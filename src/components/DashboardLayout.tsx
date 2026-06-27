import { ReactNode, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Bot, MessageSquare, GitBranch, CheckSquare, BookTemplate,
  Settings, LogOut, ChevronLeft, ChevronRight, Users, LayoutDashboard,
  Menu, X, ClipboardList, Shield,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: MessageSquare, label: "AI Chat", path: "/dashboard/chat" },
  { icon: GitBranch, label: "Repositories", path: "/dashboard/repos" },
  { icon: CheckSquare, label: "Tasks", path: "/dashboard/tasks" },
  { icon: BookTemplate, label: "Prompts", path: "/dashboard/prompts" },
  { icon: Users, label: "Team", path: "/dashboard/team" },
  { icon: ClipboardList, label: "Audit Logs", path: "/dashboard/audit-logs" },
  { icon: Settings, label: "Settings", path: "/dashboard/settings" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const handleNav = (path: string) => {
    navigate(path);
    if (isMobile) setMobileOpen(false);
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-14 sm:h-16 border-b border-sidebar-border shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
            <Bot className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          {(!collapsed || isMobile) && <span className="font-display font-bold text-sidebar-primary-foreground">Karadev</span>}
        </div>
        {isMobile && (
          <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="text-sidebar-foreground/70 p-1">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => handleNav(item.path)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {(!collapsed || isMobile) && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-sidebar-border space-y-1 shrink-0">
        {isAdmin && (
          <button
            onClick={() => handleNav("/admin")}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-sidebar-foreground/90 bg-destructive/10 hover:bg-destructive/20 hover:text-destructive transition-colors"
          >
            <Shield className="h-4 w-4 shrink-0" />
            {(!collapsed || isMobile) && <span>Admin Panel</span>}
          </button>
        )}
        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /><span>Collapse</span></>}
          </button>
        )}
        <button
          onClick={() => { signOut(); navigate("/"); }}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:bg-destructive/20 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {(!collapsed || isMobile) && <span>Sign Out</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile top bar */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-40 h-14 bg-sidebar text-sidebar-foreground border-b border-sidebar-border flex items-center px-4 gap-3">
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="p-1">
            <Menu className="h-5 w-5" />
          </button>
          <div className="h-7 w-7 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Bot className="h-3.5 w-3.5 text-sidebar-primary-foreground" />
          </div>
          <span className="font-display font-bold text-sidebar-primary-foreground text-sm">Karadev</span>
        </div>
      )}

      {/* Mobile overlay sidebar */}
      {isMobile && mobileOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 z-50 w-64 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Desktop sidebar */}
      {!isMobile && (
        <aside className={cn(
          "flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 shrink-0",
          collapsed ? "w-16" : "w-60"
        )}>
          {sidebarContent}
        </aside>
      )}

      {/* Main content */}
      <main className={cn("flex-1 overflow-y-auto", isMobile && "pt-14")}>
        {children}
      </main>
    </div>
  );
}
