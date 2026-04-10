import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ServerFunctions() {
  const [showCreate, setShowCreate] = useState(false);
  const [newFunction, setNewFunction] = useState({ name: '', runtime: 'nodejs18', type: 'serverless' });
  const { toast } = useToast();

  const handleCreate = () => {
    if (!newFunction.name.trim()) return;
    toast({
      title: 'Function created',
      description: `${newFunction.name} has been created successfully.`,
    });
    setNewFunction({ name: '', runtime: 'nodejs18', type: 'serverless' });
    setShowCreate(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-bold text-foreground">Functions</h3>
          <p className="text-sm text-muted-foreground">
            Serverless, Edge, and Cron functions
          </p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="bg-orange-gradient hover:opacity-90 text-white gap-2" disabled>
              <Plus className="h-4 w-4" />
              Create Function
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Create Function</DialogTitle>
              <DialogDescription>
                Deploy serverless functions, edge functions, or cron jobs
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="fn-name" className="text-foreground">Function Name</Label>
                <Input
                  id="fn-name"
                  placeholder="api/users"
                  value={newFunction.name}
                  onChange={(e) => setNewFunction({ ...newFunction, name: e.target.value })}
                  className="bg-muted/50 border-border font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Function Type</Label>
                <Select
                  value={newFunction.type}
                  onValueChange={(value) => setNewFunction({ ...newFunction, type: value })}
                >
                  <SelectTrigger className="bg-muted/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="serverless">Serverless Function</SelectItem>
                    <SelectItem value="edge">Edge Function</SelectItem>
                    <SelectItem value="cron">Cron Job</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Runtime</Label>
                <Select
                  value={newFunction.runtime}
                  onValueChange={(value) => setNewFunction({ ...newFunction, runtime: value })}
                >
                  <SelectTrigger className="bg-muted/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="nodejs18">Node.js 18.x</SelectItem>
                    <SelectItem value="nodejs20">Node.js 20.x</SelectItem>
                    <SelectItem value="edge">Edge Runtime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)} className="border-border">
                Cancel
              </Button>
              <Button onClick={handleCreate} className="bg-orange-gradient hover:opacity-90 text-white">
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Empty State */}
      <Card className="glass-card">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center mb-4">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium text-foreground">No functions yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Functions require Vercel integration. Connect your Vercel account to start deploying serverless functions.
          </p>
          <Button variant="outline" className="border-border mt-4" disabled>
            Connect Vercel
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
