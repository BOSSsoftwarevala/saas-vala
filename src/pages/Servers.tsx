import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatusCards } from '@/components/servers/StatusCards';
import { ServerListPanel } from '@/components/servers/ServerListPanel';
import { GitConnect } from '@/components/servers/GitConnect';
import { ProjectDeploy } from '@/components/servers/ProjectDeploy';
import { AutoSubdomain } from '@/components/servers/AutoSubdomain';
import { CustomDomain } from '@/components/servers/CustomDomain';
import { SimpleBuildLogs } from '@/components/servers/SimpleBuildLogs';
import { SimpleSettings } from '@/components/servers/SimpleSettings';

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
            One-click deploy • Auto subdomain • Zero configuration
          </p>
        </div>

        {/* Status Cards */}
        <StatusCards />

        {/* Server List with Pay Now */}
        <ServerListPanel />

        {/* Main Grid - Two Column Layout */}
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
    </DashboardLayout>
  );
}
