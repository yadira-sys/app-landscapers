-- ============================================================
-- 20260428 SECURITY HARDENING
-- ============================================================
-- THIS MIGRATION IS DESTRUCTIVE TO THE PUBLIC API SURFACE:
--   * Profiles are no longer world-readable
--   * Storage buckets become private (signed URLs required)
--   * user_roles cannot be self-inserted (manage-worker required)
--   * PIN login requires 6 digits and bcrypt-hashed pin_hash column
-- BEFORE DEPLOY: stage in a non-prod project, smoke-test PIN login
-- (legacy plaintext fallback is built into pin-login for transition).
-- ============================================================

-- ------------------------------------------------------------
-- 1. profiles.pin_hash column (bcrypt hashed PIN storage)
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pin_hash text;

COMMENT ON COLUMN public.profiles.pin_hash IS
  'bcrypt hash of the user PIN. Replaces plaintext profiles.pin. '
  'POST-DEPLOY ACTION: Once all active users have logged in once via the legacy fallback, '
  'rotate any PINs that were exposed while the world-readable profiles_select policy was active, '
  'and run: UPDATE public.profiles SET pin = NULL WHERE pin IS NOT NULL;';

-- ------------------------------------------------------------
-- 2. is_staff() helper - SECURITY DEFINER
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'dueno')
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated, anon;

COMMENT ON FUNCTION public.is_staff() IS
  'Returns true if the current auth.uid() has admin or dueno role. '
  'Use in RLS policies to gate staff-only access.';

-- ------------------------------------------------------------
-- 3. Lock down user_roles INSERT
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
CREATE POLICY "user_roles_insert_admin_only"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (false);

-- ------------------------------------------------------------
-- 4. user_roles UPDATE / DELETE locked to service-role only
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "user_roles_update" ON public.user_roles;
CREATE POLICY "user_roles_update_admin_only"
  ON public.user_roles
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles;
CREATE POLICY "user_roles_delete_admin_only"
  ON public.user_roles
  FOR DELETE
  USING (false);

-- ------------------------------------------------------------
-- 5. profiles SELECT - self or staff only
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select_self_or_staff"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id OR public.is_staff());

COMMENT ON POLICY "profiles_select_self_or_staff" ON public.profiles IS
  'Replaces the dangerous USING (true) policy that exposed every PIN/email. '
  'POST-DEPLOY: rotate any PINs that may have been exposed while the old policy was live.';

-- ------------------------------------------------------------
-- 6. presupuestos and tareas (idempotent - tables may exist in prod)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.presupuestos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  cliente     text,
  estado      text NOT NULL DEFAULT 'Pendiente de enviar',
  fecha_envio date,
  importe     numeric(10, 2),
  notas       text,
  notion_url  text,
  imagenes    jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.presupuestos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presupuestos_select_staff" ON public.presupuestos;
CREATE POLICY "presupuestos_select_staff" ON public.presupuestos
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "presupuestos_insert_staff" ON public.presupuestos;
CREATE POLICY "presupuestos_insert_staff" ON public.presupuestos
  FOR INSERT WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "presupuestos_update_staff" ON public.presupuestos;
CREATE POLICY "presupuestos_update_staff" ON public.presupuestos
  FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "presupuestos_delete_staff" ON public.presupuestos;
CREATE POLICY "presupuestos_delete_staff" ON public.presupuestos
  FOR DELETE USING (public.is_staff());

