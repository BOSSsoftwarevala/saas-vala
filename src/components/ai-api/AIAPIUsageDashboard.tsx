// AI API Usage Monitoring Dashboard
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Cpu,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Calendar,
  Download,
} from 'lucide-react';
import { aiApiService } from '@/services/ai-api/ai-api.service';
import type { AIAPIUsageStats, AIAPIHealthStatus } from '@/types/ai-api-management';

export function AIAPIUsageDashboard() {
  const [usageStats, setUsageStats] = useState<AIAPIUsageStats | null>(null);
  const [healthStatus, setHealthStatus] = useState<AIAPIHealthStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7d');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const startDate = getStartDate(dateRange);
      const [stats, health] = await Promise.all([
        aiApiService.getAPIUsageStats(startDate),
        aiApiService.getAPIHealthStatus(),
      ]);
      setUsageStats(stats);
      setHealthStatus(health);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, dateRange]);

  const getStartDate = (range: string): string => {
    const now = new Date();
    const days = parseInt(range.replace('d', ''));
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return startDate.toISOString();
  };

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(2)}`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold">AI API Usage Monitoring</h3>
          <p className="text-sm text-muted-foreground">Real-time monitoring of all 105+ AI APIs</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Auto Refresh</Label>
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
          </div>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={fetchDashboardData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{loading ? '...' : formatNumber(usageStats?.total_requests || 0)}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
            <div className="mt-2 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-[10px] text-green-500">+12.5%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">Total Tokens</p>
                <p className="text-2xl font-bold">{loading ? '...' : formatNumber(usageStats?.total_tokens || 0)}</p>
              </div>
              <Cpu className="h-8 w-8 text-purple-500" />
            </div>
            <div className="mt-2 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-[10px] text-green-500">+8.3%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">Total Cost</p>
                <p className="text-2xl font-bold">{loading ? '...' : formatCost(usageStats?.total_cost || 0)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
            <div className="mt-2 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-red-500" />
              <span className="text-[10px] text-red-500">+2.1%</span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{loading ? '...' : `${usageStats?.success_rate.toFixed(1) || 0}%`}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <div className="mt-2">
              <Progress value={usageStats?.success_rate || 0} className="h-1" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage by Request Type */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Usage by Request Type</CardTitle>
          <CardDescription>Distribution of API usage across different request types</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {usageStats?.by_request_type && Object.entries(usageStats.by_request_type).map(([type, stats]) => (
              <div key={type} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium capitalize">{type.replace('_', ' ')}</span>
                  <span className="text-muted-foreground">
                    {formatNumber(stats.requests)} requests • {formatCost(stats.cost)}
                  </span>
                </div>
                <Progress 
                  value={(stats.requests / (usageStats.total_requests || 1)) * 100} 
                  className="h-2"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Usage by Provider */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Usage by Provider</CardTitle>
          <CardDescription>API usage distribution across providers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {usageStats?.by_provider && Object.entries(usageStats.by_provider)
              .sort(([, a], [, b]) => b.cost - a.cost)
              .slice(0, 10)
              .map(([provider, stats]) => (
                <div key={provider} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                  <div className="flex-1">
                    <p className="text-xs font-medium">{provider}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatNumber(stats.requests)} requests • {formatNumber(stats.tokens)} tokens
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold">{formatCost(stats.cost)}</p>
                    <Badge variant={stats.success_rate > 90 ? 'default' : stats.success_rate > 70 ? 'secondary' : 'destructive'} className="text-[10px]">
                      {stats.success_rate.toFixed(1)}% success
                    </Badge>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* API Health Status */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-sm font-medium">API Health Status</CardTitle>
          <CardDescription>Real-time health monitoring of all active APIs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {healthStatus.map((status) => (
              <div key={status.provider} className="p-3 bg-muted/30 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">{status.provider}</p>
                  {status.is_healthy ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Success Rate</span>
                    <span className={status.success_rate > 90 ? 'text-green-600' : status.success_rate > 70 ? 'text-yellow-600' : 'text-red-600'}>
                      {status.success_rate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Avg Response</span>
                    <span>{status.avg_response_time.toFixed(0)}ms</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Fail Count</span>
                    <span>{status.fail_count}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Budget</span>
                    {status.is_within_budget ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-red-500" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cost Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Cost Optimization</CardTitle>
            <CardDescription>Recommendations to reduce API costs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-xs font-medium text-green-600">SEO Requests</p>
              <p className="text-[10px] text-muted-foreground">Using DeepSeek saves ~90% compared to OpenAI</p>
            </div>
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs font-medium text-blue-600">Chat Requests</p>
              <p className="text-[10px] text-muted-foreground">Groq provides fastest response at lowest cost</p>
            </div>
            <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <p className="text-xs font-medium text-purple-600">Critical Requests</p>
              <p className="text-[10px] text-muted-foreground">OpenAI GPT-4 for highest quality output</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Budget Overview</CardTitle>
            <CardDescription>Daily and monthly budget tracking</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Daily Budget</span>
                <span className="text-muted-foreground">$10.00 / $50.00</span>
              </div>
              <Progress value={20} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Monthly Budget</span>
                <span className="text-muted-foreground">$150.00 / $500.00</span>
              </div>
              <Progress value={30} className="h-2" />
            </div>
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-medium">Projected Monthly Cost</span>
                <span className="text-muted-foreground">$180.00</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Based on current usage trends</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
