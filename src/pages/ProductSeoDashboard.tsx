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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="seo">SEO Table</TabsTrigger>
            <TabsTrigger value="keywords">Keywords</TabsTrigger>
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
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>SEO Table implementation in progress</p>
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
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Keyword tracking implementation in progress</p>
                </div>
              </CardContent>
            </Card>
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
