import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Settings2, Save, Trash2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SystemPrompt {
  id: string;
  name: string;
  prompt: string;
  is_default: boolean;
  is_global: boolean;
}

interface SystemPromptEditorProps {
  isOpen: boolean;
  onClose: () => void;
  activePrompt: string;
  onSelectPrompt: (prompt: string) => void;
}

export function SystemPromptEditor({ isOpen, onClose, activePrompt, onSelectPrompt }: SystemPromptEditorProps) {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [editingPrompt, setEditingPrompt] = useState(activePrompt);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) loadPrompts();
  }, [isOpen]);

  useEffect(() => {
    setEditingPrompt(activePrompt);
  }, [activePrompt]);

  const loadPrompts = async () => {
    try {
      const { data } = await (supabase as any)
        .from('system_prompts')
        .select('*')
        .order('is_default', { ascending: false });
      if (data) setPrompts(data as SystemPrompt[]);
    } catch (e) {
      console.error('Failed to load prompts:', e);
    }
  };

  const handleSave = async () => {
    if (!newName.trim() || !editingPrompt.trim()) {
      toast.error('Name aur prompt dono chahiye');
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from('system_prompts').insert({
      name: newName,
      prompt: editingPrompt,
      user_id: user?.id,
      is_default: false,
      is_global: false,
    });
    setLoading(false);
    if (error) toast.error('Save failed');
    else { toast.success('Prompt saved'); setNewName(''); loadPrompts(); }
  };

  const handleDelete = async (id: string) => {
    await (supabase as any).from('system_prompts').delete().eq('id', id);
    toast.success('Deleted');
    loadPrompts();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            System Prompt Editor
          </SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Active System Prompt</label>
            <Textarea
              value={editingPrompt}
              onChange={(e) => setEditingPrompt(e.target.value)}
              rows={6}
              className="text-sm"
              placeholder="Enter system prompt..."
            />
            <Button size="sm" onClick={() => { onSelectPrompt(editingPrompt); toast.success('Prompt applied'); }}>
              <Check className="h-3.5 w-3.5 mr-1.5" /> Apply
            </Button>
          </div>

          <div className="border-t border-border pt-4 space-y-2">
            <label className="text-sm font-medium text-foreground">Save as Template</label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Template name..." className="text-sm" />
            <Button size="sm" variant="outline" onClick={handleSave} disabled={loading}>
              <Save className="h-3.5 w-3.5 mr-1.5" /> Save Template
            </Button>
          </div>

          <div className="border-t border-border pt-4 space-y-2">
            <label className="text-sm font-medium text-foreground">Templates</label>
            {prompts.map((p) => (
              <div key={p.id} className={cn(
                "p-3 rounded-lg border border-border hover:border-primary/30 cursor-pointer transition-all",
                editingPrompt === p.prompt && "border-primary bg-primary/5"
              )}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{p.name}</span>
                  <div className="flex items-center gap-1">
                    {p.is_default && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">Default</span>}
                    {p.is_global && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">Global</span>}
                    {!p.is_global && (
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{p.prompt}</p>
                <Button variant="ghost" size="sm" className="mt-1 h-6 text-xs" onClick={() => { setEditingPrompt(p.prompt); onSelectPrompt(p.prompt); toast.success(`"${p.name}" applied`); }}>
                  Use This
                </Button>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
