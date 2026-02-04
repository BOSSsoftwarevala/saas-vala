import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  MessageSquare,
  Users,
  PlayCircle,
  Download,
  AlertTriangle,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface LiveStat {
  id: string;
  title: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  bgClass: string;
  items?: { id: string; label: string; time: string }[];
}

export function LiveControlPanel() {
  const [stats, setStats] = useState<LiveStat[]>([
    {
      id: 'live-chats',
      title: 'Live Chats',
      count: 0,
      icon: MessageSquare,
      colorClass: 'text-blue-500',
      bgClass: 'bg-blue-500/10',
      items: [],
    },
    {
      id: 'active-users',
      title: 'Active Users',
      count: 0,
      icon: Users,
      colorClass: 'text-success',
      bgClass: 'bg-success/10',
      items: [],
    },
    {
      id: 'demos-running',
      title: 'Demo Running',
      count: 0,
      icon: PlayCircle,
      colorClass: 'text-purple-500',
      bgClass: 'bg-purple-500/10',
      items: [],
    },
    {
      id: 'apk-downloads',
      title: 'APK Downloads',
      count: 0,
      icon: Download,
      colorClass: 'text-cyan-500',
      bgClass: 'bg-cyan-500/10',
      items: [],
    },
    {
      id: 'server-alerts',
      title: 'Server Alerts',
      count: 0,
      icon: AlertTriangle,
      colorClass: 'text-warning',
      bgClass: 'bg-warning/10',
      items: [],
    },
    {
      id: 'license-expiry',
      title: 'License Expiry',
      count: 0,
      icon: Clock,
      colorClass: 'text-destructive',
      bgClass: 'bg-destructive/10',
      items: [],
    },
  ]);

  const [selectedStat, setSelectedStat] = useState<LiveStat | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const fetchLiveStats = async () => {
      try {
        // Fetch active demos
        const { data: demos } = await supabase
          .from('demos')
          .select('id, name, product_id')
          .eq('status', 'active');

        // Fetch expiring licenses (next 30 days)
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const { data: expiringLicenses } = await supabase
          .from('license_keys')
          .select('id, license_key, expires_at')
          .eq('status', 'active')
          .lt('expires_at', thirtyDaysFromNow.toISOString())
          .gt('expires_at', new Date().toISOString());

        // Fetch server alerts (failed/stopped servers)
        const { data: serverAlerts } = await supabase
          .from('servers')
          .select('id, name, status')
          .in('status', ['failed', 'stopped']);

        // Fetch open support tickets
        const { data: openTickets } = await supabase
          .from('support_tickets')
          .select('id, ticket_number, user_name')
          .in('status', ['open', 'pending']);

        // Fetch APK download counts (using apks table)
        const { data: apkDownloads } = await supabase
          .from('apks')
          .select('id, version, download_count, product_id')
          .eq('status', 'published')
          .order('download_count', { ascending: false })
          .limit(10);

        // Calculate total downloads
        const totalDownloads = apkDownloads?.reduce((sum, apk) => sum + (apk.download_count || 0), 0) || 0;

        // Fetch active user sessions (from today)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { data: activeSessions } = await supabase
          .from('user_sessions')
          .select('id, user_id, device_name, last_active_at')
          .gt('last_active_at', today.toISOString());

        setStats(prev => prev.map(stat => {
          switch (stat.id) {
            case 'live-chats':
              return {
                ...stat,
                count: openTickets?.length || 0,
                items: openTickets?.map(t => ({
                  id: t.id,
                  label: `${t.ticket_number} - ${t.user_name}`,
                  time: 'Active',
                })) || [],
              };
            case 'active-users':
              return {
                ...stat,
                count: activeSessions?.length || 0,
                items: activeSessions?.map(s => ({
                  id: s.id,
                  label: s.device_name || 'Unknown Device',
                  time: s.last_active_at ? new Date(s.last_active_at).toLocaleTimeString() : 'Active',
                })) || [],
              };
            case 'demos-running':
              return {
                ...stat,
                count: demos?.length || 0,
                items: demos?.map(d => ({
                  id: d.id,
                  label: d.name,
                  time: 'Live',
                })) || [],
              };
            case 'apk-downloads':
              return {
                ...stat,
                count: totalDownloads,
                items: apkDownloads?.map(a => ({
                  id: a.id,
                  label: `v${a.version}`,
                  time: `${a.download_count || 0} downloads`,
                })) || [],
              };
            case 'server-alerts':
              return {
                ...stat,
                count: serverAlerts?.length || 0,
                items: serverAlerts?.map(s => ({
                  id: s.id,
                  label: s.name,
                  time: s.status,
                })) || [],
              };
            case 'license-expiry':
              return {
                ...stat,
                count: expiringLicenses?.length || 0,
                items: expiringLicenses?.map(l => ({
                  id: l.id,
                  label: l.license_key.slice(0, 12) + '...',
                  time: new Date(l.expires_at!).toLocaleDateString(),
                })) || [],
              };
            default:
              return stat;
          }
        }));
      } catch (error) {
        console.error('Error fetching live stats:', error);
      }
    };

    fetchLiveStats();

    // Set up real-time subscriptions
    const channel = supabase
      .channel('live-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, fetchLiveStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'demos' }, fetchLiveStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'servers' }, fetchLiveStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'apks' }, fetchLiveStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_sessions' }, fetchLiveStats)
      .subscribe();

    // Auto refresh every 30 seconds
    const interval = setInterval(fetchLiveStats, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const handleStatClick = (stat: LiveStat) => {
    setSelectedStat(stat);
    setDrawerOpen(true);
  };

  return (
    <>
      <aside className="w-56 shrink-0 hidden xl:block">
        <div className="glass-card rounded-xl p-3 sticky top-20">
          <div className="flex items-center gap-2 mb-3 px-2">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm font-semibold text-foreground">Live Control</span>
          </div>

          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-2">
              {stats.map((stat) => {
                const Icon = stat.icon;
                const hasAlerts = stat.count > 0;
                
                return (
                  <button
                    key={stat.id}
                    onClick={() => handleStatClick(stat)}
                    className={cn(
                      'w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200',
                      'hover:bg-muted/50 group',
                      hasAlerts && stat.id.includes('alert') && 'bg-destructive/5'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn('p-2 rounded-lg', stat.bgClass)}>
                        <Icon className={cn('h-4 w-4', stat.colorClass)} />
                      </div>
                      <div className="text-left">
                        <p className="text-xs text-muted-foreground">{stat.title}</p>
                        <p className={cn('text-lg font-bold', stat.colorClass)}>
                          {stat.count}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </aside>

      {/* Mini Drawer for Details */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-80">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selectedStat && (
                <>
                  <div className={cn('p-2 rounded-lg', selectedStat.bgClass)}>
                    <selectedStat.icon className={cn('h-4 w-4', selectedStat.colorClass)} />
                  </div>
                  {selectedStat.title}
                  <Badge variant="outline" className="ml-auto">
                    {selectedStat.count}
                  </Badge>
                </>
              )}
            </SheetTitle>
          </SheetHeader>
          
          <div className="mt-6">
            {selectedStat?.items && selectedStat.items.length > 0 ? (
              <div className="space-y-2">
                {selectedStat.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <span className="text-sm font-medium truncate">{item.label}</span>
                    <Badge variant="secondary" className="text-xs shrink-0 ml-2">
                      {item.time}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm text-muted-foreground">No items to display</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
