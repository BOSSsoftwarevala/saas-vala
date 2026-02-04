import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ShieldCheck, 
  Bug, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2,
  Lock,
  Scan,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SecurityIssue {
  id: string;
  type: 'malware' | 'backdoor' | 'permission' | 'threat';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  fixed: boolean;
}

export function SecurityScan() {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);
  const [issues, setIssues] = useState<SecurityIssue[]>([]);

  const startScan = () => {
    setIsScanning(true);
    setProgress(0);
    setIssues([]);
    setScanComplete(false);

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          completeScan();
          return 100;
        }
        return prev + Math.random() * 8 + 3;
      });
    }, 200);
  };

  const completeScan = () => {
    const mockIssues: SecurityIssue[] = [
      {
        id: '1',
        type: 'malware',
        severity: 'critical',
        title: 'Suspicious code pattern detected',
        description: 'eval() usage in user input handler',
        fixed: false
      },
      {
        id: '2',
        type: 'backdoor',
        severity: 'high',
        title: 'Potential backdoor found',
        description: 'Remote shell access in debug.php',
        fixed: false
      },
      {
        id: '3',
        type: 'permission',
        severity: 'medium',
        title: 'Weak file permissions',
        description: 'Config file is world-readable',
        fixed: false
      }
    ];

    setIssues(mockIssues);
    setIsScanning(false);
    setScanComplete(true);
  };

  const autoFix = () => {
    setIssues(prev => prev.map(i => ({ ...i, fixed: true })));
    toast.success('All security issues fixed', {
      description: 'Code hardened and threats neutralized'
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'high': return 'bg-destructive/15 text-destructive border-destructive/25';
      case 'medium': return 'bg-warning/20 text-warning border-warning/30';
      case 'low': return 'bg-muted text-muted-foreground border-border';
      default: return '';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'malware': return Bug;
      case 'backdoor': return XCircle;
      case 'permission': return Lock;
      case 'threat': return AlertTriangle;
      default: return AlertTriangle;
    }
  };

  const unfixedIssues = issues.filter(i => !i.fixed);
  const allFixed = scanComplete && unfixedIssues.length === 0;

  return (
    <Card className="glass-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-destructive/20 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-lg">Security Scanner</CardTitle>
              <CardDescription className="text-xs">
                Malware • Backdoor • Permissions • Threats
              </CardDescription>
            </div>
          </div>

          {allFixed && (
            <Badge className="bg-success/20 text-success border-success/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Secure
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!scanComplete && !isScanning && (
          <Button 
            onClick={startScan}
            className="w-full bg-destructive hover:bg-destructive/90 gap-2"
          >
            <Scan className="h-4 w-4" />
            Start Security Scan
          </Button>
        )}

        {isScanning && (
          <div className="space-y-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-destructive" />
              <div>
                <p className="text-sm font-medium text-foreground">Scanning for threats...</p>
                <p className="text-xs text-muted-foreground">Checking malware, backdoors, permissions</p>
              </div>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {scanComplete && issues.length > 0 && (
          <>
            <ScrollArea className="h-[180px]">
              <div className="space-y-2 pr-4">
                {issues.map((issue) => {
                  const TypeIcon = getTypeIcon(issue.type);
                  
                  return (
                    <div
                      key={issue.id}
                      className={cn(
                        'p-3 rounded-lg border transition-all',
                        issue.fixed 
                          ? 'bg-success/5 border-success/30 opacity-60' 
                          : getSeverityColor(issue.severity)
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'p-2 rounded-lg shrink-0',
                          issue.fixed ? 'bg-success/10' : 'bg-background/50'
                        )}>
                          {issue.fixed ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <TypeIcon className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={cn(
                              'text-sm font-medium',
                              issue.fixed ? 'text-success line-through' : 'text-foreground'
                            )}>
                              {issue.title}
                            </p>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {issue.severity}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {issue.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {unfixedIssues.length > 0 && (
              <Button 
                onClick={autoFix}
                className="w-full bg-success hover:bg-success/90 text-success-foreground gap-2"
              >
                <ShieldCheck className="h-4 w-4" />
                Auto Fix All ({unfixedIssues.length})
              </Button>
            )}
          </>
        )}

        {scanComplete && issues.length === 0 && (
          <div className="p-4 rounded-lg bg-success/10 border border-success/30 text-center">
            <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
            <p className="text-sm font-medium text-success">No threats detected</p>
            <p className="text-xs text-muted-foreground">Your code is clean and secure</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
