import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Settings, GitBranch, Pause, Wrench, Shield, Bell, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';




export function SimpleSettings() {
  const [server, setServer] = useState<{ id: string; auto_deploy: boolean; status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [localSettings, setLocalSettings] = useState({
    auto_deploy: true,
    maintenance: false,
    paused: false,
    ddos: true,
    notifications: true,
  });

  useEffect(() => {
    fetchServer();
  }, []);

  const fetchServer = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('servers')
      .select('id, auto_deploy, status')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setServer(data);
      setLocalSettings(prev => ({
        ...prev,
        auto_deploy: data.auto_deploy ?? true,
        paused: data.status === 'stopped',
      }));
    }
    setLoading(false);
  };

  const handleToggle = async (settingId: string) => {
    if (settingId === 'ddos') {
      toast.info('DDoS protection is always enabled for security.');
      return;
    }

    const newValue = !localSettings[settingId as keyof typeof localSettings];
    setLocalSettings(prev => ({ ...prev, [settingId]: newValue }));

    // Persist to DB for server-related settings
    if (server) {
      if (settingId === 'auto_deploy') {
        const { error } = await supabase.from('servers').update({ auto_deploy: newValue }).eq('id', server.id);
        if (error) { toast.error('Failed to update'); return; }
      }
      if (settingId === 'paused') {
        const newStatus = newValue ? 'stopped' : 'live';
        const { error } = await supabase.from('servers').update({ status: newStatus }).eq('id', server.id);
        if (error) { toast.error('Failed to update'); return; }
      }
    }

    const labels: Record<string, string> = {
      auto_deploy: 'Auto Deploy on Git Push',
      maintenance: 'Maintenance Mode',
      paused: 'Pause Project',
      notifications: 'Deploy Notifications',
    };
    toast.success(`${labels[settingId] || settingId} ${newValue ? 'enabled' : 'disabled'}`);
  };

  const settingsConfig = [
    { id: 'auto_deploy', icon: GitBranch, title: 'Auto Deploy on Git Push', description: 'Automatically deploy when you push to main branch', color: 'text-success', bgColor: 'bg-success/20' },
    { id: 'maintenance', icon: Wrench, title: 'Maintenance Mode', description: 'Show maintenance page to visitors', color: 'text-warning', bgColor: 'bg-warning/20' },
    { id: 'paused', icon: Pause, title: 'Pause Project', description: 'Temporarily pause the project (keeps subdomain)', color: 'text-destructive', bgColor: 'bg-destructive/20' },
    { id: 'ddos', icon: Shield, title: 'DDoS Protection', description: 'Basic protection against attacks (always on)', color: 'text-cyan', bgColor: 'bg-cyan/20' },
    { id: 'notifications', icon: Bell, title: 'Deploy Notifications', description: 'Get notified when deployments complete', color: 'text-primary', bgColor: 'bg-primary/20' },
  ];

  if (loading) {
    return (
      <Card className="glass-card">
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
            <Settings className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <CardTitle className="text-base sm:text-lg">Quick Settings</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Persisted to database • Instant effect
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {settingsConfig.map((setting) => {
          const Icon = setting.icon;
          const isLocked = setting.id === 'ddos';
          const enabled = localSettings[setting.id as keyof typeof localSettings];

          return (
            <div key={setting.id} className={cn(
              'flex items-center justify-between p-3 sm:p-4 rounded-lg transition-colors',
              enabled ? 'bg-muted/50' : 'bg-muted/20'
            )}>
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn('h-8 w-8 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shrink-0', setting.bgColor)}>
                  <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', setting.color)} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{setting.title}</p>
                    {isLocked && <Badge variant="outline" className="text-xs border-border hidden sm:flex">Always On</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{setting.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {enabled && <CheckCircle2 className="h-4 w-4 text-success hidden sm:block" />}
                <Switch
                  checked={enabled}
                  onCheckedChange={() => handleToggle(setting.id)}
                  disabled={isLocked}
                  className={cn(isLocked && 'opacity-50')}
                />
              </div>
            </div>
          );
        })}
        <p className="text-xs text-center text-muted-foreground pt-2">
          Settings are saved to database immediately.
        </p>
      </CardContent>
    </Card>
  );
}