import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  onRetry: () => void;
  message?: string;
}

export default function QueryError({ onRetry, message }: Props) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-5 space-y-4" data-testid="query-error">
      <div
        className="h-12 w-12 rounded-full flex items-center justify-center"
        style={{ backgroundColor: "hsl(0 72% 51% / 0.1)" }}
      >
        <AlertTriangle className="h-6 w-6" style={{ color: "hsl(0 72% 51%)" }} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium" style={{ color: "hsl(30 5% 30%)" }}>
          No se pudieron cargar los datos
        </p>
        <p className="text-xs text-muted-foreground">
          {message ?? "Revisa tu conexión e inténtalo de nuevo."}
        </p>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium tracking-wide uppercase rounded-sm transition-all"
        style={{
          backgroundColor: "hsl(155 40% 20%)",
          color: "hsl(0 0% 98%)",
          border: "1px solid hsl(155 40% 30%)",
        }}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Reintentar
      </button>
    </div>
  );
}
