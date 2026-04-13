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
import { Suspense, useEffect } from 'react';


// Lazy loaded components for better performance
const Auth = React.lazy(() => import("./pages/Auth"));
const Marketplace = React.lazy(() => import("./pages/SimpleMarketplace"));
const SoftwareDemo = React.lazy(() => import("./pages/SoftwareDemo"));
const ProductDetail = React.lazy(() => import("./pages/ProductDetail"));
const Favorites = React.lazy(() => import("./pages/Favorites"));
const Orders = React.lazy(() => import("./pages/Orders"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Products = React.lazy(() => import("./pages/Products"));
const AddProduct = React.lazy(() => import("./pages/AddProduct"));
const Support = React.lazy(() => import("./pages/Support"));
const AiChatLive = React.lazy(() => import("./pages/AiChatLive"));
const Keys = React.lazy(() => import("./pages/Keys"));
const Servers = React.lazy(() => import("./pages/Servers"));
const ValaBuilder = React.lazy(() => import("./pages/ValaBuilder"));
const ValaBuilderOpenAI = React.lazy(() => import("./components/ValaBuilderOpenAI"));
const AIIntegrationsSettings = React.lazy(() => import("./components/AIIntegrationsSettings"));
const RealTimeAITest = React.lazy(() => import("./components/RealTimeAITest"));
const FlowTestSystem = React.lazy(() => import("./components/FlowTestSystem"));
const LiveAIDemo = React.lazy(() => import("./components/LiveAIDemo"));
const AISoftwareFactory = React.lazy(() => import("./components/AISoftwareFactory"));
const UltraAISoftwareFactory = React.lazy(() => import("./components/UltraAISoftwareFactory"));
const WorldClassFactory = React.lazy(() => import("./components/WorldClassFactory"));
const APKPipelineAdmin = React.lazy(() => import("./components/APKPipelineAdmin"));
const UltraAPKPipelineAdmin = React.lazy(() => import("./components/UltraAPKPipelineAdmin"));
const ExtremeAPKPipelineAdmin = React.lazy(() => import("./components/ExtremeAPKPipelineAdmin"));
const SaasAiDashboard = React.lazy(() => import("./pages/SaasAiDashboard"));
const AiApis = React.lazy(() => import("./pages/AiApis"));
const Wallet = React.lazy(() => import("./pages/Wallet"));
const SeoLeads = React.lazy(() => import("./pages/SeoLeads"));
const Resellers = React.lazy(() => import("./pages/Resellers"));
const DemoPage = React.lazy(() => import("./pages/DemoPage"));
const Settings = React.lazy(() => import("./pages/Settings"));
const AuditLogs = React.lazy(() => import("./pages/AuditLogs"));
const SystemHealth = React.lazy(() => import("./pages/SystemHealth"));
const ResellerDashboard = React.lazy(() => import("./pages/ResellerDashboard"));
const Automation = React.lazy(() => import("./pages/Automation"));
const Cart = React.lazy(() => import("./pages/Cart"));
const ApkPipeline = React.lazy(() => import("./pages/ApkPipeline"));
const OfflineAppTemplate = React.lazy(() => import("./pages/OfflineAppTemplate"));
const MarketplaceAdmin = React.lazy(() => import("./pages/MarketplaceAdmin"));

// PWA Components - grouped for better chunking
const EduPwa = React.lazy(() => import("./pages/EduPwa"));
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

// Role detail components
const RoleDetail = React.lazy(() => import("./pages/RoleDetail"));
const TransportRoleDetail = React.lazy(() => import("./pages/TransportRoleDetail"));
const ManufacturingRoleDetail = React.lazy(() => import("./pages/ManufacturingRoleDetail"));
const EducationCategory = React.lazy(() => import("./pages/EducationCategory"));

// Install page (critical for PWA)
const Install = React.lazy(() => import("./pages/Install"));
import ProtectedShellProviders from './components/layout/ProtectedShellProviders';

function preloadCriticalRoutes() {
  return Promise.allSettled([
    import("./pages/SimpleMarketplace"),
    import("./pages/ProductDetail"),
    import("./pages/Favorites"),
    import("./pages/Orders"),
    import("./pages/Dashboard"),
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
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}

function LazyWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    }>
      {children}
    </Suspense>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return (
    <LazyWrapper>
      <ProtectedShellProviders>{children}</ProtectedShellProviders>
    </LazyWrapper>
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
        <Route path="/auth" element={<LazyWrapper><Auth /></LazyWrapper>} />
        <Route path="/" element={<LazyWrapper><Marketplace /></LazyWrapper>} />
        <Route path="/marketplace" element={<LazyWrapper><Marketplace /></LazyWrapper>} />
        <Route path="/marketplace/product/:id" element={<LazyWrapper><ProductDetail /></LazyWrapper>} />
        <Route path="/marketplace/category/:category" element={<LazyWrapper><Marketplace /></LazyWrapper>} />
        <Route path="/marketplace/search" element={<LazyWrapper><Marketplace /></LazyWrapper>} />
        <Route path="/demo/:slug" element={<LazyWrapper><SoftwareDemo /></LazyWrapper>} />
        <Route path="/favorites" element={<ProtectedRoute><LazyWrapper><Favorites /></LazyWrapper></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><LazyWrapper><Orders /></LazyWrapper></ProtectedRoute>} />

        {/* Public lazy routes */}
        <Route path="/edu-pwa" element={<LazyWrapper><EduPwa /></LazyWrapper>} />
        <Route path="/install" element={<LazyWrapper><Install /></LazyWrapper>} />
        <Route path="/health-pwa" element={<LazyWrapper><HealthPwa /></LazyWrapper>} />
        <Route path="/realestate-pwa" element={<LazyWrapper><RealEstatePwa /></LazyWrapper>} />
        <Route path="/ecom-pwa" element={<LazyWrapper><EcomPwa /></LazyWrapper>} />
        <Route path="/retail-pwa" element={<LazyWrapper><RetailPwa /></LazyWrapper>} />
        <Route path="/food-pwa" element={<LazyWrapper><FoodPwa /></LazyWrapper>} />
        <Route path="/hospitality-pwa" element={<LazyWrapper><HospitalityPwa /></LazyWrapper>} />
        <Route path="/transport-pwa" element={<LazyWrapper><TransportPwa /></LazyWrapper>} />
        <Route path="/logistics-pwa" element={<LazyWrapper><LogisticsPwa /></LazyWrapper>} />
        <Route path="/finance-pwa" element={<LazyWrapper><FinancePwa /></LazyWrapper>} />
        <Route path="/media-pwa" element={<LazyWrapper><MediaPwa /></LazyWrapper>} />
        <Route path="/social-pwa" element={<LazyWrapper><SocialPwa /></LazyWrapper>} />
        <Route path="/ai-tools-pwa" element={<LazyWrapper><AiToolsPwa /></LazyWrapper>} />
        <Route path="/devtools-pwa" element={<LazyWrapper><DevToolsPwa /></LazyWrapper>} />
        <Route path="/productivity-pwa" element={<LazyWrapper><ProductivityPwa /></LazyWrapper>} />
        <Route path="/cybersecurity-pwa" element={<LazyWrapper><CyberSecurityPwa /></LazyWrapper>} />
        <Route path="/invest-pwa" element={<LazyWrapper><InvestPwa /></LazyWrapper>} />
        <Route path="/manufacturing-pwa" element={<LazyWrapper><ManufacturingPwa /></LazyWrapper>} />
        <Route path="/construction-pwa" element={<LazyWrapper><ConstructionPwa /></LazyWrapper>} />
        <Route path="/automotive-pwa" element={<LazyWrapper><AutomotivePwa /></LazyWrapper>} />
        <Route path="/agriculture-pwa" element={<LazyWrapper><AgriculturePwa /></LazyWrapper>} />
        <Route path="/energy-pwa" element={<LazyWrapper><EnergyPwa /></LazyWrapper>} />
        <Route path="/telecom-pwa" element={<LazyWrapper><TelecomPwa /></LazyWrapper>} />
        <Route path="/it-software-pwa" element={<LazyWrapper><ItSoftwarePwa /></LazyWrapper>} />
        <Route path="/cloud-devops-pwa" element={<LazyWrapper><CloudDevopsPwa /></LazyWrapper>} />
        <Route path="/analytics-pwa" element={<LazyWrapper><AnalyticsPwa /></LazyWrapper>} />
        <Route path="/cart" element={<LazyWrapper><Cart /></LazyWrapper>} />
        <Route path="/offline-app" element={<LazyWrapper><OfflineAppTemplate /></LazyWrapper>} />

        {/* Protected routes */}
        <Route path="/dashboard" element={<ProtectedRoute><AdminRoute><LazyWrapper><Dashboard /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        
        {/* Products module */}
        <Route path="/products" element={<ProtectedRoute><LazyWrapper><Products /></LazyWrapper></ProtectedRoute>} />
        <Route path="/products/list" element={<ProtectedRoute><LazyWrapper><Products /></LazyWrapper></ProtectedRoute>} />
        <Route path="/products/create" element={<ProtectedRoute><LazyWrapper><AddProduct /></LazyWrapper></ProtectedRoute>} />
        <Route path="/products/add" element={<ProtectedRoute><LazyWrapper><AddProduct /></LazyWrapper></ProtectedRoute>} />
        <Route path="/products/edit/:id" element={<ProtectedRoute><LazyWrapper><Products /></LazyWrapper></ProtectedRoute>} />
        <Route path="/products/view/:id" element={<ProtectedRoute><LazyWrapper><Products /></LazyWrapper></ProtectedRoute>} />
        <Route path="/products/deploy/:id" element={<ProtectedRoute><AdminRoute><LazyWrapper><Products /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        
        {/* Keys module */}
        <Route path="/keys" element={<ProtectedRoute><LazyWrapper><Keys /></LazyWrapper></ProtectedRoute>} />
        <Route path="/keys/list" element={<ProtectedRoute><LazyWrapper><Keys /></LazyWrapper></ProtectedRoute>} />
        <Route path="/keys/generate" element={<ProtectedRoute><AdminRoute><LazyWrapper><Keys /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/keys/assign" element={<ProtectedRoute><AdminRoute><LazyWrapper><Keys /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        
        {/* Servers module */}
        <Route path="/servers" element={<ProtectedRoute><LazyWrapper><Servers /></LazyWrapper></ProtectedRoute>} />
        <Route path="/servers/list" element={<ProtectedRoute><LazyWrapper><Servers /></LazyWrapper></ProtectedRoute>} />
        <Route path="/servers/deploy" element={<ProtectedRoute><AdminRoute><LazyWrapper><Servers /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/servers/logs" element={<ProtectedRoute><AdminRoute><LazyWrapper><Servers /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        
        {/* Resellers module */}
        <Route path="/resellers" element={<ProtectedRoute><AdminRoute><LazyWrapper><Resellers /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/resellers/list" element={<ProtectedRoute><AdminRoute><LazyWrapper><Resellers /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/resellers/create" element={<ProtectedRoute><AdminRoute><LazyWrapper><Resellers /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/resellers/credits" element={<ProtectedRoute><AdminRoute><LazyWrapper><Resellers /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/reseller-manager" element={<ProtectedRoute><AdminRoute><LazyWrapper><Resellers /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        
        {/* Leads module */}
        <Route path="/leads" element={<ProtectedRoute><AdminRoute><LazyWrapper><SeoLeads /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/leads/list" element={<ProtectedRoute><AdminRoute><LazyWrapper><SeoLeads /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/leads/update" element={<ProtectedRoute><AdminRoute><LazyWrapper><SeoLeads /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/seo-leads" element={<ProtectedRoute><AdminRoute><LazyWrapper><SeoLeads /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        
        {/* System modules */}
        <Route path="/notifications" element={<ProtectedRoute><AdminRoute><LazyWrapper><Dashboard /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/logs" element={<ProtectedRoute><AdminRoute><LazyWrapper><AuditLogs /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><LazyWrapper><Settings /></LazyWrapper></ProtectedRoute>} />
        <Route path="/security" element={<ProtectedRoute><AdminRoute><LazyWrapper><SystemHealth /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/role-detail" element={<ProtectedRoute><LazyWrapper><RoleDetail /></LazyWrapper></ProtectedRoute>} />
        <Route path="/transport-role-detail" element={<ProtectedRoute><LazyWrapper><TransportRoleDetail /></LazyWrapper></ProtectedRoute>} />
        <Route path="/manufacturing-role-detail" element={<ProtectedRoute><LazyWrapper><ManufacturingRoleDetail /></LazyWrapper></ProtectedRoute>} />
        <Route path="/education" element={<ProtectedRoute><LazyWrapper><EducationCategory /></LazyWrapper></ProtectedRoute>} />
        <Route path="/vala-builder" element={<ProtectedRoute><LazyWrapper><ValaBuilder /></LazyWrapper></ProtectedRoute>} />
        <Route path="/vala-builder-openai" element={<ProtectedRoute><LazyWrapper><ValaBuilderOpenAI /></LazyWrapper></ProtectedRoute>} />
        <Route path="/ai-settings" element={<ProtectedRoute><AdminRoute><LazyWrapper><AIIntegrationsSettings /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/ai-test" element={<ProtectedRoute><LazyWrapper><RealTimeAITest /></LazyWrapper></ProtectedRoute>} />
        <Route path="/flow-test" element={<ProtectedRoute><LazyWrapper><FlowTestSystem /></LazyWrapper></ProtectedRoute>} />
        <Route path="/live-demo" element={<ProtectedRoute><LazyWrapper><LiveAIDemo /></LazyWrapper></ProtectedRoute>} />
        <Route path="/ai-factory" element={<ProtectedRoute><LazyWrapper><AISoftwareFactory /></LazyWrapper></ProtectedRoute>} />
        <Route path="/ultra-factory" element={<ProtectedRoute><LazyWrapper><UltraAISoftwareFactory /></LazyWrapper></ProtectedRoute>} />
        <Route path="/world-class-factory" element={<ProtectedRoute><LazyWrapper><WorldClassFactory /></LazyWrapper></ProtectedRoute>} />
        <Route path="/apk-pipeline" element={<ProtectedRoute><AdminRoute><LazyWrapper><APKPipelineAdmin /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/ultra-apk-pipeline" element={<ProtectedRoute><AdminRoute><LazyWrapper><UltraAPKPipelineAdmin /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/extreme-apk-pipeline" element={<ProtectedRoute><AdminRoute><LazyWrapper><ExtremeAPKPipelineAdmin /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/ai-chat" element={<ProtectedRoute><LazyWrapper><AiChatLive /></LazyWrapper></ProtectedRoute>} />
        <Route path="/support" element={<ProtectedRoute><LazyWrapper><Support /></LazyWrapper></ProtectedRoute>} />
        <Route path="/saas-ai-dashboard" element={<ProtectedRoute><LazyWrapper><SaasAiDashboard /></LazyWrapper></ProtectedRoute>} />
        <Route path="/saas-ai" element={<ProtectedRoute><LazyWrapper><SaasAiDashboard /></LazyWrapper></ProtectedRoute>} />
        <Route path="/ai-apis" element={<ProtectedRoute><LazyWrapper><AiApis /></LazyWrapper></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><LazyWrapper><Wallet /></LazyWrapper></ProtectedRoute>} />
        <Route path="/reseller/dashboard" element={<ProtectedRoute><LazyWrapper><ResellerDashboard /></LazyWrapper></ProtectedRoute>} />
        
        {/* Admin-only routes */}
        <Route path="/settings" element={<ProtectedRoute><AdminRoute><LazyWrapper><Settings /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/audit-logs" element={<ProtectedRoute><AdminRoute><LazyWrapper><AuditLogs /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/system-health" element={<ProtectedRoute><AdminRoute><LazyWrapper><SystemHealth /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/automation" element={<ProtectedRoute><AdminRoute><LazyWrapper><Automation /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/auto-pilot" element={<ProtectedRoute><AdminRoute><LazyWrapper><Automation /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/admin/add-product" element={<ProtectedRoute><AdminRoute><LazyWrapper><AddProduct /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/admin/marketplace" element={<ProtectedRoute><AdminRoute><LazyWrapper><MarketplaceAdmin /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/:demoSlug" element={<LazyWrapper><DemoHostRoute /></LazyWrapper>} />
        <Route path="/marketplace-admin" element={<ProtectedRoute><AdminRoute><LazyWrapper><MarketplaceAdmin /></LazyWrapper></AdminRoute></ProtectedRoute>} />

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
