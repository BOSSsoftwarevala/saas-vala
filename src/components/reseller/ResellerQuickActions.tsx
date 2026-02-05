 import { useState } from 'react';
 import { Button } from '@/components/ui/button';
 import {
   AlertDialog,
   AlertDialogAction,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
 } from '@/components/ui/alert-dialog';
 import { Shield, Ban, Play, CheckCircle, XCircle, Loader2 } from 'lucide-react';
 import type { Reseller } from '@/hooks/useResellers';
 import type { Json } from '@/integrations/supabase/types';
 import { supabase } from '@/integrations/supabase/client';
 import { toast } from 'sonner';
 
 interface ResellerQuickActionsProps {
   reseller: Reseller;
   onAction: () => void;
 }
 
 export function ResellerQuickActions({ reseller, onAction }: ResellerQuickActionsProps) {
   const [confirmAction, setConfirmAction] = useState<'approve' | 'suspend' | 'activate' | null>(null);
   const [loading, setLoading] = useState(false);
 
   const logActivity = async (action: string, details: Json) => {
     try {
       await supabase.from('activity_logs').insert([{
         action,
         entity_type: 'reseller',
         entity_id: reseller.id,
         details,
       }]);
     } catch (error) {
       console.error('Failed to log activity:', error);
     }
   };
 
   const handleApprove = async () => {
     setLoading(true);
     try {
       const { error } = await supabase
         .from('resellers')
         .update({ is_verified: true, is_active: true })
         .eq('id', reseller.id);
 
       if (error) throw error;
       
       await logActivity('approve', {
         company_name: reseller.company_name,
         notes: 'Reseller approved and verified',
       });
       
       toast.success('Reseller approved successfully');
       onAction();
     } catch {
       toast.error('Failed to approve reseller');
     } finally {
       setLoading(false);
       setConfirmAction(null);
     }
   };
 
   const handleSuspend = async () => {
     setLoading(true);
     try {
       const { error } = await supabase
         .from('resellers')
         .update({ is_active: false })
         .eq('id', reseller.id);
 
       if (error) throw error;
       
       await logActivity('suspend', {
         company_name: reseller.company_name,
         notes: 'Reseller account suspended',
       });
       
       toast.success('Reseller suspended');
       onAction();
     } catch {
       toast.error('Failed to suspend reseller');
     } finally {
       setLoading(false);
       setConfirmAction(null);
     }
   };
 
   const handleActivate = async () => {
     setLoading(true);
     try {
       const { error } = await supabase
         .from('resellers')
         .update({ is_active: true })
         .eq('id', reseller.id);
 
       if (error) throw error;
       
       await logActivity('activate', {
         company_name: reseller.company_name,
         notes: 'Reseller account reactivated',
       });
       
       toast.success('Reseller activated');
       onAction();
     } catch {
       toast.error('Failed to activate reseller');
     } finally {
       setLoading(false);
       setConfirmAction(null);
     }
   };
 
   return (
     <>
       <div className="flex items-center gap-2">
         {!reseller.is_verified && (
           <Button
             size="sm"
             variant="outline"
             className="gap-1.5 border-cyan/30 text-cyan hover:bg-cyan/10"
             onClick={() => setConfirmAction('approve')}
           >
             <Shield className="h-3.5 w-3.5" />
             Approve
           </Button>
         )}
         
         {reseller.is_active ? (
           <Button
             size="sm"
             variant="outline"
             className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
             onClick={() => setConfirmAction('suspend')}
           >
             <Ban className="h-3.5 w-3.5" />
             Suspend
           </Button>
         ) : (
           <Button
             size="sm"
             variant="outline"
             className="gap-1.5 border-success/30 text-success hover:bg-success/10"
             onClick={() => setConfirmAction('activate')}
           >
             <Play className="h-3.5 w-3.5" />
             Activate
           </Button>
         )}
       </div>
 
       <AlertDialog open={confirmAction === 'approve'} onOpenChange={() => setConfirmAction(null)}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle className="flex items-center gap-2">
               <CheckCircle className="h-5 w-5 text-cyan" />
               Approve Reseller?
             </AlertDialogTitle>
             <AlertDialogDescription>
               This will verify and activate <strong>{reseller.company_name || 'this reseller'}</strong>. 
               They will be able to generate license keys and access the reseller portal.
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
             <AlertDialogAction
               onClick={handleApprove}
               disabled={loading}
               className="bg-cyan text-cyan-foreground hover:bg-cyan/90"
             >
               {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
               Approve
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
 
       <AlertDialog open={confirmAction === 'suspend'} onOpenChange={() => setConfirmAction(null)}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle className="flex items-center gap-2">
               <XCircle className="h-5 w-5 text-destructive" />
               Suspend Reseller?
             </AlertDialogTitle>
             <AlertDialogDescription>
               This will suspend <strong>{reseller.company_name || 'this reseller'}</strong>. 
               They will lose access to the reseller portal and cannot generate new keys.
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
             <AlertDialogAction
               onClick={handleSuspend}
               disabled={loading}
               className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
             >
               {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
               Suspend
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
 
       <AlertDialog open={confirmAction === 'activate'} onOpenChange={() => setConfirmAction(null)}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle className="flex items-center gap-2">
               <Play className="h-5 w-5 text-success" />
               Activate Reseller?
             </AlertDialogTitle>
             <AlertDialogDescription>
               This will reactivate <strong>{reseller.company_name || 'this reseller'}</strong>. 
               They will regain access to the reseller portal.
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
             <AlertDialogAction
               onClick={handleActivate}
               disabled={loading}
               className="bg-success text-success-foreground hover:bg-success/90"
             >
               {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
               Activate
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
     </>
   );
 }