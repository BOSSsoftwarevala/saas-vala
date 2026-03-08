import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SidebarProvider } from "@/hooks/useSidebarState";
import { Loader2 } from "lucide-react";
 import { GlobalActivityPanel } from "@/components/global/GlobalActivityPanel";
 import { WorkingDeveloperIndicator } from "@/components/global/WorkingDeveloperIndicator";

// Pages
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Marketplace from "./pages/Marketplace";
import Products from "./pages/Products";
import RoleDetail from "./pages/RoleDetail";
 import TransportRoleDetail from "./pages/TransportRoleDetail";
 import ManufacturingRoleDetail from "./pages/ManufacturingRoleDetail";
import EducationCategory from "./pages/EducationCategory";
import Keys from "./pages/Keys";
import Servers from "./pages/Servers";
import AiChat from "./pages/AiChat";
import SaasAiDashboard from "./pages/SaasAiDashboard";
import AiApis from "./pages/AiApis";
import Wallet from "./pages/Wallet";
import SeoLeads from "./pages/SeoLeads";
import Resellers from "./pages/Resellers";
import Settings from "./pages/Settings";
import AuditLogs from "./pages/AuditLogs";
import SystemHealth from "./pages/SystemHealth";
import NotFound from "./pages/NotFound";
import ResellerDashboard from "./pages/ResellerDashboard";
import Automation from "./pages/Automation";
import AddProduct from "./pages/AddProduct";
import EduPwa from "./pages/EduPwa";
import Install from "./pages/Install";
import HealthPwa from "./pages/HealthPwa";
import RealEstatePwa from "./pages/RealEstatePwa";
import EcomPwa from "./pages/EcomPwa";
import RetailPwa from "./pages/RetailPwa";
import FoodPwa from "./pages/FoodPwa";
import HospitalityPwa from "./pages/HospitalityPwa";
import TransportPwa from "./pages/TransportPwa";
import LogisticsPwa from "./pages/LogisticsPwa";
import FinancePwa from "./pages/FinancePwa";
import InvestPwa from "./pages/InvestPwa";
import ManufacturingPwa from "./pages/ManufacturingPwa";
import ConstructionPwa from "./pages/ConstructionPwa";

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

      {/* Public routes - no auth required */}
      <Route path="/" element={<Marketplace />} />
      <Route path="/marketplace" element={<Marketplace />} />
      <Route path="/edu-pwa" element={<EduPwa />} />
      <Route path="/install" element={<Install />} />
      <Route path="/health-pwa" element={<HealthPwa />} />
      <Route path="/realestate-pwa" element={<RealEstatePwa />} />
      <Route path="/ecom-pwa" element={<EcomPwa />} />
      <Route path="/retail-pwa" element={<RetailPwa />} />
      <Route path="/food-pwa" element={<FoodPwa />} />
      <Route path="/hospitality-pwa" element={<HospitalityPwa />} />
      <Route path="/transport-pwa" element={<TransportPwa />} />
      <Route path="/logistics-pwa" element={<LogisticsPwa />} />
      <Route path="/finance-pwa" element={<FinancePwa />} />
      <Route path="/invest-pwa" element={<InvestPwa />} />
      <Route path="/manufacturing-pwa" element={<ManufacturingPwa />} />
      <Route path="/construction-pwa" element={<ConstructionPwa />} />

      {/* Protected routes */}
      <Route
        path="/dashboard"
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
        path="/role-detail"
        element={
          <ProtectedRoute>
            <RoleDetail />
          </ProtectedRoute>
        }
      />
       <Route
         path="/transport-role-detail"
         element={
           <ProtectedRoute>
             <TransportRoleDetail />
           </ProtectedRoute>
         }
       />
      <Route
        path="/manufacturing-role-detail"
        element={
          <ProtectedRoute>
            <ManufacturingRoleDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/education"
        element={
          <ProtectedRoute>
            <EducationCategory />
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
        path="/settings"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <Settings />
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
        path="/system-health"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <SystemHealth />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reseller-dashboard"
        element={
          <ProtectedRoute>
            <ResellerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/automation"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <Automation />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/add-product"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AddProduct />
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
       <GlobalActivityPanel />
       <WorkingDeveloperIndicator />
      <BrowserRouter>
        <AuthProvider>
          <SidebarProvider>
            <AppRoutes />
          </SidebarProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
