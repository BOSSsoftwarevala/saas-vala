 import { useState } from 'react';
 import { Button } from '@/components/ui/button';
 import { Badge } from '@/components/ui/badge';
 import { Switch } from '@/components/ui/switch';
 import { Label } from '@/components/ui/label';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import {
   Sheet,
   SheetContent,
   SheetHeader,
   SheetTitle,
 } from '@/components/ui/sheet';
 import {
   X,
   Key,
   Copy,
   Eye,
   EyeOff,
   Calendar,
   Clock,
   User,
   Shield,
   Activity,
 } from 'lucide-react';
 import { formatDistanceToNow, format } from 'date-fns';
 import { toast } from 'sonner';
 import type { LicenseKey } from '@/hooks/useLicenseKeys';
 
 interface KeyDetailPanelProps {
   keyData: LicenseKey | null;
   open: boolean;
   onClose: () => void;
   onStatusChange: (id: string, status: 'active' | 'suspended') => Promise<void>;
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
 
 export function KeyDetailPanel({
   keyData,
   open,
   onClose,
   onStatusChange,
   getProductName,
 }: KeyDetailPanelProps) {
   const [showKey, setShowKey] = useState(false);
   const [updating, setUpdating] = useState(false);
 
   if (!keyData) return null;
 
   const status = statusConfig[keyData.status];
   const keyType = keyTypeConfig[keyData.key_type];
 
   const maskedKey = showKey
     ? keyData.license_key
     : keyData.license_key.replace(/[A-Z0-9]/g, '•');
 
   const handleCopy = () => {
     navigator.clipboard.writeText(keyData.license_key);
     toast.success('Key copied to clipboard');
   };
 
   const handleToggleStatus = async (enabled: boolean) => {
     setUpdating(true);
     try {
       await onStatusChange(keyData.id, enabled ? 'active' : 'suspended');
     } finally {
       setUpdating(false);
     }
   };
 
   return (
     <Sheet open={open} onOpenChange={onClose}>
       <SheetContent className="w-full sm:max-w-lg p-0 bg-background border-border">
         <SheetHeader className="p-6 border-b border-border">
           <div className="flex items-center justify-between">
             <SheetTitle className="flex items-center gap-2 text-foreground">
               <Key className="h-5 w-5 text-primary" />
               Key Details
             </SheetTitle>
           </div>
         </SheetHeader>
 
         <ScrollArea className="h-[calc(100vh-80px)]">
           <div className="p-6 space-y-6">
             {/* Key Display */}
             <div className="glass-card rounded-xl p-4 space-y-3">
               <div className="flex items-center justify-between">
                 <Label className="text-muted-foreground">License Key</Label>
                 <div className="flex items-center gap-1">
                   <Button
                     variant="ghost"
                     size="icon"
                     className="h-8 w-8"
                     onClick={() => setShowKey(!showKey)}
                   >
                     {showKey ? (
                       <EyeOff className="h-4 w-4 text-muted-foreground" />
                     ) : (
                       <Eye className="h-4 w-4 text-muted-foreground" />
                     )}
                   </Button>
                   <Button
                     variant="ghost"
                     size="icon"
                     className="h-8 w-8"
                     onClick={handleCopy}
                   >
                     <Copy className="h-4 w-4 text-muted-foreground" />
                   </Button>
                 </div>
               </div>
               <code className="block text-sm font-mono text-foreground bg-muted/50 p-3 rounded-lg break-all">
                 {maskedKey}
               </code>
             </div>
 
             {/* Status & Type */}
             <div className="grid grid-cols-2 gap-4">
               <div className="glass-card rounded-xl p-4">
                 <Label className="text-muted-foreground text-xs">Status</Label>
                 <div className="mt-2">
                   <Badge variant="outline" className={status.style}>
                     {status.label}
                   </Badge>
                 </div>
               </div>
               <div className="glass-card rounded-xl p-4">
                 <Label className="text-muted-foreground text-xs">Type</Label>
                 <div className="mt-2">
                   <Badge variant="outline" className={keyType.style}>
                     {keyType.label}
                   </Badge>
                 </div>
               </div>
             </div>
 
             {/* Enable/Disable Toggle */}
             <div className="glass-card rounded-xl p-4">
               <div className="flex items-center justify-between">
                 <div className="space-y-1">
                   <Label className="text-foreground">Key Status</Label>
                   <p className="text-sm text-muted-foreground">
                     {keyData.status === 'active' ? 'Key is currently active' : 'Key is suspended'}
                   </p>
                 </div>
                 <Switch
                   checked={keyData.status === 'active'}
                   onCheckedChange={handleToggleStatus}
                   disabled={updating || keyData.status === 'revoked' || keyData.status === 'expired'}
                 />
               </div>
             </div>
 
             {/* Product & Owner */}
             <div className="glass-card rounded-xl p-4 space-y-4">
               <div className="flex items-center gap-3">
                 <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                   <Shield className="h-5 w-5 text-primary" />
                 </div>
                 <div>
                   <Label className="text-muted-foreground text-xs">Product / Module</Label>
                   <p className="text-foreground font-medium">{getProductName(keyData.product_id)}</p>
                 </div>
               </div>
 
               {(keyData.owner_name || keyData.owner_email) && (
                 <div className="flex items-center gap-3 pt-3 border-t border-border">
                   <div className="h-10 w-10 rounded-lg bg-cyan/20 flex items-center justify-center">
                     <User className="h-5 w-5 text-cyan" />
                   </div>
                   <div>
                     <Label className="text-muted-foreground text-xs">Assigned To</Label>
                     <p className="text-foreground font-medium">{keyData.owner_name || '-'}</p>
                     {keyData.owner_email && (
                       <p className="text-sm text-muted-foreground">{keyData.owner_email}</p>
                     )}
                   </div>
                 </div>
               )}
             </div>
 
             {/* Usage & Limits */}
             <div className="glass-card rounded-xl p-4 space-y-4">
               <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                 <Activity className="h-4 w-4 text-primary" />
                 Usage Details
               </h4>
               <div className="grid grid-cols-2 gap-4">
                 <div>
                   <Label className="text-muted-foreground text-xs">Devices Used</Label>
                   <p className="text-foreground font-medium">
                     {keyData.activated_devices} / {keyData.max_devices}
                   </p>
                 </div>
                 <div>
                   <Label className="text-muted-foreground text-xs">Max Devices</Label>
                   <p className="text-foreground font-medium">{keyData.max_devices}</p>
                 </div>
               </div>
             </div>
 
             {/* Dates */}
             <div className="glass-card rounded-xl p-4 space-y-4">
               <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                 <Calendar className="h-4 w-4 text-primary" />
                 Timeline
               </h4>
               <div className="space-y-3">
                 <div className="flex items-center justify-between">
                   <span className="text-sm text-muted-foreground">Created</span>
                   <span className="text-sm text-foreground">
                     {format(new Date(keyData.created_at), 'PPP')}
                   </span>
                 </div>
                 {keyData.activated_at && (
                   <div className="flex items-center justify-between">
                     <span className="text-sm text-muted-foreground">Activated</span>
                     <span className="text-sm text-foreground">
                       {format(new Date(keyData.activated_at), 'PPP')}
                     </span>
                   </div>
                 )}
                 <div className="flex items-center justify-between">
                   <span className="text-sm text-muted-foreground">Expires</span>
                   <span className="text-sm text-foreground">
                     {keyData.expires_at
                       ? format(new Date(keyData.expires_at), 'PPP')
                       : 'Never'}
                   </span>
                 </div>
               </div>
             </div>
 
             {/* Last Used */}
             {keyData.activated_at && (
               <div className="glass-card rounded-xl p-4">
                 <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
                     <Clock className="h-5 w-5 text-success" />
                   </div>
                   <div>
                     <Label className="text-muted-foreground text-xs">Last Used</Label>
                     <p className="text-foreground font-medium">
                       {formatDistanceToNow(new Date(keyData.activated_at), { addSuffix: true })}
                     </p>
                   </div>
                 </div>
               </div>
             )}
           </div>
         </ScrollArea>
       </SheetContent>
     </Sheet>
   );
 }