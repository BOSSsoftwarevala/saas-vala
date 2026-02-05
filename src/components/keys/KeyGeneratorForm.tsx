 import { useState } from 'react';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { Copy, RefreshCw, Key, Loader2, Eye, EyeOff } from 'lucide-react';
 import { toast } from 'sonner';
 import { cn } from '@/lib/utils';
 
 interface KeyGeneratorFormProps {
   products: Array<{ id: string; name: string }>;
   onGenerate: (data: {
     product_id: string;
     key_type: 'lifetime' | 'yearly' | 'monthly' | 'trial';
     license_key: string;
     owner_name: string;
     owner_email: string;
     max_devices: number;
     expires_at: string;
     notes: string;
   }) => Promise<void>;
   submitting: boolean;
 }
 
 type KeyType = 'api' | 'feature' | 'license';
 type KeySize = 16 | 32 | 64;
 
 const generateKeyBySize = (size: KeySize): string => {
   const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
   let result = '';
   const segmentSize = size === 16 ? 4 : size === 32 ? 8 : 16;
   const segments = size / segmentSize;
   
   for (let j = 0; j < segments; j++) {
     if (j > 0) result += '-';
     for (let i = 0; i < segmentSize; i++) {
       result += chars.charAt(Math.floor(Math.random() * chars.length));
     }
   }
   return result;
 };
 
 export function KeyGeneratorForm({ products, onGenerate, submitting }: KeyGeneratorFormProps) {
   const [keyType, setKeyType] = useState<KeyType>('license');
   const [keySize, setKeySize] = useState<KeySize>(32);
   const [generatedKey, setGeneratedKey] = useState('');
   const [showKey, setShowKey] = useState(false);
   const [productId, setProductId] = useState('');
   const [expiryDate, setExpiryDate] = useState('');
   const [usageLimit, setUsageLimit] = useState(1);
   const [ownerName, setOwnerName] = useState('');
   const [ownerEmail, setOwnerEmail] = useState('');
 
   const handleGenerateKey = () => {
     const newKey = generateKeyBySize(keySize);
     setGeneratedKey(newKey);
     setShowKey(true);
   };
 
   const handleCopyKey = () => {
     if (generatedKey) {
       navigator.clipboard.writeText(generatedKey);
       toast.success('Key copied to clipboard');
     }
   };
 
   const handleSubmit = async () => {
     if (!productId) {
       toast.error('Please select a product');
       return;
     }
     if (!generatedKey) {
       toast.error('Please generate a key first');
       return;
     }
 
     await onGenerate({
       product_id: productId,
       key_type: keyType === 'license' ? 'yearly' : keyType === 'api' ? 'lifetime' : 'monthly',
       license_key: generatedKey,
       owner_name: ownerName,
       owner_email: ownerEmail,
       max_devices: usageLimit,
       expires_at: expiryDate,
       notes: '',
     });
 
     // Reset form
     setGeneratedKey('');
     setOwnerName('');
     setOwnerEmail('');
     setExpiryDate('');
   };
 
   const maskedKey = generatedKey
     ? showKey
       ? generatedKey
       : generatedKey.replace(/[A-Z0-9]/g, '•')
     : '';
 
   return (
     <div className="glass-card rounded-xl p-6 space-y-6">
       <div className="flex items-center gap-2 mb-4">
         <Key className="h-5 w-5 text-primary" />
         <h3 className="font-semibold text-foreground">Key Generator</h3>
       </div>
 
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Left Column */}
         <div className="space-y-4">
           {/* Key Type Selector */}
           <div className="space-y-2">
             <Label>Key Type</Label>
             <div className="flex flex-wrap gap-2">
               {(['api', 'feature', 'license'] as KeyType[]).map((type) => (
                 <Button
                   key={type}
                   type="button"
                   variant={keyType === type ? 'default' : 'outline'}
                   size="sm"
                   className={cn(
                     'min-h-[44px] px-4',
                     keyType === type && 'bg-primary text-primary-foreground'
                   )}
                   onClick={() => setKeyType(type)}
                 >
                   {type.charAt(0).toUpperCase() + type.slice(1)}
                 </Button>
               ))}
             </div>
           </div>
 
           {/* Key Size Selector */}
           <div className="space-y-2">
             <Label>Key Size</Label>
             <div className="flex flex-wrap gap-2">
               {([16, 32, 64] as KeySize[]).map((size) => (
                 <Button
                   key={size}
                   type="button"
                   variant={keySize === size ? 'default' : 'outline'}
                   size="sm"
                   className={cn(
                     'min-h-[44px] px-4',
                     keySize === size && 'bg-primary text-primary-foreground'
                   )}
                   onClick={() => setKeySize(size)}
                 >
                   {size === 16 ? 'Nano (16)' : size === 32 ? 'Micro (32)' : 'Standard (64)'}
                 </Button>
               ))}
             </div>
           </div>
 
           {/* Generated Key Field */}
           <div className="space-y-2">
             <Label>Generated Key</Label>
             <div className="flex gap-2">
               <div className="relative flex-1">
                 <Input
                   value={maskedKey}
                   readOnly
                   placeholder="Click generate to create key"
                   className="font-mono bg-muted/50 border-border min-h-[44px] pr-10"
                 />
                 {generatedKey && (
                   <Button
                     type="button"
                     variant="ghost"
                     size="icon"
                     className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                     onClick={() => setShowKey(!showKey)}
                   >
                     {showKey ? (
                       <EyeOff className="h-4 w-4 text-muted-foreground" />
                     ) : (
                       <Eye className="h-4 w-4 text-muted-foreground" />
                     )}
                   </Button>
                 )}
               </div>
               <Button
                 type="button"
                 variant="outline"
                 size="icon"
                 className="min-h-[44px] min-w-[44px]"
                 onClick={handleCopyKey}
                 disabled={!generatedKey}
               >
                 <Copy className="h-4 w-4" />
               </Button>
               <Button
                 type="button"
                 variant="outline"
                 size="icon"
                 className="min-h-[44px] min-w-[44px]"
                 onClick={handleGenerateKey}
               >
                 <RefreshCw className="h-4 w-4" />
               </Button>
             </div>
           </div>
         </div>
 
         {/* Right Column */}
         <div className="space-y-4">
           {/* Product Select */}
           <div className="space-y-2">
             <Label>Product *</Label>
             <Select value={productId} onValueChange={setProductId}>
               <SelectTrigger className="min-h-[44px] bg-muted/50 border-border">
                 <SelectValue placeholder="Select product" />
               </SelectTrigger>
               <SelectContent>
                 {products.map((product) => (
                   <SelectItem key={product.id} value={product.id}>
                     {product.name}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
 
           {/* Expiry Date & Usage Limit */}
           <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label>Expiry Date</Label>
               <Input
                 type="date"
                 value={expiryDate}
                 onChange={(e) => setExpiryDate(e.target.value)}
                 className="min-h-[44px] bg-muted/50 border-border"
               />
             </div>
             <div className="space-y-2">
               <Label>Usage Limit</Label>
               <Input
                 type="number"
                 min="1"
                 value={usageLimit}
                 onChange={(e) => setUsageLimit(Number(e.target.value))}
                 className="min-h-[44px] bg-muted/50 border-border"
               />
             </div>
           </div>
 
           {/* Owner Info */}
           <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label>Owner Name</Label>
               <Input
                 placeholder="John Doe"
                 value={ownerName}
                 onChange={(e) => setOwnerName(e.target.value)}
                 className="min-h-[44px] bg-muted/50 border-border"
               />
             </div>
             <div className="space-y-2">
               <Label>Owner Email</Label>
               <Input
                 type="email"
                 placeholder="john@example.com"
                 value={ownerEmail}
                 onChange={(e) => setOwnerEmail(e.target.value)}
                 className="min-h-[44px] bg-muted/50 border-border"
               />
             </div>
           </div>
         </div>
       </div>
 
       {/* Submit Button */}
       <div className="flex justify-end pt-4 border-t border-border">
         <Button
           onClick={handleSubmit}
           disabled={submitting || !productId || !generatedKey}
           className="bg-orange-gradient hover:opacity-90 text-white min-h-[44px] px-8"
         >
           {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
           Create Key
         </Button>
       </div>
     </div>
   );
 }