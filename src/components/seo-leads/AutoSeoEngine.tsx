import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  Play,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileText,
  Image,
  Link2,
  Code,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface SeoFeature {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  status: 'active' | 'pending' | 'running';
}

interface PageSeo {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  keywords: string[];
  status: 'optimized' | 'pending' | 'error' | 'scanning';
  score: number;
  h1: string | null;
  word_count: number;
  has_sitemap: boolean;
  has_robots: boolean;
  page_speed: number | null;
  mobile_friendly: boolean | null;
  scan_errors: any[];
}

const defaultFeatures: SeoFeature[] = [
  { id: 'meta-title', name: 'Auto Meta Title', description: 'AI-generated titles for all pages', enabled: true, status: 'active' },
  { id: 'meta-desc', name: 'Auto Meta Description', description: 'AI-powered descriptions', enabled: true, status: 'active' },
  { id: 'keywords', name: 'Auto Keywords', description: 'Smart keyword extraction', enabled: true, status: 'active' },
  { id: 'og-tags', name: 'Auto OG Tags', description: 'Facebook, WhatsApp, Twitter', enabled: true, status: 'active' },
  { id: 'schema', name: 'Auto Schema', description: 'Product, SaaS, FAQ, Review', enabled: true, status: 'active' },
  { id: 'sitemap', name: 'Auto Sitemap', description: 'sitemap.xml generation', enabled: true, status: 'active' },
  { id: 'robots', name: 'Auto Robots.txt', description: 'Search engine directives', enabled: true, status: 'active' },
  { id: 'internal-links', name: 'Auto Internal Linking', description: 'Smart link suggestions', enabled: false, status: 'pending' },
  { id: 'alt-tags', name: 'Auto Image Alt Tags', description: 'AI-powered alt text', enabled: true, status: 'active' },
];

