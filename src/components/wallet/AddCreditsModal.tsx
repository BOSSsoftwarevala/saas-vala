import { useRef, useState } from 'react';
import { usePaymentSettings } from '@/hooks/usePaymentSettings';
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
  Paperclip,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import softwareValaLogo from '@/assets/softwarevala-logo.png';
import { supabase } from '@/lib/supabase';

interface AddCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const presetAmounts = [500, 1000, 2000, 5000, 10000];

type PayMethod = 'upi' | 'bank' | 'wise' | 'remit' | 'crypto';

export function AddCreditsModal({ open, onOpenChange, onSuccess }: AddCreditsModalProps) {
  const { settings: ps, loading: psLoading, maskAccountNumber, maskIfsc, maskBinance } = usePaymentSettings();
  const [amount, setAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PayMethod>('wise');
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [transactionRef, setTransactionRef] = useState('');
  const [transactionProof, setTransactionProof] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'form' | 'processing' | 'success' | 'pending'>('form');
  const [retryCount, setRetryCount] = useState(0);

  const finalAmount = customAmount ? parseInt(customAmount) || 0 : amount;
  const isManualMethod = payMethod === 'bank' || payMethod === 'wise' || payMethod === 'remit' || payMethod === 'crypto';

  const handleCopyField = (value: string, label: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value.trim()) { toast.error(`${label} not configured`); return; }
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied!`);
  };

  /** Upload proof file to storage and return public URL, or null on failure. */
  const uploadProofFile = async (userId: string, txId: string): Promise<string | null> => {
    if (!proofFile) return transactionProof || null;
    setProofUploading(true);
    try {
      const ext = proofFile.name.split('.').pop() ?? 'jpg';
      const path = `${userId}/${txId}.${ext}`;
      const { error } = await supabase.storage
        .from('payment-proofs')
        .upload(path, proofFile, { upsert: true, contentType: proofFile.type });
      if (error) { console.warn('Proof upload failed:', error); return transactionProof || null; }
      const { data: signed } = await supabase.storage
        .from('payment-proofs')
        .createSignedUrl(path, 60 * 60 * 24 * 365); // 1-year link
      setProofUploading(false);
      return signed?.signedUrl ?? null;
    } catch (e) {
      console.warn('Proof upload error:', e);
      setProofUploading(false);
      return transactionProof || null;
    }
  };

  /** Call admin notification edge function (fire-and-forget). */
  const notifyAdmin = (txId: string, userEmail: string) => {
    supabase.functions.invoke('send-admin-notification', {
      body: {
        transaction_id: txId,
        amount: finalAmount,
        payment_method: payMethod,
        reference_id: transactionRef,
        user_email: userEmail,
        context: 'wallet_topup',
      },
    }).catch(() => { /* non-critical */ });
  };

  const handleClose = () => {
    setStep('form');
    setAmount(1000);
    setCustomAmount('');
    setPayMethod('wise');
    setTransactionRef('');
    setTransactionProof('');
    setProofFile(null);
    setRetryCount(0);
    setShowMoreOptions(false);
    onOpenChange(false);
  };

  const handleCopy = (text: string, label: string) => {
    if (!text.trim()) { toast.error(`${label} not configured`); return; }
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const submitManualPayment = async () => {
    const trimmedRef = transactionRef.trim();
    if (!trimmedRef) {
      toast.error('Transaction reference is required before submitting');
      return;
    }
    if (trimmedRef.length < 5) {
      toast.error('Transaction reference seems too short — please enter the full ID');
      return;
    }
    setStep('processing');
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: walletData } = await supabase
          .from('wallets')
          .select('id')
          .eq('user_id', userData.user.id)
          .maybeSingle();
        if (walletData) {
          // Insert transaction first to get ID for proof upload path
          const { data: tx, error: txErr } = await (supabase as any).from('transactions').insert({
            wallet_id: walletData.id,
            type: 'credit',
            amount: finalAmount,
            balance_after: null,
            status: 'pending',
            description: `${payMethod.toUpperCase()} Transfer - Awaiting Verification`,
            created_by: userData.user.id,
            reference_id: transactionRef,
            reference_type:
              payMethod === 'crypto'
                ? 'crypto_transfer'
                : payMethod === 'wise'
                ? 'wise_transfer'
                : payMethod === 'remit'
                ? 'remit_transfer'
                : 'bank_transfer',
            meta: {
              payment_method: payMethod,
              transaction_ref: transactionRef,
              transaction_proof: null,
              wise_payment_link: payMethod === 'wise' ? wiseDetails.payLink : null,
              verification_required: true,
            },
          }).select('id').single();

          if (!txErr && tx?.id) {
            // Upload proof file and patch transaction meta
            const proofUrl = await uploadProofFile(userData.user.id, tx.id);
            if (proofUrl) {
              await (supabase as any).from('transactions').update({
                meta: {
                  payment_method: payMethod,
                  transaction_ref: transactionRef,
                  transaction_proof: proofUrl,
                  wise_payment_link: payMethod === 'wise' ? wiseDetails.payLink : null,
                  verification_required: true,
                },
              }).eq('id', tx.id);
            }
            notifyAdmin(tx.id, userData.user.email ?? 'unknown');
          }
        }
      }
      setStep('pending');
    } catch {
      toast.error('Failed to submit. Please try again.');
      setStep('form');
    }
  };

  const submitUpiPayment = async () => {
    const trimmedRef = transactionRef.trim();
    if (!trimmedRef) {
      toast.error('UPI Transaction ID is required before submitting');
      return;
    }
    if (trimmedRef.length < 5) {
      toast.error('UPI Transaction ID seems too short — please check and re-enter');
      return;
    }
    setStep('processing');

    const processPayment = async (attempt: number): Promise<boolean> => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return false;

        const { data: walletData } = await supabase
          .from('wallets')
          .select('id, balance')
          .eq('user_id', userData.user.id)
          .maybeSingle();
        if (!walletData) return false;

        const newBalance = (walletData.balance || 0) + finalAmount;

        const { data: tx, error: txError } = await (supabase as any).from('transactions').insert({
          wallet_id: walletData.id,
          type: 'credit',
          amount: finalAmount,
          balance_after: newBalance,
          status: 'pending',
          description: 'UPI Payment - Pending Verification',
          created_by: userData.user.id,
          reference_id: transactionRef,
          reference_type: 'upi',
          meta: {
            payment_method: 'upi',
            upi_txn_id: transactionRef,
            transaction_proof: null,
            verification_required: true,
          },
        }).select('id').single();

        if (txError && attempt < 3) {
          setRetryCount(attempt);
          await new Promise(r => setTimeout(r, 1500));
          return processPayment(attempt + 1);
        }
        if (!txError && tx?.id) {
          const { data: authUser } = await supabase.auth.getUser();
          const proofUrl = await uploadProofFile(authUser.user?.id ?? 'anon', tx.id);
          if (proofUrl) {
            await (supabase as any).from('transactions').update({
              meta: {
                payment_method: 'upi',
                upi_txn_id: transactionRef,
                transaction_proof: proofUrl,
                verification_required: true,
              },
            }).eq('id', tx.id);
          }
          notifyAdmin(tx.id, authUser.user?.email ?? 'unknown');
        }
        return !txError;
      } catch {
        if (attempt < 3) {
          setRetryCount(attempt);
          await new Promise(r => setTimeout(r, 1500));
          return processPayment(attempt + 1);
        }
        return false;
      }
    };

    const success = await processPayment(1);
    if (success) {
      setStep('pending');
      onSuccess?.();
    } else {
      toast.error('Submission failed. Please try again.');
      setStep('form');
      setRetryCount(0);
    }
  };

  /** Shared proof file picker shown inside each payment method block. */
  const ProofUploadRow = () => (
    <div className="space-y-1">
      <input
        ref={proofInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setProofFile(f);
          if (f) setTransactionProof('');
        }}
      />
      {proofFile ? (
        <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2 text-xs">
          <Paperclip className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="flex-1 truncate text-foreground">{proofFile.name}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setProofFile(null); if (proofInputRef.current) proofInputRef.current.value = ''; }}
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); proofInputRef.current?.click(); }}
          className="w-full flex items-center gap-2 border border-dashed border-border rounded-lg px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
        >
          <Paperclip className="h-3.5 w-3.5 shrink-0" />
          Attach payment proof (screenshot / PDF) — optional but speeds up approval
        </button>
      )}
    </div>
  );

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

              {/* ── WISE PAYMENT (PRIMARY) ── */}
              <div
                className={cn(
                  'rounded-xl border-2 cursor-pointer transition-all',
                  payMethod === 'wise' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                )}
                onClick={() => setPayMethod('wise')}
              >
                <div className="flex items-center gap-3 p-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Send className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">Wise Payment</p>
                    <p className="text-xs text-muted-foreground">Global transfer with QR + direct pay link</p>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-primary/30">Primary</Badge>
                </div>

                {payMethod === 'wise' && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                    {psLoading ? (
                      <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(ps.wise_pay_link)}`}
                          alt="Wise payment QR"
                          className="h-28 w-28 rounded-lg border border-border bg-white p-1"
                        />
                        <div className="flex-1 space-y-2">
                          <p className="text-xs text-muted-foreground">Scan QR or open the payment link in Wise to pay.</p>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(ps.wise_pay_link, '_blank', 'noopener,noreferrer');
                              }}
                            >
                              Open Wise Link
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={handleCopyField(ps.wise_pay_link, 'Wise payment link')}
                            >
                              <Copy className="h-3 w-3" /> Copy Link
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    <Input
                      placeholder="Enter Wise transfer reference (required)"
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className={!transactionRef.trim() && step === 'form' ? '' : ''}
                    />
                    <ProofUploadRow />
                  </div>
                )}
              </div>

              {/* ── UPI PAYMENT ── */}
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
                  <Badge className="bg-muted text-muted-foreground border-border">Alternative</Badge>
                </div>

                {payMethod === 'upi' && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                    {psLoading ? (
                      <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    ) : (
                      <div className="bg-background rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">UPI ID</p>
                          <p className="font-mono font-semibold text-foreground">{ps.upi_id}</p>
                        </div>
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopyField(ps.upi_id, 'UPI ID')}>
                          <Copy className="h-3 w-3" /> Copy
                        </Button>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground text-center">
                      1. Open any UPI app → Send ₹{finalAmount.toLocaleString()} to above UPI ID<br />
                      2. Enter the Transaction ID below (required)
                    </p>
                    <Input
                      placeholder="UPI Transaction ID (required)"
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <ProofUploadRow />
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
                {showMoreOptions ? 'Hide' : 'More'} Payment Options (Bank / Remitly / Crypto / International)
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
                        {psLoading ? (
                          <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="bg-background rounded-lg p-2">
                                <p className="text-muted-foreground">Account Number</p>
                                <p className="font-mono font-semibold">{maskAccountNumber(ps.account_number)}</p>
                                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={handleCopyField(ps.account_number, 'Account Number')}>
                                  Copy
                                </Button>
                              </div>
                              <div className="bg-background rounded-lg p-2">
                                <p className="text-muted-foreground">IFSC Code</p>
                                <p className="font-mono font-semibold">{maskIfsc(ps.ifsc_code)}</p>
                                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={handleCopyField(ps.ifsc_code, 'IFSC Code')}>
                                  Copy
                                </Button>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                              <strong>Bank:</strong> {ps.bank_name} • <strong>Branch:</strong> {ps.branch_name} • <strong>A/C Name:</strong> {ps.account_name}
                            </div>
                          </>
                        )}
                        <Input
                          placeholder="UTR / Transaction Reference (required)"
                          value={transactionRef}
                          onChange={(e) => setTransactionRef(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <ProofUploadRow />
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
                        <p className="text-xs text-muted-foreground">{psLoading ? 'Loading...' : ps.remitly_note}</p>
                        {!psLoading && (
                          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                            <strong>Bank:</strong> {ps.bank_name} • <strong>A/C:</strong> {maskAccountNumber(ps.account_number)} • <strong>IFSC:</strong> {maskIfsc(ps.ifsc_code)}
                          </div>
                        )}
                        <Input
                          placeholder="Transfer Reference (required)"
                          value={transactionRef}
                          onChange={(e) => setTransactionRef(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <ProofUploadRow />
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
                        {psLoading ? (
                          <div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                        ) : (
                          <div className="bg-background rounded-lg p-2 flex items-center justify-between">
                            <div>
                              <p className="text-xs text-muted-foreground">Binance Pay ID</p>
                              <p className="font-mono font-semibold text-sm">{maskBinance(ps.binance_pay_id)}</p>
                            </div>
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopyField(ps.binance_pay_id, 'Binance Pay ID')}>
                              <Copy className="h-3 w-3" /> Copy
                            </Button>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">Supported: USDT (TRC20 recommended), BTC, BEP20</p>
                        <Input
                          placeholder="Txn Hash / Binance Order ID (required)"
                          value={transactionRef}
                          onChange={(e) => setTransactionRef(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <ProofUploadRow />
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
                disabled={finalAmount < 100 || (isManualMethod && !transactionRef.trim()) || (payMethod === 'upi' && !transactionRef.trim())}
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
