import { Card, CardContent } from '@/components/ui/card';
import { 
  MessageSquare, 
  ListTodo, 
  Wrench, 
  Clock, 
  Activity 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: 'primary' | 'cyan' | 'green' | 'orange' | 'purple';
}

function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  const colorClasses = {
    primary: 'text-primary bg-primary/10 border-primary/30',
    cyan: 'text-cyan bg-cyan/10 border-cyan/30',
    green: 'text-green bg-green/10 border-green/30',
    orange: 'text-orange bg-orange/10 border-orange/30',
    purple: 'text-purple bg-purple/10 border-purple/30',
  };

  const iconBg = {
    primary: 'bg-primary/20',
    cyan: 'bg-cyan/20',
    green: 'bg-green/20',
    orange: 'bg-orange/20',
    purple: 'bg-purple/20',
  };

  return (
    <Card className={cn('glass-card border transition-all hover:scale-[1.02]', colorClasses[color])}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn('p-3 rounded-xl', iconBg[color])}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-display font-bold text-foreground">{value.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{title}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface AiDashboardStatsProps {
  stats: {
    totalPrompts: number;
    activeTasks: number;
    autoFixesDone: number;
    pendingReviews: number;
    aiHealthScore: number;
  };
}

export function AiDashboardStats({ stats }: AiDashboardStatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      <StatCard
        title="Total Prompts"
        value={stats.totalPrompts}
        icon={MessageSquare}
        color="primary"
      />
      <StatCard
        title="Active Tasks"
        value={stats.activeTasks}
        icon={ListTodo}
        color="cyan"
      />
      <StatCard
        title="Auto Fixes Done"
        value={stats.autoFixesDone}
        icon={Wrench}
        color="green"
      />
      <StatCard
        title="Pending Reviews"
        value={stats.pendingReviews}
        icon={Clock}
        color="orange"
      />
      <StatCard
        title="AI Health %"
        value={stats.aiHealthScore}
        icon={Activity}
        color="purple"
      />
    </div>
  );
}
