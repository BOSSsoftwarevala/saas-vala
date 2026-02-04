import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Globe,
  Shield,
  ShieldCheck,
  ShieldX,
  Clock,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface LiveDomainSSLPanelProps {
  domainsAddedToday: number;
  sslIssuedToday: number;
  sslErrors: number;
  autoRenewRunning: boolean;
  recentEvents: {
    id: string;
    type: 'domain_added' | 'ssl_issued' | 'ssl_error' | 'ssl_renewed' | 'domain_verified';
    message: string;
    time: string;
    status: 'success' | 'error' | 'warning' | 'info';
  }[];
}

export function LiveDomainSSLPanel({
  domainsAddedToday,
  sslIssuedToday,
  sslErrors,
  autoRenewRunning,
  recentEvents,
}: LiveDomainSSLPanelProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 5000);
    return () => clearInterval(interval);
  }, []);

  const eventIcons = {
    domain_added: Globe,
    ssl_issued: ShieldCheck,
    ssl_error: ShieldX,
    ssl_renewed: Shield,
    domain_verified: CheckCircle2,
  };

  const eventColors = {
    success: 'text-success bg-success/20',
    error: 'text-destructive bg-destructive/20',
    warning: 'text-warning bg-warning/20',
    info: 'text-cyan bg-cyan/20',
  };

  return (
    <div className="hidden xl:block w-80 shrink-0 space-y-4">
      {/* Live Status Header */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-foreground">Domain & SSL Status</CardTitle>
            <Badge variant="outline" className="bg-success/20 text-success border-success/30 gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Live
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-lg bg-cyan/10 text-center">
              <Globe className="h-4 w-4 text-cyan mx-auto mb-1" />
              <p className="text-xl font-bold text-foreground">{domainsAddedToday}</p>
              <p className="text-[10px] text-muted-foreground">Domains Today</p>
            </div>
            <div className="p-3 rounded-lg bg-success/10 text-center">
              <ShieldCheck className="h-4 w-4 text-success mx-auto mb-1" />
              <p className="text-xl font-bold text-foreground">{sslIssuedToday}</p>
              <p className="text-[10px] text-muted-foreground">SSL Issued</p>
            </div>
          </div>

          {/* SSL Errors */}
          <div className={cn(
            'flex items-center justify-between p-3 rounded-lg',
            sslErrors > 0 ? 'bg-destructive/10' : 'bg-muted/30'
          )}>
            <div className="flex items-center gap-2">
              {sslErrors > 0 ? (
                <ShieldX className="h-4 w-4 text-destructive" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-success" />
              )}
              <span className="text-sm text-foreground">SSL Errors</span>
            </div>
            <Badge variant="outline" className={cn(
              sslErrors > 0 
                ? 'bg-destructive/20 text-destructive border-destructive/30'
                : 'bg-success/20 text-success border-success/30'
            )}>
              {sslErrors}
            </Badge>
          </div>

          {/* Auto Renew Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <RefreshCw className={cn(
                'h-4 w-4',
                autoRenewRunning ? 'text-warning animate-spin' : 'text-muted-foreground'
              )} />
              <span className="text-sm text-foreground">Auto Renew</span>
            </div>
            <Badge variant="outline" className={cn(
              autoRenewRunning
                ? 'bg-warning/20 text-warning border-warning/30'
                : 'bg-muted/20 text-muted-foreground border-muted/30'
            )}>
              {autoRenewRunning ? 'Running' : 'Idle'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Recent Events */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-foreground">Recent Events</CardTitle>
            <span className="text-xs text-muted-foreground">Auto-refresh 5s</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentEvents.length === 0 ? (
            <div className="text-center py-4">
              <Clock className="h-6 w-6 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No recent events</p>
            </div>
          ) : (
            recentEvents.slice(0, 6).map((event) => {
              const Icon = eventIcons[event.type];
              const colorClass = eventColors[event.status];

              return (
                <div
                  key={event.id}
                  className="flex items-start gap-2 p-2 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  <div className={cn('h-6 w-6 rounded-full flex items-center justify-center shrink-0', colorClass)}>
                    <Icon className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground truncate">{event.message}</p>
                    <p className="text-[10px] text-muted-foreground">{event.time}</p>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Last Updated */}
      <div className="text-center">
        <p className="text-[10px] text-muted-foreground">
          Last updated: {format(time, 'HH:mm:ss')}
        </p>
      </div>
    </div>
  );
}
