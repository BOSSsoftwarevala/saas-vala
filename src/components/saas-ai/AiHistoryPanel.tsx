import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { History, Search, CheckCircle, Clock, XCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AiHistoryItem {
  id: string;
  task: string;
  category: string;
  status: 'success' | 'pending' | 'failed';
  timestamp: Date;
  result?: string;
}

interface AiHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  onRerun: (item: AiHistoryItem) => void;
}

export function AiHistoryPanel({ open, onClose, onRerun }: AiHistoryPanelProps) {
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState<AiHistoryItem[]>([
    {
      id: '1',
      task: 'Analyze product for missing features',
      category: 'Product AI',
      status: 'success',
      timestamp: new Date(Date.now() - 3600000),
      result: 'Found 3 missing button actions in checkout flow'
    },
    {
      id: '2',
      task: 'Security scan on uploaded code',
      category: 'Security AI',
      status: 'success',
      timestamp: new Date(Date.now() - 7200000),
      result: 'No critical vulnerabilities found. 2 minor issues fixed.'
    },
    {
      id: '3',
      task: 'Deploy to client server',
      category: 'Deployment AI',
      status: 'pending',
      timestamp: new Date(Date.now() - 1800000),
    },
    {
      id: '4',
      task: 'Auto SEO optimization',
      category: 'SEO & Leads AI',
      status: 'failed',
      timestamp: new Date(Date.now() - 5400000),
      result: 'Failed: Missing sitemap.xml'
    },
  ]);

  const filteredHistory = history.filter(item => 
    item.task.toLowerCase().includes(search.toLowerCase()) ||
    item.category.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green" />;
      case 'pending': return <Clock className="h-4 w-4 text-orange" />;
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green/10 text-green border-green/30';
      case 'pending': return 'bg-orange/10 text-orange border-orange/30';
      case 'failed': return 'bg-destructive/10 text-destructive border-destructive/30';
    }
  };

  if (!open) return null;

  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            AI History
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search history..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {filteredHistory.map((item) => (
              <div 
                key={item.id}
                className="p-3 rounded-lg bg-muted/20 border border-border/50 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(item.status)}
                      <span className="font-medium text-sm">{item.task}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">{item.category}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {item.timestamp.toLocaleString()}
                      </span>
                    </div>
                    {item.result && (
                      <p className={cn(
                        'text-xs p-2 rounded',
                        item.status === 'success' ? 'bg-green/10 text-green' :
                        item.status === 'failed' ? 'bg-destructive/10 text-destructive' :
                        'bg-muted text-muted-foreground'
                      )}>
                        {item.result}
                      </p>
                    )}
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => onRerun(item)}
                    className="shrink-0"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
