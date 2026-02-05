 import { useState } from 'react';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import {
   Table,
   TableBody,
   TableCell,
   TableHead,
   TableHeader,
   TableRow,
 } from '@/components/ui/table';
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuTrigger,
 } from '@/components/ui/dropdown-menu';
 import {
   Key,
   Copy,
   MoreVertical,
   Pause,
   Play,
   Ban,
   Trash2,
   Eye,
   Loader2,
 } from 'lucide-react';
 import { toast } from 'sonner';
 import type { LicenseKey } from '@/hooks/useLicenseKeys';
 
 interface KeyListTableProps {
   keys: LicenseKey[];
   loading: boolean;
   onRowClick: (key: LicenseKey) => void;
   onSuspend: (id: string) => Promise<void>;
   onActivate: (id: string) => Promise<void>;
   onRevoke: (id: string) => Promise<void>;
   onDelete: (id: string) => void;
   getProductName: (productId: string) => string;
 }
 
 const statusConfig = {
   active: { label: 'Active', style: 'bg-success/20 text-success border-success/30' },
   suspended: { label: 'Suspended', style: 'bg-warning/20 text-warning border-warning/30' },
   revoked: { label: 'Revoked', style: 'bg-destructive/20 text-destructive border-destructive/30' },
   expired: { label: 'Expired', style: 'bg-muted text-muted-foreground border-muted-foreground/30' },
 };
 
 const keyTypeConfig = {
   lifetime: { label: 'Lifetime', style: 'bg-primary/20 text-primary border-primary/30' },
   yearly: { label: 'Yearly', style: 'bg-cyan/20 text-cyan border-cyan/30' },
   monthly: { label: 'Monthly', style: 'bg-purple/20 text-purple border-purple/30' },
   trial: { label: 'Trial', style: 'bg-warning/20 text-warning border-warning/30' },
 };
 
 export function KeyListTable({
   keys,
   loading,
   onRowClick,
   onSuspend,
   onActivate,
   onRevoke,
   onDelete,
   getProductName,
 }: KeyListTableProps) {
   const copyToClipboard = (key: string, e: React.MouseEvent) => {
     e.stopPropagation();
     navigator.clipboard.writeText(key);
     toast.success('Key copied to clipboard');
   };
 
   if (loading) {
     return (
       <div className="flex items-center justify-center p-12">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
       </div>
     );
   }
 
   if (keys.length === 0) {
     return (
       <div className="flex flex-col items-center justify-center p-12 text-center">
         <Key className="h-12 w-12 text-muted-foreground mb-4" />
         <h3 className="font-semibold text-foreground mb-2">No license keys found</h3>
         <p className="text-muted-foreground">Generate your first license key above</p>
       </div>
     );
   }
 
   return (
     <>
       {/* Desktop Table */}
       <div className="hidden md:block overflow-auto max-h-[600px]">
         <Table>
           <TableHeader className="sticky top-0 bg-background z-10">
             <TableRow className="border-border hover:bg-muted/50">
               <TableHead className="text-muted-foreground">Key Name</TableHead>
               <TableHead className="text-muted-foreground">Type</TableHead>
               <TableHead className="text-muted-foreground">Assigned To</TableHead>
               <TableHead className="text-muted-foreground">Status</TableHead>
               <TableHead className="text-muted-foreground">Usage</TableHead>
               <TableHead className="text-muted-foreground">Expiry</TableHead>
               <TableHead className="text-muted-foreground text-right">Actions</TableHead>
             </TableRow>
           </TableHeader>
           <TableBody>
             {keys.map((keyItem) => {
               const status = statusConfig[keyItem.status];
               const keyType = keyTypeConfig[keyItem.key_type];
               return (
                 <TableRow
                   key={keyItem.id}
                   className="border-border hover:bg-muted/30 cursor-pointer"
                   onClick={() => onRowClick(keyItem)}
                 >
                   <TableCell>
                     <div className="flex items-center gap-2">
                       <Key className="h-4 w-4 text-primary shrink-0" />
                       <code className="text-sm font-mono text-foreground truncate max-w-[150px]">
                         {keyItem.license_key}
                       </code>
                       <Button
                         variant="ghost"
                         size="icon"
                         className="h-6 w-6 shrink-0"
                         onClick={(e) => copyToClipboard(keyItem.license_key, e)}
                       >
                         <Copy className="h-3 w-3 text-muted-foreground" />
                       </Button>
                     </div>
                   </TableCell>
                   <TableCell>
                     <Badge variant="outline" className={keyType.style}>
                       {keyType.label}
                     </Badge>
                   </TableCell>
                   <TableCell>
                     <div>
                       <p className="text-foreground text-sm">{keyItem.owner_name || '-'}</p>
                       <p className="text-xs text-muted-foreground">{keyItem.owner_email || ''}</p>
                     </div>
                   </TableCell>
                   <TableCell>
                     <Badge variant="outline" className={status.style}>
                       {status.label}
                     </Badge>
                   </TableCell>
                   <TableCell>
                     <span className="text-sm text-foreground">
                       {keyItem.activated_devices}/{keyItem.max_devices}
                     </span>
                   </TableCell>
                   <TableCell className="text-muted-foreground text-sm">
                     {keyItem.expires_at
                       ? new Date(keyItem.expires_at).toLocaleDateString()
                       : 'Never'}
                   </TableCell>
                   <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                     <DropdownMenu>
                       <DropdownMenuTrigger asChild>
                         <Button variant="ghost" size="icon" className="h-8 w-8">
                           <MoreVertical className="h-4 w-4 text-muted-foreground" />
                         </Button>
                       </DropdownMenuTrigger>
                       <DropdownMenuContent align="end" className="bg-popover border-border">
                         <DropdownMenuItem
                           className="gap-2 cursor-pointer"
                           onClick={() => onRowClick(keyItem)}
                         >
                           <Eye className="h-4 w-4" /> View Details
                         </DropdownMenuItem>
                         {keyItem.status === 'suspended' ? (
                           <DropdownMenuItem
                             className="gap-2 cursor-pointer text-success"
                             onClick={() => onActivate(keyItem.id)}
                           >
                             <Play className="h-4 w-4" /> Activate
                           </DropdownMenuItem>
                         ) : keyItem.status === 'active' && (
                           <DropdownMenuItem
                             className="gap-2 cursor-pointer text-warning"
                             onClick={() => onSuspend(keyItem.id)}
                           >
                             <Pause className="h-4 w-4" /> Suspend
                           </DropdownMenuItem>
                         )}
                         {keyItem.status !== 'revoked' && (
                           <DropdownMenuItem
                             className="gap-2 cursor-pointer text-destructive"
                             onClick={() => onRevoke(keyItem.id)}
                           >
                             <Ban className="h-4 w-4" /> Revoke
                           </DropdownMenuItem>
                         )}
                         <DropdownMenuItem
                           className="gap-2 cursor-pointer text-destructive"
                           onClick={() => onDelete(keyItem.id)}
                         >
                           <Trash2 className="h-4 w-4" /> Delete
                         </DropdownMenuItem>
                       </DropdownMenuContent>
                     </DropdownMenu>
                   </TableCell>
                 </TableRow>
               );
             })}
           </TableBody>
         </Table>
       </div>
 
       {/* Mobile Cards */}
       <div className="md:hidden space-y-3 p-4">
         {keys.map((keyItem) => {
           const status = statusConfig[keyItem.status];
           const keyType = keyTypeConfig[keyItem.key_type];
           return (
             <div
               key={keyItem.id}
               className="glass-card rounded-xl p-4 space-y-3 cursor-pointer active:scale-[0.98] transition-transform"
               onClick={() => onRowClick(keyItem)}
             >
               {/* Header */}
               <div className="flex items-start justify-between">
                 <div className="flex items-center gap-2 flex-1 min-w-0">
                   <Key className="h-4 w-4 text-primary shrink-0" />
                   <code className="text-sm font-mono text-foreground truncate">
                     {keyItem.license_key}
                   </code>
                 </div>
                 <div className="flex items-center gap-2 shrink-0">
                   <Badge variant="outline" className={status.style}>
                     {status.label}
                   </Badge>
                 </div>
               </div>
 
               {/* Info Grid */}
               <div className="grid grid-cols-2 gap-3 text-sm">
                 <div>
                   <span className="text-muted-foreground">Type:</span>{' '}
                   <Badge variant="outline" className={`${keyType.style} ml-1`}>
                     {keyType.label}
                   </Badge>
                 </div>
                 <div>
                   <span className="text-muted-foreground">Usage:</span>{' '}
                   <span className="text-foreground">
                     {keyItem.activated_devices}/{keyItem.max_devices}
                   </span>
                 </div>
                 <div>
                   <span className="text-muted-foreground">Owner:</span>{' '}
                   <span className="text-foreground">{keyItem.owner_name || '-'}</span>
                 </div>
                 <div>
                   <span className="text-muted-foreground">Expiry:</span>{' '}
                   <span className="text-foreground">
                     {keyItem.expires_at
                       ? new Date(keyItem.expires_at).toLocaleDateString()
                       : 'Never'}
                   </span>
                 </div>
               </div>
 
               {/* Actions */}
               <div className="flex items-center gap-2 pt-2 border-t border-border" onClick={(e) => e.stopPropagation()}>
                 <Button
                   variant="ghost"
                   size="sm"
                   className="flex-1 min-h-[36px]"
                   onClick={() => copyToClipboard(keyItem.license_key, {} as React.MouseEvent)}
                 >
                   <Copy className="h-4 w-4 mr-1" /> Copy
                 </Button>
                 {keyItem.status === 'active' && (
                   <Button
                     variant="ghost"
                     size="sm"
                     className="flex-1 min-h-[36px] text-warning"
                     onClick={() => onSuspend(keyItem.id)}
                   >
                     <Pause className="h-4 w-4 mr-1" /> Suspend
                   </Button>
                 )}
                 {keyItem.status === 'suspended' && (
                   <Button
                     variant="ghost"
                     size="sm"
                     className="flex-1 min-h-[36px] text-success"
                     onClick={() => onActivate(keyItem.id)}
                   >
                     <Play className="h-4 w-4 mr-1" /> Activate
                   </Button>
                 )}
                 <Button
                   variant="ghost"
                   size="sm"
                   className="flex-1 min-h-[36px] text-destructive"
                   onClick={() => onDelete(keyItem.id)}
                 >
                   <Trash2 className="h-4 w-4 mr-1" /> Delete
                 </Button>
               </div>
             </div>
           );
         })}
       </div>
     </>
   );
 }