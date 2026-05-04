import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import landscapersLogo from "@/assets/landscapers-logo.png";

type LoginMode = "email" | "pin";

export default function Login() {
  const { user, signIn, loading } = useAuth();
  const [mode, setMode] = useState<LoginMode>("pin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "hsl(150 25% 12%)" }}>
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: "hsl(142 55% 50%)" }} />
    </div>
  );
  if (user) return <Navigate to="/" replace />;

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const { error } = await signIn(email, password);
    if (error) setError("Email o contraseña incorrectos");
    setSubmitting(false);
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(pin)) {
      setError("El PIN debe tener 6 dígitos");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("pin-login", {
        body: { pin },
      });
      if (fnError || data?.error) {
        setError(data?.error || "PIN incorrecto");
        setSubmitting(false);
        return;
      }
      if (data?.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }
    } catch {
      setError("Error al conectar con el servidor");
    }
    setSubmitting(false);
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center p-6"
      style={{ backgroundColor: "hsl(150 25% 12%)" }}
    >
      {/* Logo */}
      <div className="mb-8 text-center">
        <img
          src={landscapersLogo}
          alt="Landscapers"
          className="h-16 w-auto mx-auto mb-4"
        />
        <h1
          className="font-display tracking-wide text-2xl font-medium"
          style={{ color: "hsl(0 0% 96%)" }}
        >
          Landscapers
        </h1>
        <div
          className="h-px w-24 mx-auto my-3"
          style={{ background: "linear-gradient(90deg, transparent, hsl(142 55% 45%), transparent)" }}
        />
        <p
          className="text-xs tracking-[0.15em] uppercase font-light"
          style={{ color: "hsl(142 55% 50%)" }}
        >
          Área de trabajo
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex w-full max-w-sm mb-6 rounded-lg overflow-hidden" style={{ border: "1px solid hsl(0 0% 20%)" }}>
        <button
          type="button"
          onClick={() => { setMode("pin"); setError(""); }}
          className="flex-1 py-2.5 text-xs tracking-[0.15em] uppercase font-medium transition-all"
          style={{
            backgroundColor: mode === "pin" ? "hsl(142 45% 30%)" : "transparent",
            color: mode === "pin" ? "hsl(0 0% 96%)" : "hsl(0 0% 45%)",
          }}
        >
          PIN
        </button>
        <button
          type="button"
          onClick={() => { setMode("email"); setError(""); }}
          className="flex-1 py-2.5 text-xs tracking-[0.15em] uppercase font-medium transition-all"
          style={{
            backgroundColor: mode === "email" ? "hsl(142 45% 30%)" : "transparent",
            color: mode === "email" ? "hsl(0 0% 96%)" : "hsl(0 0% 45%)",
          }}
        >
          Email
        </button>
      </div>

      {/* Forms */}
      <div className="w-full max-w-sm">
        {mode === "pin" ? (
          <form onSubmit={handlePinLogin} className="space-y-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="pin"
                className="text-xs tracking-widest uppercase font-medium"
                style={{ color: "hsl(0 0% 55%)" }}
              >
                Tu PIN
              </Label>
              <Input
                id="pin"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                autoComplete="off"
                className="border-0 border-b rounded-none bg-transparent text-2xl font-light tracking-[0.5em] text-center focus-visible:ring-0 focus-visible:border-b-2 px-0 h-14"
                style={{
                  color: "hsl(0 0% 90%)",
                  borderColor: "hsl(0 0% 25%)",
                }}
              />
              <p className="text-center text-xs mt-2" style={{ color: "hsl(0 0% 40%)" }}>
                Introduce tu PIN de 6 dígitos
              </p>
            </div>

            {error && (
              <p className="text-xs text-center" style={{ color: "hsl(0 72% 60%)" }}>{error}</p>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting || pin.length < 6}
                className="w-full py-3 text-xs tracking-[0.2em] uppercase font-medium rounded-lg transition-all disabled:opacity-50"
                style={{
                  backgroundColor: "hsl(142 45% 30%)",
                  color: "hsl(0 0% 96%)",
                  border: "1px solid hsl(142 40% 38%)",
                }}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : (
                  "Entrar"
                )}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleEmailLogin} className="space-y-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs tracking-widest uppercase font-medium"
                style={{ color: "hsl(0 0% 55%)" }}
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@landscapers.es"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="border-0 border-b rounded-none bg-transparent text-sm font-light focus-visible:ring-0 focus-visible:border-b-2 px-0 h-10"
                style={{
                  color: "hsl(0 0% 90%)",
                  borderColor: "hsl(0 0% 25%)",
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-xs tracking-widest uppercase font-medium"
                style={{ color: "hsl(0 0% 55%)" }}
              >
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="border-0 border-b rounded-none bg-transparent text-sm font-light focus-visible:ring-0 focus-visible:border-b-2 px-0 h-10"
                style={{
                  color: "hsl(0 0% 90%)",
                  borderColor: "hsl(0 0% 25%)",
                }}
              />
            </div>

            {error && (
              <p className="text-xs" style={{ color: "hsl(0 72% 60%)" }}>{error}</p>
            )}

            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 text-xs tracking-[0.2em] uppercase font-medium rounded-lg transition-all disabled:opacity-50"
                style={{
                  backgroundColor: "hsl(142 45% 30%)",
                  color: "hsl(0 0% 96%)",
                  border: "1px solid hsl(142 40% 38%)",
                }}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : (
                  "Acceder"
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      <p
        className="mt-12 text-xs tracking-wider"
        style={{ color: "hsl(0 0% 30%)" }}
      >
        © Landscapers — Uso interno
      </p>
    </div>
  );
}
