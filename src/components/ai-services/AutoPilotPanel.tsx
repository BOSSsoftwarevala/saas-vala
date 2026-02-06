import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Zap,
  Video,
  Globe,
  Search,
  Megaphone,
  Target,
  Sparkles,
  Play,
  Pause,
  Settings,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AutoPilotFeature {
  id: string;
  name: string;
  description: string;
  icon: typeof Zap;
  status: 'running' | 'paused' | 'idle' | 'error';
  lastRun: string;
  nextRun: string;
  todayActions: number;
  totalActions: number;
  successRate: number;
  isEnabled: boolean;
}

const features: AutoPilotFeature[] = [
  {
    id: 'auto-seo',
    name: 'Auto SEO Optimizer',
    description: 'AI optimizes meta tags, keywords, and sitemap automatically',
    icon: Search,
    status: 'running',
    lastRun: '2 mins ago',
    nextRun: '1 hour',
    todayActions: 45,
    totalActions: 1250,
    successRate: 98,
    isEnabled: true
  },
  {
    id: 'auto-google-ads',
    name: 'Auto Google Ads',
    description: 'AI creates, manages & optimizes your Google Ads campaigns',
    icon: Megaphone,
    status: 'paused',
    lastRun: '1 day ago',
    nextRun: 'Paused',
    todayActions: 0,
    totalActions: 89,
    successRate: 94,
    isEnabled: false
  },
  {
    id: 'auto-video',
    name: 'Auto Video Creator',
    description: 'AI generates product overview videos automatically',
    icon: Video,
    status: 'running',
    lastRun: '30 mins ago',
    nextRun: '4 hours',
    todayActions: 3,
    totalActions: 156,
    successRate: 96,
    isEnabled: true
  },
  {
    id: 'auto-country',
    name: 'Auto Country Targeting',
    description: 'AI selects best model & content per country (India/Africa focus)',
    icon: Globe,
    status: 'running',
    lastRun: '5 mins ago',
    nextRun: '30 mins',
    todayActions: 120,
    totalActions: 3450,
    successRate: 99,
    isEnabled: true
  },
  {
    id: 'auto-posting',
    name: 'Auto Google Posting',
    description: 'AI auto-posts to Google Business, Search Console',
    icon: Target,
    status: 'running',
    lastRun: '10 mins ago',
    nextRun: '2 hours',
    todayActions: 12,
    totalActions: 890,
    successRate: 97,
    isEnabled: true
  },
  {
    id: 'auto-audience',
    name: 'Auto Target Audience',
    description: 'AI finds & targets your perfect customers automatically',
    icon: Sparkles,
    status: 'idle',
    lastRun: '12 hours ago',
    nextRun: '6 hours',
    todayActions: 5,
    totalActions: 234,
    successRate: 92,
    isEnabled: true
  }
];

const statusConfig = {
  running: { color: 'bg-success text-success-foreground', icon: Activity, label: 'Running', pulse: true },
  paused: { color: 'bg-warning text-warning-foreground', icon: Pause, label: 'Paused', pulse: false },
  idle: { color: 'bg-muted text-muted-foreground', icon: Clock, label: 'Idle', pulse: false },
  error: { color: 'bg-destructive text-destructive-foreground', icon: AlertTriangle, label: 'Error', pulse: false }
};

