import { Card, CardContent } from '@/components/ui/card';
import { 
  Activity, 
  Cpu, 
  AlertTriangle, 
  Clock, 
  DollarSign,
  TrendingUp
} from 'lucide-react';
import { motion } from 'framer-motion';

interface StatCard {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
}

const stats: StatCard[] = [
  {
    title: 'Total AI Requests',
    value: '24,847',
    change: '+12.5%',
    changeType: 'positive',
    icon: Activity,
    gradient: 'from-primary to-orange-400'
  },
  {
    title: 'Active AI Models',
    value: '7',
    change: '3 primary',
    changeType: 'neutral',
    icon: Cpu,
    gradient: 'from-secondary to-cyan-400'
  },
  {
    title: 'Failed Requests',
    value: '23',
    change: '-8.2%',
    changeType: 'positive',
    icon: AlertTriangle,
    gradient: 'from-destructive to-red-400'
  },
  {
    title: 'Avg Response Time',
    value: '1.2s',
    change: '-0.3s',
    changeType: 'positive',
    icon: Clock,
    gradient: 'from-purple-500 to-accent'
  },
  {
    title: 'Cost Today',
    value: '$47.82',
    change: 'Within budget',
    changeType: 'neutral',
    icon: DollarSign,
    gradient: 'from-green-500 to-emerald-400'
  },
  {
    title: 'Monthly Cost',
    value: '$1,247',
    change: '+5.2%',
    changeType: 'negative',
    icon: TrendingUp,
    gradient: 'from-yellow-500 to-orange-400'
  }
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export function AiStatsCards() {
  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
    >
      {stats.map((stat, index) => (
        <motion.div key={index} variants={item}>
          <Card className="relative overflow-hidden border-border hover:border-primary/30 transition-all duration-300 group">
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.gradient}`}>
                  <stat.icon className="h-4 w-4 text-white" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.title}</p>
                {stat.change && (
                  <p className={`text-xs font-medium ${
                    stat.changeType === 'positive' ? 'text-success' :
                    stat.changeType === 'negative' ? 'text-destructive' :
                    'text-muted-foreground'
                  }`}>
                    {stat.change}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </motion.div>
  );
}
