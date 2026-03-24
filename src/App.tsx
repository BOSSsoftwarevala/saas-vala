import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SidebarProvider } from "@/hooks/useSidebarState";
import { CartProvider } from "@/hooks/useCart";
import { Loader2 } from "lucide-react";
import React, { Suspense } from "react";

// Only eagerly load the landing page (Marketplace) and Auth
import Marketplace from "./pages/Marketplace";
import Auth from "./pages/Auth";

// Lazy load everything else
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Products = React.lazy(() => import("./pages/Products"));
const RoleDetail = React.lazy(() => import("./pages/RoleDetail"));
const TransportRoleDetail = React.lazy(() => import("./pages/TransportRoleDetail"));
const ManufacturingRoleDetail = React.lazy(() => import("./pages/ManufacturingRoleDetail"));
const EducationCategory = React.lazy(() => import("./pages/EducationCategory"));
const Keys = React.lazy(() => import("./pages/Keys"));
const Servers = React.lazy(() => import("./pages/Servers"));
const AiChat = React.lazy(() => import("./pages/AiChat"));
const ValaBuilder = React.lazy(() => import("./pages/ValaBuilder"));
const SaasAiDashboard = React.lazy(() => import("./pages/SaasAiDashboard"));
const AiApis = React.lazy(() => import("./pages/AiApis"));
const Wallet = React.lazy(() => import("./pages/Wallet"));
const SeoLeads = React.lazy(() => import("./pages/SeoLeads"));
const Resellers = React.lazy(() => import("./pages/Resellers"));
const Settings = React.lazy(() => import("./pages/Settings"));
const AuditLogs = React.lazy(() => import("./pages/AuditLogs"));
const SystemHealth = React.lazy(() => import("./pages/SystemHealth"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const ResellerDashboard = React.lazy(() => import("./pages/ResellerDashboard"));
const Automation = React.lazy(() => import("./pages/Automation"));
const AddProduct = React.lazy(() => import("./pages/AddProduct"));
const EduPwa = React.lazy(() => import("./pages/EduPwa"));
const Install = React.lazy(() => import("./pages/Install"));
const HealthPwa = React.lazy(() => import("./pages/HealthPwa"));
const RealEstatePwa = React.lazy(() => import("./pages/RealEstatePwa"));
const EcomPwa = React.lazy(() => import("./pages/EcomPwa"));
const RetailPwa = React.lazy(() => import("./pages/RetailPwa"));
const FoodPwa = React.lazy(() => import("./pages/FoodPwa"));
const HospitalityPwa = React.lazy(() => import("./pages/HospitalityPwa"));
const TransportPwa = React.lazy(() => import("./pages/TransportPwa"));
const LogisticsPwa = React.lazy(() => import("./pages/LogisticsPwa"));
const FinancePwa = React.lazy(() => import("./pages/FinancePwa"));
const MediaPwa = React.lazy(() => import("./pages/MediaPwa"));
const SocialPwa = React.lazy(() => import("./pages/SocialPwa"));
const AiToolsPwa = React.lazy(() => import("./pages/AiToolsPwa"));
const DevToolsPwa = React.lazy(() => import("./pages/DevToolsPwa"));
const ProductivityPwa = React.lazy(() => import("./pages/ProductivityPwa"));
const CyberSecurityPwa = React.lazy(() => import("./pages/CyberSecurityPwa"));
const InvestPwa = React.lazy(() => import("./pages/InvestPwa"));
const ManufacturingPwa = React.lazy(() => import("./pages/ManufacturingPwa"));
const ConstructionPwa = React.lazy(() => import("./pages/ConstructionPwa"));
const AutomotivePwa = React.lazy(() => import("./pages/AutomotivePwa"));
const AgriculturePwa = React.lazy(() => import("./pages/AgriculturePwa"));
const EnergyPwa = React.lazy(() => import("./pages/EnergyPwa"));
const TelecomPwa = React.lazy(() => import("./pages/TelecomPwa"));
const ItSoftwarePwa = React.lazy(() => import("./pages/ItSoftwarePwa"));
const CloudDevopsPwa = React.lazy(() => import("./pages/CloudDevopsPwa"));
const AnalyticsPwa = React.lazy(() => import("./pages/AnalyticsPwa"));
const Cart = React.lazy(() => import("./pages/Cart"));
const ApkPipeline = React.lazy(() => import("./pages/ApkPipeline"));
const OfflineAppTemplate = React.lazy(() => import("./pages/OfflineAppTemplate"));
const MarketplaceAdmin = React.lazy(() => import("./pages/MarketplaceAdmin"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!isSuperAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<Marketplace />} />
        <Route path="/marketplace" element={<Marketplace />} />

        {/* Public lazy routes */}
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
        <Route path="/media-pwa" element={<MediaPwa />} />
        <Route path="/social-pwa" element={<SocialPwa />} />
        <Route path="/ai-tools-pwa" element={<AiToolsPwa />} />
        <Route path="/devtools-pwa" element={<DevToolsPwa />} />
        <Route path="/productivity-pwa" element={<ProductivityPwa />} />
        <Route path="/cybersecurity-pwa" element={<CyberSecurityPwa />} />
        <Route path="/invest-pwa" element={<InvestPwa />} />
        <Route path="/manufacturing-pwa" element={<ManufacturingPwa />} />
        <Route path="/construction-pwa" element={<ConstructionPwa />} />
        <Route path="/automotive-pwa" element={<AutomotivePwa />} />
        <Route path="/agriculture-pwa" element={<AgriculturePwa />} />
        <Route path="/energy-pwa" element={<EnergyPwa />} />
        <Route path="/telecom-pwa" element={<TelecomPwa />} />
        <Route path="/it-software-pwa" element={<ItSoftwarePwa />} />
        <Route path="/cloud-devops-pwa" element={<CloudDevopsPwa />} />
        <Route path="/analytics-pwa" element={<AnalyticsPwa />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/offline-app" element={<OfflineAppTemplate />} />

        {/* Protected routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
        <Route path="/keys" element={<ProtectedRoute><Keys /></ProtectedRoute>} />
        <Route path="/servers" element={<ProtectedRoute><Servers /></ProtectedRoute>} />
        <Route path="/role-detail" element={<ProtectedRoute><RoleDetail /></ProtectedRoute>} />
        <Route path="/transport-role-detail" element={<ProtectedRoute><TransportRoleDetail /></ProtectedRoute>} />
        <Route path="/manufacturing-role-detail" element={<ProtectedRoute><ManufacturingRoleDetail /></ProtectedRoute>} />
        <Route path="/education" element={<ProtectedRoute><EducationCategory /></ProtectedRoute>} />
        <Route path="/vala-builder" element={<ProtectedRoute><ValaBuilder /></ProtectedRoute>} />
        <Route path="/ai-chat" element={<ProtectedRoute><AiChat /></ProtectedRoute>} />
        <Route path="/saas-ai-dashboard" element={<ProtectedRoute><SaasAiDashboard /></ProtectedRoute>} />
        <Route path="/ai-apis" element={<ProtectedRoute><AiApis /></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
        <Route path="/seo-leads" element={<ProtectedRoute><SeoLeads /></ProtectedRoute>} />
        <Route path="/reseller-dashboard" element={<ProtectedRoute><ResellerDashboard /></ProtectedRoute>} />

        {/* Admin routes */}
        <Route path="/reseller-manager" element={<ProtectedRoute><AdminRoute><Resellers /></AdminRoute></ProtectedRoute>} />
        <Route path="/resellers" element={<ProtectedRoute><AdminRoute><Resellers /></AdminRoute></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><AdminRoute><Settings /></AdminRoute></ProtectedRoute>} />
        <Route path="/audit-logs" element={<ProtectedRoute><AdminRoute><AuditLogs /></AdminRoute></ProtectedRoute>} />
        <Route path="/system-health" element={<ProtectedRoute><AdminRoute><SystemHealth /></AdminRoute></ProtectedRoute>} />
        <Route path="/automation" element={<ProtectedRoute><AdminRoute><Automation /></AdminRoute></ProtectedRoute>} />
        <Route path="/apk-pipeline" element={<ProtectedRoute><AdminRoute><ApkPipeline /></AdminRoute></ProtectedRoute>} />
        <Route path="/admin/add-product" element={<ProtectedRoute><AdminRoute><AddProduct /></AdminRoute></ProtectedRoute>} />
        <Route path="/admin/marketplace" element={<ProtectedRoute><AdminRoute><MarketplaceAdmin /></AdminRoute></ProtectedRoute>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
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
          <CartProvider>
            <SidebarProvider>
              <AppRoutes />
            </SidebarProvider>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
