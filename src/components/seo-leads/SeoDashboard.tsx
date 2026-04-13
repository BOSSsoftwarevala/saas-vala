import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  FileSearch,
  Target,
  Globe2,
  Users,
  TrendingUp,
  Cpu,
  RefreshCw,
  FileText,
  Link2,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area, BarChart, Bar } from 'recharts';

interface DashboardStats {
  totalPages: number;
  activeKeywords: number;
  leadsToday: number;
  leadsMonth: number;
  conversionRate: number;
  avgSeoScore: number;
  errorsCount: number;
  countryTraffic: { country: string; visits: number; percentage: number }[];
  leadSources: { name: string; value: number; color: string }[];
  seoGrowth: { date: string; pages: number; score: number }[];
  keywordRanks: { keyword: string; rank: number }[];
  recentScans: { action: string; result: string; created_at: string }[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--cyan))', 'hsl(var(--purple))'];

export function SeoDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalPages: 0,
    activeKeywords: 0,
    leadsToday: 0,
    leadsMonth: 0,
    conversionRate: 0,
    avgSeoScore: 0,
    errorsCount: 0,
    countryTraffic: [],
    leadSources: [],
    seoGrowth: [],
    keywordRanks: [],
    recentScans: [],
  });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    initializeProject();
  }, []);

  const initializeProject = async () => {
    try {
      // Get or create default project
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: projects } = await supabase
        .from('seo_projects')
        .select('id')
        .eq('user_id', user?.id)
        .limit(1);
      
      if (projects && projects.length > 0) {
        setProjectId(projects[0].id);
        fetchStats(projects[0].id);
      } else if (user) {
        // Create default project
        const { data: newProject, error } = await supabase
          .from('seo_projects')
          .insert({
            user_id: user.id,
            project_name: 'Default Project',
            domain: window.location.hostname,
          })
          .select('id')
          .single();
        
        if (newProject) {
          setProjectId(newProject.id);
          fetchStats(newProject.id);
        }
      }
    } catch (err) {
      console.error('Error initializing project:', err);
      setLoading(false);
    }
  };

  const fetchStats = async (pid: string) => {
    setLoading(true);
    try {
      // Fetch from NEW tables
      const { data: pages } = await supabase
        .from('seo_pages')
        .select('seo_score,status')
        .eq('project_id', pid);
      
      const { data: keywords } = await supabase
        .from('seo_keywords')
        .select('*')
        .eq('project_id', pid);
      
      const { data: errors } = await supabase
        .from('seo_errors')
        .select('id')
        .eq('project_id', pid)
        .eq('is_fixed', false);
      
      // Fetch seo_leads
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      
      const { data: leadsData } = await supabase
        .from('seo_leads')
        .select('*')
        .eq('project_id', pid);
      
      const leads = leadsData || [];
      const leadsToday = leads.filter(l => new Date(l.created_at!) >= today).length;
      const leadsMonth = leads.filter(l => new Date(l.created_at!) >= monthStart).length;
      const converted = leads.filter(l => l.status === 'converted').length;
      const conversionRate = leads.length > 0 ? (converted / leads.length) * 100 : 0;

      // Lead sources from seo_leads
      const sourceCounts: Record<string, number> = {};
      leads.forEach(l => {
        sourceCounts[l.source || 'other'] = (sourceCounts[l.source || 'other'] || 0) + 1;
      });
      
      const leadSources = Object.entries(sourceCounts).map(([name, value], idx) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        color: COLORS[idx % COLORS.length],
      }));

      // Country data from seo_leads
      const countryMap: Record<string, number> = {};
      leads.forEach(l => {
        const country = l.geo_country || 'Unknown';
        countryMap[country] = (countryMap[country] || 0) + 1;
      });
      
      const totalVisits = Object.values(countryMap).reduce((a, b) => a + b, 0) || 1;
      const countryTraffic = Object.entries(countryMap)
        .map(([country, visits]) => ({
          country,
          visits,
          percentage: Math.round((visits / totalVisits) * 100),
        }))
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 6);

      // Pages added per day (last 7 days)
      const seoGrowth = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dayStr = d.toISOString().split('T')[0];
        return {
          date: d.toLocaleDateString('en-US', { weekday: 'short' }),
          pages: pages?.filter(p => p.status !== 'error').length || 0,
          score: pages && pages.length > 0
            ? Math.round(pages.reduce((sum, p) => sum + (p.seo_score || 0), 0) / pages.length)
            : 0,
        };
      });

      // Keyword rankings
      const keywordRanks = (keywords || [])
        .filter(k => k.current_rank !== null)
        .slice(0, 5)
        .map(k => ({
          keyword: k.keyword,
          rank: k.current_rank || 0,
        }));

      // Recent scan logs
      const { data: recentLogs } = await supabase
        .from('seo_logs')
        .select('action,result,created_at')
        .eq('project_id', pid)
        .order('created_at', { ascending: false })
        .limit(5);

      const avgScore = pages && pages.length > 0
        ? Math.round(pages.reduce((sum, p) => sum + (p.seo_score || 0), 0) / pages.length)
        : 0;

      setStats({
        totalPages: pages?.length || 0,
        activeKeywords: keywords?.length || 0,
        leadsToday,
        leadsMonth,
        conversionRate,
        avgSeoScore: avgScore,
        errorsCount: errors?.length || 0,
        countryTraffic,
        leadSources: leadSources.length > 0 ? leadSources : [],
        seoGrowth,
        keywordRanks,
        recentScans: recentLogs || [],
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const runFullSeoScan = async () => {
    if (!projectId) {
      toast.error('No project selected');
      return;
    }
    setScanning(true);
    toast.info('Starting full SEO scan...');
    try {
      const { error } = await supabase.functions.invoke('seo-automation-engine', {
        body: { 
          action: 'full-scan', 
          projectId,
          scanType: 'comprehensive'
        },
      });
      if (error) throw error;
      toast.success('SEO scan completed!', { description: 'All pages analyzed.' });
      if (projectId) await fetchStats(projectId);
    } catch (err: any) {
      toast.error('SEO scan failed: ' + (err.message || 'Unknown error'));
    } finally {
      setScanning(false);
    }
  };

  const syncWithGoogle = async () => {
    if (!projectId) {
      toast.error('No project selected');
      return;
    }
    setSyncing(true);
    toast.info('Syncing with Google Search Console...');
    try {
      const { data: project } = await supabase
        .from('seo_projects')
        .select('domain')
        .eq('id', projectId)
        .single();
      
      const { error } = await supabase.functions.invoke('seo-automation-engine', {
        body: { 
          action: 'submit-sitemap', 
          siteUrl: project?.domain || window.location.origin,
          projectId
        },
      });
      if (error) throw error;
      toast.success('Google sync complete!', { description: 'Sitemap submitted.' });
    } catch (err: any) {
      toast.error('Google sync failed: ' + (err.message || 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  };

  const generateMetaForAll = async () => {
    if (!projectId) {
      toast.error('No project selected');
      return;
    }
    toast.info('Generating meta tags for all pages...');
    try {
      const { error } = await supabase.functions.invoke('seo-optimize', {
        body: { 
          action: 'generate-meta-all',
          projectId
        },
      });
      if (error) throw error;
      toast.success('Meta tags generated!', { description: 'AI meta tags applied.' });
      if (projectId) await fetchStats(projectId);
    } catch (err: any) {
      toast.error('Meta generation failed: ' + (err.message || 'Unknown error'));
    }
  };

  const exportLeads = async () => {
    if (!projectId) {
      toast.error('No project selected');
      return;
    }
    const { data } = await supabase
      .from('seo_leads')
      .select('*')
      .eq('project_id', projectId);
    
    if (!data?.length) {
      toast.error('No leads to export');
      return;
    }
    
    const csv = [
      ['Name', 'Email', 'Phone', 'Company', 'Source', 'Status', 'Score', 'Temperature', 'Created'].join(','),
      ...data.map(l => [
        l.name, l.email, l.phone, l.company, l.source, l.status, 
        l.score, l.temperature, l.created_at
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seo-leads-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Leads exported!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards - REAL DATA ONLY */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="glass-card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <FileSearch className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.totalPages}</p>
                <p className="text-xs text-muted-foreground">Pages Indexed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
                <Target className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.activeKeywords}</p>
                <p className="text-xs text-muted-foreground">Active Keywords</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-cyan/20 flex items-center justify-center">
                <Globe2 className="h-5 w-5 text-cyan" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.countryTraffic.length}</p>
                <p className="text-xs text-muted-foreground">Countries</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.leadsToday}/{stats.leadsMonth}</p>
                <p className="text-xs text-muted-foreground">Leads Today/Mo</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-purple" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.conversionRate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Conv. Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg ${stats.avgSeoScore >= 80 ? 'bg-green-500/20' : stats.avgSeoScore >= 60 ? 'bg-amber-500/20' : 'bg-red-500/20'} flex items-center justify-center`}>
                <CheckCircle2 className={`h-5 w-5 ${stats.avgSeoScore >= 80 ? 'text-green-500' : stats.avgSeoScore >= 60 ? 'text-amber-500' : 'text-red-500'}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${stats.avgSeoScore >= 80 ? 'text-green-500' : stats.avgSeoScore >= 60 ? 'text-amber-500' : 'text-red-500'}`}>{stats.avgSeoScore}</p>
                <p className="text-xs text-muted-foreground">Avg SEO Score</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card-hover">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg ${stats.errorsCount === 0 ? 'bg-green-500/20' : 'bg-red-500/20'} flex items-center justify-center`}>
                <AlertCircle className={`h-5 w-5 ${stats.errorsCount === 0 ? 'text-green-500' : 'text-red-500'}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${stats.errorsCount === 0 ? 'text-green-500' : 'text-red-500'}`}>{stats.errorsCount}</p>
                <p className="text-xs text-muted-foreground">SEO Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={runFullSeoScan} disabled={scanning} className="gap-2">
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Run Full SEO Scan
        </Button>
        <Button onClick={generateMetaForAll} variant="outline" className="gap-2">
          <FileText className="h-4 w-4" />
          Generate Meta for All
        </Button>
        <Button onClick={syncWithGoogle} disabled={syncing} variant="outline" className="gap-2">
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          Sync with Google
        </Button>
        <Button onClick={exportLeads} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export Leads
        </Button>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SEO Growth Chart */}
        <Card className="glass-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">SEO Performance (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.seoGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--success))" fontSize={12} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }} 
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="pages" name="Pages" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="score" name="Avg Score" stroke="hsl(var(--success))" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Lead Source Pie Chart */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Lead Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.leadSources}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.leadSources.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {stats.leadSources.map((source, idx) => (
                <Badge key={idx} variant="outline" style={{ borderColor: source.color, color: source.color }}>
                  {source.name}: {source.value}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Country Traffic */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Country-Wise Traffic</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {stats.countryTraffic.length > 0 ? stats.countryTraffic.map((item, idx) => (
              <div key={idx} className="p-4 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Globe2 className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">{item.country}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{item.visits}</p>
                <Progress value={item.percentage} className="h-1 mt-2" />
                <p className="text-xs text-muted-foreground mt-1">{item.percentage}% of traffic</p>
              </div>
            )) : (
              <p className="col-span-full text-center text-muted-foreground py-4">
                No country data available yet. Leads will populate this data.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity & Keyword Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Scans */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Recent SEO Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentScans.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No recent activity. Run a scan to see activity here.
              </p>
            ) : (
              <div className="space-y-3">
                {stats.recentScans.map((scan, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${scan.result === 'success' ? 'bg-green-500' : scan.result === 'error' ? 'bg-red-500' : 'bg-amber-500'}`} />
                      <span className="text-sm font-medium">{scan.action}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(scan.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Keyword Rankings */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Top Keyword Rankings
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.keywordRanks.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No keyword rankings yet. Add keywords to track rankings.
              </p>
            ) : (
              <div className="space-y-3">
                {stats.keywordRanks.map((kw, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <span className="text-sm font-medium truncate max-w-[200px]">{kw.keyword}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${kw.rank <= 10 ? 'text-green-500' : kw.rank <= 30 ? 'text-amber-500' : 'text-red-500'}`}>
                        #{kw.rank}
                      </span>
                      <Progress value={Math.max(0, 100 - kw.rank)} className="w-16 h-2" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
