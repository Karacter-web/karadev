import { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Shield, Users, Building2, ClipboardList, BookTemplate, LayoutDashboard, LogOut, ArrowLeft, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/agent", label: "Build Agent", icon: Bot },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/workspaces", label: "Workspaces", icon: Building2 },
  { to: "/admin/prompts", label: "Prompt Library", icon: BookTemplate },
  { to: "/admin/audit", label: "Audit Logs", icon: ClipboardList },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4 p-6 text-center">
        <Shield className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-display font-bold">Admin access required</h1>
        <p className="text-muted-foreground max-w-md">
          Your account does not have administrator privileges for the Karadev platform.
        </p>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="hidden md:flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="flex items-center gap-2 px-4 h-16 border-b border-sidebar-border">
          <div className="h-8 w-8 rounded-lg bg-destructive flex items-center justify-center">
            <Shield className="h-4 w-4 text-destructive-foreground" />
          </div>
          <div>
            <div className="font-display font-bold text-sidebar-primary-foreground leading-tight">Karadev</div>
            <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">Admin Panel</div>
          </div>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )
              }
            >
              <it.icon className="h-4 w-4 shrink-0" />
              <span>{it.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-2 border-t border-sidebar-border space-y-1">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> <span>Exit admin</span>
          </button>
          <button
            onClick={() => {
              signOut();
              navigate("/");
            }}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-destructive/20 hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4" /> <span>Sign out</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}