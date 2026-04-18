import React from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from '@/hooks/useCart';
import { applySaasValaBranding } from '@/lib/demoMasking';
import { useEffect } from 'react';

// Direct imports for critical modules (no lazy loading for reliability)
import Auth from "./pages/Auth";
import Marketplace from "./pages/Marketplace";
import ProductDetail from "./pages/ProductDetail";
import Dashboard from "./pages/Dashboard";
import MarketplaceAdmin from "./pages/MarketplaceAdmin";
import MarketplaceAdminPanel from "./pages/MarketplaceAdminPanel";
import AuditLogs from "./pages/AuditLogs";
import SystemHealth from "./pages/SystemHealth";
import Automation from "./pages/Automation";

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

function AppRoutes() {
  useEffect(() => {
    applySaasValaBranding();
  }, []);

  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="/" element={<Marketplace />} />
      <Route path="/marketplace" element={<Marketplace />} />
      <Route path="/marketplace/product/:id" element={<ProductDetail />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/automation" element={<Automation />} />
      <Route path="/audit-logs" element={<AuditLogs />} />
      <Route path="/marketplace-admin" element={<MarketplaceAdmin />} />
      <Route path="/marketplace-admin-panel" element={<MarketplaceAdminPanel />} />
      <Route path="/system-health" element={<SystemHealth />} />
      <Route path="*" element={<Marketplace />} />
    </Routes>
  );
}


const App = () => {
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
