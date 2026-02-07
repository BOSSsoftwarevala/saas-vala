import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DollarSign,
  TrendingUp,
  Zap,
  CreditCard,
  ArrowUpRight,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wallet,
  RefreshCw,
  Download,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface UsageRecord {
  id: string;
  model: string;
  tokens_input: number;
  tokens_output: number;
  cost: number;
  endpoint: string | null;
  created_at: string;
}

interface CostRecord {
  id: string;
  model_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost: number | null;
  billed: boolean | null;
  created_at: string | null;
}

interface QuotaRecord {
  daily_limit: number | null;
  daily_used: number | null;
  monthly_limit: number | null;
  monthly_used: number | null;
  last_reset_daily: string | null;
  last_reset_monthly: string | null;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export function AiBillingPanel() {
  const [usage, setUsage] = useState<UsageRecord[]>([]);
  const [costs, setCosts] = useState<CostRecord[]>([]);
  const [quota, setQuota] = useState<QuotaRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'all'>('month');

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setLoading(false);
        return;
      }

      const userId = userData.user.id;

      // Date filter
      const now = new Date();
      let dateFilter: string | null = null;
      if (period === 'today') {
        dateFilter = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      } else if (period === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateFilter = weekAgo.toISOString();
      } else if (period === 'month') {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        dateFilter = monthAgo.toISOString();
      }

      // Fetch usage
      let usageQuery = supabase
        .from('ai_usage')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (dateFilter) usageQuery = usageQuery.gte('created_at', dateFilter);
      const { data: usageData } = await usageQuery;
      setUsage(usageData || []);

      // Fetch costs
      let costsQuery = supabase
        .from('ai_costs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (dateFilter) costsQuery = costsQuery.gte('created_at', dateFilter);
      const { data: costsData } = await costsQuery;
      setCosts(costsData || []);

      // Fetch quota
      const { data: quotaData } = await supabase
        .from('ai_quotas')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      setQuota(quotaData);

    } catch (err) {
      console.error('Error fetching billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  // Computed stats
  const totalTokensIn = usage.reduce((sum, u) => sum + (u.tokens_input || 0), 0);
  const totalTokensOut = usage.reduce((sum, u) => sum + (u.tokens_output || 0), 0);
  const totalCost = costs.reduce((sum, c) => sum + (c.cost || 0), 0);
  const totalRequests = usage.length;
  const billedCosts = costs.filter(c => c.billed).reduce((sum, c) => sum + (c.cost || 0), 0);
  const pendingCosts = totalCost - billedCosts;

  const dailyUsedPercent = quota ? Math.min(100, ((quota.daily_used || 0) / (quota.daily_limit || 1)) * 100) : 0;
  const monthlyUsedPercent = quota ? Math.min(100, ((quota.monthly_used || 0) / (quota.monthly_limit || 1)) * 100) : 0;

  // Group costs by model
  const costsByModel: Record<string, number> = {};
  usage.forEach(u => {
    const model = u.model || 'Unknown';
    costsByModel[model] = (costsByModel[model] || 0) + (u.cost || 0);
  });

  const statCards = [
    {
      title: 'Total Spend',
      value: `$${totalCost.toFixed(4)}`,
      sub: period === 'today' ? 'Today' : period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'All Time',
      icon: DollarSign,
      gradient: 'from-green-500 to-emerald-400',
      trend: totalCost > 0 ? 'active' : 'none'
    },
    {
      title: 'Total Requests',
      value: totalRequests.toLocaleString(),
      sub: `${totalTokensIn.toLocaleString()} in / ${totalTokensOut.toLocaleString()} out`,
      icon: Zap,
      gradient: 'from-primary to-orange-400',
      trend: totalRequests > 0 ? 'active' : 'none'
    },
    {
      title: 'Pending Bill',
      value: `$${pendingCosts.toFixed(4)}`,
      sub: `$${billedCosts.toFixed(4)} billed`,
      icon: Receipt,
      gradient: 'from-yellow-500 to-orange-400',
      trend: pendingCosts > 0 ? 'warning' : 'none'
    },
    {
      title: 'Avg Cost/Request',
      value: totalRequests > 0 ? `$${(totalCost / totalRequests).toFixed(6)}` : '$0',
      sub: 'Per request',
      icon: TrendingUp,
      gradient: 'from-purple-500 to-violet-400',
      trend: 'none'
    }
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Period Selector + Refresh */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <Card key={i} className="relative overflow-hidden border-border hover:border-primary/30 transition-all duration-300 group">
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${stat.gradient}`}>
                  <stat.icon className="h-4 w-4 text-white" />
                </div>
                {stat.trend === 'active' && (
                  <Badge variant="outline" className="text-success border-success/30 text-[10px] gap-0.5">
                    <ArrowUpRight className="h-2.5 w-2.5" /> Active
                  </Badge>
                )}
                {stat.trend === 'warning' && (
                  <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 text-[10px] gap-0.5">
                    <AlertTriangle className="h-2.5 w-2.5" /> Pending
                  </Badge>
                )}
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.title}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Quota Usage Bars */}
      {quota && (
        <motion.div variants={item}>
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                Usage Quotas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Daily Usage</span>
                  <span className="text-sm font-medium">
                    {(quota.daily_used || 0).toLocaleString()} / {(quota.daily_limit || 0).toLocaleString()} requests
                  </span>
                </div>
                <Progress value={dailyUsedPercent} className="h-2" />
                {dailyUsedPercent > 80 && (
                  <p className="text-xs text-yellow-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Daily limit almost reached!
                  </p>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Monthly Usage</span>
                  <span className="text-sm font-medium">
                    {(quota.monthly_used || 0).toLocaleString()} / {(quota.monthly_limit || 0).toLocaleString()} requests
                  </span>
                </div>
                <Progress value={monthlyUsedPercent} className="h-2" />
                {monthlyUsedPercent > 80 && (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Monthly limit almost reached!
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Cost by Model Breakdown */}
      {Object.keys(costsByModel).length > 0 && (
        <motion.div variants={item}>
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                Cost by Model
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(costsByModel).sort((a, b) => b[1] - a[1]).map(([model, cost]) => {
                  const pct = totalCost > 0 ? (cost / totalCost) * 100 : 0;
                  return (
                    <div key={model}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{model}</Badge>
                        </div>
                        <span className="text-sm font-mono font-medium">${cost.toFixed(4)}</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Recent Usage History */}
      <motion.div variants={item}>
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Recent AI Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </div>
            ) : usage.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No AI usage found for this period
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Model</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead className="text-right">Tokens In</TableHead>
                      <TableHead className="text-right">Tokens Out</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usage.slice(0, 20).map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{u.model}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {u.endpoint || '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {(u.tokens_input || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {(u.tokens_output || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          ${(u.cost || 0).toFixed(6)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {u.created_at ? format(new Date(u.created_at), 'MMM dd, HH:mm') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Billing History from ai_costs */}
      <motion.div variants={item}>
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              Billing Records
            </CardTitle>
          </CardHeader>
          <CardContent>
            {costs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No billing records yet
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Input Tokens</TableHead>
                      <TableHead className="text-right">Output Tokens</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {costs.slice(0, 20).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          {c.billed ? (
                            <Badge className="bg-success/10 text-success border-success/20 gap-1 text-[10px]">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Billed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-yellow-500 border-yellow-500/20 gap-1 text-[10px]">
                              <Clock className="h-2.5 w-2.5" /> Pending
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {(c.input_tokens || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {(c.output_tokens || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          ${(c.cost || 0).toFixed(6)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {c.created_at ? format(new Date(c.created_at), 'MMM dd, HH:mm') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
