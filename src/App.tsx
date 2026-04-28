import React from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from '@/hooks/useCart';
import Marketplace from "./pages/Marketplace";
import Auth from "./pages/Auth";
import Automation from "./pages/Automation";
import AuditLogs from "./pages/AuditLogs";
import MarketplaceAdmin from "./pages/MarketplaceAdmin";
import SystemHealth from "./pages/SystemHealth";

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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<Marketplace />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/automation" element={<Automation />} />
              <Route path="/audit-logs" element={<AuditLogs />} />
              <Route path="/marketplace-admin" element={<MarketplaceAdmin />} />
              <Route path="/system-health" element={<SystemHealth />} />
              <Route path="*" element={<Marketplace />} />
            </Routes>
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
