import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useBulkVercelDeploy } from '@/hooks/useBulkVercelDeploy';
import { Rocket, RefreshCw, CheckCircle, XCircle, Loader2, Globe } from 'lucide-react';

export function BulkVercelDeployPanel() {
  const {
    deploying,
    status,
    batchResults,
    totalDeployed,
    totalFailed,
    getStatus,
    deployAll,
  } = useBulkVercelDeploy();

  useEffect(() => {
    getStatus();
  }, []);

  const totalProcessed = totalDeployed + totalFailed;
  const progressPercent = status?.total_repos
    ? Math.round(((status.deployed_with_subdomain + totalDeployed) / status.total_repos) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-blue-400" />
            Vercel Bulk Deploy — saasvala.com
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-400">{status?.total_repos ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Total Repos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">{status?.deployed_with_subdomain ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Deployed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-400">{status?.pending ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </div>

          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">{progressPercent}% deployed to *.saasvala.com</p>

          <div className="flex gap-2">
            <Button
              onClick={() => deployAll(5)}
              disabled={deploying}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {deploying ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Deploying...</>
              ) : (
                <><Rocket className="h-4 w-4 mr-2" /> Deploy All to Vercel</>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={getStatus}
              disabled={deploying}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Live Results */}
      {deploying && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Live Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 text-sm">
              <span className="text-green-400">✅ {totalDeployed} deployed</span>
              <span className="text-red-400">❌ {totalFailed} failed</span>
              <span className="text-muted-foreground">🔄 Processing batch {batchResults.length + 1}...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Batch History */}
      {batchResults.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Deployment Results</CardTitle>
          </CardHeader>
          <CardContent className="max-h-64 overflow-y-auto space-y-1">
            {batchResults.flatMap(batch => batch.results).map((r, i) => (
              <div key={i} className="flex items-center justify-between py-1 px-2 rounded text-xs bg-muted/30">
                <span className="font-mono">{r.slug}</span>
                <div className="flex items-center gap-2">
                  {r.success ? (
                    <>
                      <a href={`https://${r.custom_domain}`} target="_blank" className="text-blue-400 hover:underline">
                        {r.custom_domain}
                      </a>
                      <CheckCircle className="h-3 w-3 text-green-400" />
                    </>
                  ) : (
                    <>
                      <span className="text-red-400">{r.error}</span>
                      <XCircle className="h-3 w-3 text-red-400" />
                    </>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
