import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useIsAdmin } from "@/hooks/useIsAdmin";

const Landing = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Chat = lazy(() => import("./pages/Chat"));
const Repos = lazy(() => import("./pages/Repos"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Team = lazy(() => import("./pages/Team"));
const Prompts = lazy(() => import("./pages/Prompts"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Embed = lazy(() => import("./pages/Embed"));
const DashboardLayout = lazy(() => import("./components/DashboardLayout"));
const AdminLayout = lazy(() => import("./components/AdminLayout"));
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminWorkspaces = lazy(() => import("./pages/admin/AdminWorkspaces"));
const AdminPrompts = lazy(() => import("./pages/admin/AdminPrompts"));
const AdminAudit = lazy(() => import("./pages/admin/AdminAudit"));
const AdminAgent = lazy(() => import("./pages/admin/AdminAgent"));
const AdminAuditSettings = lazy(() => import("./pages/admin/AdminAuditSettings"));
const Sandbox = lazy(() => import("./pages/admin/Sandbox"));
const GitHubRepos = lazy(() => import("./pages/admin/GitHubRepos"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return (
    <Suspense fallback={<PageLoader />}>
      <DashboardLayout>{children}</DashboardLayout>
    </Suspense>
  );
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  if (loading) return null;
  if (user) {
    if (roleLoading) return null;
    return <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />;
  }
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return (
    <Suspense fallback={<PageLoader />}>
      <AdminLayout>{children}</AdminLayout>
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary fallbackTitle="Application Error">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
                <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/embed" element={<Embed />} />

                <Route path="/dashboard" element={<ProtectedRoute><ErrorBoundary fallbackTitle="Dashboard Error"><Dashboard /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/chat" element={<ProtectedRoute><ErrorBoundary fallbackTitle="Chat Error"><Chat /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/repos" element={<ProtectedRoute><ErrorBoundary fallbackTitle="Repos Error"><Repos /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/tasks" element={<ProtectedRoute><ErrorBoundary fallbackTitle="Tasks Error"><Tasks /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/team" element={<ProtectedRoute><ErrorBoundary fallbackTitle="Team Error"><Team /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/prompts" element={<ProtectedRoute><ErrorBoundary fallbackTitle="Prompts Error"><Prompts /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/settings" element={<ProtectedRoute><ErrorBoundary fallbackTitle="Settings Error"><SettingsPage /></ErrorBoundary></ProtectedRoute>} />
                <Route path="/dashboard/audit-logs" element={<ProtectedRoute><ErrorBoundary fallbackTitle="Audit Logs Error"><AuditLogs /></ErrorBoundary></ProtectedRoute>} />

                <Route path="/admin" element={<AdminRoute><ErrorBoundary fallbackTitle="Admin Error"><AdminOverview /></ErrorBoundary></AdminRoute>} />
                <Route path="/admin/users" element={<AdminRoute><ErrorBoundary fallbackTitle="Admin Error"><AdminUsers /></ErrorBoundary></AdminRoute>} />
                <Route path="/admin/workspaces" element={<AdminRoute><ErrorBoundary fallbackTitle="Admin Error"><AdminWorkspaces /></ErrorBoundary></AdminRoute>} />
                <Route path="/admin/prompts" element={<AdminRoute><ErrorBoundary fallbackTitle="Admin Error"><AdminPrompts /></ErrorBoundary></AdminRoute>} />
                <Route path="/admin/audit" element={<AdminRoute><ErrorBoundary fallbackTitle="Admin Error"><AdminAudit /></ErrorBoundary></AdminRoute>} />
                <Route path="/admin/agent" element={<AdminRoute><ErrorBoundary fallbackTitle="Admin Error"><AdminAgent /></ErrorBoundary></AdminRoute>} />
                <Route path="/admin/settings/audit" element={<AdminRoute><ErrorBoundary fallbackTitle="Admin Error"><AdminAuditSettings /></ErrorBoundary></AdminRoute>} />
                <Route path="/admin/sandbox" element={<AdminRoute><ErrorBoundary fallbackTitle="Admin Error"><Sandbox /></ErrorBoundary></AdminRoute>} />
                <Route path="/admin/github" element={<AdminRoute><ErrorBoundary fallbackTitle="Admin Error"><GitHubRepos /></ErrorBoundary></AdminRoute>} />

                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;