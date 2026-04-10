import React from 'react';
import { DashboardProvider } from '@/hooks/useDashboardStore';
import { SidebarProvider } from '@/hooks/useSidebarState';

interface ProtectedShellProvidersProps {
  children: React.ReactNode;
}

export default function ProtectedShellProviders({ children }: ProtectedShellProvidersProps) {
  return (
    <DashboardProvider>
      <SidebarProvider>{children}</SidebarProvider>
    </DashboardProvider>
  );
}
