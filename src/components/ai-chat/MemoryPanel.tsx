import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Brain,
  Plus,
  Edit2,
  Trash2,
  Search,
  Shield,
  Clock,
  Folder,
  RefreshCw,
  X,
  Save,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Memory {
  id: string;
  memory_type: "permanent" | "project" | "session";
  category: string;
  title: string;
  content: string;
  tags: string[];
  priority: "HIGH" | "NORMAL" | "TEMP";
  project_context?: string;
  source: string;
  is_active: boolean;
  access_count: number;
  last_accessed_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

interface AuditEntry {
  id: string;
  memory_id: string;
  action: string;
  recall_reason?: string;
  session_id?: string;
  created_at: string;
}

interface MemoryPanelProps {
  onClose: () => void;
}

const PRIORITY_COLORS = {
  HIGH: "bg-red-500/20 text-red-400 border-red-500/30",
  NORMAL: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  TEMP: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const TYPE_COLORS = {
  permanent: "bg-purple-500/20 text-purple-400",
  project: "bg-green-500/20 text-green-400",
  session: "bg-orange-500/20 text-orange-400",
};

const CATEGORIES = [
  "business_goal", "architecture", "permission", "api_meta",
  "product_structure", "repo_note", "bug", "decision",
  "deploy_config", "current_task", "action_log", "runtime_log", "general", "github"
];

export function MemoryPanel({ onClose }: MemoryPanelProps) {
  const { toast } = useToast();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"memories" | "audit">("memories");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [editMemory, setEditMemory] = useState<Memory | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMemory, setNewMemory] = useState({
    memory_type: "permanent" as const,
    category: "general",
    title: "",
    content: "",
    priority: "NORMAL" as const,
    tags: "",
    project_context: "",
    expires_at: "",
  });

  const fetchMemories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_memories")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .order("access_count", { ascending: false });

    if (!error && data) setMemories(data as Memory[]);
    setLoading(false);
  };

  const fetchAudit = async () => {
    const { data } = await supabase
      .from("ai_memory_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setAuditLogs(data as AuditEntry[]);
  };

  useEffect(() => {
    fetchMemories();
    fetchAudit();
  }, []);

  const filtered = memories.filter((m) => {
    const matchSearch =
      !search ||
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.content.toLowerCase().includes(search.toLowerCase()) ||
      m.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    const matchType = filterType === "all" || m.memory_type === filterType;
    const matchPriority = filterPriority === "all" || m.priority === filterPriority;
    return matchSearch && matchType && matchPriority;
  });

  const handleSaveNew = async () => {
    if (!newMemory.title || !newMemory.content) {
      toast({ title: "Title aur Content required hain", variant: "destructive" });
      return;
    }

    const row: any = {
      memory_type: newMemory.memory_type,
      category: newMemory.category,
      title: newMemory.title,
      content: newMemory.content,
      priority: newMemory.priority,
      tags: newMemory.tags ? newMemory.tags.split(",").map(t => t.trim()) : [],
      project_context: newMemory.project_context || null,
      source: "user",
    };

    const priorityValue = newMemory.priority as string;
    if (priorityValue === "TEMP" && newMemory.expires_at) {
      row.expires_at = new Date(newMemory.expires_at).toISOString();
    } else if (priorityValue !== "TEMP") {
      row.expires_at = null;
    }

    const { data, error } = await supabase.from("ai_memories").insert(row).select("id").single();

    if (error) {
      toast({ title: "Error saving memory", description: error.message, variant: "destructive" });
      return;
    }

    if (data) {
      await supabase.from("ai_memory_audit").insert({
        memory_id: data.id,
        action: "created",
        new_content: row.content,
        recall_reason: "Manually added by user",
      });
    }

    toast({ title: "✅ Memory saved!", description: `"${newMemory.title}" permanently stored` });
    setShowAddForm(false);
    setNewMemory({ memory_type: "permanent", category: "general", title: "", content: "", priority: "NORMAL", tags: "", project_context: "", expires_at: "" });
    fetchMemories();
    fetchAudit();
  };

  const handleUpdate = async () => {
    if (!editMemory) return;

    const { error } = await supabase
      .from("ai_memories")
      .update({
        title: editMemory.title,
        content: editMemory.content,
        priority: editMemory.priority,
        category: editMemory.category,
        memory_type: editMemory.memory_type,
        tags: editMemory.tags,
        project_context: editMemory.project_context,
        expires_at: editMemory.priority === "TEMP" ? editMemory.expires_at : null,
      })
      .eq("id", editMemory.id);

    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }

    await supabase.from("ai_memory_audit").insert({
      memory_id: editMemory.id,
      action: "updated",
      new_content: editMemory.content,
      recall_reason: "Manually updated by user",
    });

    toast({ title: "✅ Memory updated!" });
    setEditMemory(null);
    fetchMemories();
    fetchAudit();
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`"${title}" delete karna chahte ho? (Soft delete)`)) return;

    await supabase.from("ai_memories").update({ is_active: false }).eq("id", id);
    await supabase.from("ai_memory_audit").insert({
      memory_id: id,
      action: "deleted",
      recall_reason: "Manually deleted by user",
    });

    toast({ title: "🗑️ Memory removed" });
    fetchMemories();
    fetchAudit();
  };

  const stats = {
    total: memories.length,
    high: memories.filter(m => m.priority === "HIGH").length,
    normal: memories.filter(m => m.priority === "NORMAL").length,
    temp: memories.filter(m => m.priority === "TEMP").length,
    permanent: memories.filter(m => m.memory_type === "permanent").length,
    project: memories.filter(m => m.memory_type === "project").length,
    session: memories.filter(m => m.memory_type === "session").length,
  };

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          <span className="font-bold text-sm">VALA AI — Persistent Memory System</span>
          <Badge variant="outline" className="text-xs text-green-400 border-green-500/30">
            {stats.total} Active
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => { fetchMemories(); fetchAudit(); }}>
            <RefreshCw className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-6 gap-2 px-4 py-2 bg-[hsl(var(--card))/50] border-b border-[hsl(var(--border))]">
        {[
          { label: "HIGH", val: stats.high, cls: "text-red-400" },
          { label: "NORMAL", val: stats.normal, cls: "text-blue-400" },
          { label: "TEMP", val: stats.temp, cls: "text-yellow-400" },
          { label: "Permanent", val: stats.permanent, cls: "text-purple-400" },
          { label: "Project", val: stats.project, cls: "text-green-400" },
          { label: "Session", val: stats.session, cls: "text-orange-400" },
        ].map(s => (
          <div key={s.label} className="text-center">
            <div className={`text-lg font-bold ${s.cls}`}>{s.val}</div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[hsl(var(--border))]">
        {(["memories", "audit"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              activeTab === tab
                ? "bg-purple-500/10 text-purple-400 border-b-2 border-purple-500"
                : "text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            }`}
          >
            {tab === "memories" ? (
              <><Brain className="w-3 h-3 inline mr-1" />Memory Store</>
            ) : (
              <><Activity className="w-3 h-3 inline mr-1" />Audit Trail</>
            )}
          </button>
        ))}
      </div>

      {activeTab === "memories" && (
        <>
          {/* Filters + Add */}
          <div className="flex gap-2 px-3 py-2 border-b border-[hsl(var(--border))]">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[hsl(var(--muted-foreground))]" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search memories..."
                className="pl-7 h-7 text-xs"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="permanent">Permanent</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="session">Session</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="HIGH">HIGH</SelectItem>
                <SelectItem value="NORMAL">NORMAL</SelectItem>
                <SelectItem value="TEMP">TEMP</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="h-7 text-xs bg-purple-600 hover:bg-purple-700" onClick={() => setShowAddForm(true)}>
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
          </div>

          {/* Memory List */}
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-[hsl(var(--muted-foreground))]">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading memories...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[hsl(var(--muted-foreground))]">
                <Brain className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">No memories found</p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {filtered.map(mem => (
                  <div key={mem.id} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 hover:border-purple-500/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1 mb-1">
                          <Badge className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[mem.priority]}`}>
                            {mem.priority === "HIGH" && <Shield className="w-2 h-2 mr-0.5" />}
                            {mem.priority === "TEMP" && <Clock className="w-2 h-2 mr-0.5" />}
                            {mem.priority}
                          </Badge>
                          <Badge className={`text-[10px] px-1.5 py-0 ${TYPE_COLORS[mem.memory_type]}`}>
                            {mem.memory_type}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            <Folder className="w-2 h-2 mr-0.5" />{mem.category}
                          </Badge>
                          {mem.access_count > 0 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-400">
                              recalled {mem.access_count}×
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs font-semibold truncate">{mem.title}</p>
                        <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-2">{mem.content}</p>
                        {mem.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {mem.tags.map(tag => (
                              <span key={tag} className="text-[10px] bg-[hsl(var(--muted))] px-1.5 py-0 rounded">#{tag}</span>
                            ))}
                          </div>
                        )}
                        {mem.priority === "TEMP" && mem.expires_at && (
                          <p className="text-[10px] text-yellow-400 mt-1">
                            <Clock className="w-2 h-2 inline mr-0.5" />
                            Expires: {format(new Date(mem.expires_at), "dd MMM yyyy")}
                          </p>
                        )}
                        <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1">
                          Saved: {format(new Date(mem.created_at), "dd MMM yyyy HH:mm")}
                          {mem.last_accessed_at && ` · Last used: ${format(new Date(mem.last_accessed_at), "dd MMM HH:mm")}`}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditMemory(mem)}>
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:text-red-300" onClick={() => handleDelete(mem.id, mem.title)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </>
      )}

      {activeTab === "audit" && (
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-1">
            {auditLogs.length === 0 ? (
              <div className="text-center py-8 text-[hsl(var(--muted-foreground))] text-sm">No audit logs yet</div>
            ) : (
              auditLogs.map(log => (
                <div key={log.id} className="flex items-start gap-2 py-1.5 border-b border-[hsl(var(--border))]/50 text-xs">
                  <Badge className={`text-[10px] shrink-0 ${
                    log.action === "recalled" ? "bg-blue-500/20 text-blue-400" :
                    log.action === "created" ? "bg-green-500/20 text-green-400" :
                    log.action === "deleted" ? "bg-red-500/20 text-red-400" :
                    log.action === "expired" ? "bg-yellow-500/20 text-yellow-400" :
                    "bg-gray-500/20 text-gray-400"
                  }`}>
                    {log.action}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] truncate text-[hsl(var(--muted-foreground))]">
                      {log.recall_reason || log.session_id || "—"}
                    </p>
                  </div>
                  <span className="text-[10px] text-[hsl(var(--muted-foreground))] shrink-0">
                    {format(new Date(log.created_at), "dd MMM HH:mm")}
                  </span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      )}

      {/* Add Memory Dialog */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-400" /> Add New Memory
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-medium mb-1 block">Type</label>
                <Select value={newMemory.memory_type} onValueChange={v => setNewMemory(p => ({ ...p, memory_type: v as any }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="permanent">Permanent</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                    <SelectItem value="session">Session</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Priority</label>
                <Select value={newMemory.priority} onValueChange={v => setNewMemory(p => ({ ...p, priority: v as any }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HIGH">🔴 HIGH</SelectItem>
                    <SelectItem value="NORMAL">🔵 NORMAL</SelectItem>
                    <SelectItem value="TEMP">🟡 TEMP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Category</label>
                <Select value={newMemory.category} onValueChange={v => setNewMemory(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Title *</label>
              <Input value={newMemory.title} onChange={e => setNewMemory(p => ({ ...p, title: e.target.value }))} placeholder="Short descriptive title" className="h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Content *</label>
              <Textarea value={newMemory.content} onChange={e => setNewMemory(p => ({ ...p, content: e.target.value }))} placeholder="Detailed memory content that VALA AI should remember..." rows={5} className="text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium mb-1 block">Tags (comma separated)</label>
                <Input value={newMemory.tags} onChange={e => setNewMemory(p => ({ ...p, tags: e.target.value }))} placeholder="github, deployment, bug" className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Project Context</label>
                <Input value={newMemory.project_context} onChange={e => setNewMemory(p => ({ ...p, project_context: e.target.value }))} placeholder="repo-name or slug" className="h-8 text-sm" />
              </div>
            </div>
            {(newMemory.priority as string) === "TEMP" && (
              <div>
                <label className="text-xs font-medium mb-1 block flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-yellow-400" /> Expiry Date (TEMP only)
                </label>
                <Input type="date" value={newMemory.expires_at} onChange={e => setNewMemory(p => ({ ...p, expires_at: e.target.value }))} className="h-8 text-sm" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveNew} className="bg-purple-600 hover:bg-purple-700">
              <Save className="w-3 h-3 mr-1" /> Save Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Memory Dialog */}
      {editMemory && (
        <Dialog open={!!editMemory} onOpenChange={() => setEditMemory(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-400" /> Edit Memory
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-medium mb-1 block">Type</label>
                  <Select value={editMemory.memory_type} onValueChange={v => setEditMemory(p => p ? { ...p, memory_type: v as any } : null)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">Permanent</SelectItem>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="session">Session</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Priority</label>
                  <Select value={editMemory.priority} onValueChange={v => setEditMemory(p => p ? { ...p, priority: v as any } : null)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HIGH">🔴 HIGH</SelectItem>
                      <SelectItem value="NORMAL">🔵 NORMAL</SelectItem>
                      <SelectItem value="TEMP">🟡 TEMP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Category</label>
                  <Select value={editMemory.category} onValueChange={v => setEditMemory(p => p ? { ...p, category: v } : null)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Title</label>
                <Input value={editMemory.title} onChange={e => setEditMemory(p => p ? { ...p, title: e.target.value } : null)} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Content</label>
                <Textarea value={editMemory.content} onChange={e => setEditMemory(p => p ? { ...p, content: e.target.value } : null)} rows={6} className="text-sm" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setEditMemory(null)}>Cancel</Button>
              <Button size="sm" onClick={handleUpdate} className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-3 h-3 mr-1" /> Update Memory
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
