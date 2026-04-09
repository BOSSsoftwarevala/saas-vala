import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Search,
  Lock,
  Unlock,
  Plus,
  Minus,
  Loader2,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Link as LinkIcon,
  Image as ImageIcon,
} from 'lucide-react';
import { useWallet, Wallet as WalletType } from '@/hooks/useWallet';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PendingPayment {
  id: string;
  wallet_id: string;
  type: 'credit' | 'debit';
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  description: string | null;
  reference_id: string | null;
  reference_type: string | null;
  created_by: string | null;
  created_at: string;
  meta: Record<string, any> | null;
}

export function AdminWalletManager() {
  const { allWallets, fetchAllWallets, addCredit, deductBalance } = useWallet();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'credit' | 'debit'>('credit');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [verifyingTxId, setVerifyingTxId] = useState<string | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [proofPreviewIsImage, setProofPreviewIsImage] = useState(false);

  const filteredWallets = allWallets.filter((wallet) =>
    wallet.user_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleLock = async (wallet: WalletType) => {
    setProcessing(true);
    const { error } = await supabase
      .from('wallets')
      .update({ is_locked: !wallet.is_locked })
      .eq('id', wallet.id);

    if (error) {
      toast.error('Failed to update wallet status');
    } else {
      toast.success(wallet.is_locked ? 'Wallet unlocked' : 'Wallet locked');
      await fetchAllWallets();
    }
    setProcessing(false);
  };

  const openAdjustModal = (wallet: WalletType, type: 'credit' | 'debit') => {
    setSelectedWallet(wallet);
    setAdjustmentType(type);
    setAdjustmentAmount('');
    setAdjustmentReason('');
    setShowAdjustModal(true);
  };

  const handleAdjustment = async () => {
    if (!selectedWallet || !adjustmentAmount || !adjustmentReason) {
      toast.error('Please fill all fields');
      return;
    }

    const amount = parseFloat(adjustmentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setProcessing(true);
    try {
      if (adjustmentType === 'credit') {
        await addCredit(selectedWallet.id, amount, `Admin adjustment: ${adjustmentReason}`);
      } else {
        await deductBalance(selectedWallet.id, amount, `Admin adjustment: ${adjustmentReason}`);
      }
      setShowAdjustModal(false);
    } catch (error) {
      // Error already handled in hook
    }
    setProcessing(false);
  };

  const fetchPendingPayments = async () => {
    const { data, error } = await (supabase as any)
      .from('transactions')
      .select('id,wallet_id,type,amount,status,description,reference_id,reference_type,created_by,created_at,meta')
      .in('type', ['credit', 'debit'])
      .eq('status', 'pending')
      .in('reference_type', ['wise_transfer', 'bank_transfer', 'upi', 'crypto_transfer', 'remit_transfer'])
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      toast.error('Failed to load pending payment proofs');
      return;
    }

    setPendingPayments((data || []) as PendingPayment[]);
  };

  const approvePendingPayment = async (tx: PendingPayment) => {
    setVerifyingTxId(tx.id);
    try {
      const approvedAmount = Number(tx.amount || 0);
      if (!Number.isFinite(approvedAmount) || approvedAmount <= 0) {
        throw new Error('Invalid payment amount');
      }

      let nextBalance: number | null = null;

      // Credit tx means wallet top-up. Debit tx means manual product purchase.
      if (tx.type === 'credit') {
        const { data: wallet, error: walletError } = await (supabase as any)
          .from('wallets')
          .select('id, balance')
          .eq('id', tx.wallet_id)
          .maybeSingle();

        if (walletError || !wallet) throw new Error('Wallet not found for this payment');

        nextBalance = Number(wallet.balance || 0) + approvedAmount;

        const { error: walletUpdateError } = await (supabase as any)
          .from('wallets')
          .update({ balance: nextBalance, updated_at: new Date().toISOString() })
          .eq('id', wallet.id);

        if (walletUpdateError) throw walletUpdateError;
      }

      const existingMeta = (tx.meta || {}) as Record<string, unknown>;
      const approvedMeta = {
        ...existingMeta,
        verification_required: false,
        verified: true,
        verified_at: new Date().toISOString(),
      };

      const { error: txUpdateError } = await (supabase as any)
        .from('transactions')
        .update({
          status: 'completed',
          balance_after: nextBalance,
          meta: approvedMeta,
        })
        .eq('id', tx.id)
        .eq('status', 'pending');

      if (txUpdateError) throw txUpdateError;

      const pendingOrderId = typeof existingMeta.pending_order_id === 'string' ? existingMeta.pending_order_id : null;
      if (pendingOrderId) {
        await (supabase as any)
          .from('marketplace_orders')
          .update({
            status: 'completed',
            transaction_id: tx.id,
            payment_method: String(existingMeta.payment_method || 'wise'),
            completed_at: new Date().toISOString(),
          })
          .eq('id', pendingOrderId)
          .eq('status', 'pending');
      }

          toast.success(tx.type === 'credit' ? 'Payment verified and wallet credited' : 'Payment verified and pending order activated');
      await fetchAllWallets();
      await fetchPendingPayments();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to verify payment');
    } finally {
      setVerifyingTxId(null);
    }
  };

  const rejectPendingPayment = async (tx: PendingPayment) => {
    setVerifyingTxId(tx.id);
    try {
      const existingMeta = (tx.meta || {}) as Record<string, unknown>;
      const rejectedMeta = {
        ...existingMeta,
        verification_required: false,
        verified: false,
        rejected_at: new Date().toISOString(),
      };

      const { error } = await (supabase as any)
        .from('transactions')
        .update({ status: 'failed', meta: rejectedMeta })
        .eq('id', tx.id)
        .eq('status', 'pending');

      if (error) throw error;

      const pendingOrderId = typeof existingMeta.pending_order_id === 'string' ? existingMeta.pending_order_id : null;
      if (pendingOrderId) {
        await (supabase as any)
          .from('marketplace_orders')
          .update({ status: 'cancelled' })
          .eq('id', pendingOrderId)
          .eq('status', 'pending');
      }

      toast.success('Payment marked as rejected');
      await fetchPendingPayments();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to reject payment');
    } finally {
      setVerifyingTxId(null);
    }
  };

  useEffect(() => {
    fetchPendingPayments();
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by user ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-muted/50 border-border"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Wallet className="h-4 w-4" />
          <span>{allWallets.length} total wallets</span>
        </div>
      </div>

      {/* Pending Payment Verification */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <p className="font-semibold text-foreground">Pending Payment Verification</p>
            <p className="text-xs text-muted-foreground">Verify reference/proof first, then approve to credit wallet</p>
          </div>
          <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30">
            {pendingPayments.length} pending
          </Badge>
        </div>

        {pendingPayments.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No pending Wise/UPI/manual payment proofs.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-muted/50">
                <TableHead className="text-muted-foreground">Method</TableHead>
                <TableHead className="text-muted-foreground">Amount</TableHead>
                <TableHead className="text-muted-foreground">Reference</TableHead>
                <TableHead className="text-muted-foreground">Proof</TableHead>
                <TableHead className="text-muted-foreground">Submitted</TableHead>
                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingPayments.map((tx) => {
                const paymentMethod = String(tx.meta?.payment_method || tx.reference_type || 'manual');
                const proofUrl = typeof tx.meta?.transaction_proof === 'string' ? tx.meta.transaction_proof : '';
                const isImageProof = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(proofUrl);
                const isPdfProof = /\.(pdf)(\?|$)/i.test(proofUrl);
                return (
                  <TableRow key={tx.id} className="border-border hover:bg-muted/30">
                    <TableCell className="capitalize">{paymentMethod.replace('_', ' ')}</TableCell>
                    <TableCell className="font-semibold">₹{Number(tx.amount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{tx.reference_id || '-'}</TableCell>
                    <TableCell>
                      {proofUrl ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          onClick={() => {
                            setProofPreviewUrl(proofUrl);
                            setProofPreviewIsImage(isImageProof);
                          }}
                        >
                          {isImageProof ? (
                            <><ImageIcon className="h-3 w-3" /> View image</>
                          ) : (
                            <><LinkIcon className="h-3 w-3" /> {isPdfProof ? 'View PDF' : 'View proof'}</>
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">No proof link</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          className="h-8 bg-success hover:bg-success/90 text-white"
                          onClick={() => approvePendingPayment(tx)}
                          disabled={verifyingTxId === tx.id}
                        >
                          {verifyingTxId === tx.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-destructive/40 text-destructive hover:bg-destructive/10"
                          onClick={() => rejectPendingPayment(tx)}
                          disabled={verifyingTxId === tx.id}
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Proof Preview Modal */}
      <Dialog open={!!proofPreviewUrl} onOpenChange={(open) => { if (!open) { setProofPreviewUrl(null); setProofPreviewIsImage(false); } }}>
        <DialogContent className="sm:max-w-3xl bg-background border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Payment Proof Preview</DialogTitle>
            <DialogDescription>Review the uploaded payment proof before approving.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/20 p-2">
            {proofPreviewUrl ? (
              proofPreviewIsImage ? (
                <img src={proofPreviewUrl} alt="Payment proof" className="w-full max-h-[70vh] object-contain rounded" />
              ) : (
                <iframe
                  src={proofPreviewUrl}
                  title="Payment proof"
                  className="w-full h-[70vh] rounded"
                />
              )
            ) : null}
          </div>
          {proofPreviewUrl && (
            <div className="flex justify-end">
              <a href={proofPreviewUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">Open in new tab</Button>
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="glass-card rounded-xl overflow-hidden">

        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-muted/50">
              <TableHead className="text-muted-foreground">User ID</TableHead>
              <TableHead className="text-muted-foreground">Balance</TableHead>
              <TableHead className="text-muted-foreground">Currency</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground">Created</TableHead>
              <TableHead className="text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredWallets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No wallets found</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredWallets.map((wallet) => (
                <TableRow key={wallet.id} className="border-border hover:bg-muted/30">
                  <TableCell className="font-mono text-xs text-foreground">
                    {wallet.user_id.slice(0, 8)}...
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      'font-semibold',
                      wallet.balance < 500 ? 'text-warning' : 'text-foreground'
                    )}>
                      ₹{wallet.balance.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{wallet.currency}</TableCell>
                  <TableCell>
                    {wallet.is_locked ? (
                      <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30">
                        <Lock className="h-3 w-3 mr-1" />
                        Locked
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(wallet.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-success hover:text-success"
                        onClick={() => openAdjustModal(wallet, 'credit')}
                        disabled={wallet.is_locked}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => openAdjustModal(wallet, 'debit')}
                        disabled={wallet.is_locked}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleToggleLock(wallet)}
                        disabled={processing}
                      >
                        {wallet.is_locked ? (
                          <Unlock className="h-4 w-4 text-success" />
                        ) : (
                          <Lock className="h-4 w-4 text-warning" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Adjustment Modal */}
      <Dialog open={showAdjustModal} onOpenChange={setShowAdjustModal}>
        <DialogContent className="sm:max-w-md bg-background border-border">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              {adjustmentType === 'credit' ? (
                <Plus className="h-5 w-5 text-success" />
              ) : (
                <Minus className="h-5 w-5 text-destructive" />
              )}
              {adjustmentType === 'credit' ? 'Add Credit' : 'Deduct Balance'}
            </DialogTitle>
            <DialogDescription>
              Adjusting wallet for user {selectedWallet?.user_id.slice(0, 8)}...
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {adjustmentType === 'debit' && selectedWallet && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 text-warning text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>Current balance: ₹{selectedWallet.balance.toLocaleString()}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                <Input
                  id="amount"
                  placeholder="Enter amount"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value.replace(/\D/g, ''))}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason (for audit log)</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for this adjustment..."
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjustModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdjustment}
              disabled={processing || !adjustmentAmount || !adjustmentReason}
              className={cn(
                adjustmentType === 'credit' 
                  ? 'bg-success hover:bg-success/90' 
                  : 'bg-destructive hover:bg-destructive/90',
                'text-white'
              )}
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {adjustmentType === 'credit' ? 'Add Credit' : 'Deduct Balance'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
