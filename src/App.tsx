import React from 'react';
// Global error boundary for critical failures
class GlobalErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error('Global error boundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return <div style={{padding: 32, color: 'red', fontWeight: 'bold'}}>Critical error: {String(this.state.error)}<br/>Check your environment variables and API connectivity.<br/>See console for details.</div>;
    }
    return this.props.children;
  }
}
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { CartProvider } from '@/hooks/useCart';
import { applySaasValaBranding, DEMO_PUBLIC_HOST } from '@/lib/demoMasking';
import { Loader2 } from 'lucide-react';
import React, { Suspense, useEffect } from 'react';


import Auth from "./pages/Auth";
import Marketplace from "./pages/Marketplace";
import DemoPage from "./pages/DemoPage";
import ProductDetail from "./pages/ProductDetail";
import Favorites from "./pages/Favorites";
import Orders from "./pages/Orders";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import RoleDetail from "./pages/RoleDetail";
import TransportRoleDetail from "./pages/TransportRoleDetail";
import ManufacturingRoleDetail from "./pages/ManufacturingRoleDetail";
import EducationCategory from "./pages/EducationCategory";
import Keys from "./pages/Keys";
import Servers from "./pages/Servers";
import AiChat from "./pages/AiChat";
import ValaBuilder from "./pages/ValaBuilder";
import SaasAiDashboard from "./pages/SaasAiDashboard";
import AiApis from "./pages/AiApis";
import Wallet from "./pages/Wallet";
import SeoLeads from "./pages/SeoLeads";
import Resellers from "./pages/Resellers";
import Settings from "./pages/Settings";
import AuditLogs from "./pages/AuditLogs";
import SystemHealth from "./pages/SystemHealth";
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
import MediaPwa from "./pages/MediaPwa";
import SocialPwa from "./pages/SocialPwa";
import AiToolsPwa from "./pages/AiToolsPwa";
import DevToolsPwa from "./pages/DevToolsPwa";
import ProductivityPwa from "./pages/ProductivityPwa";
import CyberSecurityPwa from "./pages/CyberSecurityPwa";
import InvestPwa from "./pages/InvestPwa";
import ManufacturingPwa from "./pages/ManufacturingPwa";
import ConstructionPwa from "./pages/ConstructionPwa";
import AutomotivePwa from "./pages/AutomotivePwa";
import AgriculturePwa from "./pages/AgriculturePwa";
import EnergyPwa from "./pages/EnergyPwa";
import TelecomPwa from "./pages/TelecomPwa";
import ItSoftwarePwa from "./pages/ItSoftwarePwa";
import CloudDevopsPwa from "./pages/CloudDevopsPwa";
import AnalyticsPwa from "./pages/AnalyticsPwa";
import Cart from "./pages/Cart";
import ApkPipeline from "./pages/ApkPipeline";
import OfflineAppTemplate from "./pages/OfflineAppTemplate";
import MarketplaceAdmin from "./pages/MarketplaceAdmin";
import Support from "./pages/Support";
import ProtectedShellProviders from './components/layout/ProtectedShellProviders';

function preloadCriticalRoutes() {
  return Promise.allSettled([
    import('./pages/Marketplace'),
    import('./pages/ProductDetail'),
    import('./pages/Favorites'),
    import('./pages/Orders'),
    import('./pages/Dashboard'),
    import('./pages/Support'),
  ]);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: {
      retry: 1,
    },
  },
});

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
  return (
    <Suspense fallback={<PageLoader />}>
      <ProtectedShellProviders>{children}</ProtectedShellProviders>
    </Suspense>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isReseller, homePath, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!isAdmin) return <Navigate to={isReseller ? '/reseller/dashboard' : homePath} replace />;
  return <>{children}</>;
}

