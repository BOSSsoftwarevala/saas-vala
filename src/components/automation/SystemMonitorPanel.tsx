import { useState, useEffect } from 'react';
import { useSystemMonitor } from '@/hooks/useSystemMonitor';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Shield, CheckCircle, XCircle, Clock, Zap, RefreshCw,
  Server, Bot, GitBranch, CreditCard, Activity, Loader2, Eye
} from 'lucide-react';

const riskColors: Record<string, string> = {
  low: 'bg-green-500/10 text-green-500 border-green-500/20',
  medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  high: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  critical: 'bg-red-500/10 text-red-500 border-red-500/20',
};

const moduleIcons: Record<string, React.ReactNode> = {
  server: <Server className="h-4 w-4" />,
  ai: <Bot className="h-4 w-4" />,
  git: <GitBranch className="h-4 w-4" />,
  billing: <CreditCard className="h-4 w-4" />,
  security: <Shield className="h-4 w-4" />,
  seo: <Activity className="h-4 w-4" />,
};

export function SystemMonitorPanel() {
  const { user } = useAuth();
  const {
    loading, scanning, queue, stats,
    runHealthCheck, fetchQueue, fetchStats, approveItem, rejectItem
  } = useSystemMonitor();
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    fetchStats();
    fetchQueue('pending');
  }, []);

  useEffect(() => {
    fetchQueue(activeTab);
  }, [activeTab]);

  const handleScan = async () => {
    await runHealthCheck();
    await fetchStats();
    await fetchQueue(activeTab);
  };

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
            <p className="text-2xl font-bold">{stats?.pending || 0}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <p className="text-2xl font-bold">{stats?.approved || 0}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4 text-center">
            <XCircle className="h-5 w-5 mx-auto mb-1 text-red-500" />
            <p className="text-2xl font-bold">{stats?.rejected || 0}</p>
            <p className="text-xs text-muted-foreground">Rejected</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4 text-center">
            <Zap className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <p className="text-2xl font-bold">{stats?.auto_approved || 0}</p>
            <p className="text-xs text-muted-foreground">Auto-Done</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4 text-center">
            <Activity className="h-5 w-5 mx-auto mb-1" style={{ color: stats?.last_health?.status === 'healthy' ? '#22c55e' : stats?.last_health?.status === 'degraded' ? '#eab308' : '#ef4444' }} />
            <p className="text-2xl font-bold capitalize">{stats?.last_health?.status || '—'}</p>
            <p className="text-xs text-muted-foreground">System</p>
          </CardContent>
        </Card>
      </div>

      {/* Scan Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">🛡️ Smart Approval Queue</h3>
          <p className="text-xs text-muted-foreground">
            AI monitors 24/7 • Low risk = auto • Medium/High = your approval
          </p>
        </div>
        <Button onClick={handleScan} disabled={scanning} size="sm" className="gap-2">
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {scanning ? 'Scanning...' : 'Run Scan Now'}
        </Button>
      </div>

      {/* Queue Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-4 bg-muted/30">
          <TabsTrigger value="pending" className="gap-1 text-xs">
            <Clock className="h-3 w-3" /> Pending {stats?.pending ? `(${stats.pending})` : ''}
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-1 text-xs">
            <CheckCircle className="h-3 w-3" /> Approved
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-1 text-xs">
            <XCircle className="h-3 w-3" /> Rejected
          </TabsTrigger>
          <TabsTrigger value="auto_approved" className="gap-1 text-xs">
            <Zap className="h-3 w-3" /> Auto
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : queue.length === 0 ? (
            <Card className="bg-card/30 border-dashed">
              <CardContent className="py-12 text-center">
                <Shield className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground">No items in this queue</p>
                <p className="text-xs text-muted-foreground mt-1">Run a scan to check for updates</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {queue.map((item) => (
                <Card key={item.id} className="bg-card/50 border-border/50 hover:border-primary/20 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-muted-foreground">
                            {moduleIcons[item.source_module] || <Eye className="h-4 w-4" />}
                          </span>
                          <h4 className="font-medium text-sm truncate">{item.title}</h4>
                          <Badge variant="outline" className={`text-[10px] ${riskColors[item.risk_level]}`}>
                            {item.risk_level.toUpperCase()}
                          </Badge>
                          {item.ai_confidence > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              🤖 {item.ai_confidence}%
                            </span>
                          )}
                        </div>

                        {/* Reason */}
                        <div className="bg-muted/30 rounded-lg p-2.5 mb-2">
                          <p className="text-xs text-muted-foreground mb-1 font-medium">📋 Reason:</p>
                          <p className="text-xs">{item.reason}</p>
                        </div>

                        {/* Effect */}
                        <div className="bg-primary/5 rounded-lg p-2.5">
                          <p className="text-xs text-muted-foreground mb-1 font-medium">⚡ Effect if approved:</p>
                          <p className="text-xs">{item.effect}</p>
                        </div>

                        {/* Meta */}
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                          <span>{item.monitor_type.replace('_', ' ')}</span>
                          <span>•</span>
                          <span>{new Date(item.created_at).toLocaleString()}</span>
                          {item.target_entity_type && (
                            <>
                              <span>•</span>
                              <span>{item.target_entity_type}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      {item.status === 'pending' && (
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button
                            size="sm"
                            className="gap-1 text-xs"
                            onClick={() => user?.id && approveItem(item.id, user.id)}
                          >
                            <CheckCircle className="h-3 w-3" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs"
                            onClick={() => rejectItem(item.id)}
                          >
                            <XCircle className="h-3 w-3" /> Reject
                          </Button>
                        </div>
                      )}

                      {item.status === 'approved' && (
                        <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                          ✅ Approved
                        </Badge>
                      )}

                      {item.status === 'auto_approved' && (
                        <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">
                          ⚡ Auto
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Last Health Snapshot */}
      {stats?.last_health && (
        <Card className="bg-card/30 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">📊 Last System Scan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
              {Object.entries(stats.last_health.metrics || {}).map(([key, value]) => (
                <div key={key}>
                  <p className="text-lg font-bold">{value as number}</p>
                  <p className="text-[10px] text-muted-foreground">{key.replace(/_/g, ' ')}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3 text-right">
              Last scan: {new Date(stats.last_health.created_at).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
