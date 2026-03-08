import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Globe, CheckCircle2, Shield, Copy, Check, ExternalLink, Loader2, Rocket, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface SubdomainResult {
  slug: string;
  success: boolean;
  custom_domain?: string;
  vercel_url?: string;
  error?: string;
}

export function AutoSubdomain() {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [appName, setAppName] = useState('');
  const [lastResult, setLastResult] = useState<any>(null);
  const [bulkResults, setBulkResults] = useState<SubdomainResult[]>([]);

  const domainSuffix = 'saasvala.com';

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('URL copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Single repo → auto subdomain
  const handleAutoSubdomain = async () => {
    if (!repoUrl) {
      toast.error('GitHub repo URL daalo');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('factory-deploy', {
        body: {
          action: 'auto-subdomain',
          repo_url: repoUrl,
          app_name: appName || undefined,
          domain_suffix: domainSuffix,
        },
      });
      if (error) throw error;
      setLastResult(data);
      if (data?.success) {
        toast.success(`✅ ${data.custom_domain} created!`);
      } else {
        toast.error(data?.error || 'Failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error creating subdomain');
    } finally {
      setLoading(false);
    }
  };

  // Bulk → deploy all SaaSVala repos with subdomains
  const handleBulkSubdomain = async () => {
    setBulkLoading(true);
    setBulkResults([]);
    toast.info('🚀 Bulk subdomain creation started... This may take a few minutes.');

    try {
      // Import repo mapping dynamically
      const { allRepos } = await import('@/data/saasvalaRepoMapping');
      
      // Process in batches of 10
      const batchSize = 10;
      const allResults: SubdomainResult[] = [];

      for (let i = 0; i < allRepos.length; i += batchSize) {
        const batch = allRepos.slice(i, i + batchSize).map(r => ({ slug: r.slug, owner: 'saasvala' }));

        const { data, error } = await supabase.functions.invoke('factory-deploy', {
          body: {
            action: 'bulk-subdomain',
            repos: batch,
            domain_suffix: domainSuffix,
          },
        });

        if (error) {
          batch.forEach(r => allResults.push({ slug: r.slug, success: false, error: 'API error' }));
        } else if (data?.results) {
          allResults.push(...data.results);
        }

        setBulkResults([...allResults]);
        toast.info(`📦 Processed ${Math.min(i + batchSize, allRepos.length)}/${allRepos.length} repos...`);
      }

      const successCount = allResults.filter(r => r.success).length;
      toast.success(`✅ Done! ${successCount}/${allResults.length} repos deployed with .${domainSuffix} subdomains`);
    } catch (err: any) {
      toast.error(err.message || 'Bulk subdomain failed');
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-cyan/20 flex items-center justify-center">
              <Globe className="h-5 w-5 text-cyan" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg">Auto Subdomain System</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Auto-create {'{repo}.saasvala.com'} via Vercel
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-success/20 text-success border-success/30 hidden sm:flex">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Vercel Connected
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Single Repo Subdomain */}
        <div className="glass-card rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Single Repo → Subdomain</p>
          <Input
            placeholder="https://github.com/saasvala/repo-name"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className="bg-background/50"
          />
          <Input
            placeholder="Custom name (optional)"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            className="bg-background/50"
          />
          <Button
            onClick={handleAutoSubdomain}
            disabled={loading}
            className="w-full bg-orange-gradient hover:opacity-90 text-white gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            Create Subdomain
          </Button>

          {lastResult?.success && (
            <div className="p-3 rounded-lg bg-success/10 border border-success/20 space-y-1">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-sm font-medium text-success">Subdomain Created!</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-foreground font-mono">https://{lastResult.custom_domain}</p>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => copyUrl(`https://${lastResult.custom_domain}`)}>
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <a href={`https://${lastResult.custom_domain}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Vercel: {lastResult.vercel_url}</p>
            </div>
          )}
        </div>

        {/* Bulk Deploy All Repos */}
        <div className="glass-card rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Bulk Deploy All 284 Repos</p>
              <p className="text-xs text-muted-foreground">Auto-create all *.saasvala.com subdomains</p>
            </div>
            <Badge variant="outline" className="text-xs">284 repos</Badge>
          </div>
          <Button
            onClick={handleBulkSubdomain}
            disabled={bulkLoading}
            variant="outline"
            className="w-full border-primary/30 gap-2"
          >
            {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {bulkLoading ? 'Processing...' : 'Deploy All with Subdomains'}
          </Button>

          {bulkResults.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <div className="flex gap-2 text-xs">
                <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                  ✅ {bulkResults.filter(r => r.success).length}
                </Badge>
                <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30">
                  ❌ {bulkResults.filter(r => !r.success).length}
                </Badge>
              </div>
              {bulkResults.slice(-20).map((r, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/30 text-xs">
                  <span className="font-mono truncate flex-1">{r.slug}.saasvala.com</span>
                  {r.success ? (
                    <CheckCircle2 className="h-3 w-3 text-success shrink-0 ml-2" />
                  ) : (
                    <span className="text-destructive shrink-0 ml-2">✗</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-muted/30 text-center">
            <CheckCircle2 className="h-5 w-5 text-success mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Auto DNS</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 text-center">
            <Shield className="h-5 w-5 text-success mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">SSL Auto</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 text-center">
            <Globe className="h-5 w-5 text-cyan mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">*.saasvala.com</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
