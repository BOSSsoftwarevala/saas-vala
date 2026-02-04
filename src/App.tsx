import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

// Pages
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Keys from "./pages/Keys";
import Servers from "./pages/Servers";
import ServerSetup from "./pages/ServerSetup";
import DomainOperations from "./pages/DomainOperations";
import SecurityLogs from "./pages/SecurityLogs";
import AiChat from "./pages/AiChat";
import SaasAiDashboard from "./pages/SaasAiDashboard";
import SaasAiSystem from "./pages/SaasAiSystem";
import AiApis from "./pages/AiApis";
import Wallet from "./pages/Wallet";
import SeoLeads from "./pages/SeoLeads";
import Resellers from "./pages/Resellers";
import AuditLogs from "./pages/AuditLogs";
import Settings from "./pages/Settings";
import Support from "./pages/Support";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

// Admin only route wrapper
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Auth route */}
      <Route path="/auth" element={<Auth />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products"
        element={
          <ProtectedRoute>
            <Products />
          </ProtectedRoute>
        }
      />
      <Route
        path="/keys"
        element={
          <ProtectedRoute>
            <Keys />
          </ProtectedRoute>
        }
      />
      <Route
        path="/servers"
        element={
          <ProtectedRoute>
            <Servers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/server-setup"
        element={
          <ProtectedRoute>
            <ServerSetup />
          </ProtectedRoute>
        }
      />
      <Route
        path="/domain-operations"
        element={
          <ProtectedRoute>
            <DomainOperations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/security-logs"
        element={
          <ProtectedRoute>
            <SecurityLogs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-chat"
        element={
          <ProtectedRoute>
            <AiChat />
          </ProtectedRoute>
        }
      />
      <Route
        path="/saas-ai-dashboard"
        element={
          <ProtectedRoute>
            <SaasAiDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/saas-ai-system"
        element={
          <ProtectedRoute>
            <SaasAiSystem />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-apis"
        element={
          <ProtectedRoute>
            <AiApis />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wallet"
        element={
          <ProtectedRoute>
            <Wallet />
          </ProtectedRoute>
        }
      />
      <Route
        path="/seo-leads"
        element={
          <ProtectedRoute>
            <SeoLeads />
          </ProtectedRoute>
        }
      />
      <Route
        path="/support"
        element={
          <ProtectedRoute>
            <Support />
          </ProtectedRoute>
        }
      />
      <Route
        path="/resellers"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <Resellers />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit-logs"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AuditLogs />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <Settings />
            </AdminRoute>
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
