import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Mesh gradient overlay */}
        <div className="absolute inset-0 bg-mesh-gradient opacity-60" />
        {/* Dot grid */}
        <div className="absolute inset-0 grid-bg-dots opacity-40" />
        {/* Top-left radial glow */}
        <div 
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-[0.04]"
          style={{
            background: 'radial-gradient(circle, hsl(25, 95%, 53%) 0%, transparent 70%)',
          }}
        />
        {/* Bottom-right radial glow */}
        <div 
          className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-[0.03]"
          style={{
            background: 'radial-gradient(circle, hsl(187, 85%, 53%) 0%, transparent 70%)',
          }}
        />
      </div>

      <Sidebar />
      <div className="pl-16 lg:pl-64 transition-all duration-300 relative z-10">
        <Header />
        <main className="min-h-[calc(100vh-4rem)] p-6">
          {children}
        </main>
        {/* Footer */}
        <footer className="border-t border-border/50 py-4 px-6 backdrop-blur-sm">
          <p className="text-center text-sm text-muted-foreground">
            © 2025 SaaS VALA. Powered by{' '}
            <span className="font-semibold text-gradient-primary">SoftwareVala™</span>
          </p>
        </footer>
      </div>
    </div>
  );
}