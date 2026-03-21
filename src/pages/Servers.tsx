import React, { Suspense } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatusCards } from '@/components/servers/StatusCards';
import { ServerListPanel } from '@/components/servers/ServerListPanel';
import { GitConnect } from '@/components/servers/GitConnect';
import { ProjectDeploy } from '@/components/servers/ProjectDeploy';
import { AutoSubdomain } from '@/components/servers/AutoSubdomain';
import { CustomDomain } from '@/components/servers/CustomDomain';
import { SimpleBuildLogs } from '@/components/servers/SimpleBuildLogs';
import { SimpleSettings } from '@/components/servers/SimpleSettings';

// Lazy load heavy components
const AutoSubdomainLazy = React.lazy(() => import('@/components/servers/AutoSubdomain').then(m => ({ default: m.AutoSubdomain })));
const CustomDomainLazy = React.lazy(() => import('@/components/servers/CustomDomain').then(m => ({ default: m.CustomDomain })));
const SimpleSettingsLazy = React.lazy(() => import('@/components/servers/SimpleSettings').then(m => ({ default: m.SimpleSettings })));

const ServersSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="h-12 bg-muted rounded w-1/3" />
    <div className="grid grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 bg-muted rounded" />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-64 bg-muted rounded" />
      ))}
    </div>
  </div>
);

export default function Servers() {
  return (
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground">
              Server Manager
            </h1>
            <p className="text-sm text-muted-foreground">
              One-click deploy • Auto subdomain • Zero configuration
            </p>
          </div>

            {/* Status Cards - with Suspense */}
            <Suspense fallback={<div className="grid grid-cols-4 gap-4 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded" />)}</div>}>
              <StatusCards />
            </Suspense>

            {/* Server List */}
            <Suspense fallback={<div className="h-64 bg-muted rounded animate-pulse" />}>
              <ServerListPanel />
            </Suspense>

            {/* Main Grid - Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                {/* Git Connect */}
                <Suspense fallback={<div className="h-64 bg-muted rounded animate-pulse" />}>
                  <GitConnect />
                </Suspense>
                
                {/* Project Deploy */}
                <Suspense fallback={<div className="h-64 bg-muted rounded animate-pulse" />}>
                  <ProjectDeploy />
                </Suspense>
                
                {/* Build Logs */}
                <Suspense fallback={<div className="h-64 bg-muted rounded animate-pulse" />}>
                  <SimpleBuildLogs />
                </Suspense>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Auto Subdomain */}
                <Suspense fallback={<div className="h-64 bg-muted rounded animate-pulse" />}>
                  <AutoSubdomainLazy />
                </Suspense>
                
                {/* Custom Domain */}
                <Suspense fallback={<div className="h-64 bg-muted rounded animate-pulse" />}>
                  <CustomDomainLazy />
                </Suspense>
                
                {/* Simple Settings */}
                <Suspense fallback={<div className="h-64 bg-muted rounded animate-pulse" />}>
                  <SimpleSettingsLazy />
                </Suspense>
              </div>
            </div>
          </div>
        </DashboardLayout>
  );
}
