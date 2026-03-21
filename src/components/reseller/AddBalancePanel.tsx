import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useWallet } from '@/hooks/useWallet';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Wallet,
  Building2,
  Bitcoin,
  Copy,
  CheckCircle2,
  Loader2,
  Globe,
} from 'lucide-react';

const paymentMethods = [
  { id: 'wise', name: 'Wise (TransferWise)', icon: Globe, description: 'International transfer - Fast & Low fees' },
  { id: 'bank', name: 'Bank Transfer', icon: Building2, description: 'Direct Indian bank transfer (NEFT/IMPS)' },
  { id: 'binance', name: 'Binance Pay / Crypto', icon: Bitcoin, description: 'USDT, Bitcoin via Binance' },
];

const wiseDetails = {
  'Account Holder': 'SOFTWARE VALA',
  'Email': 'pay@softwarevala.com',
  'Wise ID': 'softwarevala',
  'Currency': 'USD / INR / EUR accepted',
};

const bankDetails = {
  'Bank Name': 'Indian Bank',
  'Account Name': 'SOFTWARE VALA',
  'Account Number': '123456789012',
  'IFSC Code': 'IDIB000V001',
  'Branch': 'Main Branch, Mumbai',
};

const binanceDetails = {
  'Binance Pay ID': '218723456',
  'USDT (TRC20)': 'TXkY4p6dGJL3erM8v9r2m',
  'Bitcoin (BTC)': 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
};

const amountPresets = [50, 100, 200, 500, 1000, 2000];

export function AddBalancePanel() {
  const { wallet, fetchWallet } = useWallet();
  const [selectedMethod, setSelectedMethod] = useState('wise');
  const [amount, setAmount] = useState('100');
  const [transactionId, setTransactionId] = useState('');
  const [senderName, setSenderName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const getPaymentDetails = (): Record<string, string> => {
    switch (selectedMethod) {
      case 'wise': return wiseDetails;
      case 'bank': return bankDetails;
      case 'binance': return binanceDetails;
      default: return {};
    }
  };

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < 10) {
      toast.error('Minimum amount is $10');
      return;
    }
    if (!transactionId.trim()) {
      toast.error('Please enter Transaction ID / Reference');
      return;
    }
    if (!senderName.trim()) {
      toast.error('Please enter sender name');
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error('Please login first');
        setSubmitting(false);
        return;
      }

      // Log the payment request as a pending transaction
      if (wallet) {
        const { error } = await supabase.from('transactions').insert({
          wallet_id: wallet.id,
          type: 'credit' as const,
          amount: amt,
          balance_after: wallet.balance, // Not credited yet
          status: 'pending' as const,
          description: `Add Balance via ${selectedMethod.toUpperCase()} - Pending verification`,
          reference_id: transactionId.trim(),
          reference_type: 'manual_topup',
          created_by: userData.user.id,
          meta: {
            payment_method: selectedMethod,
            sender_name: senderName.trim(),
            transaction_ref: transactionId.trim(),
            requested_amount: amt,
          }
        });

        if (error) throw error;
      }

      // Log activity
      await supabase.from('activity_logs').insert({
        entity_type: 'wallet',
        entity_id: wallet?.id || userData.user.id,
        action: 'balance_topup_request',
        performed_by: userData.user.id,
        details: {
          amount: amt,
          method: selectedMethod,
          transaction_ref: transactionId.trim(),
          sender: senderName.trim(),
        }
      });

      toast.success('✅ Payment verification request submitted!', {
        description: 'We will verify and credit your balance within 1-24 hours.',
        duration: 6000,
      });

      setTransactionId('');
      setSenderName('');
      fetchWallet();
    } catch (err: any) {
      console.error('Submit error:', err);
      toast.error('Failed to submit: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Balance */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center shadow-lg">
                <Wallet className="h-7 w-7 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Balance</p>
                <p className="text-3xl font-bold text-foreground">${wallet?.balance?.toFixed(2) || '0.00'}</p>
              </div>
            </div>
            <Badge variant="outline" className="text-sm px-3 py-1.5">
              Min Top-up: $10
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Amount + Method */}
        <Card>
          <CardHeader>
            <CardTitle>Add Balance</CardTitle>
            <CardDescription>Select amount & payment method</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Quick Amount Presets */}
            <div>
              <Label className="mb-2 block">Quick Select</Label>
              <div className="grid grid-cols-3 gap-2">
                {amountPresets.map((preset) => (
                  <Button
                    key={preset}
                    variant={amount === preset.toString() ? 'default' : 'outline'}
                    onClick={() => setAmount(preset.toString())}
                    className="h-11 font-semibold"
                  >
                    ${preset}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Amount */}
            <div className="space-y-1.5">
              <Label>Custom Amount ($)</Label>
              <Input
                type="number"
                min="10"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="text-lg font-semibold h-12"
              />
              {parseFloat(amount) > 0 && parseFloat(amount) < 10 && (
                <p className="text-xs text-destructive">Minimum $10</p>
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
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border hover:border-primary/40'
                    }`}
                    onClick={() => setSelectedMethod(method.id)}
                  >
                    <RadioGroupItem value={method.id} id={method.id} />
                    <method.icon className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm">{method.name}</p>
                      <p className="text-xs text-muted-foreground">{method.description}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        {/* Right: Payment Details + Submit */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedMethod === 'wise' ? '🌐 Wise Transfer Details' :
               selectedMethod === 'bank' ? '🏦 Bank Transfer Details' :
               '₿ Binance / Crypto Details'}
            </CardTitle>
            <CardDescription>Send payment to below details, then submit reference</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Payment Info Cards */}
            <div className="space-y-2.5">
              {Object.entries(getPaymentDetails()).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">{key}</p>
                    <p className="font-mono font-medium text-foreground text-sm truncate">{value}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="flex-shrink-0 ml-2" onClick={() => copyToClipboard(value, key)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Submission Form */}
            <div className="pt-4 border-t border-border space-y-3">
              <div className="space-y-1.5">
                <Label>Sender Name *</Label>
                <Input
                  placeholder="Name on payment account"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Transaction ID / Reference *</Label>
                <Input
                  placeholder="Enter txn ID after payment"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                />
              </div>

              {/* Summary */}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold text-foreground">${parseFloat(amount) || 0}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Method</span>
                  <span className="font-medium text-foreground capitalize">{selectedMethod}</span>
                </div>
              </div>

              <Button
                className="w-full h-12 text-base font-semibold"
                onClick={handleSubmit}
                disabled={submitting || !transactionId.trim() || !senderName.trim() || parseFloat(amount) < 10}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Submit for Verification
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Balance credited within 1-24 hours after verification
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
