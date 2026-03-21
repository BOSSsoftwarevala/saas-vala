import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWallet } from '@/hooks/useWallet';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Search, TrendingUp, Globe, BarChart3, Zap, AlertCircle, Wallet,
  CheckCircle2, Target, FileText, Loader2, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

const seoTools = [
  { id: 'keyword-research', title: 'AI Keyword Research', description: 'AI-powered keyword analysis for your niche', icon: Search, cost: 5, color: 'from-blue-500 to-cyan-500' },
  { id: 'site-audit', title: 'AI Site Audit', description: 'Full AI-driven SEO health check', icon: FileText, cost: 8, color: 'from-purple-500 to-pink-500' },
  { id: 'rank-tracker', title: 'AI Rank Tracker', description: 'AI-predicted keyword positions', icon: TrendingUp, cost: 10, color: 'from-green-500 to-emerald-500' },
  { id: 'backlink-analysis', title: 'AI Backlink Analysis', description: 'AI-analyzed backlink profile', icon: Globe, cost: 7, color: 'from-orange-500 to-amber-500' },
  { id: 'competitor-spy', title: 'AI Competitor Analysis', description: 'AI-powered competitor SEO spy', icon: Target, cost: 12, color: 'from-red-500 to-rose-500' },
  { id: 'content-optimizer', title: 'AI Content Optimizer', description: 'AI optimizes content for rankings', icon: Zap, cost: 6, color: 'from-indigo-500 to-violet-500' },
];

interface SeoRun {
  id: string;
  tool_id: string;
  tool_name: string;
  target_url: string;
  cost: number;
  status: string;
  result: string | null;
  created_at: string;
}

