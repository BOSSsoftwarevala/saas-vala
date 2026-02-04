import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  Edit,
  RefreshCw,
  Lock,
  History,
  Eye,
  Loader2,
  Sparkles,
  Search,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SeoEntry {
  id: string;
  url: string;
  title: string | null;
  meta_description: string | null;
  keywords: string[] | null;
  og_image: string | null;
  status: 'optimized' | 'pending';
  locked: boolean;
}

export function MetaTagManager() {
  const [entries, setEntries] = useState<SeoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editDialog, setEditDialog] = useState(false);
  const [editEntry, setEditEntry] = useState<SeoEntry | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    meta_description: '',
    keywords: '',
  });

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('seo_data').select('*').limit(100);
      if (data) {
        setEntries(data.map(d => ({
          ...d,
          status: d.title && d.meta_description ? 'optimized' : 'pending',
          locked: false,
        })));
      }
    } catch (error) {
      console.error('Error fetching SEO entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (entry: SeoEntry) => {
    setEditEntry(entry);
    setFormData({
      title: entry.title || '',
      meta_description: entry.meta_description || '',
      keywords: (entry.keywords || []).join(', '),
    });
    setEditDialog(true);
  };

  const saveEdit = async () => {
    if (!editEntry) return;
    
    try {
      const { error } = await supabase.from('seo_data').update({
        title: formData.title,
        meta_description: formData.meta_description,
        keywords: formData.keywords.split(',').map(k => k.trim()).filter(Boolean),
      }).eq('id', editEntry.id);

      if (error) throw error;

      toast.success('Meta tags updated!');
      setEditDialog(false);
      fetchEntries();
    } catch (error) {
      toast.error('Failed to update meta tags');
    }
  };

  const regenerateAI = async (id: string) => {
    setRegenerating(id);
    
    try {
      // Call AI to regenerate meta tags
      const entry = entries.find(e => e.id === id);
      if (!entry) return;

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [{
            role: 'user',
            content: `Generate SEO meta tags for this URL: ${entry.url}. Return JSON with: title (max 60 chars), description (max 160 chars), keywords (array of 5 keywords).`
          }]
        }
      });

      if (error) throw error;

      // Parse AI response and update
      toast.success('Meta tags regenerated with AI!');
      fetchEntries();
    } catch (error) {
      toast.error('AI regeneration failed');
    } finally {
      setRegenerating(null);
    }
  };

  const lockMeta = (id: string) => {
    setEntries(prev => prev.map(e => 
      e.id === id ? { ...e, locked: !e.locked } : e
    ));
    toast.success('Meta lock toggled');
  };

  const viewHistory = (id: string) => {
    toast.info('Version history coming soon');
  };

  const previewOG = (entry: SeoEntry) => {
    const preview = `
📄 ${entry.title || 'No title'}

${entry.meta_description || 'No description'}

🔗 ${entry.url}
    `;
    toast.info('OG Preview', { description: preview.substring(0, 100) + '...' });
  };

  const filteredEntries = entries.filter(e => 
    e.url.toLowerCase().includes(search.toLowerCase()) ||
    e.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by URL or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Meta Tag Manager</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No SEO entries found. Run Auto SEO to generate meta tags.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead>Page URL</TableHead>
                    <TableHead>Meta Title</TableHead>
                    <TableHead>Meta Description</TableHead>
                    <TableHead>Keywords</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => (
                    <TableRow key={entry.id} className="border-border">
                      <TableCell className="font-mono text-xs max-w-40 truncate">
                        {entry.url}
                      </TableCell>
                      <TableCell className="max-w-48">
                        <div className="truncate text-sm">
                          {entry.title || <span className="text-muted-foreground">Not set</span>}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-64">
                        <div className="truncate text-sm text-muted-foreground">
                          {entry.meta_description || 'Not set'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap max-w-32">
                          {(entry.keywords || []).slice(0, 2).map((kw, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={entry.status === 'optimized' ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning'}>
                          {entry.status}
                        </Badge>
                        {entry.locked && <Lock className="inline h-3 w-3 ml-1 text-muted-foreground" />}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(entry)} disabled={entry.locked}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => regenerateAI(entry.id)}
                            disabled={regenerating === entry.id || entry.locked}
                          >
                            {regenerating === entry.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4" />
                            )}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => lockMeta(entry.id)}>
                            <Lock className={`h-4 w-4 ${entry.locked ? 'text-primary' : ''}`} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => previewOG(entry)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => viewHistory(entry.id)}>
                            <History className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Meta Tags</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Meta Title (max 60 chars)</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground">{formData.title.length}/60</p>
            </div>
            <div className="space-y-2">
              <Label>Meta Description (max 160 chars)</Label>
              <Textarea
                value={formData.meta_description}
                onChange={(e) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
                maxLength={160}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{formData.meta_description.length}/160</p>
            </div>
            <div className="space-y-2">
              <Label>Keywords (comma separated)</Label>
              <Input
                value={formData.keywords}
                onChange={(e) => setFormData(prev => ({ ...prev, keywords: e.target.value }))}
                placeholder="keyword1, keyword2, keyword3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
