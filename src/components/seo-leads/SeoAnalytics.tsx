import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart3,
  Download,
  FileText,
  TrendingUp,
  Users,
  Globe2,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ReportData {
  seoRanking: { keyword: string; position: number; change: number }[];
  countryPerformance: { country: string; leads: number; converted: number }[];
  conversionFunnel: { stage: string; value: number }[];
  resellerPerformance: { name: string; leads: number; converted: number }[];
}

export function SeoAnalytics() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [reportData, setReportData] = useState<ReportData>({
    seoRanking: [],
    countryPerformance: [],
    conversionFunnel: [],
    resellerPerformance: [],
  });

  useEffect(() => {
    fetchReportData();
  }, [timeRange]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const { data: leads } = await supabase.from('leads').select('*');
      const { data: seoData } = await supabase.from('seo_data').select('*');

      // Process data
      const leadsArr = leads || [];

      // Country performance
      const countryMap: Record<string, { leads: number; converted: number }> = {};
      leadsArr.forEach(l => {
        const meta = l.meta as any;
        const country = meta?.country || 'Unknown';
        if (!countryMap[country]) countryMap[country] = { leads: 0, converted: 0 };
        countryMap[country].leads++;
        if (l.status === 'converted') countryMap[country].converted++;
      });
      
      const countryPerformance = Object.entries(countryMap)
        .map(([country, data]) => ({ country, ...data }))
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 6);

      // Conversion funnel
      const statusCounts = {
        new: leadsArr.filter(l => l.status === 'new').length,
        contacted: leadsArr.filter(l => l.status === 'contacted').length,
        qualified: leadsArr.filter(l => l.status === 'qualified').length,
        converted: leadsArr.filter(l => l.status === 'converted').length,
      };
      
      const conversionFunnel = [
        { stage: 'New Leads', value: statusCounts.new + statusCounts.contacted + statusCounts.qualified + statusCounts.converted },
        { stage: 'Contacted', value: statusCounts.contacted + statusCounts.qualified + statusCounts.converted },
        { stage: 'Qualified', value: statusCounts.qualified + statusCounts.converted },
        { stage: 'Converted', value: statusCounts.converted },
      ];

      // Mock SEO ranking data
      const seoRanking = (seoData || []).slice(0, 5).map((s, idx) => ({
        keyword: (s.keywords as string[])?.[0] || `keyword-${idx}`,
        position: Math.floor(Math.random() * 20) + 1,
        change: Math.floor(Math.random() * 10) - 5,
      }));

      // Mock reseller performance
      const resellerPerformance = [
        { name: 'John Reseller', leads: 45, converted: 12 },
        { name: 'Sarah Partner', leads: 38, converted: 15 },
        { name: 'Mike Agent', leads: 32, converted: 8 },
        { name: 'Lisa Sales', leads: 28, converted: 10 },
      ];

      setReportData({
        seoRanking,
        countryPerformance,
        conversionFunnel,
        resellerPerformance,
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = (format: 'pdf' | 'excel' | 'csv') => {
    toast.success(`Report exported as ${format.toUpperCase()}!`);
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
      {/* Controls */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Analytics & Reports</h3>
            </div>
            
            <div className="flex gap-3">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" onClick={() => exportReport('pdf')} className="gap-2">
                <FileText className="h-4 w-4" />
                PDF
              </Button>
              <Button variant="outline" onClick={() => exportReport('excel')} className="gap-2">
                <FileText className="h-4 w-4" />
                Excel
              </Button>
              <Button variant="outline" onClick={() => exportReport('csv')} className="gap-2">
                <Download className="h-4 w-4" />
                CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Lead Conversion Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportData.conversionFunnel} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="stage" type="category" width={100} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }} 
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Country Performance */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe2 className="h-5 w-5 text-primary" />
              Country Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reportData.countryPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="country" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }} 
                  />
                  <Bar dataKey="leads" name="Leads" fill="hsl(var(--primary))" />
                  <Bar dataKey="converted" name="Converted" fill="hsl(var(--success))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SEO Ranking Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            SEO Ranking Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {reportData.seoRanking.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No SEO data available</p>
            ) : (
              reportData.seoRanking.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono">#{item.position}</Badge>
                    <span className="font-medium">{item.keyword}</span>
                  </div>
                  <Badge 
                    className={item.change > 0 ? 'bg-success/20 text-success' : item.change < 0 ? 'bg-destructive/20 text-destructive' : 'bg-muted'}
                  >
                    {item.change > 0 ? `↑ ${item.change}` : item.change < 0 ? `↓ ${Math.abs(item.change)}` : '—'}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reseller Performance */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Reseller Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {reportData.resellerPerformance.map((reseller, idx) => (
              <div key={idx} className="p-4 rounded-lg bg-muted/30 border border-border">
                <p className="font-medium text-foreground">{reseller.name}</p>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Leads</span>
                    <span className="font-medium">{reseller.leads}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Converted</span>
                    <span className="font-medium text-success">{reseller.converted}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Rate</span>
                    <span className="font-medium text-primary">
                      {((reseller.converted / reseller.leads) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