export function ResellerSeoPanel() {
  const { wallet, fetchWallet: refetchWallet } = useWallet();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [targetUrl, setTargetUrl] = useState('');
  const [runningTool, setRunningTool] = useState<string | null>(null);
  const [seoRuns, setSeoRuns] = useState<SeoRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewResult, setViewResult] = useState<SeoRun | null>(null);
  const [progress, setProgress] = useState(0);

  const balance = wallet?.balance || 0;

  useEffect(() => { fetchSeoRuns(); }, []);

  const fetchSeoRuns = async () => {
    const { data } = await supabase
      .from('reseller_seo_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setSeoRuns((data as unknown as SeoRun[]) || []);
    setLoading(false);
  };

  const handleRunTool = async (toolId: string, toolName: string, cost: number) => {
    if (balance < cost) {
      toast.error(`Insufficient balance! You need $${cost}. Please add balance first.`);
      return;
    }
    if (!targetUrl.trim()) {
      toast.error('Please enter a target URL first');
      return;
    }
    if (!user) return;

    setRunningTool(toolId);
    setProgress(10);

    try {
      // Step 1: Deduct from wallet FIRST
      const { error: walletErr } = await supabase
        .from('wallets')
        .update({ balance: balance - cost })
        .eq('user_id', user.id);
      if (walletErr) throw walletErr;

      setProgress(25);

      // Step 2: Call AI for real analysis
      const { data: aiResult, error: aiErr } = await supabase.functions.invoke('reseller-ai-tools', {
        body: { tool_id: toolId, tool_name: toolName, target_url: targetUrl.trim(), tool_type: 'seo' },
      });

      setProgress(80);

      if (aiErr) throw aiErr;

      const resultText = aiResult?.result || 'Analysis completed successfully.';

      // Step 3: Save result to DB
      const { error: runErr } = await supabase
        .from('reseller_seo_runs')
        .insert({
          user_id: user.id,
          tool_id: toolId,
          tool_name: toolName,
          target_url: targetUrl.trim(),
          cost,
          status: 'completed',
          result: resultText,
        });
      if (runErr) throw runErr;

      setProgress(100);
      toast.success(`✅ ${toolName} completed! $${cost} deducted. AI analysis ready.`);
      await fetchSeoRuns();
      refetchWallet();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to run SEO tool');
      // Refund on failure
      await supabase.from('wallets').update({ balance }).eq('user_id', user!.id);
      refetchWallet();
    } finally {
      setRunningTool(null);
      setProgress(0);
    }
  };

  const totalSpent = seoRuns.reduce((s, r) => s + Number(r.cost), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">🤖 AI SEO Tools</h2>
          <p className="text-muted-foreground">Real AI-powered SEO analysis — results after payment</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm py-1.5 px-3 gap-1.5 border-primary/30">
            <Wallet className="h-3.5 w-3.5" />
            Balance: ${balance.toFixed(2)}
          </Badge>
          {balance < 5 && (
            <Button size="sm" onClick={() => navigate('/reseller-dashboard?tab=wallet')} className="gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> Add Balance
            </Button>
          )}
        </div>
      </div>

      {/* Balance Warning */}
      {balance < 5 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Low Balance</p>
              <p className="text-xs text-muted-foreground">Add balance to unlock AI SEO tools. Each tool costs $5-$12 per run.</p>
            </div>
            <Button size="sm" variant="outline" className="ml-auto shrink-0 border-amber-500/30 text-amber-500 hover:bg-amber-500/10" onClick={() => navigate('/reseller-dashboard?tab=wallet')}>Top Up</Button>
          </CardContent>
        </Card>
      )}

      {/* Target URL */}
      <Card>
        <CardContent className="p-4">
          <label className="text-sm font-medium text-foreground mb-2 block">Target Website URL</label>
          <Input placeholder="https://example.com" value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} />
        </CardContent>
      </Card>

      {/* SEO Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {seoTools.map((tool, index) => {
          const Icon = tool.icon;
          const isRunning = runningTool === tool.id;
          const canAfford = balance >= tool.cost;

          return (
            <motion.div key={tool.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}>
              <Card className="hover:border-primary/30 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${tool.color} text-white`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant="outline" className="text-xs">${tool.cost}/run</Badge>
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{tool.title}</h3>
                  <p className="text-xs text-muted-foreground mb-4">{tool.description}</p>

                  {isRunning && (
                    <div className="mb-3">
                      <Progress value={progress} className="h-1.5" />
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> AI analyzing...</p>
                    </div>
                  )}

                  <Button size="sm" className="w-full gap-1.5" disabled={isRunning || !canAfford} onClick={() => handleRunTool(tool.id, tool.title, tool.cost)}>
                    {isRunning ? 'AI Processing...' : !canAfford ? 'Insufficient Balance' : (<><Zap className="h-3.5 w-3.5" />Run AI Tool</>)}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'AI Runs', value: seoRuns.length.toString(), icon: BarChart3 },
          { label: 'Unique Tools', value: new Set(seoRuns.map(r => r.tool_id)).size.toString(), icon: Search },
          { label: 'Sites Analyzed', value: new Set(seoRuns.map(r => r.target_url)).size.toString(), icon: Globe },
          { label: 'Total Spent', value: `$${totalSpent.toFixed(2)}`, icon: Wallet },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 text-center">
              <stat.icon className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* History with View Results */}
      {seoRuns.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-3">Recent AI SEO Runs</h3>
          <div className="space-y-2">
            {seoRuns.slice(0, 10).map((run) => (
              <Card key={run.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{run.tool_name}</p>
                    <p className="text-xs text-muted-foreground">{run.target_url}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">${Number(run.cost).toFixed(2)}</Badge>
                    {run.result && (
                      <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={() => setViewResult(run)}>
                        <Eye className="h-3 w-3" /> View
                      </Button>
                    )}
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Result Viewer Dialog */}
      <Dialog open={!!viewResult} onOpenChange={() => setViewResult(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              🤖 {viewResult?.tool_name} — AI Result
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="prose prose-sm dark:prose-invert max-w-none p-2">
              <p className="text-xs text-muted-foreground mb-2">Target: {viewResult?.target_url}</p>
              <ReactMarkdown>{viewResult?.result || ''}</ReactMarkdown>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
