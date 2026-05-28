import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import RoleError from "@/components/RoleError";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages
const Login = lazy(() => import("@/pages/Login"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Fichaje = lazy(() => import("@/pages/shared/Fichaje"));
const RegistroHoras = lazy(() => import("@/pages/shared/RegistroHoras"));
const TrabajosExtras = lazy(() => import("@/pages/shared/TrabajosExtras"));
const GestionCompras = lazy(() => import("@/pages/shared/GestionCompras"));
const GestionIncidencias = lazy(() => import("@/pages/shared/GestionIncidencias"));
const HistorialCompleto = lazy(() => import("@/pages/shared/HistorialCompleto"));
const IncidenciasJardinero = lazy(() => import("@/pages/jardinero/IncidenciasJardinero"));
const HistorialJardinero = lazy(() => import("@/pages/jardinero/HistorialJardinero"));
const ResumenEncargado = lazy(() => import("@/pages/encargado/ResumenEncargado"));
const Dashboard = lazy(() => import("@/pages/admin/Dashboard"));
const GestionJardines = lazy(() => import("@/pages/admin/GestionJardines"));
const GestionTrabajadores = lazy(() => import("@/pages/admin/GestionTrabajadores"));
const ControlHorario = lazy(() => import("@/pages/admin/ControlHorario"));
const Presupuestos = lazy(() => import("@/pages/admin/Presupuestos"));
const Tareas = lazy(() => import("@/pages/admin/Tareas"));

const PageLoader = () => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin" style={{ color: "hsl(142 55% 50%)" }} />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,   // 2 min → avoid re-fetching on every navigation
      gcTime: 10 * 60 * 1000,     // 10 min cache
      refetchOnWindowFocus: false, // manual refresh instead
      retry: 1,
    },
  },
});

function AppRoutes() {
  const { user, role, loading, roleError, retryRole, signOut } = useAuth();

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "hsl(150 25% 12%)" }}>
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: "hsl(142 55% 50%)" }} />
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  // Sesión cargada pero sin rol: fallo de carga o usuario sin rol asignado.
  // Nunca dejar un spinner sin salida — mostrar pantalla con reintentar / cerrar sesión.
  if (!role) return (
    <RoleError onRetry={retryRole} onSignOut={signOut} failed={roleError} />
  );

  const isAdmin = role === "admin" || role === "dueno";
  const isEncargado = role === "encargado";

  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Home por rol */}
          <Route path="/" element={
            isAdmin ? <Dashboard /> :
            isEncargado ? <ResumenEncargado /> :
            <Fichaje />
          } />

          {/* Fichaje (check-in/out) */}
          <Route path="/fichaje" element={<Fichaje />} />

          {/* Registro manual de horas */}
          <Route path="/horas" element={<RegistroHoras />} />

          {/* Trabajos extras */}
          <Route path="/extras" element={<TrabajosExtras />} />

          {/* Incidencias */}
          <Route path="/incidencias" element={
            isAdmin || isEncargado ? <GestionIncidencias /> : <IncidenciasJardinero />
          } />

          {/* Gastos / Compras */}
          <Route path="/gastos" element={<GestionCompras />} />
          <Route path="/compras" element={<GestionCompras />} />

          {/* Historial */}
          <Route path="/historial" element={
            isAdmin || isEncargado ? <HistorialCompleto /> : <HistorialJardinero />
          } />

          {/* Admin / Encargado */}
          <Route path="/jardines" element={
            <ProtectedRoute allowedRoles={["admin", "dueno", "encargado"]}>
              <GestionJardines />
            </ProtectedRoute>
          } />
          <Route path="/trabajadores" element={
            <ProtectedRoute allowedRoles={["admin", "dueno", "encargado"]}>
              <GestionTrabajadores />
            </ProtectedRoute>
          } />
          <Route path="/control-horario" element={
            <ProtectedRoute allowedRoles={["admin", "dueno", "encargado"]}>
              <ControlHorario />
            </ProtectedRoute>
          } />
          <Route path="/presupuestos" element={
            <ProtectedRoute allowedRoles={["admin", "dueno"]}>
              <Presupuestos />
            </ProtectedRoute>
          } />
          <Route path="/tareas" element={<Tareas />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/*" element={<AppRoutes />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
