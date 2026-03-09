import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAutoApkPipeline } from '@/hooks/useAutoApkPipeline';
import { Smartphone, ScanSearch, Hammer, RefreshCw, Rocket, BarChart3 } from 'lucide-react';

export function AutoApkPipelinePanel() {
  const {
    loading, stats,
    scanAndRegister, bulkBuild, checkUpdates, runFullPipeline, getStats,
  } = useAutoApkPipeline();

  useEffect(() => {
    getStats();
  }, [getStats]);

  const catalogStats = stats?.catalog;
  const queueStats = stats?.queue;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Smartphone className="h-6 w-6 text-primary" />
                Auto APK Conversion Pipeline
              </CardTitle>
              <CardDescription className="mt-1">
                Automatically converts all SaaS Vala Git repositories into Android APK products with license gating
              </CardDescription>
            </div>
            <Button onClick={runFullPipeline} disabled={loading} size="lg" className="gap-2">
              <Rocket className="h-4 w-4" />
              {loading ? 'Running...' : 'Run Full Pipeline'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Repos" value={catalogStats?.total || 0} color="text-foreground" />
        <StatCard label="APK Built" value={catalogStats?.completed || 0} color="text-green-500" />
        <StatCard label="On Marketplace" value={catalogStats?.on_marketplace || 0} color="text-blue-500" />
        <StatCard label="Build Queue" value={queueStats?.queued || 0} color="text-yellow-500" />
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ActionCard
          icon={<ScanSearch className="h-5 w-5" />}
          title="Scan Repos"
          description="Detect new SaaSVala repositories and register them as products"
          onClick={scanAndRegister}
          loading={loading}
        />
        <ActionCard
          icon={<Hammer className="h-5 w-5" />}
          title="Bulk Build APKs"
          description="Queue APK builds for all pending repositories"
          onClick={() => bulkBuild(20)}
          loading={loading}
        />
        <ActionCard
          icon={<RefreshCw className="h-5 w-5" />}
          title="Check Updates"
          description="Detect repo changes and rebuild affected APKs"
          onClick={checkUpdates}
          loading={loading}
        />
        <ActionCard
          icon={<BarChart3 className="h-5 w-5" />}
          title="Refresh Stats"
          description="Get latest pipeline statistics"
          onClick={getStats}
          loading={loading}
        />
      </div>

      {/* Pipeline Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pipeline Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatusItem label="Pending Scan" count={catalogStats?.pending || 0} variant="secondary" />
            <StatusItem label="Pending Build" count={catalogStats?.pending_build || 0} variant="outline" />
            <StatusItem label="Building" count={catalogStats?.building || 0} variant="default" />
            <StatusItem label="Completed" count={catalogStats?.completed || 0} variant="default" />
          </div>
          {queueStats && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground mb-2">Build Queue</p>
              <div className="flex gap-3 flex-wrap">
                <Badge variant="outline">Queued: {queueStats.queued}</Badge>
                <Badge variant="default">Processing: {queueStats.processing}</Badge>
                <Badge variant="secondary">Done: {queueStats.completed}</Badge>
                {queueStats.failed > 0 && (
                  <Badge variant="destructive">Failed: {queueStats.failed}</Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-center">
            {[
              { step: '1', label: 'Repo Detected', desc: 'GitHub scan' },
              { step: '2', label: 'Product Created', desc: 'Auto-register' },
              { step: '3', label: 'APK Built', desc: 'Capacitor build' },
              { step: '4', label: 'License Gated', desc: 'Key activation' },
              { step: '5', label: 'Marketplace Live', desc: 'Ready to sell' },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                  {item.step}
                </div>
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <p className={`text-3xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

function ActionCard({ icon, title, description, onClick, loading }: {
  icon: React.ReactNode; title: string; description: string; onClick: () => void; loading: boolean;
}) {
  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-primary">{icon}<span className="font-semibold text-sm">{title}</span></div>
        <p className="text-xs text-muted-foreground">{description}</p>
        <Button size="sm" variant="outline" className="w-full" onClick={onClick} disabled={loading}>
          {loading ? 'Processing...' : 'Execute'}
        </Button>
      </CardContent>
    </Card>
  );
}

function StatusItem({ label, count, variant }: { label: string; count: number; variant: "default" | "secondary" | "outline" | "destructive" }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Badge variant={variant}>{count}</Badge>
    </div>
  );
}
