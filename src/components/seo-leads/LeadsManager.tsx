import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Users,
  Search,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  MessageCircle,
  CheckCircle,
  Download,
  Loader2,
  Mail,
  Phone,
  Building,
  Globe2,
  Flame,
  Thermometer,
  Snowflake,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: 'website' | 'referral' | 'social' | 'ads' | 'organic' | 'other';
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  notes: string | null;
  tags: string[] | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

const statusStyles = {
  new: 'bg-cyan/20 text-cyan border-cyan/30',
  contacted: 'bg-warning/20 text-warning border-warning/30',
  qualified: 'bg-purple/20 text-purple border-purple/30',
  converted: 'bg-success/20 text-success border-success/30',
  lost: 'bg-destructive/20 text-destructive border-destructive/30',
};

const sourceStyles = {
  website: 'bg-cyan/20 text-cyan',
  referral: 'bg-success/20 text-success',
  social: 'bg-purple/20 text-purple',
  ads: 'bg-warning/20 text-warning',
  organic: 'bg-primary/20 text-primary',
  other: 'bg-muted text-muted-foreground',
};

const priorityIcons = {
  hot: { icon: Flame, color: 'text-destructive' },
  warm: { icon: Thermometer, color: 'text-warning' },
  cold: { icon: Snowflake, color: 'text-cyan' },
};

