import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings,
  GitBranch,
  Shield,
  Heart,
  RotateCcw,
  HardDrive,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AutoRules {
  auto_deploy: boolean;
  auto_ssl_renewal: boolean;
  auto_health_check: boolean;
  auto_restart: boolean;
  auto_backup: boolean;
  backup_schedule: 'daily' | 'weekly' | 'monthly';
  health_check_interval: number;
  max_restart_attempts: number;
}

interface AutoOperationsPanelProps {
  serverId?: string | null;
  serverName?: string;
  initialRules?: Partial<AutoRules>;
  onUpdate: (rules: AutoRules) => void;
}

export function AutoOperationsPanel({
  serverId: _serverId,
  serverName,
  initialRules,
  onUpdate,
}: AutoOperationsPanelProps) {
  const [rules, setRules] = useState<AutoRules>({
    auto_deploy: initialRules?.auto_deploy ?? true,
    auto_ssl_renewal: initialRules?.auto_ssl_renewal ?? true,
    auto_health_check: initialRules?.auto_health_check ?? true,
    auto_restart: initialRules?.auto_restart ?? false,
    auto_backup: initialRules?.auto_backup ?? true,
    backup_schedule: initialRules?.backup_schedule ?? 'daily',
    health_check_interval: initialRules?.health_check_interval ?? 60,
    max_restart_attempts: initialRules?.max_restart_attempts ?? 3,
  });

  const handleToggle = (key: keyof AutoRules, value: boolean) => {
    const newRules = { ...rules, [key]: value };
    setRules(newRules);
    onUpdate(newRules);
    toast.success(`${key.replace(/_/g, ' ')} ${value ? 'enabled' : 'disabled'}`);
  };

  const handleSelectChange = (key: keyof AutoRules, value: string) => {
    const newRules = { ...rules, [key]: value };
    setRules(newRules as AutoRules);
    onUpdate(newRules as AutoRules);
    toast.success('Settings updated');
  };

  const operationItems = [
    {
      key: 'auto_deploy',
      icon: GitBranch,
      title: 'Auto Deploy on Git Push',
      description: 'Automatically deploy when code is pushed to the connected branch',
      color: 'text-cyan',
      bgColor: 'bg-cyan/20',
    },
    {
      key: 'auto_ssl_renewal',
      icon: Shield,
      title: 'Auto SSL Renewal',
      description: 'Automatically renew SSL certificates 15 days before expiry',
      color: 'text-success',
      bgColor: 'bg-success/20',
    },
    {
      key: 'auto_health_check',
      icon: Heart,
      title: 'Auto Health Check',
      description: 'Periodically check server health and uptime',
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/20',
    },
    {
      key: 'auto_restart',
      icon: RotateCcw,
      title: 'Auto Restart on Failure',
      description: 'Automatically restart the server if it becomes unresponsive',
      color: 'text-warning',
      bgColor: 'bg-warning/20',
    },
    {
      key: 'auto_backup',
      icon: HardDrive,
      title: 'Auto Backup',
      description: 'Automatically backup server data on schedule',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/20',
    },
  ];

  const enabledCount = Object.entries(rules)
    .filter(([key, value]) => key.startsWith('auto_') && value === true)
    .length;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg">Auto Operations</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                {serverName ? `Configure automation for ${serverName}` : 'Server automation settings'}
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-success/20 text-success border-success/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {enabledCount}/5 Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle Items */}
        <div className="space-y-3">
          {operationItems.map((item) => {
            const Icon = item.icon;
            const isEnabled = rules[item.key as keyof AutoRules] as boolean;

            return (
              <div
                key={item.key}
                className={cn(
                  'flex items-center justify-between p-4 rounded-lg transition-colors',
                  isEnabled ? 'bg-muted/40' : 'bg-muted/20'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', item.bgColor)}>
                    <Icon className={cn('h-4 w-4', item.color)} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(v) => handleToggle(item.key as keyof AutoRules, v)}
                />
              </div>
            );
          })}
        </div>

        {/* Additional Settings */}
        {rules.auto_backup && (
          <div className="p-4 rounded-lg bg-muted/30 space-y-3">
            <p className="text-sm font-medium text-foreground">Backup Schedule</p>
            <Select
              value={rules.backup_schedule}
              onValueChange={(v) => handleSelectChange('backup_schedule', v)}
            >
              <SelectTrigger className="bg-muted/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {rules.auto_health_check && (
          <div className="p-4 rounded-lg bg-muted/30 space-y-3">
            <p className="text-sm font-medium text-foreground">Health Check Interval</p>
            <Select
              value={String(rules.health_check_interval)}
              onValueChange={(v) => handleSelectChange('health_check_interval', v)}
            >
              <SelectTrigger className="bg-muted/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Every 30 seconds</SelectItem>
                <SelectItem value="60">Every 1 minute</SelectItem>
                <SelectItem value="300">Every 5 minutes</SelectItem>
                <SelectItem value="600">Every 10 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {rules.auto_restart && (
          <div className="p-4 rounded-lg bg-muted/30 space-y-3">
            <p className="text-sm font-medium text-foreground">Max Restart Attempts</p>
            <Select
              value={String(rules.max_restart_attempts)}
              onValueChange={(v) => handleSelectChange('max_restart_attempts', v)}
            >
              <SelectTrigger className="bg-muted/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 attempt</SelectItem>
                <SelectItem value="3">3 attempts</SelectItem>
                <SelectItem value="5">5 attempts</SelectItem>
                <SelectItem value="10">10 attempts</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Info Notice */}
        <div className="text-center pt-2">
          <p className="text-xs text-muted-foreground">
            All operations are logged to audit_logs for compliance.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
