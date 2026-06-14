import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Landing from "./pages/Index"; // Named Landing here
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback"; // Your new callback handler
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import Repos from "./pages/Repos";
import Tasks from "./pages/Tasks";
import Team from "./pages/Team";
import Prompts from "./pages/Prompts";
import SettingsPage from "./pages/SettingsPage";
import DashboardLayout from "./components/DashboardLayout";
import NotFound from "./pages/NotFound";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import AuditLogs from "./pages/AuditLogs";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <DashboardLayout>{children}</DashboardLayout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary fallbackTitle="Application Error">
            <Routes>
              {/* FIXED: Using Landing component to match your import definition */}
              <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
              <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              
              {/* Dashboard Layout Views */}
              <Route path="/dashboard" element={<ProtectedRoute><ErrorBoundary fallbackTitle="Dashboard Error"><Dashboard /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/dashboard/chat" element={<ProtectedRoute><ErrorBoundary fallbackTitle="Chat Error"><Chat /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/dashboard/repos" element={<ProtectedRoute><ErrorBoundary fallbackTitle="Repos Error"><Repos /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/dashboard/tasks" element={<ProtectedRoute><ErrorBoundary fallbackTitle="Tasks Error"><Tasks /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/dashboard/team" element={<ProtectedRoute><ErrorBoundary fallbackTitle="Team Error"><Team /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/dashboard/prompts" element={<ProtectedRoute><ErrorBoundary fallbackTitle="Prompts Error"><Prompts /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/dashboard/settings" element={<ProtectedRoute><ErrorBoundary fallbackTitle="Settings Error"><SettingsPage /></ErrorBoundary></ProtectedRoute>} />
              <Route path="/dashboard/audit-logs" element={<ProtectedRoute><ErrorBoundary fallbackTitle="Audit Logs Error"><AuditLogs /></ErrorBoundary></ProtectedRoute>} />
              
              {/* Legal & Missing Links */}
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
