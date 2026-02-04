import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Wrench, 
  CheckCircle2, 
  ArrowRight, 
  SkipForward,
  Loader2,
  FileCode,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FixLog {
  id: string;
  action: 'fixed' | 'changed' | 'skipped' | 'upgraded';
  file: string;
  description: string;
  timestamp: Date;
}

interface AutoFixProps {
  itemsToFix?: { id: string; title: string }[];
  onComplete: () => void;
}

export function AutoFix({ itemsToFix = [], onComplete }: AutoFixProps) {
  const [isFixing, setIsFixing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [logs, setLogs] = useState<FixLog[]>([]);
  const [complete, setComplete] = useState(false);

  const startAutoFix = () => {
    setIsFixing(true);
    setLogs([]);
    setCurrentStep(0);
    setComplete(false);

    // Simulate fixing process
    const fixSteps = [
      { action: 'fixed' as const, file: 'database.php', description: 'Replaced mysql_connect with mysqli_connect' },
      { action: 'fixed' as const, file: 'query.php', description: 'Added prepared statements for SQL queries' },
      { action: 'changed' as const, file: '.env', description: 'Created environment configuration file' },
      { action: 'upgraded' as const, file: 'composer.json', description: 'Updated 5 packages to latest secure versions' },
      { action: 'fixed' as const, file: 'auth.php', description: 'Added password hashing with bcrypt' },
      { action: 'skipped' as const, file: 'legacy.php', description: 'Manual review required for custom logic' },
    ];

    let step = 0;
    const interval = setInterval(() => {
      if (step >= fixSteps.length) {
        clearInterval(interval);
        setIsFixing(false);
        setComplete(true);
        return;
      }

      const fixStep = fixSteps[step];
      setLogs(prev => [...prev, {
        id: crypto.randomUUID(),
        ...fixStep,
        timestamp: new Date()
      }]);
      setCurrentStep(step + 1);
      step++;
    }, 1000);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'fixed': return CheckCircle2;
      case 'changed': return FileCode;
      case 'skipped': return SkipForward;
      case 'upgraded': return RefreshCw;
      default: return ArrowRight;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'fixed': return 'text-success';
      case 'changed': return 'text-secondary';
      case 'skipped': return 'text-warning';
      case 'upgraded': return 'text-primary';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Wrench className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Auto Fix & Upgrade</CardTitle>
              <CardDescription className="text-xs">
                AI repairs • Zero manual coding
              </CardDescription>
            </div>
          </div>

          {complete && (
            <Badge className="bg-success/20 text-success border-success/30">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Complete
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isFixing && !complete && (
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <p className="text-sm text-foreground mb-2">AI will automatically:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  Fix deprecated code
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  Fix missing files & configs
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  Upgrade old PHP/JS safely
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  Keep original logic intact
                </li>
              </ul>
            </div>

            <Button 
              onClick={startAutoFix}
              className="w-full bg-primary hover:bg-primary/90 gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Start Auto Fix
            </Button>
          </div>
        )}

        {isFixing && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/10 border border-primary/30">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">Auto-fixing in progress...</p>
              <p className="text-xs text-muted-foreground">Step {currentStep} of 6</p>
            </div>
          </div>
        )}

        {logs.length > 0 && (
          <ScrollArea className="h-[200px]">
            <div className="space-y-2 pr-4">
              {logs.map((log) => {
                const ActionIcon = getActionIcon(log.action);
                
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-2 rounded-lg bg-muted/20 animate-fade-in"
                  >
                    <ActionIcon className={cn('h-4 w-4 mt-0.5 shrink-0', getActionColor(log.action))} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">
                          {log.file}
                        </code>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {log.action}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{log.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {complete && (
          <Button 
            onClick={onComplete}
            variant="outline"
            className="w-full border-success/30 text-success hover:bg-success/10"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Continue to Deploy
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
