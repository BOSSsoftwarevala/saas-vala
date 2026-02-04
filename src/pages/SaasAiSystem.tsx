import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageSquare, Mic, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { AiDashboardStats } from '@/components/saas-ai/AiDashboardStats';
import { AiQuickActions } from '@/components/saas-ai/AiQuickActions';
import { AiCategoriesGrid } from '@/components/saas-ai/AiCategoriesGrid';
import { AiTaskModal } from '@/components/saas-ai/AiTaskModal';
import { AiHistoryPanel } from '@/components/saas-ai/AiHistoryPanel';
import saasValaLogo from '@/assets/saas-vala-logo.jpg';

export default function SaasAiSystem() {
  const navigate = useNavigate();
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // Mock stats - would come from database
  const stats = {
    totalPrompts: 1247,
    activeTasks: 3,
    autoFixesDone: 89,
    pendingReviews: 5,
    aiHealthScore: 98,
  };

  const handleNewTask = () => {
    setTaskModalOpen(true);
  };

  const handleVoiceCommand = () => {
    setIsRecording(true);
    toast.info('Listening for voice command...');
    // Voice recognition would be implemented here
    setTimeout(() => {
      setIsRecording(false);
      toast.success('Voice command captured!');
      setTaskModalOpen(true);
    }, 2000);
  };

  const handleUploadFile = () => {
    setTaskModalOpen(true);
  };

  const handleViewHistory = () => {
    setHistoryOpen(!historyOpen);
  };

  const handleTaskSubmit = (task: { type: string; content: string; category: string }) => {
    toast.success(`AI Task started: ${task.content.slice(0, 50)}...`);
    // Navigate to chat with the task pre-filled
    navigate('/ai-chat');
  };

  const handleRunTask = (categoryId: string, task: string) => {
    toast.success(`Running: ${task}`);
    navigate('/ai-chat');
  };

  const handleRerun = (item: any) => {
    toast.success(`Re-running: ${item.task}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <img src={saasValaLogo} alt="SaaS VALA" className="h-10 w-10 rounded-xl object-cover" />
              <div>
                <h1 className="font-display font-bold text-foreground">SaaS VALA AI</h1>
                <p className="text-xs text-muted-foreground">
                  Internal AI System • Non-Tech Friendly
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant={isRecording ? 'destructive' : 'outline'}
              size="sm"
              onClick={handleVoiceCommand}
              className="gap-2"
            >
              <Mic className={`h-4 w-4 ${isRecording ? 'animate-pulse' : ''}`} />
              {isRecording ? 'Listening...' : 'Voice'}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate('/ai-chat')}
              className="gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              AI Chat
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/saas-ai-dashboard')}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Dashboard
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <AiDashboardStats stats={stats} />

        {/* Quick Actions */}
        <AiQuickActions
          onNewTask={handleNewTask}
          onVoiceCommand={handleVoiceCommand}
          onUploadFile={handleUploadFile}
          onViewHistory={handleViewHistory}
        />

        {/* History Panel (Conditional) */}
        <AiHistoryPanel
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onRerun={handleRerun}
        />

        {/* Categories Grid */}
        <AiCategoriesGrid onRunTask={handleRunTask} />
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 px-6">
        <p className="text-center text-sm text-muted-foreground">
          Powered by <span className="font-semibold text-primary">SoftwareVala™</span>
        </p>
      </footer>

      {/* Task Modal */}
      <AiTaskModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        onSubmit={handleTaskSubmit}
      />
    </div>
  );
}
