import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  GitBranch, Plus, Upload, RefreshCw, Link, FileText, ChevronDown, ChevronUp,
  Database, Loader2, Check, AlertCircle
} from 'lucide-react';

interface SyncResult {
  inserted: number;
  updated: number;
  errors: number;
  total: number;
}

export function AdminProductManager() {
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Manual add state
  const [manualName, setManualName] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualGitUrl, setManualGitUrl] = useState('');
  const [manualApkUrl, setManualApkUrl] = useState('');
  const [manualPrice, setManualPrice] = useState('5');
  const [manualLang, setManualLang] = useState('');
  const [addingManual, setAddingManual] = useState(false);

  // Bulk URL state
  const [bulkUrls, setBulkUrls] = useState('');
  const [addingBulk, setAddingBulk] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ name: string; status: string }[]>([]);

  // File upload state
  const [fileProcessing, setFileProcessing] = useState(false);

  // Sync real GitHub repos → products
  const handleGitHubSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('github-multi-account', {
        body: { action: 'sync_to_products', data: {} },
      });
      if (error) throw error;
      if (data?.success) {
        setSyncResult(data);
        toast.success(`✅ Synced! ${data.inserted} new, ${data.updated} updated from GitHub`);
      } else {
        toast.error('Sync failed');
      }
    } catch (e: any) {
      toast.error(e.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // Add single product manually
  const handleAddManual = async () => {
    if (!manualName.trim()) { toast.error('Product name required'); return; }
    setAddingManual(true);
    try {
      const { data, error } = await supabase.functions.invoke('github-multi-account', {
        body: {
          action: 'add_manual_product',
          data: {
            name: manualName.trim(),
            description: manualDesc.trim() || undefined,
            gitUrl: manualGitUrl.trim() || undefined,
            apkUrl: manualApkUrl.trim() || undefined,
            price: Number(manualPrice) || 5,
            language: manualLang.trim() || undefined,
          },
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`✅ "${manualName}" added to marketplace`);
        setManualName(''); setManualDesc(''); setManualGitUrl('');
        setManualApkUrl(''); setManualLang(''); setManualPrice('5');
      } else {
        toast.error(data?.error || 'Failed to add product');
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setAddingManual(false);
    }
  };

  // Bulk add from URLs (one per line: name | github_url | apk_url)
  const handleBulkUrls = async () => {
    const lines = bulkUrls.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) { toast.error('Enter at least one line'); return; }

    setAddingBulk(true);
    setBulkResults([]);
    const results: { name: string; status: string }[] = [];

    for (const line of lines) {
      const parts = line.split('|').map(p => p.trim());
      const name = parts[0];
      const gitUrl = parts[1] || undefined;
      const apkUrl = parts[2] || undefined;

      if (!name) { results.push({ name: line, status: 'skip: no name' }); continue; }

      try {
        const { data, error } = await supabase.functions.invoke('github-multi-account', {
          body: { action: 'add_manual_product', data: { name, gitUrl, apkUrl, price: 5 } },
        });
        if (error || !data?.success) {
          results.push({ name, status: `error: ${data?.error || error?.message}` });
        } else {
          results.push({ name, status: 'added' });
        }
      } catch (e: any) {
        results.push({ name, status: `error: ${e.message}` });
      }
    }

    setBulkResults(results);
    const added = results.filter(r => r.status === 'added').length;
    toast.success(`Done! ${added}/${lines.length} products added`);
    setAddingBulk(false);
  };

  // Parse txt file (one product name per line, or pipe-separated)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileProcessing(true);

    const text = await file.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    setBulkUrls(lines.join('\n'));
    setFileProcessing(false);
    toast.success(`${lines.length} lines loaded from file. Review and click "Add All"`);
    e.target.value = '';
  };

  if (!open) {
    return (
      <div className="px-4 md:px-8 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="border-primary/30 text-primary hover:bg-primary/10"
        >
          <Database className="h-4 w-4 mr-2" />
          Admin: Manage Products
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 mb-6">
      <Card className="border-primary/20 bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Product Manager (Admin Only)
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              <ChevronUp className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="github">
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="github" className="flex-1">
                <GitBranch className="h-3 w-3 mr-1" />
                GitHub Sync
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex-1">
                <Plus className="h-3 w-3 mr-1" />
                Add Single
              </TabsTrigger>
              <TabsTrigger value="bulk" className="flex-1">
                <Link className="h-3 w-3 mr-1" />
                Bulk Add
              </TabsTrigger>
              <TabsTrigger value="file" className="flex-1">
                <FileText className="h-3 w-3 mr-1" />
                File Upload
              </TabsTrigger>
            </TabsList>

            {/* GitHub Sync Tab */}
            <TabsContent value="github" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Fetch all real repos from <strong>SaaSVala</strong> + <strong>SoftwareVala</strong> GitHub accounts and add them as products.
              </p>
              <Button
                onClick={handleGitHubSync}
                disabled={syncing}
                className="w-full"
              >
                {syncing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing GitHub Repos...</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-2" />Sync Real GitHub Repos → Products</>
                )}
              </Button>

              {syncResult && (
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="text-center p-3 bg-accent rounded-lg border border-border">
                    <p className="text-2xl font-bold text-foreground">{syncResult.inserted}</p>
                    <p className="text-xs text-muted-foreground">New Added</p>
                  </div>
                  <div className="text-center p-3 bg-secondary rounded-lg border border-border">
                    <p className="text-2xl font-bold text-primary">{syncResult.updated}</p>
                    <p className="text-xs text-muted-foreground">Updated</p>
                  </div>
                  <div className="text-center p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                    <p className="text-2xl font-bold text-destructive">{syncResult.errors}</p>
                    <p className="text-xs text-muted-foreground">Errors</p>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Manual Single Add Tab */}
            <TabsContent value="manual" className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Product Name *</label>
                  <Input placeholder="e.g. Hotel Booking Pro" value={manualName} onChange={e => setManualName(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                  <Textarea placeholder="Short description..." value={manualDesc} onChange={e => setManualDesc(e.target.value)} rows={2} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">GitHub URL</label>
                  <Input placeholder="https://github.com/..." value={manualGitUrl} onChange={e => setManualGitUrl(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">APK URL / Path</label>
                  <Input placeholder="apks/myapp.apk or https://..." value={manualApkUrl} onChange={e => setManualApkUrl(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Language / Stack</label>
                  <Input placeholder="PHP, React, Flutter..." value={manualLang} onChange={e => setManualLang(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Price ($)</label>
                  <Input type="number" placeholder="5" value={manualPrice} onChange={e => setManualPrice(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleAddManual} disabled={addingManual} className="w-full">
                {addingManual ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</> : <><Plus className="h-4 w-4 mr-2" />Add to Marketplace</>}
              </Button>
            </TabsContent>

            {/* Bulk URLs Tab */}
            <TabsContent value="bulk" className="space-y-3">
              <p className="text-xs text-muted-foreground">
                One per line. Format: <code className="bg-muted px-1 rounded">Product Name | GitHub URL | APK URL</code><br/>
                GitHub URL and APK URL are optional.
              </p>
              <Textarea
                placeholder={"Hotel Booking System | https://github.com/saasvala/hotel-booking\nRestaurant POS | https://github.com/saasvala/restaurant-pos | apks/restaurant.apk\nSchool ERP Pro"}
                value={bulkUrls}
                onChange={e => setBulkUrls(e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
              <Button onClick={handleBulkUrls} disabled={addingBulk} className="w-full">
                {addingBulk ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adding...</> : <><Upload className="h-4 w-4 mr-2" />Add All to Marketplace</>}
              </Button>

              {bulkResults.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1 mt-2">
                  {bulkResults.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {r.status === 'added' ? (
                        <Check className="h-3 w-3 text-primary shrink-0" />
                      ) : (
                        <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
                      )}
                      <span className="truncate">{r.name}</span>
                      {r.status !== 'added' && (
                        <Badge variant="destructive" className="text-[10px] ml-auto shrink-0">{r.status}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* File Upload Tab */}
            <TabsContent value="file" className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Upload a <strong>.txt</strong> file. Each line = one product.<br/>
                Format: <code className="bg-muted px-1 rounded">Name | GitHub URL | APK URL</code>
              </p>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                {fileProcessing ? (
                  <><Loader2 className="h-8 w-8 text-muted-foreground animate-spin mb-2" /><span className="text-sm text-muted-foreground">Reading file...</span></>
                ) : (
                  <><Upload className="h-8 w-8 text-muted-foreground mb-2" /><span className="text-sm text-muted-foreground">Click to upload .txt file</span><span className="text-xs text-muted-foreground">File will load into Bulk Add tab</span></>
                )}
                <input type="file" accept=".txt,.csv" className="hidden" onChange={handleFileUpload} />
              </label>
              <p className="text-xs text-muted-foreground text-center">
                After file loads, go to <strong>Bulk Add</strong> tab to review and submit.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