export function AutoPilotPanel() {
  const [featureList, setFeatureList] = useState(features);
  const [masterEnabled, setMasterEnabled] = useState(true);

  const handleToggleFeature = (featureId: string) => {
    setFeatureList(prev => prev.map(f => {
      if (f.id === featureId) {
        const newEnabled = !f.isEnabled;
        toast.success(`${f.name} ${newEnabled ? 'enabled' : 'paused'}`);
        return { 
          ...f, 
          isEnabled: newEnabled,
          status: newEnabled ? 'running' : 'paused'
        };
      }
      return f;
    }));
  };

  const handleRunNow = (feature: AutoPilotFeature) => {
    toast.promise(
      new Promise(resolve => setTimeout(resolve, 2000)),
      {
        loading: `Running ${feature.name}...`,
        success: `${feature.name} completed successfully!`,
        error: `${feature.name} failed`
      }
    );
  };

  const handleMasterToggle = () => {
    setMasterEnabled(!masterEnabled);
    setFeatureList(prev => prev.map(f => ({
      ...f,
      isEnabled: !masterEnabled,
      status: !masterEnabled ? 'running' : 'paused'
    })));
    toast.success(masterEnabled ? 'All auto-features paused' : 'All auto-features activated');
  };

  const runningCount = featureList.filter(f => f.status === 'running').length;
  const totalActionsToday = featureList.reduce((sum, f) => sum + f.todayActions, 0);
  const avgSuccessRate = Math.round(featureList.reduce((sum, f) => sum + f.successRate, 0) / featureList.length);

  return (
    <div className="space-y-6">
      {/* Master Control */}
      <Card className="glass-card border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn(
                'h-12 w-12 rounded-xl flex items-center justify-center',
                masterEnabled ? 'bg-success/20' : 'bg-muted'
              )}>
                <Zap className={cn(
                  'h-6 w-6',
                  masterEnabled ? 'text-success' : 'text-muted-foreground'
                )} />
              </div>
              <div>
                <h3 className="font-bold text-lg">Auto-Pilot Mode</h3>
                <p className="text-sm text-muted-foreground">
                  AI handles everything automatically - no action needed
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-xl font-bold text-success">{runningCount}</p>
                <p className="text-xs text-muted-foreground">Running</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-primary">{totalActionsToday}</p>
                <p className="text-xs text-muted-foreground">Today's Actions</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-cyan">{avgSuccessRate}%</p>
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </div>
              
              <div className="flex items-center gap-2 pl-4 border-l border-border">
                <span className="text-sm font-medium">Master</span>
                <Switch 
                  checked={masterEnabled} 
                  onCheckedChange={handleMasterToggle}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {featureList.map((feature) => {
          const status = statusConfig[feature.status];
          const StatusIcon = status.icon;
          const Icon = feature.icon;
          
          return (
            <Card 
              key={feature.id} 
              className={cn(
                'glass-card-hover overflow-hidden',
                feature.isEnabled && 'border-primary/30'
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'h-10 w-10 rounded-lg flex items-center justify-center',
                      feature.isEnabled ? 'bg-primary/20' : 'bg-muted'
                    )}>
                      <Icon className={cn(
                        'h-5 w-5',
                        feature.isEnabled ? 'text-primary' : 'text-muted-foreground'
                      )} />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{feature.name}</CardTitle>
                      <div className="flex items-center gap-1 mt-1">
                        <Badge className={cn('text-[10px] px-1.5 py-0', status.color)}>
                          <StatusIcon className={cn(
                            'h-2.5 w-2.5 mr-0.5',
                            status.pulse && 'animate-pulse'
                          )} />
                          {status.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <Switch
                    checked={feature.isEnabled}
                    onCheckedChange={() => handleToggleFeature(feature.id)}
                  />
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">{feature.description}</p>
                
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 bg-muted/30 rounded-lg">
                    <p className="text-lg font-bold text-foreground">{feature.todayActions}</p>
                    <p className="text-[10px] text-muted-foreground">Today</p>
                  </div>
                  <div className="text-center p-2 bg-muted/30 rounded-lg">
                    <p className="text-lg font-bold text-foreground">{feature.totalActions.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">Total</p>
                  </div>
                </div>
                
                {/* Success Rate */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Success Rate</span>
                    <span className={cn(
                      feature.successRate >= 95 ? 'text-success' : 
                      feature.successRate >= 80 ? 'text-warning' : 'text-destructive'
                    )}>
                      {feature.successRate}%
                    </span>
                  </div>
                  <Progress 
                    value={feature.successRate} 
                    className="h-1.5"
                  />
                </div>
                
                {/* Timing */}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Last: {feature.lastRun}
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <TrendingUp className="h-3 w-3" />
                    Next: {feature.nextRun}
                  </div>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="flex-1 h-7 text-xs gap-1"
                    onClick={() => handleRunNow(feature)}
                    disabled={!feature.isEnabled}
                  >
                    <Play className="h-3 w-3" />
                    Run Now
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    className="h-7 w-7 p-0"
                  >
                    <Settings className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info Box */}
      <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
        <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium">Fully Automated - No Action Required</p>
          <p className="text-xs text-muted-foreground mt-1">
            All features run 24/7 without your intervention. When upgrades are needed, 
            you'll be notified automatically. Best-in-market automation at just $5/month!
          </p>
        </div>
      </div>
    </div>
  );
}
