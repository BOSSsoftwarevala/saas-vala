import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-16 lg:pl-64 transition-all duration-300">
        <Header />
        <main className="min-h-[calc(100vh-4rem)] p-6">
          {children}
        </main>
        {/* Footer */}
        <footer className="border-t border-border py-4 px-6">
          <p className="text-center text-sm text-muted-foreground">
            © 2024 SaaS VALA. Powered by{' '}
            <span className="font-semibold text-primary">SoftwareVala™</span>
          </p>
        </footer>
      </div>
    </div>
  );
}
