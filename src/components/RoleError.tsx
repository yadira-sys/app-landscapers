import { AlertTriangle, RefreshCw, LogOut } from "lucide-react";

interface Props {
  onRetry: () => void;
  onSignOut: () => void;
  failed?: boolean;
}

export default function RoleError({ onRetry, onSignOut, failed }: Props) {
  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{ backgroundColor: "hsl(150 25% 12%)" }}
      data-testid="role-error"
    >
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="flex justify-center">
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "hsl(38 90% 50% / 0.15)" }}
          >
            <AlertTriangle className="h-8 w-8" style={{ color: "hsl(38 90% 55%)" }} />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-xl font-light tracking-wide" style={{ color: "hsl(0 0% 95%)" }}>
            No pudimos cargar tu perfil
          </h1>
          <div className="h-px w-12 mx-auto" style={{ backgroundColor: "hsl(155 45% 45%)" }} />
          <p className="text-sm mt-3" style={{ color: "hsl(0 0% 70%)" }}>
            {failed
              ? "Hubo un problema al cargar tu cuenta. Revisa tu conexión e inténtalo de nuevo."
              : "Tu usuario no tiene un rol asignado. Pide a un administrador que lo configure, o vuelve a intentarlo."}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium tracking-wide uppercase rounded-sm transition-all"
            style={{
              backgroundColor: "hsl(155 40% 22%)",
              color: "hsl(0 0% 98%)",
              border: "1px solid hsl(155 40% 32%)",
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </button>
          <button
            onClick={onSignOut}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium tracking-wide uppercase rounded-sm transition-all"
            style={{
              backgroundColor: "transparent",
              color: "hsl(0 0% 75%)",
              border: "1px solid hsl(0 0% 30%)",
            }}
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