function FallbackRedirect() {
  const { user, homePath, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return <Navigate to={homePath} replace />;
}

function DemoHostRoute() {
  if (typeof window === 'undefined') return <PageLoader />;
  if (window.location.hostname.toLowerCase() !== DEMO_PUBLIC_HOST.toLowerCase()) {
    return <Navigate to="/" replace />;
  }
  return <DemoPage />;
}

function AppRoutes() {
  useEffect(() => {
    applySaasValaBranding();
  }, []);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<Marketplace />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/marketplace/product/:id" element={<ProductDetail />} />
        <Route path="/demo/:slug" element={<DemoPage />} />
        <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />

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
        <Route path="/dashboard" element={<ProtectedRoute><AdminRoute><Dashboard /></AdminRoute></ProtectedRoute>} />
        
        {/* Products module */}
        <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
        <Route path="/products/list" element={<ProtectedRoute><Products /></ProtectedRoute>} />
        <Route path="/products/create" element={<ProtectedRoute><AddProduct /></ProtectedRoute>} />
        <Route path="/products/add" element={<ProtectedRoute><AddProduct /></ProtectedRoute>} />
        <Route path="/products/edit/:id" element={<ProtectedRoute><Products /></ProtectedRoute>} />
        <Route path="/products/view/:id" element={<ProtectedRoute><Products /></ProtectedRoute>} />
        <Route path="/products/deploy/:id" element={<ProtectedRoute><AdminRoute><Products /></AdminRoute></ProtectedRoute>} />
        
        {/* Keys module */}
        <Route path="/keys" element={<ProtectedRoute><Keys /></ProtectedRoute>} />
        <Route path="/keys/list" element={<ProtectedRoute><Keys /></ProtectedRoute>} />
        <Route path="/keys/generate" element={<ProtectedRoute><AdminRoute><Keys /></AdminRoute></ProtectedRoute>} />
        <Route path="/keys/assign" element={<ProtectedRoute><AdminRoute><Keys /></AdminRoute></ProtectedRoute>} />
        
        {/* Servers module */}
        <Route path="/servers" element={<ProtectedRoute><Servers /></ProtectedRoute>} />
        <Route path="/servers/list" element={<ProtectedRoute><Servers /></ProtectedRoute>} />
        <Route path="/servers/deploy" element={<ProtectedRoute><AdminRoute><Servers /></AdminRoute></ProtectedRoute>} />
        <Route path="/servers/logs" element={<ProtectedRoute><AdminRoute><Servers /></AdminRoute></ProtectedRoute>} />
        
        {/* Resellers module */}
        <Route path="/resellers" element={<ProtectedRoute><AdminRoute><Resellers /></AdminRoute></ProtectedRoute>} />
        <Route path="/resellers/list" element={<ProtectedRoute><AdminRoute><Resellers /></AdminRoute></ProtectedRoute>} />
        <Route path="/resellers/create" element={<ProtectedRoute><AdminRoute><Resellers /></AdminRoute></ProtectedRoute>} />
        <Route path="/resellers/credits" element={<ProtectedRoute><AdminRoute><Resellers /></AdminRoute></ProtectedRoute>} />
        <Route path="/reseller-manager" element={<ProtectedRoute><AdminRoute><Resellers /></AdminRoute></ProtectedRoute>} />
        
        {/* Leads module */}
        <Route path="/leads" element={<ProtectedRoute><AdminRoute><SeoLeads /></AdminRoute></ProtectedRoute>} />
        <Route path="/leads/list" element={<ProtectedRoute><AdminRoute><SeoLeads /></AdminRoute></ProtectedRoute>} />
        <Route path="/leads/update" element={<ProtectedRoute><AdminRoute><SeoLeads /></AdminRoute></ProtectedRoute>} />
        <Route path="/seo-leads" element={<ProtectedRoute><AdminRoute><SeoLeads /></AdminRoute></ProtectedRoute>} />
        
        {/* System modules */}
        <Route path="/notifications" element={<ProtectedRoute><AdminRoute><Dashboard /></AdminRoute></ProtectedRoute>} />
        <Route path="/logs" element={<ProtectedRoute><AdminRoute><AuditLogs /></AdminRoute></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/security" element={<ProtectedRoute><AdminRoute><SystemHealth /></AdminRoute></ProtectedRoute>} />
        <Route path="/role-detail" element={<ProtectedRoute><RoleDetail /></ProtectedRoute>} />
        <Route path="/transport-role-detail" element={<ProtectedRoute><TransportRoleDetail /></ProtectedRoute>} />
        <Route path="/manufacturing-role-detail" element={<ProtectedRoute><ManufacturingRoleDetail /></ProtectedRoute>} />
        <Route path="/education" element={<ProtectedRoute><EducationCategory /></ProtectedRoute>} />
        <Route path="/vala-builder" element={<ProtectedRoute><ValaBuilder /></ProtectedRoute>} />
        <Route path="/ai-chat" element={<ProtectedRoute><AiChat /></ProtectedRoute>} />
        <Route path="/saas-ai-dashboard" element={<ProtectedRoute><SaasAiDashboard /></ProtectedRoute>} />
        <Route path="/saas-ai" element={<ProtectedRoute><SaasAiDashboard /></ProtectedRoute>} />
        <Route path="/ai-apis" element={<ProtectedRoute><AiApis /></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
        <Route path="/reseller/dashboard" element={<ProtectedRoute><ResellerDashboard /></ProtectedRoute>} />
        <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />

        {/* Admin-only routes */}
        <Route path="/settings" element={<ProtectedRoute><AdminRoute><Settings /></AdminRoute></ProtectedRoute>} />
        <Route path="/audit-logs" element={<ProtectedRoute><AdminRoute><AuditLogs /></AdminRoute></ProtectedRoute>} />
        <Route path="/system-health" element={<ProtectedRoute><AdminRoute><SystemHealth /></AdminRoute></ProtectedRoute>} />
        <Route path="/automation" element={<ProtectedRoute><AdminRoute><Automation /></AdminRoute></ProtectedRoute>} />
        <Route path="/auto-pilot" element={<ProtectedRoute><AdminRoute><Automation /></AdminRoute></ProtectedRoute>} />
        <Route path="/apk-pipeline" element={<ProtectedRoute><AdminRoute><ApkPipeline /></AdminRoute></ProtectedRoute>} />
        <Route path="/admin/add-product" element={<ProtectedRoute><AdminRoute><AddProduct /></AdminRoute></ProtectedRoute>} />
        <Route path="/admin/marketplace" element={<ProtectedRoute><AdminRoute><MarketplaceAdmin /></AdminRoute></ProtectedRoute>} />
        <Route path="/:demoSlug" element={<DemoHostRoute />} />
        <Route path="/marketplace-admin" element={<ProtectedRoute><AdminRoute><MarketplaceAdmin /></AdminRoute></ProtectedRoute>} />

        {/* 404 fallback → redirect to appropriate dashboard */}
        <Route path="*" element={<FallbackRedirect />} />
      </Routes>
    </Suspense>
  );
}


const App = () => {
  React.useEffect(() => {
    // Debug: confirm App root renders
    // eslint-disable-next-line no-console
    console.log('App root mounted');
    // Log env variables
    // eslint-disable-next-line no-console
    console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
    // eslint-disable-next-line no-console
    console.log('VITE_SUPABASE_PUBLISHABLE_KEY:', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
    const runner = () => {
      void preloadCriticalRoutes();
    };
    const idleId = (window as any).requestIdleCallback?.(runner, { timeout: 1500 });
    if (typeof idleId === 'number') {
      return () => {
        (window as any).cancelIdleCallback?.(idleId);
      };
    }
    const timeoutId = window.setTimeout(runner, 1200);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <CartProvider>
                <AppRoutes />
              </CartProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
};

export default App;
