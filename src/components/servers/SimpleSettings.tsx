import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  GitBranch, 
  Pause, 
  Wrench,
  Shield,
  Bell,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SettingToggle {
  id: string;
  icon: typeof Settings;
  title: string;
  description: string;
  enabled: boolean;
  color: string;
  bgColor: string;
}

export function SimpleSettings() {
  const [settings, setSettings] = useState<SettingToggle[]>([
    {
      id: 'auto-deploy',
      icon: GitBranch,
      title: 'Auto Deploy on Git Push',
      description: 'Automatically deploy when you push to main branch',
      enabled: true,
      color: 'text-success',
      bgColor: 'bg-success/20',
    },
    {
      id: 'maintenance',
      icon: Wrench,
      title: 'Maintenance Mode',
      description: 'Show maintenance page to visitors',
      enabled: false,
      color: 'text-warning',
      bgColor: 'bg-warning/20',
    },
    {
      id: 'pause',
      icon: Pause,
      title: 'Pause Project',
      description: 'Temporarily pause the project (keeps subdomain)',
      enabled: false,
      color: 'text-destructive',
      bgColor: 'bg-destructive/20',
    },
    {
      id: 'ddos',
      icon: Shield,
      title: 'DDoS Protection',
      description: 'Basic protection against attacks (always on)',
      enabled: true,
      color: 'text-cyan',
      bgColor: 'bg-cyan/20',
    },
    {
      id: 'notifications',
      icon: Bell,
      title: 'Deploy Notifications',
      description: 'Get notified when deployments complete',
      enabled: true,
      color: 'text-primary',
      bgColor: 'bg-primary/20',
    },
  ]);

  const handleToggle = (settingId: string) => {
    const setting = settings.find(s => s.id === settingId);
    
    // DDoS protection can't be turned off
    if (settingId === 'ddos') {
      toast.info('DDoS protection is always enabled for security.');
      return;
    }

    setSettings(prev => prev.map(s => 
      s.id === settingId ? { ...s, enabled: !s.enabled } : s
    ));

    const newState = !setting?.enabled;
    toast.success(`${setting?.title} ${newState ? 'enabled' : 'disabled'}`);
  };

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
              Simple toggles • No complex configuration
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {settings.map((setting) => {
          const Icon = setting.icon;
          const isLocked = setting.id === 'ddos';

          return (
            <div 
              key={setting.id}
              className={cn(
                'flex items-center justify-between p-3 sm:p-4 rounded-lg transition-colors',
                setting.enabled ? 'bg-muted/50' : 'bg-muted/20'
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={cn('h-8 w-8 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shrink-0', setting.bgColor)}>
                  <Icon className={cn('h-4 w-4 sm:h-5 sm:w-5', setting.color)} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{setting.title}</p>
                    {isLocked && (
                      <Badge variant="outline" className="text-xs border-border hidden sm:flex">
                        Always On
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{setting.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {setting.enabled && (
                  <CheckCircle2 className="h-4 w-4 text-success hidden sm:block" />
                )}
                <Switch
                  checked={setting.enabled}
                  onCheckedChange={() => handleToggle(setting.id)}
                  disabled={isLocked}
                  className={cn(isLocked && 'opacity-50')}
                />
              </div>
            </div>
          );
        })}

        <p className="text-xs text-center text-muted-foreground pt-2">
          All settings take effect immediately. No restart needed.
        </p>
      </CardContent>
    </Card>
  );
}
