import React from 'react';
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
const Marketplace = React.lazy(() => import("./pages/Marketplace"));
const SoftwareDemo = React.lazy(() => import("./pages/SoftwareDemo"));
const ProductDetail = React.lazy(() => import("./pages/ProductDetail"));
const Favorites = React.lazy(() => import("./pages/Favorites"));
const Orders = React.lazy(() => import("./pages/Orders"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Products = React.lazy(() => import("./pages/Products"));
const Keys = React.lazy(() => import("./pages/Keys"));
const Servers = React.lazy(() => import("./pages/Servers"));
const Resellers = React.lazy(() => import("./pages/Resellers"));
const MarketplaceAdmin = React.lazy(() => import("./pages/MarketplaceAdmin"));
const Settings = React.lazy(() => import("./pages/Settings"));
const AuditLogs = React.lazy(() => import("./pages/AuditLogs"));
const SystemHealth = React.lazy(() => import("./pages/SystemHealth"));
const Automation = React.lazy(() => import("./pages/Automation"));
const Cart = React.lazy(() => import("./pages/Cart"));
const DemoPage = React.lazy(() => import("./pages/DemoPage"));

// Install page (critical for PWA)
const Install = React.lazy(() => import("./pages/Install"));
import ProtectedShellProviders from './components/layout/ProtectedShellProviders';

function preloadCriticalRoutes() {
  return Promise.allSettled([
    import("./pages/Marketplace"),
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
        <Route path="/" element={<LazyWrapper><Auth /></LazyWrapper>} />
        <Route path="/marketplace" element={<LazyWrapper><Marketplace /></LazyWrapper>} />
        <Route path="/marketplace/product/:id" element={<LazyWrapper><ProductDetail /></LazyWrapper>} />
        <Route path="/marketplace/category/:category" element={<LazyWrapper><Marketplace /></LazyWrapper>} />
        <Route path="/marketplace/search" element={<LazyWrapper><Marketplace /></LazyWrapper>} />
        <Route path="/demo/:slug" element={<LazyWrapper><SoftwareDemo /></LazyWrapper>} />
        <Route path="/favorites" element={<ProtectedRoute><LazyWrapper><Favorites /></LazyWrapper></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><LazyWrapper><Orders /></LazyWrapper></ProtectedRoute>} />

        {/* Public lazy routes */}
        <Route path="/install" element={<LazyWrapper><Install /></LazyWrapper>} />
        <Route path="/cart" element={<LazyWrapper><Cart /></LazyWrapper>} />

        {/* Protected routes */}
        <Route path="/dashboard" element={<ProtectedRoute><AdminRoute><LazyWrapper><Dashboard /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        
        {/* Products module */}
        <Route path="/products" element={<ProtectedRoute><LazyWrapper><Products /></LazyWrapper></ProtectedRoute>} />
        
        {/* Keys module */}
        <Route path="/keys" element={<ProtectedRoute><LazyWrapper><Keys /></LazyWrapper></ProtectedRoute>} />
        
        {/* Servers module */}
        <Route path="/servers" element={<ProtectedRoute><LazyWrapper><Servers /></LazyWrapper></ProtectedRoute>} />
        
        {/* Resellers module */}
        <Route path="/resellers" element={<ProtectedRoute><AdminRoute><LazyWrapper><Resellers /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        
        {/* Marketplace admin */}
        <Route path="/marketplace-admin" element={<ProtectedRoute><AdminRoute><LazyWrapper><MarketplaceAdmin /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        
        {/* System modules */}
        <Route path="/settings" element={<ProtectedRoute><LazyWrapper><Settings /></LazyWrapper></ProtectedRoute>} />
        <Route path="/audit-logs" element={<ProtectedRoute><AdminRoute><LazyWrapper><AuditLogs /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/system-health" element={<ProtectedRoute><AdminRoute><LazyWrapper><SystemHealth /></LazyWrapper></AdminRoute></ProtectedRoute>} />
        <Route path="/automation" element={<ProtectedRoute><LazyWrapper><Automation /></LazyWrapper></ProtectedRoute>} />
        <Route path="/:demoSlug" element={<LazyWrapper><DemoHostRoute /></LazyWrapper>} />

        {/* 404 fallback → redirect to appropriate dashboard */}
        <Route path="*" element={<FallbackRedirect />} />
      </Routes>
    </Suspense>
  );
}


const App = () => {
  React.useEffect(() => {
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
  );
};

export default App;
