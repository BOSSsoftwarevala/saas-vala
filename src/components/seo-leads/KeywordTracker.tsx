import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Target,
  BarChart3,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Keyword {
  id: string;
  keyword: string;
  volume: number;
  difficulty: number;
  current_rank: number | null;
  previous_rank: number | null;
  rank_change: number;
  is_primary: boolean;
  search_intent: string;
  created_at: string;
}

interface KeywordHistory {
  date: string;
  rank: number;
}

export function KeywordTracker() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [addingKeyword, setAddingKeyword] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState<Keyword | null>(null);
  const [historyData, setHistoryData] = useState<KeywordHistory[]>([]);
  const [updatingRanks, setUpdatingRanks] = useState(false);

  useEffect(() => {
    fetchKeywords();
  }, []);

  const fetchKeywords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('seo_keywords')
        .select('*')
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setKeywords(data || []);
    } catch (err: any) {
      toast.error('Failed to load keywords: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const addKeyword = async () => {
    if (!newKeyword.trim()) return;
    
    setAddingKeyword(true);
    try {
      // Get default project (first one)
      const { data: projects } = await supabase
        .from('seo_projects')
        .select('id')
        .limit(1);
      
      const projectId = projects?.[0]?.id;
      
      if (!projectId) {
        toast.error('Create a project first');
        return;
      }

      const { error } = await supabase.from('seo_keywords').insert({
        project_id: projectId,
        keyword: newKeyword.trim(),
        is_primary: keywords.length === 0,
      });

      if (error) throw error;
      
      toast.success('Keyword added');
      setNewKeyword('');
      fetchKeywords();
    } catch (err: any) {
      toast.error('Failed to add keyword: ' + err.message);
    } finally {
      setAddingKeyword(false);
    }
  };

  const deleteKeyword = async (id: string) => {
    try {
      const { error } = await supabase.from('seo_keywords').delete().eq('id', id);
      if (error) throw error;
      toast.success('Keyword deleted');
      fetchKeywords();
    } catch (err: any) {
      toast.error('Failed to delete: ' + err.message);
    }
  };

  const updateRankings = async () => {
    setUpdatingRanks(true);
    try {
      const { error } = await supabase.functions.invoke('seo-automation-engine', {
        body: { action: 'update-keyword-rankings' },
      });
      
      if (error) throw error;
      
      toast.success('Rankings updated');
      fetchKeywords();
    } catch (err: any) {
      toast.error('Failed to update: ' + err.message);
    } finally {
      setUpdatingRanks(false);
    }
  };

  const fetchKeywordHistory = async (keywordId: string) => {
    try {
      const { data, error } = await supabase
        .from('seo_keyword_history')
        .select('*')
        .eq('keyword_id', keywordId)
        .order('date', { ascending: true })
        .limit(30);

      if (error) throw error;
      
      setHistoryData(
        (data || []).map(h => ({
          date: new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          rank: h.rank,
        }))
      );
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  const getRankIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getRankColor = (change: number) => {
    if (change > 0) return 'text-green-500';
    if (change < 0) return 'text-red-500';
    return 'text-muted-foreground';
  };

  const filteredKeywords = keywords.filter(k =>
    k.keyword.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: keywords.length,
    primary: keywords.filter(k => k.is_primary).length,
    tracked: keywords.filter(k => k.current_rank !== null).length,
    avgPosition: keywords.filter(k => k.current_rank !== null).length > 0
      ? Math.round(
          keywords
            .filter(k => k.current_rank !== null)
            .reduce((sum, k) => sum + (k.current_rank || 0), 0) /
          keywords.filter(k => k.current_rank !== null).length
        )
      : 0,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Keywords</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.primary}</p>
                <p className="text-xs text-muted-foreground">Primary</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-cyan/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-cyan" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.tracked}</p>
                <p className="text-xs text-muted-foreground">Rank Tracked</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <Search className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.avgPosition || '-'}</p>
                <p className="text-xs text-muted-foreground">Avg Position</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Keyword */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Keyword</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              placeholder="Enter keyword to track..."
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
            />
            <Button onClick={addKeyword} disabled={addingKeyword || !newKeyword.trim()}>
              {addingKeyword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-between">
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search keywords..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={updateRankings} disabled={updatingRanks} variant="outline">
          {updatingRanks ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Update Rankings
        </Button>
      </div>

      {/* Keywords Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tracked Keywords</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredKeywords.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {searchTerm ? 'No keywords match your search' : 'No keywords added yet'}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Keyword</TableHead>
                  <TableHead>Volume</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Current Rank</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredKeywords.map((keyword) => (
                  <TableRow key={keyword.id}>
                    <TableCell className="font-medium">{keyword.keyword}</TableCell>
                    <TableCell>{keyword.volume?.toLocaleString() || '-'}</TableCell>
                    <TableCell>
                      {keyword.difficulty ? (
                        <div className="flex items-center gap-2">
                          <Progress value={keyword.difficulty} className="w-16 h-2" />
                          <span className="text-xs">{keyword.difficulty}%</span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedKeyword(keyword);
                              fetchKeywordHistory(keyword.id);
                            }}
                          >
                            {keyword.current_rank || 'Not tracked'}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Keyword History: {keyword.keyword}</DialogTitle>
                            <DialogDescription>
                              Ranking history over the last 30 days
                            </DialogDescription>
                          </DialogHeader>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={historyData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis reversed domain={[1, 'dataMax + 10']} />
                                <Tooltip />
                                <Line
                                  type="monotone"
                                  dataKey="rank"
                                  stroke="hsl(var(--primary))"
                                  strokeWidth={2}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {getRankIcon(keyword.rank_change)}
                        <span className={`text-sm ${getRankColor(keyword.rank_change)}`}>
                          {keyword.rank_change !== 0 ? Math.abs(keyword.rank_change) : '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {keyword.is_primary ? (
                        <Badge className="bg-primary">Primary</Badge>
                      ) : (
                        <Badge variant="outline">Secondary</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteKeyword(keyword.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
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
