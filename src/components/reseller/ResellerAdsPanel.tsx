import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useWallet } from '@/hooks/useWallet';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Megaphone, Users, TrendingUp, Wallet, AlertCircle, Zap, Mail,
  Phone, Globe, BarChart3, Play, Pause, Loader2, Eye, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

const MIN_CAMPAIGN_COST = 25;

interface Campaign {
  id: string;
  name: string;
  campaign_type: string;
  budget: number;
  status: string;
  leads_count: number;
  impressions: number;
  spent: number;
  ai_strategy: string | null;
  created_at: string;
}

export function ResellerAdsPanel() {
  const { wallet, fetchWallet: refetchWallet } = useWallet();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [viewStrategy, setViewStrategy] = useState<Campaign | null>(null);
  const [newCampaign, setNewCampaign] = useState({
    name: '', type: 'google_ads', budget: 25, targetAudience: '', description: '',
  });

  const balance = wallet?.balance || 0;

  useEffect(() => { fetchCampaigns(); }, []);

  const fetchCampaigns = async () => {
    const { data } = await supabase
      .from('reseller_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setCampaigns((data as unknown as Campaign[]) || []);
    setLoading(false);
  };

  const handleCreateCampaign = async () => {
    if (balance < newCampaign.budget) {
      toast.error(`Insufficient balance! You need $${newCampaign.budget}. Add balance first.`);
      return;
    }
    if (!newCampaign.name.trim()) {
      toast.error('Please enter a campaign name');
      return;
    }
    if (!user) return;

    setCreating(true);
    try {
      // Step 1: Deduct from wallet
      const { error: walletErr } = await supabase
        .from('wallets')
        .update({ balance: balance - newCampaign.budget })
        .eq('user_id', user.id);
      if (walletErr) throw walletErr;

      // Step 2: Get AI strategy
      const { data: aiResult, error: aiErr } = await supabase.functions.invoke('reseller-ai-tools', {
        body: {
          tool_id: newCampaign.type,
          tool_name: newCampaign.name,
          target_url: newCampaign.targetAudience || newCampaign.description || newCampaign.name,
          tool_type: 'lead',
        },
      });

      const aiStrategy = aiErr ? null : aiResult?.result || null;

      // Step 3: Create campaign
      const { error: campErr } = await supabase
        .from('reseller_campaigns')
        .insert({
          user_id: user.id,
          name: newCampaign.name.trim(),
          campaign_type: newCampaign.type,
          budget: newCampaign.budget,
          target_audience: newCampaign.targetAudience || null,
          description: newCampaign.description || null,
          status: 'active',
          ai_strategy: aiStrategy,
        });
      if (campErr) throw campErr;

      toast.success(`🚀 Campaign launched with AI strategy! $${newCampaign.budget} reserved.`);
      setShowCreate(false);
      setNewCampaign({ name: '', type: 'google_ads', budget: 25, targetAudience: '', description: '' });
      await fetchCampaigns();
      refetchWallet();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to create campaign');
      await supabase.from('wallets').update({ balance }).eq('user_id', user!.id);
      refetchWallet();
    } finally {
      setCreating(false);
    }
  };

  const toggleCampaignStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    await supabase.from('reseller_campaigns').update({ status: newStatus }).eq('id', id);
    toast.success(`Campaign ${newStatus === 'active' ? 'resumed' : 'paused'}`);
    await fetchCampaigns();
  };

  const totalLeads = campaigns.reduce((s, c) => s + c.leads_count, 0);
  const totalSpent = campaigns.reduce((s, c) => s + Number(c.budget), 0);
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">🤖 AI Ads & Lead Generation</h2>
          <p className="text-muted-foreground">AI-powered campaigns — strategy generated after payment</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm py-1.5 px-3 gap-1.5 border-primary/30">
            <Wallet className="h-3.5 w-3.5" /> Balance: ${balance.toFixed(2)}
          </Badge>
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <Megaphone className="h-3.5 w-3.5" /> New Campaign
          </Button>
        </div>
      </div>

      {balance < MIN_CAMPAIGN_COST && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Add Balance for AI Campaigns</p>
              <p className="text-xs text-muted-foreground">Minimum ${MIN_CAMPAIGN_COST} required. AI generates strategy after payment.</p>
            </div>
            <Button size="sm" variant="outline" className="ml-auto shrink-0 border-amber-500/30 text-amber-500 hover:bg-amber-500/10" onClick={() => navigate('/reseller-dashboard?tab=wallet')}>Add Balance</Button>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Campaigns', value: activeCampaigns.toString(), icon: Megaphone, color: 'text-blue-500' },
          { label: 'Total Leads', value: totalLeads.toString(), icon: Users, color: 'text-green-500' },
          { label: 'Total Spent', value: `$${totalSpent.toFixed(2)}`, icon: Wallet, color: 'text-orange-500' },
          { label: 'Conversion', value: totalLeads > 0 ? `${((totalLeads / Math.max(1, campaigns.reduce((s, c) => s + c.impressions, 0))) * 100).toFixed(1)}%` : '0%', icon: TrendingUp, color: 'text-purple-500' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-xs text-muted-foreground">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Campaign */}
      {showCreate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/30">
            <CardContent className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> Create AI-Powered Campaign
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Campaign Name</label>
                  <Input placeholder="e.g. Restaurant POS Leads India" value={newCampaign.name} onChange={(e) => setNewCampaign(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Campaign Type</label>
                  <Select value={newCampaign.type} onValueChange={(v) => setNewCampaign(p => ({ ...p, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="google_ads">Google Ads</SelectItem>
                      <SelectItem value="facebook_ads">Facebook Ads</SelectItem>
                      <SelectItem value="email_outreach">Email Outreach</SelectItem>
                      <SelectItem value="sms_campaign">SMS Campaign</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp Marketing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Budget ($)</label>
                  <Input type="number" min={25} value={newCampaign.budget} onChange={(e) => setNewCampaign(p => ({ ...p, budget: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Target Audience</label>
                  <Input placeholder="e.g. Small businesses in Mumbai" value={newCampaign.targetAudience} onChange={(e) => setNewCampaign(p => ({ ...p, targetAudience: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Campaign Description</label>
                <Textarea placeholder="Describe your campaign goals..." value={newCampaign.description} onChange={(e) => setNewCampaign(p => ({ ...p, description: e.target.value }))} rows={3} />
              </div>
              <p className="text-xs text-muted-foreground">💡 AI will generate a full strategy, ad copy & targeting recommendations after payment</p>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button onClick={handleCreateCampaign} disabled={balance < newCampaign.budget || creating} className="gap-1.5">
                  {creating ? <><Loader2 className="h-4 w-4 animate-spin" /> AI Generating...</> : <><Zap className="h-4 w-4" /> Launch Campaign (${newCampaign.budget})</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Campaigns List */}
      {campaigns.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-foreground">Your Campaigns</h3>
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="hover:border-primary/20 transition-colors">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-foreground">{campaign.name}</h4>
                    <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'} className="text-xs">{campaign.status}</Badge>
                    {campaign.ai_strategy && <Badge variant="outline" className="text-xs gap-1 border-primary/30 text-primary"><Sparkles className="h-3 w-3" />AI</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{campaign.campaign_type.replace(/_/g, ' ')} • Budget: ${Number(campaign.budget).toFixed(2)} • {campaign.leads_count} leads</p>
                </div>
                <div className="flex gap-2">
                  {campaign.ai_strategy && (
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => setViewStrategy(campaign)}>
                      <Eye className="h-3.5 w-3.5" /> AI Strategy
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => toggleCampaignStatus(campaign.id, campaign.status)}>
                    {campaign.status === 'active' ? <><Pause className="h-3.5 w-3.5" /> Pause</> : <><Play className="h-3.5 w-3.5" /> Resume</>}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <Megaphone className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Campaigns Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first AI-powered lead generation campaign</p>
            <Button onClick={() => setShowCreate(true)} className="gap-1.5"><Megaphone className="h-4 w-4" /> Create First Campaign</Button>
          </CardContent>
        </Card>
      )}

      {/* Lead Channels */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-3">Lead Generation Channels</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: 'Email Outreach', desc: 'AI-crafted targeted emails', icon: Mail, cost: '$5/100 emails', color: 'from-blue-500 to-cyan-500' },
            { title: 'SMS Campaigns', desc: 'AI-optimized bulk SMS', icon: Phone, cost: '$10/500 SMS', color: 'from-green-500 to-emerald-500' },
            { title: 'Google Ads', desc: 'AI-managed PPC campaigns', icon: Globe, cost: '$25 min budget', color: 'from-red-500 to-orange-500' },
          ].map((ch) => (
            <Card key={ch.title} className="hover:border-primary/20 transition-colors">
              <CardContent className="p-5">
                <div className={`p-2.5 rounded-xl bg-gradient-to-br ${ch.color} text-white w-fit mb-3`}><ch.icon className="h-5 w-5" /></div>
                <h4 className="font-semibold text-foreground mb-1">{ch.title}</h4>
                <p className="text-xs text-muted-foreground mb-2">{ch.desc}</p>
                <Badge variant="outline" className="text-xs">{ch.cost}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* AI Strategy Viewer */}
      <Dialog open={!!viewStrategy} onOpenChange={() => setViewStrategy(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> AI Strategy — {viewStrategy?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="prose prose-sm dark:prose-invert max-w-none p-2">
              <ReactMarkdown>{viewStrategy?.ai_strategy || ''}</ReactMarkdown>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
