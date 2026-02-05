 import { useState } from 'react';
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Badge } from '@/components/ui/badge';
 import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
 import { useWallet } from '@/hooks/useWallet';
 import { toast } from 'sonner';
 import {
   Wallet,
   CreditCard,
   Building2,
   Bitcoin,
   Copy,
   CheckCircle2,
 } from 'lucide-react';
 
 const paymentMethods = [
   { id: 'bank', name: 'Bank Transfer', icon: Building2, description: 'Direct bank transfer' },
   { id: 'upi', name: 'UPI', icon: CreditCard, description: 'Google Pay, PhonePe, Paytm' },
   { id: 'crypto', name: 'Crypto', icon: Bitcoin, description: 'Bitcoin, USDT' },
 ];
 
 const bankDetails = {
   bankName: 'Indian Bank',
   accountName: 'SOFTWARE VALA',
   accountNumber: '123456789012',
   ifsc: 'IDIB000V001',
   branch: 'Main Branch, Mumbai',
 };
 
 const amountPresets = [50, 100, 200, 500, 1000];
 
 export function AddBalancePanel() {
  const { wallet } = useWallet();
   const [selectedMethod, setSelectedMethod] = useState('bank');
   const [amount, setAmount] = useState('100');
   const [transactionId, setTransactionId] = useState('');
 
   const copyToClipboard = (text: string, label: string) => {
     navigator.clipboard.writeText(text);
     toast.success(`${label} copied!`);
   };
 
   const handleSubmit = () => {
     if (!amount || parseFloat(amount) < 50) {
       toast.error('Minimum amount is $50');
       return;
     }
     if (!transactionId) {
       toast.error('Please enter transaction ID');
       return;
     }
     toast.success('Payment verification request submitted! We will verify and credit your balance within 24 hours.');
     setTransactionId('');
   };
 
   return (
     <div className="space-y-6">
       {/* Current Balance */}
       <Card className="glass-card border-primary/30">
         <CardContent className="p-6">
           <div className="flex items-center justify-between">
             <div className="flex items-center gap-4">
               <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center">
                 <Wallet className="h-7 w-7 text-white" />
               </div>
               <div>
                 <p className="text-sm text-muted-foreground">Current Balance</p>
                 <p className="text-3xl font-bold text-foreground">${wallet?.balance?.toFixed(2) || '0.00'}</p>
               </div>
             </div>
             <Badge variant="outline" className="text-lg px-4 py-2">
               Minimum: $50
             </Badge>
           </div>
         </CardContent>
       </Card>
 
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Amount Selection */}
         <Card className="glass-card">
           <CardHeader>
             <CardTitle>Select Amount</CardTitle>
             <CardDescription>Choose or enter amount to add</CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
             <div className="grid grid-cols-5 gap-2">
               {amountPresets.map((preset) => (
                 <Button
                   key={preset}
                   variant={amount === preset.toString() ? 'default' : 'outline'}
                   onClick={() => setAmount(preset.toString())}
                   className="h-12"
                 >
                   ${preset}
                 </Button>
               ))}
             </div>
 
             <div className="space-y-2">
               <Label>Custom Amount ($)</Label>
               <Input
                 type="number"
                 min="50"
                 value={amount}
                 onChange={(e) => setAmount(e.target.value)}
                 placeholder="Enter amount"
               />
               {parseFloat(amount) < 50 && (
                 <p className="text-sm text-destructive">Minimum amount is $50</p>
               )}
             </div>
 
             {/* Payment Method */}
             <div className="space-y-2">
               <Label>Payment Method</Label>
               <RadioGroup value={selectedMethod} onValueChange={setSelectedMethod}>
                 {paymentMethods.map((method) => (
                   <div
                     key={method.id}
                     className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                       selectedMethod === method.id
                         ? 'border-primary bg-primary/10'
                         : 'border-border hover:border-primary/50'
                     }`}
                     onClick={() => setSelectedMethod(method.id)}
                   >
                     <RadioGroupItem value={method.id} id={method.id} />
                     <method.icon className="h-5 w-5 text-primary" />
                     <div className="flex-1">
                       <p className="font-medium text-foreground">{method.name}</p>
                       <p className="text-sm text-muted-foreground">{method.description}</p>
                     </div>
                   </div>
                 ))}
               </RadioGroup>
             </div>
           </CardContent>
         </Card>
 
         {/* Payment Details */}
         <Card className="glass-card">
           <CardHeader>
             <CardTitle>Payment Details</CardTitle>
             <CardDescription>Transfer to the following account</CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
             {selectedMethod === 'bank' && (
               <div className="space-y-3">
                 {Object.entries(bankDetails).map(([key, value]) => (
                   <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                     <div>
                       <p className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                       <p className="font-mono font-medium text-foreground">{value}</p>
                     </div>
                     <Button variant="ghost" size="sm" onClick={() => copyToClipboard(value, key)}>
                       <Copy className="h-4 w-4" />
                     </Button>
                   </div>
                 ))}
               </div>
             )}
 
             {selectedMethod === 'upi' && (
               <div className="text-center p-6">
                 <p className="text-muted-foreground mb-4">Scan QR or use UPI ID:</p>
                 <div className="inline-flex items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                   <code className="font-mono text-lg">softwarevala@upi</code>
                   <Button variant="ghost" size="sm" onClick={() => copyToClipboard('softwarevala@upi', 'UPI ID')}>
                     <Copy className="h-4 w-4" />
                   </Button>
                 </div>
               </div>
             )}
 
             {selectedMethod === 'crypto' && (
               <div className="space-y-3">
                 <div className="p-3 rounded-lg bg-muted/50 border border-border">
                   <p className="text-xs text-muted-foreground">Bitcoin (BTC)</p>
                   <div className="flex items-center gap-2">
                     <code className="font-mono text-xs text-foreground truncate flex-1">bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh</code>
                     <Button variant="ghost" size="sm" onClick={() => copyToClipboard('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 'BTC Address')}>
                       <Copy className="h-4 w-4" />
                     </Button>
                   </div>
                 </div>
                 <div className="p-3 rounded-lg bg-muted/50 border border-border">
                   <p className="text-xs text-muted-foreground">USDT (TRC20)</p>
                   <div className="flex items-center gap-2">
                     <code className="font-mono text-xs text-foreground truncate flex-1">TXkY4p6dGJL3erM8v9r2m</code>
                     <Button variant="ghost" size="sm" onClick={() => copyToClipboard('TXkY4p6dGJL3erM8v9r2m', 'USDT Address')}>
                       <Copy className="h-4 w-4" />
                     </Button>
                   </div>
                 </div>
               </div>
             )}
 
             {/* Transaction Verification */}
             <div className="pt-4 border-t border-border space-y-3">
               <Label>Transaction ID / Reference Number</Label>
               <Input
                 placeholder="Enter transaction ID after payment"
                 value={transactionId}
                 onChange={(e) => setTransactionId(e.target.value)}
               />
               <Button className="w-full" size="lg" onClick={handleSubmit}>
                 <CheckCircle2 className="h-4 w-4 mr-2" />
                 Submit for Verification
               </Button>
               <p className="text-xs text-muted-foreground text-center">
                 Balance will be credited within 24 hours after verification
               </p>
             </div>
           </CardContent>
         </Card>
       </div>
     </div>
   );
 }