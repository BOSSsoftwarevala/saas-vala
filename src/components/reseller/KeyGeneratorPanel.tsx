 import { useState } from 'react';
 import { motion } from 'framer-motion';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { useWallet } from '@/hooks/useWallet';
 import { toast } from 'sonner';
 import {
   Key,
   AlertCircle,
   Wallet,
   Copy,
   CheckCircle2,
   Loader2,
   Lock,
 } from 'lucide-react';
 
 const MINIMUM_BALANCE = 50;
 const KEY_COST = 5;
 
 const products = [
   { id: 'restaurant-pos', name: 'Restaurant POS System', price: 5 },
   { id: 'hotel-mgmt', name: 'Hotel Management System', price: 5 },
   { id: 'retail-pos', name: 'Retail POS System', price: 5 },
   { id: 'salon-mgmt', name: 'Salon Management System', price: 5 },
   { id: 'gym-mgmt', name: 'Gym Management System', price: 5 },
 ];
 
 export function KeyGeneratorPanel() {
  const { wallet, fetchWallet } = useWallet();
   const [selectedProduct, setSelectedProduct] = useState('');
   const [clientName, setClientName] = useState('');
   const [clientEmail, setClientEmail] = useState('');
   const [quantity, setQuantity] = useState(1);
   const [isGenerating, setIsGenerating] = useState(false);
   const [generatedKeys, setGeneratedKeys] = useState<string[]>([]);
 
   const balance = wallet?.balance || 0;
   const canGenerate = balance >= MINIMUM_BALANCE;
   const totalCost = quantity * KEY_COST;
   const hasEnoughBalance = balance >= totalCost;
 
   const handleGenerate = async () => {
     if (!selectedProduct || !clientName || !clientEmail) {
       toast.error('Please fill all required fields');
       return;
     }
 
     if (!canGenerate) {
       toast.error(`Minimum balance of $${MINIMUM_BALANCE} required to generate keys`);
       return;
     }
 
     if (!hasEnoughBalance) {
       toast.error(`Insufficient balance. Need $${totalCost} but have $${balance.toFixed(2)}`);
       return;
     }
 
     setIsGenerating(true);
     const keys: string[] = [];
 
     try {
       for (let i = 0; i < quantity; i++) {
         // Generate license key format: XXXX-XXXX-XXXX-XXXX
         const key = Array(4).fill(0).map(() => 
           Math.random().toString(36).substring(2, 6).toUpperCase()
         ).join('-');
         keys.push(key);
       }
 
       setGeneratedKeys(keys);
       toast.success(`${quantity} license key(s) generated successfully!`);
      fetchWallet();
    } catch (_error) {
       toast.error('Failed to generate keys. Please try again.');
     } finally {
       setIsGenerating(false);
     }
   };
 
   const copyKey = (key: string) => {
     navigator.clipboard.writeText(key);
     toast.success('Key copied to clipboard!');
   };
 
   const copyAllKeys = () => {
     navigator.clipboard.writeText(generatedKeys.join('\n'));
     toast.success('All keys copied to clipboard!');
   };
 
   return (
     <div className="space-y-6">
       {/* Balance Warning */}
       {!canGenerate && (
         <motion.div
           initial={{ opacity: 0, y: -10 }}
           animate={{ opacity: 1, y: 0 }}
         >
           <Card className="border-destructive/50 bg-destructive/10">
             <CardContent className="p-4 flex items-center gap-4">
               <div className="h-12 w-12 rounded-full bg-destructive/20 flex items-center justify-center">
                 <Lock className="h-6 w-6 text-destructive" />
               </div>
               <div className="flex-1">
                 <h3 className="font-semibold text-foreground">Insufficient Balance</h3>
                 <p className="text-sm text-muted-foreground">
                   Minimum balance of <strong>${MINIMUM_BALANCE}</strong> required to generate keys.
                   Current balance: <strong>${balance.toFixed(2)}</strong>
                 </p>
               </div>
               <Button onClick={() => window.location.href = '/reseller-dashboard?tab=wallet'}>
                 <Wallet className="h-4 w-4 mr-2" />
                 Add Balance
               </Button>
             </CardContent>
           </Card>
         </motion.div>
       )}
 
       {/* Balance Info */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <Card className="glass-card">
           <CardContent className="p-4">
             <div className="flex items-center gap-3">
               <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                 <Wallet className="h-5 w-5 text-primary" />
               </div>
               <div>
                 <p className="text-sm text-muted-foreground">Your Balance</p>
                 <p className="text-xl font-bold text-foreground">${balance.toFixed(2)}</p>
               </div>
             </div>
           </CardContent>
         </Card>
 
         <Card className="glass-card">
           <CardContent className="p-4">
             <div className="flex items-center gap-3">
               <div className="h-10 w-10 rounded-lg bg-secondary/20 flex items-center justify-center">
                 <Key className="h-5 w-5 text-secondary" />
               </div>
               <div>
                 <p className="text-sm text-muted-foreground">Cost Per Key</p>
                 <p className="text-xl font-bold text-foreground">${KEY_COST}</p>
               </div>
             </div>
           </CardContent>
         </Card>
 
         <Card className="glass-card">
           <CardContent className="p-4">
             <div className="flex items-center gap-3">
               <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                 <AlertCircle className="h-5 w-5 text-amber-500" />
               </div>
               <div>
                 <p className="text-sm text-muted-foreground">Minimum Balance</p>
                 <p className="text-xl font-bold text-foreground">${MINIMUM_BALANCE}</p>
               </div>
             </div>
           </CardContent>
         </Card>
       </div>
 
       {/* Key Generation Form */}
       <Card className="glass-card">
         <CardHeader>
           <CardTitle className="flex items-center gap-2">
             <Key className="h-5 w-5 text-primary" />
             Generate License Keys
           </CardTitle>
           <CardDescription>
             Create license keys for your clients. Each key costs ${KEY_COST}.
           </CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label>Select Product *</Label>
               <Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={!canGenerate}>
                 <SelectTrigger>
                   <SelectValue placeholder="Choose a product" />
                 </SelectTrigger>
                 <SelectContent>
                   {products.map((product) => (
                     <SelectItem key={product.id} value={product.id}>
                       {product.name} - ${product.price}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
 
             <div className="space-y-2">
               <Label>Quantity</Label>
               <Select 
                 value={quantity.toString()} 
                 onValueChange={(v) => setQuantity(parseInt(v))}
                 disabled={!canGenerate}
               >
                 <SelectTrigger>
                   <SelectValue />
                 </SelectTrigger>
                 <SelectContent>
                   {[1, 2, 3, 5, 10, 20, 50].map((q) => (
                     <SelectItem key={q} value={q.toString()}>
                       {q} Key(s) - ${q * KEY_COST}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
           </div>
 
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label>Client Name *</Label>
               <Input
                 placeholder="Enter client name"
                 value={clientName}
                 onChange={(e) => setClientName(e.target.value)}
                 disabled={!canGenerate}
               />
             </div>
 
             <div className="space-y-2">
               <Label>Client Email *</Label>
               <Input
                 type="email"
                 placeholder="client@example.com"
                 value={clientEmail}
                 onChange={(e) => setClientEmail(e.target.value)}
                 disabled={!canGenerate}
               />
             </div>
           </div>
 
           {/* Cost Summary */}
           <div className="p-4 rounded-lg bg-muted/50 border border-border">
             <div className="flex items-center justify-between">
               <span className="text-muted-foreground">Total Cost:</span>
               <span className="text-xl font-bold text-foreground">${totalCost}</span>
             </div>
             {!hasEnoughBalance && canGenerate && (
               <p className="text-sm text-destructive mt-2">
                 Insufficient balance for this order
               </p>
             )}
           </div>
 
           <Button
             className="w-full"
             size="lg"
             disabled={!canGenerate || !hasEnoughBalance || isGenerating}
             onClick={handleGenerate}
           >
             {isGenerating ? (
               <>
                 <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                 Generating...
               </>
             ) : (
               <>
                 <Key className="h-4 w-4 mr-2" />
                 Generate {quantity} Key(s)
               </>
             )}
           </Button>
         </CardContent>
       </Card>
 
       {/* Generated Keys */}
       {generatedKeys.length > 0 && (
         <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
         >
           <Card className="glass-card border-green-500/30">
             <CardHeader>
               <div className="flex items-center justify-between">
                 <CardTitle className="flex items-center gap-2 text-green-500">
                   <CheckCircle2 className="h-5 w-5" />
                   Generated Keys
                 </CardTitle>
                 <Button variant="outline" size="sm" onClick={copyAllKeys}>
                   <Copy className="h-4 w-4 mr-2" />
                   Copy All
                 </Button>
               </div>
             </CardHeader>
             <CardContent>
               <div className="space-y-2">
                 {generatedKeys.map((key, index) => (
                   <div
                     key={index}
                     className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
                   >
                     <code className="font-mono text-sm text-foreground">{key}</code>
                     <Button variant="ghost" size="sm" onClick={() => copyKey(key)}>
                       <Copy className="h-4 w-4" />
                     </Button>
                   </div>
                 ))}
               </div>
             </CardContent>
           </Card>
         </motion.div>
       )}
     </div>
   );
 }