export function LeadsManager() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [autoAssign, setAutoAssign] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    source: 'website' as Lead['source'],
    status: 'new' as Lead['status'],
    notes: '',
    country: '',
    priority: 'warm' as 'hot' | 'warm' | 'cold',
    product_interest: '',
  });

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setLeads((data || []) as Lead[]);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditLead(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      company: '',
      source: 'website',
      status: 'new',
      notes: '',
      country: '',
      priority: 'warm',
      product_interest: '',
    });
    setDialogOpen(true);
  };

  const openEdit = (lead: Lead) => {
    setEditLead(lead);
    const meta = (lead.meta || {}) as Record<string, string>;
    setFormData({
      name: lead.name,
      email: lead.email || '',
      phone: lead.phone || '',
      company: lead.company || '',
      source: lead.source,
      status: lead.status,
      notes: lead.notes || '',
      country: String(meta.country || ''),
      priority: (meta.priority as 'hot' | 'warm' | 'cold') || 'warm',
      product_interest: String(meta.product_interest || ''),
    });
    setDialogOpen(true);
  };

  const saveLead = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    try {
      const leadData = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        company: formData.company || null,
        source: formData.source,
        status: formData.status,
        notes: formData.notes || null,
        meta: {
          country: formData.country,
          priority: formData.priority,
          product_interest: formData.product_interest,
        },
      };

      if (editLead) {
        const { error } = await supabase
          .from('leads')
          .update(leadData)
          .eq('id', editLead.id);
        if (error) throw error;
        toast.success('Lead updated!');
      } else {
        const { error } = await supabase
          .from('leads')
          .insert(leadData);
        if (error) throw error;
        toast.success('Lead created!');
      }

      setDialogOpen(false);
      fetchLeads();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save lead');
    }
  };

  const deleteLead = async (id: string) => {
    try {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
      toast.success('Lead deleted');
      fetchLeads();
    } catch (error) {
      toast.error('Failed to delete lead');
    }
  };

  const markContacted = async (id: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: 'contacted' })
        .eq('id', id);
      if (error) throw error;
      toast.success('Marked as contacted');
      fetchLeads();
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const markConverted = async (id: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: 'converted', converted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success('Lead converted!');
      fetchLeads();
    } catch (error) {
      toast.error('Failed to convert');
    }
  };

  const exportLeads = () => {
    const csv = [
      ['Name', 'Email', 'Phone', 'Company', 'Country', 'Source', 'Status', 'Priority', 'Created'].join(','),
      ...leads.map(l => {
        const meta = l.meta || {};
        return [
          l.name,
          l.email || '',
          l.phone || '',
          l.company || '',
          meta.country || '',
          l.source,
          l.status,
          meta.priority || '',
          new Date(l.created_at).toLocaleDateString(),
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Leads exported!');
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.name.toLowerCase().includes(search.toLowerCase()) ||
      lead.email?.toLowerCase().includes(search.toLowerCase()) ||
      lead.company?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="converted">Converted</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={autoAssign} onCheckedChange={setAutoAssign} />
                <Label className="text-sm">Auto-Assign</Label>
              </div>
              <Button variant="outline" onClick={exportLeads} className="gap-2">
                <Download className="h-4 w-4" />
                Export
              </Button>
              <Button onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Lead
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Leads ({filteredLeads.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="text-center p-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No leads found</p>
              <Button onClick={openCreate} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Add First Lead
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead>Name / Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => {
                  const meta = lead.meta || {};
                  const PriorityIcon = priorityIcons[meta.priority as keyof typeof priorityIcons]?.icon || Thermometer;
                  const priorityColor = priorityIcons[meta.priority as keyof typeof priorityIcons]?.color || 'text-muted-foreground';

                  return (
                    <TableRow key={lead.id} className="border-border">
                      <TableCell>
                        <div>
                          <span className="font-medium">{lead.name}</span>
                          {lead.company && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Building className="h-3 w-3" />
                              {lead.company}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {lead.email && (
                            <a href={`mailto:${lead.email}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {lead.email}
                            </a>
                          )}
                          {lead.phone && (
                            <a href={`tel:${lead.phone}`} className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {lead.phone}
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {(meta.country as string) ? (
                          <Badge variant="outline" className="text-xs">
                            <Globe2 className="h-3 w-3 mr-1" />
                            {meta.country as string}
                          </Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn('capitalize text-xs', sourceStyles[lead.source])}>
                          {lead.source}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <PriorityIcon className={cn('h-4 w-4', priorityColor)} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('capitalize', statusStyles[lead.status])}>
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(lead)}>
                              <Edit className="h-4 w-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            {lead.status === 'new' && (
                              <DropdownMenuItem onClick={() => markContacted(lead.id)}>
                                <MessageCircle className="h-4 w-4 mr-2" /> Mark Contacted
                              </DropdownMenuItem>
                            )}
                            {lead.status !== 'converted' && (
                              <DropdownMenuItem onClick={() => markConverted(lead.id)}>
                                <CheckCircle className="h-4 w-4 mr-2" /> Convert
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={() => deleteLead(lead.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Lead Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editLead ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+1 234 567 8900"
                />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input
                  value={formData.company}
                  onChange={(e) => setFormData(p => ({ ...p, company: e.target.value }))}
                  placeholder="Company Inc."
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={formData.country} onValueChange={(v) => setFormData(p => ({ ...p, country: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="India">🇮🇳 India</SelectItem>
                    <SelectItem value="USA">🇺🇸 USA</SelectItem>
                    <SelectItem value="UK">🇬🇧 UK</SelectItem>
                    <SelectItem value="UAE">🇦🇪 UAE</SelectItem>
                    <SelectItem value="Canada">🇨🇦 Canada</SelectItem>
                    <SelectItem value="Australia">🇦🇺 Australia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={formData.priority} onValueChange={(v: 'hot' | 'warm' | 'cold') => setFormData(p => ({ ...p, priority: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hot">🔥 Hot</SelectItem>
                    <SelectItem value="warm">🌡️ Warm</SelectItem>
                    <SelectItem value="cold">❄️ Cold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Source</Label>
                <Select value={formData.source} onValueChange={(v: Lead['source']) => setFormData(p => ({ ...p, source: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                    <SelectItem value="ads">Ads</SelectItem>
                    <SelectItem value="organic">Organic</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v: Lead['status']) => setFormData(p => ({ ...p, status: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="converted">Converted</SelectItem>
                    <SelectItem value="lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Product Interest</Label>
              <Input
                value={formData.product_interest}
                onChange={(e) => setFormData(p => ({ ...p, product_interest: e.target.value }))}
                placeholder="Which product are they interested in?"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveLead}>{editLead ? 'Update' : 'Create'} Lead</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