CREATE TABLE IF NOT EXISTS public.tareas (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       text NOT NULL,
  estado       text NOT NULL DEFAULT 'pendiente',
  prioridad    text,
  fecha_limite date,
  asignado_a   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  notas        text,
  notion_url   text,
  cliente      text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tareas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tareas_select_assignee_or_staff" ON public.tareas;
CREATE POLICY "tareas_select_assignee_or_staff" ON public.tareas
  FOR SELECT USING (asignado_a = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "tareas_insert_staff" ON public.tareas;
CREATE POLICY "tareas_insert_staff" ON public.tareas
  FOR INSERT WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "tareas_update_staff_or_assignee" ON public.tareas;
CREATE POLICY "tareas_update_staff_or_assignee" ON public.tareas
  FOR UPDATE
  USING (public.is_staff() OR asignado_a = auth.uid())
  WITH CHECK (public.is_staff() OR asignado_a = auth.uid());

DROP POLICY IF EXISTS "tareas_delete_staff" ON public.tareas;
CREATE POLICY "tareas_delete_staff" ON public.tareas
  FOR DELETE USING (public.is_staff());

-- ------------------------------------------------------------
-- 7. Make app storage buckets PRIVATE
-- ------------------------------------------------------------
UPDATE storage.buckets
   SET public = false
 WHERE id IN ('presupuestos', 'extras-fotos', 'compras-fotos', 'incidencias-fotos');

-- ------------------------------------------------------------
-- 8. Storage object SELECT - authenticated only, scoped to app buckets
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "storage_public_read" ON storage.objects;
DROP POLICY IF EXISTS "storage_authenticated_read_app_buckets" ON storage.objects;
CREATE POLICY "storage_authenticated_read_app_buckets"
  ON storage.objects
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND bucket_id IN ('extras-fotos', 'compras-fotos', 'incidencias-fotos', 'presupuestos')
  );

-- ------------------------------------------------------------
-- 9. auth_attempts audit table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.auth_attempts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip         text,
  user_id    uuid,
  success    boolean,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_attempts_created_at_idx
  ON public.auth_attempts (created_at DESC);

ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_attempts_no_select" ON public.auth_attempts;
CREATE POLICY "auth_attempts_no_select" ON public.auth_attempts
  FOR SELECT USING (false);
DROP POLICY IF EXISTS "auth_attempts_no_insert" ON public.auth_attempts;
CREATE POLICY "auth_attempts_no_insert" ON public.auth_attempts
  FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS "auth_attempts_no_update" ON public.auth_attempts;
CREATE POLICY "auth_attempts_no_update" ON public.auth_attempts
  FOR UPDATE USING (false);
DROP POLICY IF EXISTS "auth_attempts_no_delete" ON public.auth_attempts;
CREATE POLICY "auth_attempts_no_delete" ON public.auth_attempts
  FOR DELETE USING (false);

-- ------------------------------------------------------------
-- 10. pin_login_attempts rate-limit table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pin_login_attempts (
  ip            text NOT NULL,
  attempted_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pin_login_attempts_ip_time_idx
  ON public.pin_login_attempts (ip, attempted_at DESC);

ALTER TABLE public.pin_login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pin_login_attempts_no_select" ON public.pin_login_attempts;
CREATE POLICY "pin_login_attempts_no_select" ON public.pin_login_attempts
  FOR SELECT USING (false);
DROP POLICY IF EXISTS "pin_login_attempts_no_insert" ON public.pin_login_attempts;
CREATE POLICY "pin_login_attempts_no_insert" ON public.pin_login_attempts
  FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS "pin_login_attempts_no_update" ON public.pin_login_attempts;
CREATE POLICY "pin_login_attempts_no_update" ON public.pin_login_attempts
  FOR UPDATE USING (false);
DROP POLICY IF EXISTS "pin_login_attempts_no_delete" ON public.pin_login_attempts;
CREATE POLICY "pin_login_attempts_no_delete" ON public.pin_login_attempts
  FOR DELETE USING (false);

COMMENT ON TABLE public.pin_login_attempts IS
  'Per-IP PIN login attempt counter for rate limiting (10 / 15min). '
  'SHOULD BE PRUNED DAILY by a cron job, e.g. '
  'DELETE FROM public.pin_login_attempts WHERE attempted_at < now() - interval ''24 hours'';';

-- ------------------------------------------------------------
-- 11. role_change_log
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_change_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        uuid,
  target_user_id  uuid,
  from_role       text,
  to_role         text,
  changed_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS role_change_log_target_idx
  ON public.role_change_log (target_user_id, changed_at DESC);

ALTER TABLE public.role_change_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_change_log_select_staff" ON public.role_change_log;
CREATE POLICY "role_change_log_select_staff" ON public.role_change_log
  FOR SELECT USING (public.is_staff());
DROP POLICY IF EXISTS "role_change_log_no_insert" ON public.role_change_log;
CREATE POLICY "role_change_log_no_insert" ON public.role_change_log
  FOR INSERT WITH CHECK (false);
DROP POLICY IF EXISTS "role_change_log_no_update" ON public.role_change_log;
CREATE POLICY "role_change_log_no_update" ON public.role_change_log
  FOR UPDATE USING (false);
DROP POLICY IF EXISTS "role_change_log_no_delete" ON public.role_change_log;
CREATE POLICY "role_change_log_no_delete" ON public.role_change_log
  FOR DELETE USING (false);

-- ============================================================
-- 12. REQUIRED MANUAL POST-DEPLOY STEPS
-- ============================================================
-- 1. ROTATE PINS that were exposed while the world-readable
--    profiles_select policy was active. After every active user
--    has logged in once (which migrates them to pin_hash), force
--    a PIN reset for any account whose plaintext PIN may have
--    leaked. Then run:
--        UPDATE public.profiles SET pin = NULL WHERE pin IS NOT NULL;
--
-- 2. VERIFY presupuestos and tareas data integrity. The CREATE
--    TABLE IF NOT EXISTS clauses are safe (will not drop or
--    overwrite production rows), but staff should confirm row
--    counts match expectations after this migration is applied.
--
-- 3. UPDATE PHOTO URL GENERATION in app code. The buckets
--    presupuestos, extras-fotos, compras-fotos, incidencias-fotos
--    are now PRIVATE. Any code that built public URLs via
--    supabase.storage.from(bucket).getPublicUrl(path) must switch
--    to signed URLs:
--        supabase.storage.from(bucket).createSignedUrl(path, 3600);
--    Existing public URLs persisted in the database will return 400.
--
-- 4. SCHEDULE pin_login_attempts CLEANUP. Add a daily pg_cron job:
--        SELECT cron.schedule(
--          'pin-login-attempts-cleanup', '0 3 * * *',
--          $$DELETE FROM public.pin_login_attempts
--            WHERE attempted_at < now() - interval '24 hours'$$
--        );
--
-- 5. VERIFY run-migration edge function returns 410. Re-deploy
--    the function via `supabase functions deploy run-migration`
--    so the lockout takes effect.
-- ============================================================
