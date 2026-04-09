import { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Home, Clock, AlertTriangle, ShoppingCart, Users, BarChart3, LogOut, TreePine, MapPin, Wrench, ClipboardList, CalendarDays
} from "lucide-react";
import { useIncidenciasAlerta } from "@/hooks/useIncidenciasAlerta";
import { usePendientesAlerta } from "@/hooks/usePendientesAlerta";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
}

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, role, signOut, isAdmin, isEncargado } = useAuth();
  const navigate = useNavigate();
  const alertaIncidencias = useIncidenciasAlerta();
  const pendientesCount = usePendientesAlerta();

  const trabajadorNav: NavItem[] = [
    { to: "/", label: "Fichar", icon: MapPin },
    { to: "/horas", label: "Horas", icon: Clock },
    { to: "/incidencias", label: "Incidencias", icon: AlertTriangle },
    { to: "/gastos", label: "Gastos", icon: ShoppingCart },
    { to: "/historial", label: "Historial", icon: ClipboardList },
  ];

  const encargadoNav: NavItem[] = [
    { to: "/", label: "Resumen", icon: Home },
    { to: "/fichaje", label: "Fichar", icon: MapPin },
    { to: "/control-horario", label: "Control", icon: CalendarDays },
    { to: "/horas", label: "Horas", icon: Clock },
    { to: "/incidencias", label: "Incidencias", icon: AlertTriangle },
    { to: "/gastos", label: "Gastos", icon: ShoppingCart },
  ];

  const adminNav: NavItem[] = [
    { to: "/", label: "Dashboard", icon: BarChart3 },
    { to: "/control-horario", label: "Control", icon: CalendarDays },
    { to: "/horas", label: "Horas", icon: Clock },
    { to: "/extras", label: "Extras", icon: Wrench },
    { to: "/incidencias", label: "Incidencias", icon: AlertTriangle },
    { to: "/gastos", label: "Gastos", icon: ShoppingCart },
    { to: "/jardines", label: "Jardines", icon: TreePine },
    { to: "/trabajadores", label: "Equipo", icon: Users },
    { to: "/exportar", label: "Holded", icon: Upload },
  ];

  const navItems = isAdmin ? adminNav : isEncargado ? encargadoNav : trabajadorNav;

  const roleLabel: Record<string, string> = {
    dueno: "Dueño",
    admin: "Admin",
    encargado: "Encargado",
    jardinero: "Trabajador",
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40" style={{ backgroundColor: "hsl(var(--header-bg))", paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex flex-col">
              <span className="font-display tracking-wide text-base leading-none font-medium" style={{ color: "hsl(var(--header-fg))" }}>
                Vitalia Garden
              </span>
              <span className="text-[10px] tracking-[0.12em] uppercase mt-0.5" style={{ color: "hsl(142 55% 50%)" }}>
                {role ? roleLabel[role] : ""}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-light" style={{ color: "hsl(var(--header-fg) / 0.7)" }}>
              {profile?.full_name?.split(" ")[0] || ""}
            </span>
            <button onClick={handleSignOut} className="p-2 rounded-full transition-colors" style={{ color: "hsl(var(--header-fg) / 0.6)" }} title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, hsl(142 55% 42%), transparent)" }} />
      </header>

      {/* Main content */}
      <main className="flex-1" style={{ paddingBottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" }}>{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t" style={{ backgroundColor: "hsl(var(--nav-bg))", borderColor: "hsl(150 15% 18%)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, hsl(142 55% 42%), transparent)" }} />
        <div className="flex items-center py-1.5 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: "touch" }}>
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === "/"} className="flex-none" style={{ minWidth: navItems.length > 6 ? "4rem" : undefined, flex: navItems.length <= 6 ? "1" : undefined }}>
              {({ isActive }) => (
                <div className="flex flex-col items-center gap-0.5 py-1 px-1.5 transition-all active:scale-95">
                  <div className="relative">
                    <item.icon className="h-5 w-5 transition-colors shrink-0" style={{ color: isActive ? "hsl(var(--nav-active))" : "hsl(var(--nav-fg))" }} />
                    {item.to === "/incidencias" && alertaIncidencias > 0 && (
                      <span
                        className="absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white px-1"
                        style={{ backgroundColor: "hsl(0 72% 50%)" }}
                      >
                        {alertaIncidencias > 9 ? "9+" : alertaIncidencias}
                      </span>
                    )}
                    {item.to === "/horas" && pendientesCount > 0 && (
                      <span
                        className="absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center rounded-full text-[9px] font-bold text-white px-1"
                        style={{ backgroundColor: "hsl(38 90% 45%)" }}
                      >
                        {pendientesCount > 9 ? "9+" : pendientesCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] font-medium tracking-wide uppercase truncate w-full text-center" style={{ color: isActive ? "hsl(var(--nav-active))" : "hsl(var(--nav-fg))" }}>
                    {item.label}
                  </span>
                  {isActive && <div className="h-0.5 w-4 rounded-full" style={{ backgroundColor: "hsl(var(--nav-active))" }} />}
                </div>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
