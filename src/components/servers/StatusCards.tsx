import { Server, Rocket, AlertCircle, Globe, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusCardProps {
  icon: typeof Server;
  label: string;
  value: number | string;
  color: string;
  bgColor: string;
}

function StatusCard({ icon: Icon, label, value, color, bgColor }: StatusCardProps) {
  return (
    <div className="glass-card rounded-xl p-4 sm:p-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className={cn('h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center shrink-0', bgColor)}>
          <Icon className={cn('h-5 w-5 sm:h-6 sm:w-6', color)} />
        </div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-muted-foreground truncate">{label}</p>
          <p className="text-xl sm:text-2xl font-bold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

export function StatusCards() {
  const stats = [
    { icon: Server, label: 'Total Projects', value: 3, color: 'text-primary', bgColor: 'bg-primary/20' },
    { icon: Rocket, label: 'Live Deployments', value: 2, color: 'text-success', bgColor: 'bg-success/20' },
    { icon: AlertCircle, label: 'Failed Deployments', value: 1, color: 'text-destructive', bgColor: 'bg-destructive/20' },
    { icon: Globe, label: 'Active Subdomains', value: 3, color: 'text-cyan', bgColor: 'bg-cyan/20' },
    { icon: Shield, label: 'Custom Domains', value: 1, color: 'text-warning', bgColor: 'bg-warning/20' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {stats.map((stat) => (
        <StatusCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}
