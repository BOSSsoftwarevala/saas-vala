import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Globe,
  MessageCircle,
  Search,
  FileText,
  Phone,
  Mail,
  Plus,
  Edit,
  Trash2,
  TrendingUp,
  ExternalLink,
  Loader2,
  BarChart3,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface LeadSource {
  id: string;
  name: string;
  code: string;
  icon: string;
  enabled: boolean;
  leadsCount: number;
  conversionRate: number;
  trackingUrl: string;
}

const defaultSources: LeadSource[] = [
  { id: '1', name: 'Website Forms', code: 'website', icon: 'globe', enabled: true, leadsCount: 0, conversionRate: 0, trackingUrl: '' },
  { id: '2', name: 'WhatsApp Click', code: 'social', icon: 'whatsapp', enabled: true, leadsCount: 0, conversionRate: 0, trackingUrl: '' },
  { id: '3', name: 'SEO Organic', code: 'organic', icon: 'search', enabled: true, leadsCount: 0, conversionRate: 0, trackingUrl: '' },
  { id: '4', name: 'Google Ads', code: 'ads', icon: 'google', enabled: true, leadsCount: 0, conversionRate: 0, trackingUrl: '' },
  { id: '5', name: 'Demo Requests', code: 'referral', icon: 'demo', enabled: true, leadsCount: 0, conversionRate: 0, trackingUrl: '' },
  { id: '6', name: 'Contact Page', code: 'other', icon: 'contact', enabled: true, leadsCount: 0, conversionRate: 0, trackingUrl: '' },
];

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--cyan))', 'hsl(var(--purple))', 'hsl(var(--secondary))'];

const getIcon = (icon: string) => {
  switch (icon) {
    case 'globe': return <Globe className="h-4 w-4" />;
    case 'whatsapp': return <MessageCircle className="h-4 w-4" />;
    case 'search': return <Search className="h-4 w-4" />;
    case 'google': return <TrendingUp className="h-4 w-4" />;
    case 'demo': return <FileText className="h-4 w-4" />;
    case 'contact': return <Phone className="h-4 w-4" />;
    default: return <Globe className="h-4 w-4" />;
  }
};

export function LeadSources() {
  const [sources, setSources] = useState<LeadSource[]>(defaultSources);
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState(false);
  const [editSource, setEditSource] = useState<LeadSource | null>(null);
  const [addDialog, setAddDialog] = useState(false);
  const [newSource, setNewSource] = useState({ name: '', code: '', trackingUrl: '' });

  useEffect(() => {
    fetchSourceStats();
  }, []);

  const fetchSourceStats = async () => {
    setLoading(true);
    try {
      const { data: leads } = await supabase.from('leads').select('source, status');
      
      if (leads) {
        const sourceStats: Record<string, { count: number; converted: number }> = {};
        leads.forEach(lead => {
          const src = lead.source || 'other';
          if (!sourceStats[src]) sourceStats[src] = { count: 0, converted: 0 };
          sourceStats[src].count++;
          if (lead.status === 'converted') sourceStats[src].converted++;
        });

        setSources(prev => prev.map(s => {
          const stats = sourceStats[s.code] || { count: 0, converted: 0 };
          return {
            ...s,
            leadsCount: stats.count,
            conversionRate: stats.count > 0 ? Math.round((stats.converted / stats.count) * 100) : 0,
          };
        }));
      }
    } catch (error) {
      console.error('Error fetching source stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSource = (id: string) => {
    setSources(prev => prev.map(s => 
      s.id === id ? { ...s, enabled: !s.enabled } : s
    ));
    toast.success('Source updated');
  };

  const openEdit = (source: LeadSource) => {
    setEditSource(source);
    setEditDialog(true);
  };

  const saveEdit = () => {
    if (editSource) {
      setSources(prev => prev.map(s => s.id === editSource.id ? editSource : s));
      toast.success('Source updated');
      setEditDialog(false);
    }
  };

  const deleteSource = (id: string) => {
    setSources(prev => prev.filter(s => s.id !== id));
    toast.success('Source deleted');
  };

  const addSource = () => {
    if (!newSource.name || !newSource.code) {
      toast.error('Please fill all required fields');
      return;
    }
    
    setSources(prev => [...prev, {
      id: Date.now().toString(),
      name: newSource.name,
      code: newSource.code,
      icon: 'globe',
      enabled: true,
      leadsCount: 0,
      conversionRate: 0,
      trackingUrl: newSource.trackingUrl,
    }]);
    
    toast.success('Source added');
    setAddDialog(false);
    setNewSource({ name: '', code: '', trackingUrl: '' });
  };

  const chartData = sources.map((s, idx) => ({
    name: s.name,
    value: s.leadsCount,
    color: COLORS[idx % COLORS.length],
  })).filter(d => d.value > 0);

  const totalLeads = sources.reduce((acc, s) => acc + s.leadsCount, 0);
  const avgConversion = sources.length > 0 
    ? Math.round(sources.reduce((acc, s) => acc + s.conversionRate, 0) / sources.length)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{sources.filter(s => s.enabled).length}</p>
                <p className="text-xs text-muted-foreground">Active Sources</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalLeads}</p>
                <p className="text-xs text-muted-foreground">Total Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{avgConversion}%</p>
                <p className="text-xs text-muted-foreground">Avg. Conversion</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart and Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie Chart */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Lead Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
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
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No lead data yet
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {chartData.map((entry, idx) => (
                <Badge key={idx} variant="outline" style={{ borderColor: entry.color, color: entry.color }}>
                  {entry.name}: {entry.value}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sources Table */}
        <Card className="glass-card lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Lead Sources</CardTitle>
              <Button onClick={() => setAddDialog(true)} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Source
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>Source</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-center">Leads</TableHead>
                  <TableHead className="text-center">Conversion</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((source) => (
                  <TableRow key={source.id} className="border-border">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10">
                          {getIcon(source.icon)}
                        </div>
                        <span className="font-medium">{source.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{source.code}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-bold">
                      {source.leadsCount}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={source.conversionRate >= 20 ? 'text-success' : source.conversionRate >= 10 ? 'text-warning' : 'text-muted-foreground'}>
                        {source.conversionRate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={source.enabled}
                        onCheckedChange={() => toggleSource(source.id)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(source)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {source.trackingUrl && (
                          <Button variant="ghost" size="icon" asChild>
                            <a href={source.trackingUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => deleteSource(source.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Lead Source</DialogTitle>
          </DialogHeader>
          {editSource && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Source Name</Label>
                <Input
                  value={editSource.name}
                  onChange={(e) => setEditSource({ ...editSource, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Code (for tracking)</Label>
                <Input
                  value={editSource.code}
                  onChange={(e) => setEditSource({ ...editSource, code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tracking URL (optional)</Label>
                <Input
                  value={editSource.trackingUrl}
                  onChange={(e) => setEditSource({ ...editSource, trackingUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Lead Source</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Source Name *</Label>
              <Input
                value={newSource.name}
                onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                placeholder="e.g., LinkedIn Ads"
              />
            </div>
            <div className="space-y-2">
              <Label>Code (for tracking) *</Label>
              <Input
                value={newSource.code}
                onChange={(e) => setNewSource({ ...newSource, code: e.target.value })}
                placeholder="e.g., linkedin"
              />
            </div>
            <div className="space-y-2">
              <Label>Tracking URL (optional)</Label>
              <Input
                value={newSource.trackingUrl}
                onChange={(e) => setNewSource({ ...newSource, trackingUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>Cancel</Button>
            <Button onClick={addSource}>Add Source</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
