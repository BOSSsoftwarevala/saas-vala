 import { useState, useEffect } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { Badge } from '@/components/ui/badge';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { Button } from '@/components/ui/button';
 import {
   Activity,
   Shield,
   Ban,
   Play,
   Edit,
   Trash2,
   Plus,
   DollarSign,
   Key,
   RefreshCw,
   Loader2,
 } from 'lucide-react';
 import { formatDistanceToNow } from 'date-fns';
 
 interface ActivityLog {
   id: string;
   action: string;
   entity_type: string;
   entity_id: string;
   details: Record<string, unknown> | null;
   created_at: string;
   performed_by: string | null;
 }
 
 const getActionIcon = (action: string) => {
   switch (action.toLowerCase()) {
     case 'verify':
     case 'approve':
       return <Shield className="h-4 w-4 text-cyan" />;
     case 'suspend':
     case 'deactivate':
       return <Ban className="h-4 w-4 text-destructive" />;
     case 'activate':
       return <Play className="h-4 w-4 text-success" />;
     case 'update':
     case 'edit':
       return <Edit className="h-4 w-4 text-warning" />;
     case 'delete':
       return <Trash2 className="h-4 w-4 text-destructive" />;
     case 'create':
       return <Plus className="h-4 w-4 text-primary" />;
     case 'credit_added':
     case 'balance':
       return <DollarSign className="h-4 w-4 text-success" />;
     case 'key_generated':
       return <Key className="h-4 w-4 text-primary" />;
     default:
       return <Activity className="h-4 w-4 text-muted-foreground" />;
   }
 };
 
 const getActionBadge = (action: string) => {
   const variants: Record<string, { class: string; label: string }> = {
     verify: { class: 'bg-cyan/20 text-cyan border-cyan/30', label: 'Verified' },
     approve: { class: 'bg-cyan/20 text-cyan border-cyan/30', label: 'Approved' },
     suspend: { class: 'bg-destructive/20 text-destructive border-destructive/30', label: 'Suspended' },
     deactivate: { class: 'bg-destructive/20 text-destructive border-destructive/30', label: 'Deactivated' },
     activate: { class: 'bg-success/20 text-success border-success/30', label: 'Activated' },
     update: { class: 'bg-warning/20 text-warning border-warning/30', label: 'Updated' },
     edit: { class: 'bg-warning/20 text-warning border-warning/30', label: 'Edited' },
     delete: { class: 'bg-destructive/20 text-destructive border-destructive/30', label: 'Deleted' },
     create: { class: 'bg-primary/20 text-primary border-primary/30', label: 'Created' },
     credit_added: { class: 'bg-success/20 text-success border-success/30', label: 'Credit Added' },
     key_generated: { class: 'bg-primary/20 text-primary border-primary/30', label: 'Key Generated' },
   };
   const variant = variants[action.toLowerCase()] || { class: 'bg-muted text-muted-foreground', label: action };
   return <Badge variant="outline" className={variant.class}>{variant.label}</Badge>;
 };
 
 export function ResellerActivityPanel() {
   const [activities, setActivities] = useState<ActivityLog[]>([]);
   const [loading, setLoading] = useState(true);
 
   const fetchActivities = async () => {
     setLoading(true);
     try {
       const { data, error } = await supabase
         .from('activity_logs')
         .select('*')
         .eq('entity_type', 'reseller')
         .order('created_at', { ascending: false })
         .limit(50);
 
       if (error) throw error;
       setActivities((data || []) as ActivityLog[]);
     } catch (error) {
       console.error('Failed to fetch activities:', error);
     } finally {
       setLoading(false);
     }
   };
 
   useEffect(() => {
     fetchActivities();
   }, []);
 
   return (
     <div className="glass-card rounded-xl p-4">
       <div className="flex items-center justify-between mb-4">
         <div className="flex items-center gap-2">
           <Activity className="h-5 w-5 text-primary" />
           <h3 className="font-semibold text-foreground">Recent Activity</h3>
         </div>
         <Button variant="ghost" size="icon" onClick={fetchActivities} disabled={loading}>
           <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
         </Button>
       </div>
 
       <ScrollArea className="h-[400px] pr-4">
         {loading ? (
           <div className="flex items-center justify-center h-32">
             <Loader2 className="h-6 w-6 animate-spin text-primary" />
           </div>
         ) : activities.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-32 text-center">
             <Activity className="h-8 w-8 text-muted-foreground mb-2" />
             <p className="text-sm text-muted-foreground">No activity recorded yet</p>
           </div>
         ) : (
           <div className="space-y-3">
             {activities.map((activity) => (
               <div
                 key={activity.id}
                 className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
               >
                 <div className="h-8 w-8 rounded-lg bg-background flex items-center justify-center shrink-0">
                   {getActionIcon(activity.action)}
                 </div>
                 <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-2 flex-wrap">
                     {getActionBadge(activity.action)}
                     <span className="text-xs text-muted-foreground">
                       {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                     </span>
                   </div>
                   <p className="text-sm text-foreground mt-1 truncate">
                     {activity.details && typeof activity.details === 'object' && 'company_name' in activity.details
                       ? String(activity.details.company_name)
                       : `Reseller ${activity.entity_id.slice(0, 8)}...`}
                   </p>
                   {activity.details && typeof activity.details === 'object' && 'notes' in activity.details && (
                     <p className="text-xs text-muted-foreground mt-0.5">{String(activity.details.notes)}</p>
                   )}
                 </div>
               </div>
             ))}
           </div>
         )}
       </ScrollArea>
     </div>
   );
 }