export function AutoSeoEngine() {
  const [features, setFeatures] = useState<SeoFeature[]>(defaultFeatures);
  const [pages, setPages] = useState<PageSeo[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    fetchSeoData();
  }, []);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<any>(null);

  useEffect(() => {
    getProjectId();
  }, []);

  const getProjectId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: projects } = await supabase
      .from('seo_projects')
      .select('id')
      .eq('user_id', user?.id)
      .limit(1);
    
    if (projects?.[0]) {
      setProjectId(projects[0].id);
      fetchSeoData(projects[0].id);
    }
  };

  const fetchSeoData = async (pid: string) => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('seo_pages')
        .select('*')
        .eq('project_id', pid)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (data) {
        setPages(data.map(d => ({
          id: d.id,
          url: d.url,
          title: d.title,
          description: d.description,
          keywords: d.keywords || [],
          status: d.status as any,
          score: d.seo_score || 0,
          h1: d.h1,
          word_count: d.word_count || 0,
          has_sitemap: d.has_sitemap,
          has_robots: d.has_robots,
          page_speed: d.page_speed,
          mobile_friendly: d.mobile_friendly,
          scan_errors: d.scan_errors || [],
        })));
      }
    } catch (error) {
      console.error('Error fetching SEO data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = (id: string) => {
    setFeatures(prev => prev.map(f => 
      f.id === id ? { ...f, enabled: !f.enabled } : f
    ));
    toast.success('Feature updated');
  };

  const runAutoSeo = async () => {
    setRunning(true);
    setProgress(0);
    setProgress(20);

    try {
      const { error } = await supabase.functions.invoke('seo-automation-engine', {
        body: {
          run_type: 'full_scan',
          trigger: 'manual',
          limit: 200,
        },
      });
      if (error) throw error;

      setProgress(85);
      if (projectId) await fetchSeoData(projectId);
      toast.success('Auto SEO completed!');
    } catch (err: any) {
      toast.error('Scan failed: ' + err.message);
    } finally {
      setRunning(false);
      setProgress(100);
    }
  };

  const scanSinglePage = async (pageId: string) => {
    try {
      const { error } = await supabase.functions.invoke('seo-automation-engine', {
        body: { 
          action: 'scan-page', 
          pageId,
          projectId
        },
      });
      
      if (error) throw error;
      
      if (projectId) await fetchSeoData(projectId);
      toast.success('Page scanned successfully');
    } catch (err: any) {
      toast.error('Page scan failed: ' + err.message);
    }
  };

  const runFullScan = async () => {
    if (!projectId) {
      toast.error('No project selected');
      return;
    }
    setRunning(true);
    setProgress(0);
    toast.info('Starting comprehensive SEO scan...');
    
    try {
      const { data, error } = await supabase.functions.invoke('seo-automation-engine', {
        body: { 
          action: 'full-scan', 
          projectId,
          features: features.filter(f => f.enabled).map(f => f.id),
          scanType: 'comprehensive'
        },
      });
      
      if (error) throw error;
      
      toast.success('SEO scan completed!', {
        description: `Scanned ${data?.pagesScanned || 0} pages, found ${data?.issuesFound || 0} issues.`
      });
      if (projectId) await fetchSeoData(projectId);
    } catch (err: any) {
      toast.error('Scan failed: ' + err.message);
    } finally {
      setRunning(false);
      setProgress(100);
    }
  };

  const rollbackChanges = async () => {
    toast.info('Refreshing latest persisted SEO state...');
    try {
      if (projectId) await fetchSeoData(projectId);
      toast.success('SEO state restored from database');
    } catch {
      toast.error('Failed to restore SEO state');
    }
  };

  const previewMeta = (page: PageSeo) => {
    toast.info(`Preview: ${page.url}`, {
      description: page.title || 'No title set',
    });
  };

  const applyToAll = async () => {
    toast.info('Applying SEO settings to all pages...');
    try {
      const { error } = await supabase.functions.invoke('seo-automation-engine', {
        body: {
          run_type: 'apply_all',
          trigger: 'manual',
          limit: 200,
        },
      });
      if (error) throw error;
      await fetchSeoData();
      toast.success('Applied to all pages!');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to apply SEO settings');
    }
  };

  const getStatusBadge = (status: PageSeo['status']) => {
    switch (status) {
      case 'optimized':
        return <Badge className="bg-success/20 text-success border-success/30">Optimized</Badge>;
      case 'pending':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Pending</Badge>;
      case 'error':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Error</Badge>;
      case 'scanning':
        return <Badge className="bg-primary/20 text-primary border-primary/30"><Loader2 className="h-3 w-3 animate-spin mr-1 inline" />Scanning</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className="space-y-6">
      {/* Feature Toggles */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Auto SEO Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature) => (
              <div
                key={feature.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${feature.enabled ? 'bg-primary/10' : 'bg-muted'}`}>
                    {feature.id.includes('meta') ? <FileText className={`h-4 w-4 ${feature.enabled ? 'text-primary' : 'text-muted-foreground'}`} /> :
                     feature.id.includes('image') || feature.id.includes('alt') ? <Image className={`h-4 w-4 ${feature.enabled ? 'text-primary' : 'text-muted-foreground'}`} /> :
                     feature.id.includes('link') ? <Link2 className={`h-4 w-4 ${feature.enabled ? 'text-primary' : 'text-muted-foreground'}`} /> :
                     <Code className={`h-4 w-4 ${feature.enabled ? 'text-primary' : 'text-muted-foreground'}`} />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{feature.name}</p>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
                <Switch
                  checked={feature.enabled}
                  onCheckedChange={() => toggleFeature(feature.id)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={runAutoSeo} disabled={running} className="gap-2">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run Auto SEO
        </Button>
        <Button onClick={applyToAll} variant="outline" className="gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Apply to All
        </Button>
        <Button onClick={rollbackChanges} variant="outline" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Rollback Changes
        </Button>
      </div>

      {/* Progress Bar */}
      {running && (
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Auto SEO Progress</span>
                <span className="text-primary">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pages Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Pages SEO Status</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : pages.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No pages found. Run Auto SEO to scan and optimize pages.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>URL</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Keywords</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((page) => (
                  <TableRow key={page.id} className="border-border">
                    <TableCell className="font-mono text-xs max-w-48 truncate">
                      {page.url}
                    </TableCell>
                    <TableCell className="max-w-48 truncate">
                      {page.title || <span className="text-muted-foreground">Not set</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap max-w-32">
                        {page.keywords.slice(0, 2).map((kw, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {kw}
                          </Badge>
                        ))}
                        {page.keywords.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{page.keywords.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`font-bold ${getScoreColor(page.score)}`}>
                        {page.score}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(page.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => previewMeta(page)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
