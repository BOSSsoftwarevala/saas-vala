import { Card, CardContent } from '@/components/ui/card';
import { 
  FolderCode, 
  Hammer, 
  Clock, 
  Rocket, 
  AlertTriangle 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'destructive';
}

function StatusCard({ title, value, icon: Icon, color }: StatusCardProps) {
  const colorClasses = {
    primary: 'text-primary bg-primary/10 border-primary/30',
    secondary: 'text-secondary bg-secondary/10 border-secondary/30',
    success: 'text-success bg-success/10 border-success/30',
    warning: 'text-warning bg-warning/10 border-warning/30',
    destructive: 'text-destructive bg-destructive/10 border-destructive/30',
  };

  const iconBg = {
    primary: 'bg-primary/20',
    secondary: 'bg-secondary/20',
    success: 'bg-success/20',
    warning: 'bg-warning/20',
    destructive: 'bg-destructive/20',
  };

  return (
    <Card className={cn('glass-card border', colorClasses[color])}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn('p-2.5 rounded-xl', iconBg[color])}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{title}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface SaasAiStatusCardsProps {
  stats: {
    totalProjects: number;
    activeBuilds: number;
    pendingFixes: number;
    liveDeployments: number;
    failedBuilds: number;
  };
}

export function SaasAiStatusCards({ stats }: SaasAiStatusCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      <StatusCard
        title="Total Projects"
        value={stats.totalProjects}
        icon={FolderCode}
        color="primary"
      />
      <StatusCard
        title="Active Builds"
        value={stats.activeBuilds}
        icon={Hammer}
        color="secondary"
      />
      <StatusCard
        title="Pending Fixes"
        value={stats.pendingFixes}
        icon={Clock}
        color="warning"
      />
      <StatusCard
        title="Live Deployments"
        value={stats.liveDeployments}
        icon={Rocket}
        color="success"
      />
      <StatusCard
        title="Failed Builds"
        value={stats.failedBuilds}
        icon={AlertTriangle}
        color="destructive"
      />
    </div>
  );
}
