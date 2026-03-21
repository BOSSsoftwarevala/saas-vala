import { useState, useEffect } from 'react';
import { Server, Rocket, AlertCircle, Globe, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

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
  const [counts, setCounts] = useState({ total: 0, live: 0, failed: 0, subdomains: 0, domains: 0 });

  useEffect(() => {
    const fetchCounts = async () => {
      const { data } = await supabase.from('servers').select('id, status, subdomain, custom_domain');
      if (data) {
        setCounts({
          total: data.length,
          live: data.filter(s => s.status === 'live').length,
          failed: data.filter(s => s.status === 'failed').length,
          subdomains: data.filter(s => s.subdomain).length,
          domains: data.filter(s => s.custom_domain).length,
        });
      }
    };
    fetchCounts();
  }, []);

  const stats = [
    { icon: Server, label: 'Total Projects', value: counts.total, color: 'text-primary', bgColor: 'bg-primary/20' },
    { icon: Rocket, label: 'Live Servers', value: counts.live, color: 'text-success', bgColor: 'bg-success/20' },
    { icon: AlertCircle, label: 'Failed', value: counts.failed, color: 'text-destructive', bgColor: 'bg-destructive/20' },
    { icon: Globe, label: 'Subdomains', value: counts.subdomains, color: 'text-cyan', bgColor: 'bg-cyan/20' },
    { icon: Shield, label: 'Custom Domains', value: counts.domains, color: 'text-warning', bgColor: 'bg-warning/20' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {stats.map((stat) => (
        <StatusCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}
