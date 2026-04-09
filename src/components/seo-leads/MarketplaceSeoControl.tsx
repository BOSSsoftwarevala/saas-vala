import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { seoApi, leadsApi, systemApi } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Play, RefreshCw, Route, TrendingUp, BrainCircuit } from 'lucide-react';

type SeoMetrics = {
  seo_score?: number;
  keyword_coverage?: number;
  readability_score?: number;
  ctr_estimate?: number;
  last_scanned_at?: string;
  hashtags?: string[];
  target_countries?: string[];
  ai_recommendations?: string[];
};

type ProductSeoRow = {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  seo_metrics: SeoMetrics | null;
};

type RunRow = {
  id: string;
  status: string;
  run_type: string;
  created_at: string;
  completed_at: string | null;
  summary: {
    optimized_products?: number;
  } | null;
};

export function MarketplaceSeoControl() {
  const [rows, setRows] = useState<ProductSeoRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [routing, setRouting] = useState(false);
  const [ultraRunning, setUltraRunning] = useState(false);
  const [ultraStats, setUltraStats] = useState<{
    indexing_pending: number;
    keyword_updates_24h: number;
    hot_leads: number;
    warm_leads: number;
    avg_seo_roi: number;
    avg_ads_roi: number;
    unresolved_alerts: number;
    critical_alerts: number;
  } | null>(null);
  const [leadAnalytics, setLeadAnalytics] = useState<{
    total: number;
    converted: number;
    qualified: number;
    conversion_rate: number;
  } | null>(null);
  const [systemSummary, setSystemSummary] = useState<{
    leads_total?: number;
    ads_campaigns_total?: number;
    revenue_total?: number;
    ai_calls_total?: number;
    ai_cost_total?: number;
  } | null>(null);
  const [resilienceSummary, setResilienceSummary] = useState<{
    circuit_open?: number;
    queue_pending?: number;
    queue_running?: number;
    probe_pass_rate?: number;
  } | null>(null);
  const [securitySummary, setSecuritySummary] = useState<{
    ai_safety_blocked?: number;
    prompt_injection_blocked?: number;
    zero_trust_denies?: number;
    critical_alerts?: number;
  } | null>(null);
  const [complianceSummary, setComplianceSummary] = useState<{
    consent_total?: number;
    tax_applied_events?: number;
    billing_failures_open?: number;
    subscriptions_active?: number;
  } | null>(null);
  const [systemBusy, setSystemBusy] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [productsRes, runsRes, leadRes] = await Promise.all([
        seoApi.marketplaceProducts({ limit: 100, search: search || undefined }),
        seoApi.automationRuns({ limit: 10 }),
        leadsApi.analytics(),
      ]);
      setRows((productsRes?.data || []) as ProductSeoRow[]);
      setRuns((runsRes?.data || []) as RunRow[]);
      setLeadAnalytics((leadRes?.data || null) as typeof leadAnalytics);

      const ultra = await seoApi.ultraDashboard();
      setUltraStats((ultra?.data || null) as typeof ultraStats);

      const [command, resilience, security, compliance] = await Promise.all([
        systemApi.commandCenter(),
        systemApi.resilienceDashboard(),
        systemApi.securityDashboard(),
        systemApi.complianceDashboard(),
      ]);

      setSystemSummary((command?.data || null) as typeof systemSummary);
      setResilienceSummary((resilience?.data || null) as typeof resilienceSummary);
      setSecuritySummary((security?.data || null) as typeof securitySummary);
      setComplianceSummary((compliance?.data || null) as typeof complianceSummary);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load marketplace SEO data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seoAverage = useMemo(() => {
    const scores = rows.map((r) => r.seo_metrics?.seo_score || 0).filter((n) => n > 0);
    if (!scores.length) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [rows]);

  const runAutomation = async () => {
    setRunning(true);
    try {
      const res = await seoApi.runAutomation({ run_type: 'manual_panel', limit: 200 });
      toast.success('SEO automation completed', {
        description: `${res?.data?.summary?.optimized_products || 0} products optimized`,
      });
      await fetchAll();
    } catch (error: any) {
      toast.error(error?.message || 'Automation failed');
    } finally {
      setRunning(false);
    }
  };

  const autoRouteLeads = async () => {
    setRouting(true);
    try {
      const res = await leadsApi.autoRoute({ limit: 100 });
      toast.success('Lead routing complete', {
        description: `${res?.routed || 0} leads assigned`,
      });
      await fetchAll();
    } catch (error: any) {
      toast.error(error?.message || 'Lead routing failed');
    } finally {
      setRouting(false);
    }
  };

  const runUltraBrain = async () => {
    setUltraRunning(true);
    try {
      const res = await seoApi.ultraRun({ run_type: 'manual', region_mode: 'india', max_products: 150 });
      toast.success('Ultra SEO+Ads+Leads brain completed', {
        description: `${res?.data?.summary?.keyword_tracked || 0} keyword updates, ${res?.data?.summary?.leads_scored || 0} lead scores`,
      });
      await fetchAll();
    } catch (error: any) {
      toast.error(error?.message || 'Ultra run failed');
    } finally {
      setUltraRunning(false);
    }
  };

  const qualityColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    if (score >= 60) return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
  };

  const runSystemSelfCheck = async () => {
    setSystemBusy(true);
    try {
      await systemApi.checkIdempotency({
        scope: 'superadmin:self-check',
        idempotency_key: `self-check-${Date.now()}`,
        request_hash: 'system-health-smoke',
        response_payload: { source: 'marketplace_seo_control', ok: true },
        status_code: 200,
      });

      await systemApi.reportError({
        module_name: 'superadmin_panel',
        severity: 'info',
        error_message: 'Superadmin self-check heartbeat',
        auto_fix_attempted: false,
        auto_fix_status: 'pending',
      });

      toast.success('System self-check submitted');
      await fetchAll();
    } catch (error: any) {
      toast.error(error?.message || 'System self-check failed');
    } finally {
      setSystemBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Marketplace SEO Score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{seoAverage}</p>
            <Progress value={seoAverage} className="mt-3 h-2" />
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Leads Converted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{leadAnalytics?.converted || 0}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {leadAnalytics?.conversion_rate || 0}% conversion rate
            </p>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Qualified Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{leadAnalytics?.qualified || 0}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Out of {leadAnalytics?.total || 0} total leads
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Indexing Pending</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{ultraStats?.indexing_pending || 0}</p></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Keyword Updates (24h)</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{ultraStats?.keyword_updates_24h || 0}</p></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">SEO ROI / ADS ROI</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{ultraStats?.avg_seo_roi || 0} / {ultraStats?.avg_ads_roi || 0}</p></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Critical Alerts</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{ultraStats?.critical_alerts || 0}</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Superadmin Leads / Ads</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{systemSummary?.leads_total || 0} / {systemSummary?.ads_campaigns_total || 0}</p></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Revenue / AI Cost</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{systemSummary?.revenue_total || 0} / {systemSummary?.ai_cost_total || 0}</p></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Circuits Open / Queue Pending</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{resilienceSummary?.circuit_open || 0} / {resilienceSummary?.queue_pending || 0}</p></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Safety Blocks / Zero Trust Deny</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{securitySummary?.ai_safety_blocked || 0} / {securitySummary?.zero_trust_denies || 0}</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Prompt Injection Blocks</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{securitySummary?.prompt_injection_blocked || 0}</p></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Critical System Alerts</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{securitySummary?.critical_alerts || 0}</p></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Consent / Tax Applied</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{complianceSummary?.consent_total || 0} / {complianceSummary?.tax_applied_events || 0}</p></CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium">Billing Failures / Active Subs</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{complianceSummary?.billing_failures_open || 0} / {complianceSummary?.subscriptions_active || 0}</p></CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-lg">Marketplace SEO Control Panel</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product"
              className="w-48"
            />
            <Button onClick={fetchAll} variant="outline" className="gap-2" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
            <Button onClick={runAutomation} className="gap-2" disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run SEO Engine
            </Button>
            <Button onClick={runUltraBrain} variant="default" className="gap-2" disabled={ultraRunning}>
              {ultraRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrainCircuit className="h-4 w-4" />}
              Run Ultra Brain
            </Button>
            <Button onClick={autoRouteLeads} variant="secondary" className="gap-2" disabled={routing}>
              {routing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}
              Auto Route Leads
            </Button>
            <Button onClick={runSystemSelfCheck} variant="outline" className="gap-2" disabled={systemBusy}>
              {systemBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Superadmin Self-Check
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>SEO Score</TableHead>
                <TableHead>Keyword Coverage</TableHead>
                <TableHead>CTR Est.</TableHead>
                <TableHead>Countries</TableHead>
                <TableHead>Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const metrics = row.seo_metrics;
                const score = Math.round(metrics?.seo_score || 0);
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-muted-foreground">/{row.slug}</div>
                    </TableCell>
                    <TableCell>{row.currency} {row.price}</TableCell>
                    <TableCell>
                      <Badge className={qualityColor(score)}>{score}</Badge>
                    </TableCell>
                    <TableCell>{Math.round(metrics?.keyword_coverage || 0)}%</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3 text-primary" />
                        {metrics?.ctr_estimate || 0}%
                      </div>
                    </TableCell>
                    <TableCell className="max-w-40 truncate">
                      {(metrics?.target_countries || []).join(', ') || '-'}
                    </TableCell>
                    <TableCell className="max-w-48 truncate">
                      {(metrics?.hashtags || []).slice(0, 3).join(' ') || '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!rows.length && !loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    No marketplace SEO data yet. Run the SEO engine to generate metrics.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Recent Automation Runs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {runs.map((run) => (
            <div key={run.id} className="rounded-lg border border-border p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{run.run_type} • {run.status}</p>
                <p className="text-xs text-muted-foreground">{new Date(run.created_at).toLocaleString()}</p>
              </div>
              <Badge variant="outline">
                {run.summary?.optimized_products || 0} optimized
              </Badge>
            </div>
          ))}
          {!runs.length && (
            <p className="text-sm text-muted-foreground">No automation runs recorded yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
