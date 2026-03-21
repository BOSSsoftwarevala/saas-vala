import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useWallet } from '@/hooks/useWallet';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Search,
  TrendingUp,
  Globe,
  BarChart3,
  Zap,
  AlertCircle,
  Wallet,
  CheckCircle2,
  Target,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const seoTools = [
  { id: 'keyword-research', title: 'Keyword Research', description: 'Find high-ranking keywords for your niche', icon: Search, cost: 5, color: 'from-blue-500 to-cyan-500' },
  { id: 'site-audit', title: 'Site Audit', description: 'Full SEO health check of any website', icon: FileText, cost: 8, color: 'from-purple-500 to-pink-500' },
  { id: 'rank-tracker', title: 'Rank Tracker', description: 'Track keyword positions on Google', icon: TrendingUp, cost: 10, color: 'from-green-500 to-emerald-500' },
  { id: 'backlink-analysis', title: 'Backlink Analysis', description: 'Analyze backlink profile of any domain', icon: Globe, cost: 7, color: 'from-orange-500 to-amber-500' },
  { id: 'competitor-spy', title: 'Competitor Analysis', description: 'Spy on competitor SEO strategies', icon: Target, cost: 12, color: 'from-red-500 to-rose-500' },
  { id: 'content-optimizer', title: 'AI Content Optimizer', description: 'Optimize content for better rankings', icon: Zap, cost: 6, color: 'from-indigo-500 to-violet-500' },
];

interface SeoRun {
  id: string;
  tool_id: string;
  tool_name: string;
  target_url: string;
  cost: number;
  status: string;
  created_at: string;
}

export function ResellerSeoPanel() {
  const { wallet } = useWallet();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [targetUrl, setTargetUrl] = useState('');
  const [runningTool, setRunningTool] = useState<string | null>(null);
  const [seoRuns, setSeoRuns] = useState<SeoRun[]>([]);
  const [loading, setLoading] = useState(true);

  const balance = wallet?.balance || 0;

  useEffect(() => {
    fetchSeoRuns();
  }, []);

  const fetchSeoRuns = async () => {
    const { data } = await supabase
      .from('reseller_seo_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setSeoRuns((data as unknown as SeoRun[]) || []);
    setLoading(false);
  };

  const completedToolIds = seoRuns.map((r) => r.tool_id);
  const totalSpent = seoRuns.reduce((s, r) => s + Number(r.cost), 0);

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
    try {
      // Deduct from wallet
      const { error: walletErr } = await supabase
        .from('wallets')
        .update({ balance: balance - cost })
        .eq('user_id', user.id);

      if (walletErr) throw walletErr;

      // Log the SEO run
      const { error: runErr } = await supabase
        .from('reseller_seo_runs')
        .insert({
          user_id: user.id,
          tool_id: toolId,
          tool_name: toolName,
          target_url: targetUrl.trim(),
          cost,
          status: 'completed',
        });

      if (runErr) throw runErr;

      toast.success(`✅ ${toolName} completed! $${cost} deducted from wallet.`);
      await fetchSeoRuns();
    } catch (err) {
      console.error(err);
      toast.error('Failed to run SEO tool');
    } finally {
      setRunningTool(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">SEO Tools</h2>
          <p className="text-muted-foreground">Boost your clients' websites with professional SEO tools</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm py-1.5 px-3 gap-1.5 border-primary/30">
            <Wallet className="h-3.5 w-3.5" />
            Balance: ${balance.toFixed(2)}
          </Badge>
          {balance < 5 && (
            <Button size="sm" onClick={() => navigate('/reseller-dashboard?tab=wallet')} className="gap-1.5">
              <Wallet className="h-3.5 w-3.5" />
              Add Balance
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
              <p className="text-xs text-muted-foreground">
                Add balance to use SEO tools. Each tool costs $5-$12 per run.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto shrink-0 border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
              onClick={() => navigate('/reseller-dashboard?tab=wallet')}
            >
              Top Up
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Target URL Input */}
      <Card>
        <CardContent className="p-4">
          <label className="text-sm font-medium text-foreground mb-2 block">Target Website URL</label>
          <div className="flex gap-2">
            <Input
              placeholder="https://example.com"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* SEO Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {seoTools.map((tool, index) => {
          const Icon = tool.icon;
          const isRunning = runningTool === tool.id;
          const canAfford = balance >= tool.cost;

          return (
            <motion.div
              key={tool.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
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
                      <Progress value={66} className="h-1.5" />
                      <p className="text-xs text-muted-foreground mt-1">Running analysis...</p>
                    </div>
                  )}

                  <Button
                    size="sm"
                    className="w-full gap-1.5"
                    disabled={isRunning || !canAfford}
                    onClick={() => handleRunTool(tool.id, tool.title, tool.cost)}
                  >
                    {isRunning ? 'Running...' : !canAfford ? 'Insufficient Balance' : (
                      <><Zap className="h-3.5 w-3.5" />Run Tool</>
                    )}
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
          { label: 'Tools Used', value: seoRuns.length.toString(), icon: BarChart3 },
          { label: 'Unique Tools', value: new Set(completedToolIds).size.toString(), icon: Search },
          { label: 'Sites Analyzed', value: new Set(seoRuns.map((r) => r.target_url)).size.toString(), icon: Globe },
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

      {/* History */}
      {seoRuns.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-3">Recent SEO Runs</h3>
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
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
