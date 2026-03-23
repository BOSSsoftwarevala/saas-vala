import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Loader2,
  Shield,
  Copy,
  Clock,
  ChevronDown,
  ChevronUp,
  Wallet,
  Building2,
  Bitcoin,
  Send,
  Banknote,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import softwareValaLogo from '@/assets/softwarevala-logo.png';

interface AddCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const presetAmounts = [500, 1000, 2000, 5000, 10000];

const bankDetails = {
  accountName: 'SOFTWARE VALA',
  bankName: 'INDIAN BANK',
  accountType: 'Current',
  accountNumber: '8045924772',
  accountNumberMasked: '••••••4772',
  ifsc: 'IDIB000K196',
  ifscMasked: 'IDIB•••196',
  branchName: 'KANKAR BAGH',
  upiId: 'softwarevala@indianbank',
};

const cryptoDetails = {
  binanceId: '1078928519',
  binanceIdMasked: '•••••8519',
};

type PayMethod = 'upi' | 'bank' | 'wise' | 'remit' | 'crypto';

export function AddCreditsModal({ open, onOpenChange, onSuccess }: AddCreditsModalProps) {
  const [amount, setAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PayMethod>('upi');
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [transactionRef, setTransactionRef] = useState('');
  const [step, setStep] = useState<'form' | 'processing' | 'success' | 'pending'>('form');
  const [retryCount, setRetryCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const finalAmount = customAmount ? parseInt(customAmount) || 0 : amount;
  const isManualMethod = payMethod === 'bank' || payMethod === 'wise' || payMethod === 'remit' || payMethod === 'crypto';

  const handleClose = () => {
    setStep('form');
    setAmount(1000);
    setCustomAmount('');
    setPayMethod('upi');
    setTransactionRef('');
    setRetryCount(0);
    setIsSubmitting(false);
    setShowMoreOptions(false);
    onOpenChange(false);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const submitManualPayment = async () => {
    const trimmedRef = transactionRef.trim();
    if (!trimmedRef) {
      toast.error('Please enter your transaction reference number');
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStep('processing');
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: walletData } = await supabase
          .from('wallets')
          .select('id')
          .eq('user_id', userData.user.id)
          .maybeSingle();
        if (walletData) {
          // Check for duplicate reference ID before inserting
          const { data: existing } = await supabase
            .from('transactions')
            .select('id')
            .eq('wallet_id', walletData.id)
            .eq('reference_id', trimmedRef)
            .maybeSingle();
          if (existing) {
            toast.error('This reference ID has already been submitted');
            setStep('form');
            setIsSubmitting(false);
            return;
          }
          const { error: insertError } = await supabase.from('transactions').insert({
            wallet_id: walletData.id,
            type: 'purchase',
            amount: finalAmount,
            balance_after: null,
            status: 'pending',
            description: `${payMethod.toUpperCase()} Transfer - Awaiting Verification`,
            created_by: userData.user.id,
            reference_id: trimmedRef,
            reference_type: payMethod === 'crypto' ? 'crypto_transfer' : 'bank_transfer',
            meta: { payment_method: payMethod, transaction_ref: trimmedRef },
          });
          if (insertError) {
            if (insertError.code === '23505') {
              toast.error('This reference ID has already been submitted');
            } else {
              throw insertError;
            }
            setStep('form');
            setIsSubmitting(false);
            return;
          }
        }
      }
      await new Promise(r => setTimeout(r, 800));
      setStep('pending');
    } catch {
      toast.error('Failed to submit. Please try again.');
      setStep('form');
      setIsSubmitting(false);
    }
  };

  const submitUpiPayment = async () => {
    const trimmedRef = transactionRef.trim();
    if (!trimmedRef) {
      toast.error('Please enter your UPI transaction ID');
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStep('processing');

    // Check for duplicate reference ID before attempting payment
    try {
      const { supabase: sb } = await import('@/integrations/supabase/client');
      const { data: userData } = await sb.auth.getUser();
      if (userData.user) {
        const { data: walletData } = await sb
          .from('wallets')
          .select('id')
          .eq('user_id', userData.user.id)
          .maybeSingle();
        if (walletData) {
          const { data: existing } = await sb
            .from('transactions')
            .select('id')
            .eq('wallet_id', walletData.id)
            .eq('reference_id', trimmedRef)
            .maybeSingle();
          if (existing) {
            toast.error('This UPI Transaction ID has already been submitted');
            setStep('form');
            setIsSubmitting(false);
            return;
          }
        }
      }
    } catch {
      // If pre-check fails, proceed and let DB unique constraint catch duplicates
    }

    const processPayment = async (attempt: number): Promise<'success' | 'duplicate' | 'failed'> => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return 'failed';

        const { data: walletData } = await supabase
          .from('wallets')
          .select('id')
          .eq('user_id', userData.user.id)
          .maybeSingle();
        if (!walletData) return 'failed';

        const { error: txError } = await supabase.from('transactions').insert({
          wallet_id: walletData.id,
          type: 'purchase',
          amount: finalAmount,
          balance_after: null,
          status: 'pending',
          description: 'UPI Payment - Pending Verification',
          created_by: userData.user.id,
          reference_id: trimmedRef,
          reference_type: 'upi',
          meta: { payment_method: 'upi', upi_txn_id: trimmedRef },
        });

        if (txError) {
          if (txError.code === '23505') return 'duplicate';
          if (attempt < 3) {
            setRetryCount(attempt);
            await new Promise(r => setTimeout(r, 1500));
            return processPayment(attempt + 1);
          }
          return 'failed';
        }
        return 'success';
      } catch {
        if (attempt < 3) {
          setRetryCount(attempt);
          await new Promise(r => setTimeout(r, 1500));
          return processPayment(attempt + 1);
        }
        return 'failed';
      }
    };

    const result = await processPayment(1);
    if (result === 'success') {
      setStep('pending');
      onSuccess?.();
    } else {
      if (result === 'duplicate') {
        toast.error('This UPI Transaction ID has already been submitted');
      } else {
        toast.error('Submission failed. Please try again.');
      }
      setStep('form');
      setRetryCount(0);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-background border-border max-h-[90vh] overflow-y-auto">

        {/* ── PROCESSING ── */}
        {step === 'processing' && (
          <div className="py-16 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <h3 className="font-display text-lg font-semibold">Submitting...</h3>
            <p className="text-sm text-muted-foreground">Please wait, do not close this window</p>
            {retryCount > 0 && <p className="text-xs text-muted-foreground">Retry {retryCount}/3</p>}
          </div>
        )}

        {/* ── SUCCESS ── */}
        {step === 'success' && (
          <div className="py-16 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h3 className="font-display text-lg font-semibold">Payment Successful!</h3>
            <p className="text-sm text-muted-foreground">₹{finalAmount.toLocaleString()} added to your wallet</p>
            <Button className="w-full bg-orange-gradient text-white" onClick={handleClose}>Done</Button>
          </div>
        )}

        {/* ── PENDING ── */}
        {step === 'pending' && (
          <div className="py-12 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
              <Clock className="h-8 w-8 text-warning" />
            </div>
            <h3 className="font-display text-lg font-semibold">Payment Submitted!</h3>
            <p className="text-sm text-muted-foreground">
              ₹{finalAmount.toLocaleString()} will be added after admin verification (2-4 hours)
            </p>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Your Reference</p>
              <p className="font-mono text-sm text-foreground break-all">{transactionRef}</p>
            </div>
            <Button className="w-full bg-orange-gradient text-white" onClick={handleClose}>Done</Button>
          </div>
        )}

        {/* ── MAIN FORM ── */}
        {step === 'form' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <img src={softwareValaLogo} alt="SoftwareVala" className="h-10 w-10 rounded-full object-contain" />
                <div>
                  <DialogTitle className="font-display text-lg">Add Credits</DialogTitle>
                  <p className="text-xs text-muted-foreground">SoftwareVala™ Wallet</p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-5 py-2">

              {/* ── AMOUNT ── */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Select Amount</Label>
                <div className="grid grid-cols-5 gap-2">
                  {presetAmounts.map((preset) => (
                    <Button
                      key={preset}
                      variant={amount === preset && !customAmount ? 'default' : 'outline'}
                      className="h-10 text-xs"
                      onClick={() => { setAmount(preset); setCustomAmount(''); }}
                    >
                      ₹{preset >= 1000 ? `${preset / 1000}K` : preset}
                    </Button>
                  ))}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₹</span>
                  <Input
                    placeholder="Custom amount"
                    value={customAmount}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '');
                      setCustomAmount(v);
                      if (v) setAmount(parseInt(v));
                    }}
                    className="pl-8"
                  />
                </div>
                {finalAmount < 100 && finalAmount > 0 && (
                  <p className="text-xs text-destructive">Minimum amount is ₹100</p>
                )}
                <div className="flex justify-between text-sm bg-primary/5 rounded-lg px-4 py-2">
                  <span className="text-muted-foreground">Total to pay</span>
                  <span className="font-bold text-primary">₹{finalAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* ── UPI PAYMENT (PRIMARY) ── */}
              <div
                className={cn(
                  'rounded-xl border-2 cursor-pointer transition-all',
                  payMethod === 'upi' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                )}
                onClick={() => setPayMethod('upi')}
              >
                <div className="flex items-center gap-3 p-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">UPI Payment</p>
                    <p className="text-xs text-muted-foreground">GPay, PhonePe, Paytm, BHIM • India 🇮🇳</p>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-primary/30">Recommended</Badge>
                </div>

                {payMethod === 'upi' && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                    {/* UPI ID */}
                    <div className="bg-background rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">UPI ID</p>
                        <p className="font-mono font-semibold text-foreground">{bankDetails.upiId}</p>
                      </div>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={(e) => { e.stopPropagation(); handleCopy(bankDetails.upiId, 'UPI ID'); }}>
                        <Copy className="h-3 w-3" /> Copy
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      1. Open any UPI app → Send ₹{finalAmount.toLocaleString()} to above UPI ID<br />
                      2. Enter the Transaction ID below
                    </p>
                    <Input
                      placeholder="Enter UPI Transaction ID"
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
              </div>

              {/* ── MORE OPTIONS TOGGLE ── */}
              <Button
                variant="ghost"
                className="w-full gap-2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowMoreOptions(!showMoreOptions)}
              >
                {showMoreOptions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showMoreOptions ? 'Hide' : 'More'} Payment Options (Bank / Crypto / International)
              </Button>

              {/* ── OTHER METHODS ── */}
              {showMoreOptions && (
                <div className="space-y-2">
                  {/* Bank Transfer */}
                  <div
                    className={cn(
                      'rounded-xl border cursor-pointer transition-all',
                      payMethod === 'bank' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                    )}
                    onClick={() => setPayMethod('bank')}
                  >
                    <div className="flex items-center gap-3 p-3">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium text-sm text-foreground">Bank Transfer (NEFT/IMPS)</p>
                        <p className="text-xs text-muted-foreground">🇮🇳 India • Manual verify 2-4 hrs</p>
                      </div>
                    </div>
                    {payMethod === 'bank' && (
                      <div className="px-3 pb-3 space-y-2 border-t border-border pt-3">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-background rounded-lg p-2">
                            <p className="text-muted-foreground">Account Number</p>
                            <p className="font-mono font-semibold">{bankDetails.accountNumberMasked}</p>
                            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={(e) => { e.stopPropagation(); handleCopy(bankDetails.accountNumber, 'Account Number'); }}>
                              Copy
                            </Button>
                          </div>
                          <div className="bg-background rounded-lg p-2">
                            <p className="text-muted-foreground">IFSC Code</p>
                            <p className="font-mono font-semibold">{bankDetails.ifscMasked}</p>
                            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={(e) => { e.stopPropagation(); handleCopy(bankDetails.ifsc, 'IFSC Code'); }}>
                              Copy
                            </Button>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                          <strong>Bank:</strong> {bankDetails.bankName} • <strong>Branch:</strong> {bankDetails.branchName}
                        </div>
                        <Input
                          placeholder="Enter UTR / Transaction Reference"
                          value={transactionRef}
                          onChange={(e) => setTransactionRef(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}
                  </div>

                  {/* Wise */}
                  <div
                    className={cn(
                      'rounded-xl border cursor-pointer transition-all',
                      payMethod === 'wise' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                    )}
                    onClick={() => setPayMethod('wise')}
                  >
                    <div className="flex items-center gap-3 p-3">
                      <Send className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium text-sm text-foreground">Wise (TransferWise)</p>
                        <p className="text-xs text-muted-foreground">🌍 International • Low fees</p>
                      </div>
                    </div>
                    {payMethod === 'wise' && (
                      <div className="px-3 pb-3 space-y-2 border-t border-border pt-3">
                        <p className="text-xs text-muted-foreground">Send to Indian Bank Account (same details as Bank Transfer above)</p>
                        <Input
                          placeholder="Enter Wise Transfer Reference"
                          value={transactionRef}
                          onChange={(e) => setTransactionRef(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}
                  </div>

                  {/* Remitly */}
                  <div
                    className={cn(
                      'rounded-xl border cursor-pointer transition-all',
                      payMethod === 'remit' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                    )}
                    onClick={() => setPayMethod('remit')}
                  >
                    <div className="flex items-center gap-3 p-3">
                      <Banknote className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium text-sm text-foreground">Remitly / Western Union</p>
                        <p className="text-xs text-muted-foreground">🌍 🇺🇸 🇬🇧 🇦🇪 • Fast</p>
                      </div>
                    </div>
                    {payMethod === 'remit' && (
                      <div className="px-3 pb-3 space-y-2 border-t border-border pt-3">
                        <p className="text-xs text-muted-foreground">Send to Indian Bank Account (same details as Bank Transfer)</p>
                        <Input
                          placeholder="Enter Transfer Reference"
                          value={transactionRef}
                          onChange={(e) => setTransactionRef(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}
                  </div>

                  {/* Crypto */}
                  <div
                    className={cn(
                      'rounded-xl border cursor-pointer transition-all',
                      payMethod === 'crypto' ? 'border-amber-500 bg-amber-500/5' : 'border-border hover:border-amber-500/30'
                    )}
                    onClick={() => setPayMethod('crypto')}
                  >
                    <div className="flex items-center gap-3 p-3">
                      <Bitcoin className="h-5 w-5 text-amber-500" />
                      <div className="flex-1">
                        <p className="font-medium text-sm text-foreground">Crypto (BTC / USDT)</p>
                        <p className="text-xs text-muted-foreground">🌍 Borderless • Binance Pay</p>
                      </div>
                    </div>
                    {payMethod === 'crypto' && (
                      <div className="px-3 pb-3 space-y-2 border-t border-border pt-3">
                        <div className="bg-background rounded-lg p-2 flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">Binance Pay ID</p>
                            <p className="font-mono font-semibold text-sm">{cryptoDetails.binanceIdMasked}</p>
                          </div>
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={(e) => { e.stopPropagation(); handleCopy(cryptoDetails.binanceId, 'Binance Pay ID'); }}>
                            <Copy className="h-3 w-3" /> Copy
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">Supported: USDT (TRC20 recommended), BTC, BEP20</p>
                        <Input
                          placeholder="Enter Txn Hash / Binance Order ID"
                          value={transactionRef}
                          onChange={(e) => setTransactionRef(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}
                  </div>

                  {/* International Card */}
                  <div
                    className={cn(
                      'rounded-xl border cursor-pointer transition-all border-border hover:border-primary/30 p-3'
                    )}
                    onClick={() => { toast.info('International card payments — contact support for details'); }}
                  >
                    <div className="flex items-center gap-3">
                      <Globe className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm text-foreground">International Card (Visa/MC)</p>
                        <p className="text-xs text-muted-foreground">🌍 All Countries — Contact support</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── SECURITY NOTE ── */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
                <Shield className="h-4 w-4 text-success shrink-0" />
                <span>256-bit SSL encrypted • PCI DSS compliant • No card data stored</span>
              </div>

              {/* ── SUBMIT BUTTON ── */}
              <Button
                className="w-full bg-orange-gradient hover:opacity-90 text-white h-12 text-base font-semibold"
                disabled={isSubmitting || finalAmount < 100 || (isManualMethod && !transactionRef.trim()) || (payMethod === 'upi' && !transactionRef.trim())}
                onClick={isManualMethod ? submitManualPayment : submitUpiPayment}
              >
                {payMethod === 'upi'
                  ? `Submit UPI Payment — ₹${finalAmount.toLocaleString()}`
                  : isManualMethod
                  ? `I've Made the Payment — ₹${finalAmount.toLocaleString()}`
                  : `Pay ₹${finalAmount.toLocaleString()}`}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
