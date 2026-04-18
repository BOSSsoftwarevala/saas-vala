import React from 'react';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Marketplace from "./pages/Marketplace";
import Automation from "./pages/Automation";
import AuditLogs from "./pages/AuditLogs";
import MarketplaceAdmin from "./pages/MarketplaceAdmin";
import SystemHealth from "./pages/SystemHealth";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Marketplace />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/automation" element={<Automation />} />
        <Route path="/audit-logs" element={<AuditLogs />} />
        <Route path="/marketplace-admin" element={<MarketplaceAdmin />} />
        <Route path="/system-health" element={<SystemHealth />} />
        <Route path="*" element={<Marketplace />} />
      </Routes>
    </BrowserRouter>
  );
}
