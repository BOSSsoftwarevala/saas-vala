import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Loader2,
  FileCode,
  ShieldAlert,
  Package,
  Settings2,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalysisItem {
  id: string;
  type: 'file' | 'config' | 'security' | 'dependency';
  title: string;
  description: string;
  status: 'ok' | 'warning' | 'error';
  fixable: boolean;
}

interface CodeAnalysisProps {
  projectId?: string;
  onAutoFix: (items: AnalysisItem[]) => void;
}

export function CodeAnalysis({ projectId, onAutoFix }: CodeAnalysisProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [items, setItems] = useState<AnalysisItem[]>([]);
  const [overallStatus, setOverallStatus] = useState<'ready' | 'warning' | 'error' | null>(null);

  const startAnalysis = () => {
    setIsAnalyzing(true);
    setProgress(0);
    setItems([]);
    setAnalysisComplete(false);

    // Simulate analysis progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          completeAnalysis();
          return 100;
        }
        return prev + Math.random() * 10 + 5;
      });
    }, 300);
  };

  const completeAnalysis = () => {
    // Simulate analysis results
    const mockItems: AnalysisItem[] = [
      {
        id: '1',
        type: 'file',
        title: 'Deprecated functions detected',
        description: 'mysql_connect() found in 3 files - needs upgrade to mysqli',
        status: 'warning',
        fixable: true
      },
      {
        id: '2',
        type: 'config',
        title: 'Missing .env configuration',
        description: 'Database configuration file not found',
        status: 'error',
        fixable: true
      },
      {
        id: '3',
        type: 'security',
        title: 'SQL injection vulnerability',
        description: 'Unsanitized user input in query.php',
        status: 'error',
        fixable: true
      },
      {
        id: '4',
        type: 'dependency',
        title: 'Outdated packages',
        description: '5 packages need updates for security patches',
        status: 'warning',
        fixable: true
      },
      {
        id: '5',
        type: 'file',
        title: 'Code structure valid',
        description: 'All controllers and models properly organized',
        status: 'ok',
        fixable: false
      },
      {
        id: '6',
        type: 'security',
        title: 'HTTPS configured',
        description: 'SSL configuration detected',
        status: 'ok',
        fixable: false
      }
    ];

    setItems(mockItems);
    setIsAnalyzing(false);
    setAnalysisComplete(true);

    // Determine overall status
    const hasError = mockItems.some(i => i.status === 'error');
    const hasWarning = mockItems.some(i => i.status === 'warning');
    setOverallStatus(hasError ? 'error' : hasWarning ? 'warning' : 'ready');
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'file': return FileCode;
      case 'config': return Settings2;
      case 'security': return ShieldAlert;
      case 'dependency': return Package;
      default: return FileCode;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ok':
        return (
          <Badge className="bg-success/20 text-success border-success/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            OK
          </Badge>
        );
      case 'warning':
        return (
          <Badge className="bg-warning/20 text-warning border-warning/30">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Need Fix
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30">
            <XCircle className="h-3 w-3 mr-1" />
            Blocked
          </Badge>
        );
      default:
        return null;
    }
  };

  const fixableItems = items.filter(i => i.fixable && i.status !== 'ok');

  return (
    <Card className="glass-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-secondary/20 flex items-center justify-center">
              <Search className="h-5 w-5 text-secondary" />
            </div>
            <div>
              <CardTitle className="text-lg">Code Analysis</CardTitle>
              <CardDescription className="text-xs">
                AI-powered source code scanning
              </CardDescription>
            </div>
          </div>

          {overallStatus && (
            <Badge 
              variant="outline" 
              className={cn(
                'text-sm',
                overallStatus === 'ready' && 'bg-success/20 text-success border-success/30',
                overallStatus === 'warning' && 'bg-warning/20 text-warning border-warning/30',
                overallStatus === 'error' && 'bg-destructive/20 text-destructive border-destructive/30'
              )}
            >
              {overallStatus === 'ready' && '✔ READY'}
              {overallStatus === 'warning' && '⚠ NEED FIX'}
              {overallStatus === 'error' && '❌ BLOCKED'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!analysisComplete && !isAnalyzing && (
          <Button 
            onClick={startAnalysis}
            className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground gap-2"
          >
            <Search className="h-4 w-4" />
            Start AI Analysis
          </Button>
        )}

        {isAnalyzing && (
          <div className="space-y-3 p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-secondary" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Analyzing source code...</p>
                <p className="text-xs text-muted-foreground">Scanning files, configs, security & dependencies</p>
              </div>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {analysisComplete && items.length > 0 && (
          <>
            <ScrollArea className="h-[280px]">
              <div className="space-y-2 pr-4">
                {items.map((item) => {
                  const TypeIcon = getTypeIcon(item.type);
                  
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'p-3 rounded-lg border transition-colors',
                        item.status === 'ok' && 'bg-success/5 border-success/20',
                        item.status === 'warning' && 'bg-warning/5 border-warning/20',
                        item.status === 'error' && 'bg-destructive/5 border-destructive/20'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'p-2 rounded-lg shrink-0',
                          item.status === 'ok' && 'bg-success/10',
                          item.status === 'warning' && 'bg-warning/10',
                          item.status === 'error' && 'bg-destructive/10'
                        )}>
                          <TypeIcon className={cn(
                            'h-4 w-4',
                            item.status === 'ok' && 'text-success',
                            item.status === 'warning' && 'text-warning',
                            item.status === 'error' && 'text-destructive'
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground">{item.title}</p>
                            {getStatusBadge(item.status)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {fixableItems.length > 0 && (
              <Button 
                onClick={() => onAutoFix(fixableItems)}
                className="w-full bg-primary hover:bg-primary/90 gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Auto Fix All ({fixableItems.length} issues)
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
