import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="max-w-sm w-full text-center space-y-6">
            <div className="flex justify-center">
              <div
                className="h-16 w-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "hsl(0 72% 51% / 0.1)" }}
              >
                <AlertTriangle className="h-8 w-8" style={{ color: "hsl(0 72% 51%)" }} />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="font-display text-xl font-light tracking-wide">
                Algo ha ido mal
              </h1>
              <div className="h-px w-12 mx-auto" style={{ backgroundColor: "hsl(155 45% 45%)" }} />
              <p className="text-sm text-muted-foreground mt-3">
                La aplicación ha encontrado un error inesperado.
              </p>
              {this.state.error?.message && (
                <p
                  className="text-xs font-mono px-3 py-2 rounded-sm mt-2"
                  style={{
                    backgroundColor: "hsl(0 72% 51% / 0.05)",
                    color: "hsl(0 72% 40%)",
                    border: "1px solid hsl(0 72% 51% / 0.2)",
                  }}
                >
                  {this.state.error.message}
                </p>
              )}
            </div>

            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium tracking-wide uppercase rounded-sm transition-all"
              style={{
                backgroundColor: "hsl(155 40% 20%)",
                color: "hsl(0 0% 98%)",
                border: "1px solid hsl(155 40% 30%)",
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Reiniciar aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
