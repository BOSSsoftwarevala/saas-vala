import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  RefreshCw, 
  Download, 
  History, 
  CheckCircle2,
  Clock,
  ArrowDownToLine,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PatchVersion {
  id: string;
  version: string;
  date: Date;
  changes: string[];
  status: 'current' | 'available' | 'rollback';
}

const mockVersions: PatchVersion[] = [
  {
    id: '1',
    version: 'v2.1.0',
    date: new Date(),
    changes: ['Security patch', 'Performance improvements', 'Bug fixes'],
    status: 'available'
  },
  {
    id: '2',
    version: 'v2.0.5',
    date: new Date(Date.now() - 86400000 * 3),
    changes: ['Current deployed version'],
    status: 'current'
  },
  {
    id: '3',
    version: 'v2.0.4',
    date: new Date(Date.now() - 86400000 * 7),
    changes: ['Previous stable release'],
    status: 'rollback'
  },
  {
    id: '4',
    version: 'v2.0.3',
    date: new Date(Date.now() - 86400000 * 14),
    changes: ['Legacy version'],
    status: 'rollback'
  }
];

export function UpdatePatch() {
  const [versions, setVersions] = useState<PatchVersion[]>(mockVersions);
  const [updating, setUpdating] = useState<string | null>(null);

  const applyUpdate = (version: PatchVersion) => {
    setUpdating(version.id);
    
    setTimeout(() => {
      setVersions(prev => prev.map(v => ({
        ...v,
        status: v.id === version.id ? 'current' : 
                v.status === 'current' ? 'rollback' : v.status
      })));
      setUpdating(null);
      toast.success(`Updated to ${version.version}`, {
        description: 'No downtime - incremental patch applied'
      });
    }, 3000);
  };

  const rollback = (version: PatchVersion) => {
    setUpdating(version.id);
    
    setTimeout(() => {
      setVersions(prev => prev.map(v => ({
        ...v,
        status: v.id === version.id ? 'current' : 
                v.status === 'current' ? 'available' : v.status
      })));
      setUpdating(null);
      toast.success(`Rolled back to ${version.version}`);
    }, 2000);
  };

  const currentVersion = versions.find(v => v.status === 'current');
  const availableUpdate = versions.find(v => v.status === 'available');

  return (
    <Card className="glass-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-secondary/20 flex items-center justify-center">
              <RefreshCw className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <CardTitle className="text-lg">Auto Update & Patch</CardTitle>
              <CardDescription className="text-xs">
                One-click updates • Zero downtime
              </CardDescription>
            </div>
          </div>

          {currentVersion && (
            <Badge variant="outline" className="border-border">
              {currentVersion.version}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Available Update */}
        {availableUpdate && (
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Download className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Update Available: {availableUpdate.version}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {availableUpdate.changes.join(' • ')}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => applyUpdate(availableUpdate)}
                disabled={updating !== null}
                className="bg-primary hover:bg-primary/90 gap-2"
                size="sm"
              >
                {updating === availableUpdate.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowDownToLine className="h-4 w-4" />
                )}
                Update Now
              </Button>
            </div>
          </div>
        )}

        {/* Version History */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <History className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Version History</p>
          </div>
          
          <ScrollArea className="h-[180px]">
            <div className="space-y-2 pr-4">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border transition-colors',
                    version.status === 'current' && 'bg-success/5 border-success/30',
                    version.status === 'available' && 'bg-primary/5 border-primary/30',
                    version.status === 'rollback' && 'bg-muted/20 border-border'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {version.status === 'current' && (
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    )}
                    {version.status === 'available' && (
                      <Download className="h-4 w-4 text-primary shrink-0" />
                    )}
                    {version.status === 'rollback' && (
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{version.version}</p>
                        {version.status === 'current' && (
                          <Badge className="bg-success/20 text-success border-success/30 text-[10px]">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {version.date.toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {version.status === 'rollback' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => rollback(version)}
                      disabled={updating !== null}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {updating === version.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        'Rollback'
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
