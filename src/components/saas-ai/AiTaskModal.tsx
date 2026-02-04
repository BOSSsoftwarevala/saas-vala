import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Mic, Upload, FileCode, Smartphone } from 'lucide-react';

interface AiTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (task: { type: string; content: string; category: string }) => void;
}

export function AiTaskModal({ open, onOpenChange, onSubmit }: AiTaskModalProps) {
  const [inputType, setInputType] = useState('text');
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState('product-ai');
  const [isRecording, setIsRecording] = useState(false);

  const handleSubmit = () => {
    if (!prompt.trim()) return;
    onSubmit({ type: inputType, content: prompt, category });
    setPrompt('');
    onOpenChange(false);
  };

  const handleVoiceStart = () => {
    setIsRecording(true);
    // Voice recording would be implemented here
    setTimeout(() => {
      setIsRecording(false);
      setPrompt('Voice command captured: Analyze my product for missing features');
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">New AI Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Category Selection */}
          <div className="space-y-2">
            <Label>AI Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product-ai">Product AI</SelectItem>
                <SelectItem value="code-ai">Code & File AI</SelectItem>
                <SelectItem value="deployment-ai">Deployment AI</SelectItem>
                <SelectItem value="security-ai">Security AI</SelectItem>
                <SelectItem value="seo-leads-ai">SEO & Leads AI</SelectItem>
                <SelectItem value="payment-ai">Payment & Wallet AI</SelectItem>
                <SelectItem value="support-ai">Support AI</SelectItem>
                <SelectItem value="business-ai">Business & Decision AI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Input Type Tabs */}
          <Tabs value={inputType} onValueChange={setInputType}>
            <TabsList className="grid grid-cols-5 h-auto">
              <TabsTrigger value="text" className="flex-col gap-1 py-2">
                <MessageSquare className="h-4 w-4" />
                <span className="text-xs">Text</span>
              </TabsTrigger>
              <TabsTrigger value="voice" className="flex-col gap-1 py-2">
                <Mic className="h-4 w-4" />
                <span className="text-xs">Voice</span>
              </TabsTrigger>
              <TabsTrigger value="file" className="flex-col gap-1 py-2">
                <Upload className="h-4 w-4" />
                <span className="text-xs">File</span>
              </TabsTrigger>
              <TabsTrigger value="code" className="flex-col gap-1 py-2">
                <FileCode className="h-4 w-4" />
                <span className="text-xs">Code</span>
              </TabsTrigger>
              <TabsTrigger value="apk" className="flex-col gap-1 py-2">
                <Smartphone className="h-4 w-4" />
                <span className="text-xs">APK</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="mt-4">
              <Textarea
                placeholder="Describe your AI task..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[120px]"
              />
            </TabsContent>

            <TabsContent value="voice" className="mt-4">
              <div className="flex flex-col items-center justify-center p-8 border border-dashed border-border rounded-lg">
                <Button
                  size="lg"
                  variant={isRecording ? 'destructive' : 'default'}
                  className="rounded-full h-20 w-20"
                  onClick={handleVoiceStart}
                >
                  <Mic className={`h-8 w-8 ${isRecording ? 'animate-pulse' : ''}`} />
                </Button>
                <p className="text-sm text-muted-foreground mt-4">
                  {isRecording ? 'Recording... Click to stop' : 'Click to start voice command'}
                </p>
                {prompt && (
                  <p className="text-sm text-foreground mt-2 p-2 bg-muted rounded">{prompt}</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="file" className="mt-4">
              <div className="border border-dashed border-border rounded-lg p-8 text-center">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-2">Drag & drop files here</p>
                <Input type="file" className="hidden" id="file-upload" />
                <Button variant="outline" onClick={() => document.getElementById('file-upload')?.click()}>
                  Browse Files
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="code" className="mt-4">
              <div className="border border-dashed border-border rounded-lg p-8 text-center">
                <FileCode className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-2">Upload ZIP, folder, or source files</p>
                <p className="text-xs text-muted-foreground mb-4">Supports: PHP, JS, Python, Java, and more</p>
                <Input type="file" className="hidden" id="code-upload" accept=".zip,.tar,.gz" />
                <Button variant="outline" onClick={() => document.getElementById('code-upload')?.click()}>
                  Upload Code
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="apk" className="mt-4">
              <div className="border border-dashed border-border rounded-lg p-8 text-center">
                <Smartphone className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-2">Upload APK for analysis</p>
                <p className="text-xs text-muted-foreground mb-4">Security scan & code extraction</p>
                <Input type="file" className="hidden" id="apk-upload" accept=".apk" />
                <Button variant="outline" onClick={() => document.getElementById('apk-upload')?.click()}>
                  Upload APK
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!prompt.trim() && inputType === 'text'}>
            Run AI Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
