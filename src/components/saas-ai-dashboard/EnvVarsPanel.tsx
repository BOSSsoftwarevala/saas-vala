import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Settings2, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff,
  Save,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface EnvVarsPanelProps {
  projectId: string | null;
}

interface EnvVar {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
}

export function EnvVarsPanel({ projectId: _projectId }: EnvVarsPanelProps) {
  const [envVars, setEnvVars] = useState<EnvVar[]>([
    { id: '1', key: 'DATABASE_URL', value: 'postgresql://user:pass@host:5432/db', isSecret: true },
    { id: '2', key: 'API_KEY', value: 'sk-1234567890abcdef', isSecret: true },
    { id: '3', key: 'NODE_ENV', value: 'production', isSecret: false },
    { id: '4', key: 'SMTP_HOST', value: 'smtp.example.com', isSecret: false },
  ]);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newIsSecret, setNewIsSecret] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const toggleSecretVisibility = (id: string) => {
    setVisibleSecrets(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const addEnvVar = () => {
    if (!newKey.trim() || !newValue.trim()) {
      toast.error('Key and value are required');
      return;
    }
    
    setEnvVars(prev => [
      ...prev,
      { id: crypto.randomUUID(), key: newKey.toUpperCase(), value: newValue, isSecret: newIsSecret }
    ]);
    setNewKey('');
    setNewValue('');
    setNewIsSecret(true);
    setDialogOpen(false);
    toast.success('Environment variable added');
  };

  const deleteEnvVar = (id: string) => {
    setEnvVars(prev => prev.filter(v => v.id !== id));
    toast.success('Environment variable deleted');
  };

  const saveChanges = () => {
    toast.success('Environment variables saved');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/20">
            <Settings2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground">Environment Variables</h2>
            <p className="text-sm text-muted-foreground">Manage your project secrets and config</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Variable
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Environment Variable</DialogTitle>
                <DialogDescription>
                  Add a new environment variable for your project.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Key</Label>
                  <Input 
                    placeholder="API_KEY" 
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Value</Label>
                  <Input 
                    placeholder="your-secret-value" 
                    type={newIsSecret ? 'password' : 'text'}
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    id="is-secret" 
                    checked={newIsSecret}
                    onChange={(e) => setNewIsSecret(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="is-secret" className="cursor-pointer">
                    Mark as secret (will be encrypted)
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={addEnvVar}>Add Variable</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button size="sm" className="gap-2" onClick={saveChanges}>
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Warning */}
      <div className="p-4 rounded-xl bg-warning/10 border border-warning/30 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-warning">Sensitive Data Warning</p>
          <p className="text-xs text-muted-foreground mt-1">
            Environment variables may contain sensitive information. Never share these values publicly.
          </p>
        </div>
      </div>

      {/* Variables List */}
      <Card className="glass-card">
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {envVars.map((envVar) => (
              <div key={envVar.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-foreground">{envVar.key}</span>
                      {envVar.isSecret && (
                        <Badge variant="secondary" className="text-[10px]">Secret</Badge>
                      )}
                    </div>
                    <span className="font-mono text-sm text-muted-foreground truncate block">
                      {envVar.isSecret && !visibleSecrets.has(envVar.id) 
                        ? '••••••••••••••••' 
                        : envVar.value
                      }
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {envVar.isSecret && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleSecretVisibility(envVar.id)}
                      className="h-8 w-8"
                    >
                      {visibleSecrets.has(envVar.id) ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteEnvVar(envVar.id)}
                    className="h-8 w-8 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
