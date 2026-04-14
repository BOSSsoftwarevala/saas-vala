import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  ArrowLeft, TrendingUp, Search, Globe, BarChart3, Users, Link2, Zap,
  CheckCircle, XCircle, AlertCircle, Eye, Download, RefreshCw, Target,
  FileText, Megaphone, Shield, Settings, Smartphone, Package, DollarSign,
  Loader2,
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  thumbnail_url: string | null;
  rating: number;
  status: string;
}

interface ProductSeo {
  id: string;
  product_id: string;
  slug: string;
  title: string;
  meta_description: string | null;
  keywords: string[];
  hashtags: string[];
  seo_score: number;
  target_country: string;
  target_language: string;
  keyword_positions: any;
  impressions: number;
  clicks: number;
  ctr: number;
  content_score: number;
  content_gap: any;
  indexed_at: string | null;
  last_indexed_at: string | null;
  index_status: string;
  page_speed_score: number;
  schema_status: string;
  hreflang_status: string;
  backlink_count: number;
  backlink_quality_score: number;
  internal_link_score: number;
  auto_update_enabled: boolean;
  auto_update_timer: number;
  trend_match_score: number;
  competitor_data: any;
  revenue_generated: number;
  created_at: string;
  updated_at: string;
}

export default function ProductSeoDashboard() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [seoData, setSeoData] = useState<ProductSeo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (slug) {
      fetchProductAndSeo();
    }
  }, [slug]);

  const fetchProductAndSeo = async () => {
    setLoading(true);
    try {
      const [productRes, seoRes] = await Promise.all([
        supabase.from('marketplace_products').select('*').eq('slug', slug).single(),
        supabase.from('product_seo').select('*').eq('slug', slug).single(),
      ]);

      if (productRes.data) {
        setProduct(productRes.data);
      }
      if (seoRes.data) {
        setSeoData(seoRes.data);
      } else if (productRes.data) {
        // Create SEO record if it doesn't exist
        const { data: newSeo } = await supabase.from('product_seo').insert({
          product_id: productRes.data.id,
          slug: productRes.data.slug,
          title: productRes.data.name,
          meta_description: productRes.data.description || '',
          keywords: [],
          hashtags: [],
          seo_score: 0,
          target_country: 'IN',
          target_language: 'en',
        }).select().single();
        if (newSeo) setSeoData(newSeo);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load product SEO data');
    } finally {
      setLoading(false);
    }
  };

  const calculateSeoHealthScore = () => {
    if (!seoData) return 0;
    const scores = [
      seoData.seo_score,
      seoData.content_score,
      seoData.page_speed_score,
      seoData.backlink_quality_score,
      seoData.internal_link_score,
      seoData.trend_match_score,
    ].filter((s) => s !== null && s !== undefined);
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { color: string; icon: any }> = {
      indexed: { color: 'default', icon: CheckCircle },
      pending: { color: 'secondary', icon: AlertCircle },
      error: { color: 'destructive', icon: XCircle },
      valid: { color: 'default', icon: CheckCircle },
    };
    const config = statusMap[status] || statusMap.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.color as any} className="gap-1">
        <Icon className="h-3 w-3" />
        {status.toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Product not found</p>
          <Button onClick={() => navigate('/marketplace')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Marketplace
          </Button>
        </div>
      </div>
    );
  }

  const healthScore = calculateSeoHealthScore();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/marketplace')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">SEO Dashboard</h1>
                <p className="text-sm text-muted-foreground">{product.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchProductAndSeo}>
                <RefreshCw className="h-4 w-4 mr-2" /> Refresh
              </Button>
              <Button size="sm">
                <Download className="h-4 w-4 mr-2" /> Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Health Score Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> SEO Health Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${getScoreColor(healthScore)}`}>
                {healthScore}/100
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Eye className="h-4 w-4" /> Impressions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{seoData?.impressions || 0}</div>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" /> Clicks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{seoData?.clicks || 0}</div>
              <p className="text-xs text-muted-foreground">CTR: {seoData?.ctr || 0}%</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">₹{seoData?.revenue_generated || 0}</div>
              <p className="text-xs text-muted-foreground">From SEO</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="seo">SEO Table</TabsTrigger>
            <TabsTrigger value="keywords">Keywords</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="global">Global</TabsTrigger>
            <TabsTrigger value="actions">Actions</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4" /> Product Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4">
                    {product.thumbnail_url && (
                      <img src={product.thumbnail_url} alt={product.name} className="w-20 h-20 rounded-lg object-cover" />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold">{product.name}</h3>
                      <p className="text-sm text-muted-foreground">{product.description?.substring(0, 100)}...</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">₹{product.price}</Badge>
                        <Badge variant={product.status === 'published' ? 'default' : 'secondary'}>
                          {product.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Index Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Globe className="h-4 w-4" /> Index Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Google Index</span>
                    {getStatusBadge(seoData?.index_status || 'pending')}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Schema Status</span>
                    {getStatusBadge(seoData?.schema_status || 'pending')}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Hreflang Status</span>
                    {getStatusBadge(seoData?.hreflang_status || 'pending')}
                  </div>
                  {seoData?.last_indexed_at && (
                    <p className="text-xs text-muted-foreground">
                      Last indexed: {new Date(seoData.last_indexed_at).toLocaleDateString()}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* APK & License */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Smartphone className="h-4 w-4" /> APK & License
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">APK Available</span>
                    <Badge variant="secondary">Not Configured</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">License System</span>
                    <Badge variant="default">Active</Badge>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    Configure APK
                  </Button>
                </CardContent>
              </Card>

              {/* Auto Update */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" /> Auto Update
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Auto Update</span>
                    <Switch checked={seoData?.auto_update_enabled || false} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Update Timer</span>
                    <span className="text-sm">{seoData?.auto_update_timer || 7} days</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* SEO Table Tab */}
          <TabsContent value="seo">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">SEO Metrics Table</CardTitle>
                <CardDescription>Detailed SEO metrics and performance data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="p-2 text-left">Metric</th>
                        <th className="p-2 text-left">Value</th>
                        <th className="p-2 text-left">Status</th>
                        <th className="p-2 text-left">Last Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium">SEO Score</td>
                        <td className="p-2">{seoData?.seo_score || 0}/100</td>
                        <td className="p-2">{getStatusBadge(seoData?.seo_score >= 80 ? 'indexed' : seoData?.seo_score >= 60 ? 'pending' : 'error')}</td>
                        <td className="p-2 text-muted-foreground">{seoData?.updated_at ? new Date(seoData.updated_at).toLocaleDateString() : '—'}</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium">Content Score</td>
                        <td className="p-2">{seoData?.content_score || 0}/100</td>
                        <td className="p-2">{getStatusBadge(seoData?.content_score >= 80 ? 'indexed' : seoData?.content_score >= 60 ? 'pending' : 'error')}</td>
                        <td className="p-2 text-muted-foreground">{seoData?.updated_at ? new Date(seoData.updated_at).toLocaleDateString() : '—'}</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium">Page Speed Score</td>
                        <td className="p-2">{seoData?.page_speed_score || 0}/100</td>
                        <td className="p-2">{getStatusBadge(seoData?.page_speed_score >= 80 ? 'indexed' : seoData?.page_speed_score >= 60 ? 'pending' : 'error')}</td>
                        <td className="p-2 text-muted-foreground">{seoData?.updated_at ? new Date(seoData.updated_at).toLocaleDateString() : '—'}</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium">Backlink Quality Score</td>
                        <td className="p-2">{seoData?.backlink_quality_score || 0}/100</td>
                        <td className="p-2">{getStatusBadge(seoData?.backlink_quality_score >= 80 ? 'indexed' : seoData?.backlink_quality_score >= 60 ? 'pending' : 'error')}</td>
                        <td className="p-2 text-muted-foreground">{seoData?.updated_at ? new Date(seoData.updated_at).toLocaleDateString() : '—'}</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium">Internal Link Score</td>
                        <td className="p-2">{seoData?.internal_link_score || 0}/100</td>
                        <td className="p-2">{getStatusBadge(seoData?.internal_link_score >= 80 ? 'indexed' : seoData?.internal_link_score >= 60 ? 'pending' : 'error')}</td>
                        <td className="p-2 text-muted-foreground">{seoData?.updated_at ? new Date(seoData.updated_at).toLocaleDateString() : '—'}</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium">Trend Match Score</td>
                        <td className="p-2">{seoData?.trend_match_score || 0}/100</td>
                        <td className="p-2">{getStatusBadge(seoData?.trend_match_score >= 80 ? 'indexed' : seoData?.trend_match_score >= 60 ? 'pending' : 'error')}</td>
                        <td className="p-2 text-muted-foreground">{seoData?.updated_at ? new Date(seoData.updated_at).toLocaleDateString() : '—'}</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium">Keyword Positions</td>
                        <td className="p-2">{seoData?.keyword_positions ? Object.keys(seoData.keyword_positions).length : 0} keywords</td>
                        <td className="p-2">{getStatusBadge('pending')}</td>
                        <td className="p-2 text-muted-foreground">{seoData?.updated_at ? new Date(seoData.updated_at).toLocaleDateString() : '—'}</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium">Content Gap</td>
                        <td className="p-2">{seoData?.content_gap ? Object.keys(seoData.content_gap).length : 0} gaps</td>
                        <td className="p-2">{getStatusBadge('pending')}</td>
                        <td className="p-2 text-muted-foreground">{seoData?.updated_at ? new Date(seoData.updated_at).toLocaleDateString() : '—'}</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium">Index Status</td>
                        <td className="p-2">{seoData?.index_status || 'pending'}</td>
                        <td className="p-2">{getStatusBadge(seoData?.index_status || 'pending')}</td>
                        <td className="p-2 text-muted-foreground">{seoData?.last_indexed_at ? new Date(seoData.last_indexed_at).toLocaleDateString() : '—'}</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium">Schema Status</td>
                        <td className="p-2">{seoData?.schema_status || 'pending'}</td>
                        <td className="p-2">{getStatusBadge(seoData?.schema_status || 'pending')}</td>
                        <td className="p-2 text-muted-foreground">{seoData?.updated_at ? new Date(seoData.updated_at).toLocaleDateString() : '—'}</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium">Hreflang Status</td>
                        <td className="p-2">{seoData?.hreflang_status || 'pending'}</td>
                        <td className="p-2">{getStatusBadge(seoData?.hreflang_status || 'pending')}</td>
                        <td className="p-2 text-muted-foreground">{seoData?.updated_at ? new Date(seoData.updated_at).toLocaleDateString() : '—'}</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium">Backlink Count</td>
                        <td className="p-2">{seoData?.backlink_count || 0}</td>
                        <td className="p-2">{getStatusBadge(seoData?.backlink_count > 0 ? 'indexed' : 'pending')}</td>
                        <td className="p-2 text-muted-foreground">{seoData?.updated_at ? new Date(seoData.updated_at).toLocaleDateString() : '—'}</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium">Target Country</td>
                        <td className="p-2">{seoData?.target_country || 'IN'}</td>
                        <td className="p-2">{getStatusBadge('indexed')}</td>
                        <td className="p-2 text-muted-foreground">{seoData?.updated_at ? new Date(seoData.updated_at).toLocaleDateString() : '—'}</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium">Target Language</td>
                        <td className="p-2">{seoData?.target_language || 'en'}</td>
                        <td className="p-2">{getStatusBadge('indexed')}</td>
                        <td className="p-2 text-muted-foreground">{seoData?.updated_at ? new Date(seoData.updated_at).toLocaleDateString() : '—'}</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium">Keywords Count</td>
                        <td className="p-2">{seoData?.keywords?.length || 0}</td>
                        <td className="p-2">{getStatusBadge(seoData?.keywords && seoData.keywords.length > 0 ? 'indexed' : 'pending')}</td>
                        <td className="p-2 text-muted-foreground">{seoData?.updated_at ? new Date(seoData.updated_at).toLocaleDateString() : '—'}</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium">Hashtags Count</td>
                        <td className="p-2">{seoData?.hashtags?.length || 0}</td>
                        <td className="p-2">{getStatusBadge(seoData?.hashtags && seoData.hashtags.length > 0 ? 'indexed' : 'pending')}</td>
                        <td className="p-2 text-muted-foreground">{seoData?.updated_at ? new Date(seoData.updated_at).toLocaleDateString() : '—'}</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium">Auto Update Enabled</td>
                        <td className="p-2">{seoData?.auto_update_enabled ? 'Yes' : 'No'}</td>
                        <td className="p-2">{getStatusBadge(seoData?.auto_update_enabled ? 'indexed' : 'pending')}</td>
                        <td className="p-2 text-muted-foreground">{seoData?.updated_at ? new Date(seoData.updated_at).toLocaleDateString() : '—'}</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium">Auto Update Timer</td>
                        <td className="p-2">{seoData?.auto_update_timer || 7} days</td>
                        <td className="p-2">{getStatusBadge('indexed')}</td>
                        <td className="p-2 text-muted-foreground">{seoData?.updated_at ? new Date(seoData.updated_at).toLocaleDateString() : '—'}</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium">Competitor Data</td>
                        <td className="p-2">{seoData?.competitor_data ? Object.keys(seoData.competitor_data).length : 0} competitors</td>
                        <td className="p-2">{getStatusBadge('pending')}</td>
                        <td className="p-2 text-muted-foreground">{seoData?.updated_at ? new Date(seoData.updated_at).toLocaleDateString() : '—'}</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium">Revenue Generated</td>
                        <td className="p-2">₹{seoData?.revenue_generated || 0}</td>
                        <td className="p-2">{getStatusBadge(seoData?.revenue_generated > 0 ? 'indexed' : 'pending')}</td>
                        <td className="p-2 text-muted-foreground">{seoData?.updated_at ? new Date(seoData.updated_at).toLocaleDateString() : '—'}</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium">Slug</td>
                        <td className="p-2">{seoData?.slug || '—'}</td>
                        <td className="p-2">{getStatusBadge('indexed')}</td>
                        <td className="p-2 text-muted-foreground">{seoData?.updated_at ? new Date(seoData.updated_at).toLocaleDateString() : '—'}</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium">Title</td>
                        <td className="p-2 truncate max-w-xs">{seoData?.title || '—'}</td>
                        <td className="p-2">{getStatusBadge(seoData?.title ? 'indexed' : 'error')}</td>
                        <td className="p-2 text-muted-foreground">{seoData?.updated_at ? new Date(seoData.updated_at).toLocaleDateString() : '—'}</td>
                      </tr>
                      <tr className="border-t border-border">
                        <td className="p-2 font-medium">Meta Description</td>
                        <td className="p-2 truncate max-w-xs">{seoData?.meta_description ? seoData.meta_description.substring(0, 50) + '...' : '—'}</td>
                        <td className="p-2">{getStatusBadge(seoData?.meta_description ? 'indexed' : 'error')}</td>
                        <td className="p-2 text-muted-foreground">{seoData?.updated_at ? new Date(seoData.updated_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Keywords Tab */}
          <TabsContent value="keywords">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Keyword Tracking</CardTitle>
                <CardDescription>Track keyword positions and performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Add Keyword Form */}
                  <div className="flex gap-2">
                    <Input placeholder="Add new keyword..." className="h-9 text-sm" />
                    <Button size="sm" className="h-9">
                      <Plus className="h-4 w-4 mr-2" /> Add
                    </Button>
                  </div>

                  {/* Keywords List */}
                  {seoData?.keywords && seoData.keywords.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40">
                          <tr>
                            <th className="p-2 text-left">Keyword</th>
                            <th className="p-2 text-center">Position</th>
                            <th className="p-2 text-center">Change</th>
                            <th className="p-2 text-center">Volume</th>
                            <th className="p-2 text-center">Difficulty</th>
                            <th className="p-2 text-center">Status</th>
                            <th className="p-2 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {seoData.keywords.map((keyword, index) => (
                            <tr key={index} className="border-t border-border">
                              <td className="p-2 font-medium">{keyword}</td>
                              <td className="p-2 text-center">
                                {seoData.keyword_positions?.[keyword] || '—'}
                              </td>
                              <td className="p-2 text-center">
                                <span className="text-green-500">↑</span>
                              </td>
                              <td className="p-2 text-center">—</td>
                              <td className="p-2 text-center">—</td>
                              <td className="p-2 text-center">
                                {getStatusBadge('pending')}
                              </td>
                              <td className="p-2 text-center">
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No keywords tracked yet</p>
                      <p className="text-xs mt-2">Add keywords to start tracking their performance</p>
                    </div>
                  )}

                  {/* Hashtags */}
                  {seoData?.hashtags && seoData.hashtags.length > 0 && (
                    <div className="border-t border-border pt-4">
                      <h4 className="text-sm font-medium mb-3">Hashtags</h4>
                      <div className="flex flex-wrap gap-2">
                        {seoData.hashtags.map((hashtag, index) => (
                          <Badge key={index} variant="secondary">
                            #{hashtag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Content Editor */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Content Editor</CardTitle>
                  <CardDescription>Edit your SEO content and see live preview</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Title</label>
                    <Input
                      value={seoData?.title || ''}
                      onChange={(e) => setSeoData({ ...seoData!, title: e.target.value })}
                      className="h-9 text-sm"
                      placeholder="Page title"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {seoData?.title?.length || 0}/60 characters
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Meta Description</label>
                    <textarea
                      value={seoData?.meta_description || ''}
                      onChange={(e) => setSeoData({ ...seoData!, meta_description: e.target.value })}
                      className="w-full h-24 px-3 py-2 text-sm rounded-md border border-input bg-background"
                      placeholder="Meta description"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {seoData?.meta_description?.length || 0}/160 characters
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Slug</label>
                    <Input
                      value={seoData?.slug || ''}
                      onChange={(e) => setSeoData({ ...seoData!, slug: e.target.value })}
                      className="h-9 text-sm"
                      placeholder="URL slug"
                    />
                  </div>
                  <Button size="sm" className="w-full" onClick={() => {}}>
                    Save Changes
                  </Button>
                </CardContent>
              </Card>

              {/* Google SERP Preview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Google SERP Preview</CardTitle>
                  <CardDescription>See how your page appears in Google search results</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border border-border rounded-lg p-4 bg-white">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs">
                          {seoData?.title?.charAt(0) || 'S'}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-700">saasvala.com</p>
                          <p className="text-[10px] text-gray-500">
                            https://www.saasvala.com/product/{seoData?.slug || '...'}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-blue-600 hover:underline cursor-pointer">
                          {seoData?.title || product?.name || 'Page Title'}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {seoData?.meta_description || product?.description || 'Meta description will appear here...'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                    <h4 className="text-xs font-medium mb-2">SEO Tips</h4>
                    <ul className="text-[10px] text-muted-foreground space-y-1">
                      <li>• Keep title under 60 characters for optimal display</li>
                      <li>• Keep meta description under 160 characters</li>
                      <li>• Include primary keyword in title and description</li>
                      <li>• Make title compelling to increase click-through rate</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Traffic & Analytics</CardTitle>
                <CardDescription>View traffic data and performance analytics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Analytics implementation in progress</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Global Tab */}
          <TabsContent value="global">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Global Page Control</CardTitle>
                <CardDescription>Manage multi-country and multi-language pages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Global page control implementation in progress</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Actions Tab */}
          <TabsContent value="actions">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Auto Action Panel</CardTitle>
                <CardDescription>Automated SEO actions and optimizations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Auto action panel implementation in progress</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
