import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Plus, 
  Mic, 
  Upload, 
  History,
  Zap
} from 'lucide-react';

interface AiQuickActionsProps {
  onNewTask: () => void;
  onVoiceCommand: () => void;
  onUploadFile: () => void;
  onViewHistory: () => void;
}

export function AiQuickActions({ 
  onNewTask, 
  onVoiceCommand, 
  onUploadFile, 
  onViewHistory 
}: AiQuickActionsProps) {
  return (
    <Card className="glass-card border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button 
            onClick={onNewTask}
            className="h-auto flex-col gap-2 py-4 bg-primary/10 hover:bg-primary/20 text-foreground border border-primary/30"
            variant="outline"
          >
            <Plus className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium">New AI Task</span>
          </Button>
          
          <Button 
            onClick={onVoiceCommand}
            className="h-auto flex-col gap-2 py-4 bg-cyan/10 hover:bg-cyan/20 text-foreground border border-cyan/30"
            variant="outline"
          >
            <Mic className="h-6 w-6 text-cyan" />
            <span className="text-sm font-medium">Voice Command</span>
          </Button>
          
          <Button 
            onClick={onUploadFile}
            className="h-auto flex-col gap-2 py-4 bg-green/10 hover:bg-green/20 text-foreground border border-green/30"
            variant="outline"
          >
            <Upload className="h-6 w-6 text-green" />
            <span className="text-sm font-medium">Upload File</span>
          </Button>
          
          <Button 
            onClick={onViewHistory}
            className="h-auto flex-col gap-2 py-4 bg-purple/10 hover:bg-purple/20 text-foreground border border-purple/30"
            variant="outline"
          >
            <History className="h-6 w-6 text-purple" />
            <span className="text-sm font-medium">AI History</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
