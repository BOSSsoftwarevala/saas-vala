import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatusCards } from '@/components/servers/StatusCards';
import { ServerListPanel } from '@/components/servers/ServerListPanel';
import { GitConnect } from '@/components/servers/GitConnect';
import { ProjectDeploy } from '@/components/servers/ProjectDeploy';
import { AutoSubdomain } from '@/components/servers/AutoSubdomain';
import { CustomDomain } from '@/components/servers/CustomDomain';
import { SimpleBuildLogs } from '@/components/servers/SimpleBuildLogs';
import { SimpleSettings } from '@/components/servers/SimpleSettings';
import { ServerSecurityMonitor } from '@/components/servers/ServerSecurityMonitor';
import { ServerHealthMonitor } from '@/components/servers/ServerHealthMonitor';
import { ServerCertificates } from '@/components/servers/ServerCertificates';
import { ServerBackups } from '@/components/servers/ServerBackups';

export default function Servers() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-foreground">
            Server Manager
          </h2>
          <p className="text-sm text-muted-foreground">
            Multi-provider hosting • AI-powered security & monitoring • One-click deploy
          </p>
        </div>

        {/* Status Cards */}
        <StatusCards />

        {/* Server List with Pay Now */}
        <ServerListPanel />

        {/* AI-Powered Monitoring Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Server Monitoring & Security</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AI Security Monitor */}
            <ServerSecurityMonitor />
            
            {/* Real-time Health Monitor */}
            <ServerHealthMonitor />
          </div>
        </div>

        {/* SSL & Backup Management Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Certificates & Backups</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SSL Certificate Management */}
            <ServerCertificates />
            
            {/* Backup Management */}
            <ServerBackups />
          </div>
        </div>

        {/* Main Grid - Two Column Layout */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Deployment & Configuration</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Git Connect */}
              <GitConnect />
              
              {/* Project Deploy */}
              <ProjectDeploy />
              
              {/* Build Logs */}
              <SimpleBuildLogs />
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Auto Subdomain */}
              <AutoSubdomain />
              
              {/* Custom Domain */}
              <CustomDomain />
              
              {/* Simple Settings */}
              <SimpleSettings />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
