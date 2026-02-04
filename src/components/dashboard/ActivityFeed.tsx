import { Key, Package, Server, DollarSign, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Activity {
  id: string;
  type: 'key' | 'product' | 'server' | 'payment' | 'user';
  message: string;
  time: string;
}

const iconMap = {
  key: Key,
  product: Package,
  server: Server,
  payment: DollarSign,
  user: User,
};

const colorMap = {
  key: 'bg-primary/20 text-primary',
  product: 'bg-cyan/20 text-cyan',
  server: 'bg-purple/20 text-purple',
  payment: 'bg-green/20 text-green',
  user: 'bg-gold/20 text-gold',
};

interface ActivityFeedProps {
  activities: Activity[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <div className="glass-card rounded-xl p-4">
      <h3 className="font-display text-lg font-bold text-foreground mb-4">
        Recent Activity
      </h3>
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
        {activities.map((activity, index) => {
          const Icon = iconMap[activity.type];
          return (
            <div
              key={activity.id}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg bg-muted/30 transition-all duration-300',
                'hover:bg-muted/50 cursor-pointer',
                'animate-fade-in'
              )}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div
                className={cn(
                  'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                  colorMap[activity.type]
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{activity.message}</p>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
