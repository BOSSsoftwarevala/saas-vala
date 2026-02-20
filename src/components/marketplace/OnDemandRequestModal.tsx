import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Download, AlertTriangle, CheckCircle2, Loader2, CreditCard, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface OnDemandRequestModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productName?: string;
  productId?: string;
  productCategory?: string;
}

export function OnDemandRequestModal({
  open,
  onOpenChange,
  productName = '',
  productId,
  productCategory = '',
}: OnDemandRequestModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'form' | 'confirm' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    clientName: '',
    clientEmail: user?.email || '',
    clientPhone: '',
    requirements: '',
    advanceAmount: '499',
  });

  const handleSubmit = async () => {
    if (!form.clientName || !form.clientEmail) {
      toast.error('Name and email are required');
      return;
    }
    setStep('confirm');
  };

  const handleConfirmOrder = async () => {
    if (!user) {
      toast.error('Please sign in to place an order');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('ondemand_requests').insert({
        user_id: user.id,
        product_id: productId || null,
        product_name: productName,
        product_category: productCategory,
        client_name: form.clientName,
        client_email: form.clientEmail,
        client_phone: form.clientPhone,
        requirements: form.requirements,
        advance_amount: Number(form.advanceAmount),
        status: 'pending_payment',
      });

      if (error) throw error;
      setStep('success');
      toast.success('Order placed! Status: Pending Payment');
    } catch {
      toast.error('Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('form');
    setForm({ clientName: '', clientEmail: user?.email || '', clientPhone: '', requirements: '', advanceAmount: '499' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        {step === 'form' && (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Download className="h-5 w-5 text-primary" />
                Request Download
              </DialogTitle>
              <DialogDescription>
                {productName ? `Requesting: ${productName}` : 'Fill details to request this software'}
              </DialogDescription>
            </DialogHeader>

            {/* Advance payment notice */}
            <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg flex gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-warning">Advance Payment Required</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Orders are accepted only after advance payment. Without payment, the order stays in <strong>Pending Payment</strong> status.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs">Your Name *</Label>
                <Input
                  placeholder="Full name"
                  value={form.clientName}
                  onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Email *</Label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={form.clientEmail}
                  onChange={e => setForm(f => ({ ...f, clientEmail: e.target.value }))}
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <Input
                  placeholder="+91 9999999999"
                  value={form.clientPhone}
                  onChange={e => setForm(f => ({ ...f, clientPhone: e.target.value }))}
                  className="mt-1 h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Special Requirements</Label>
                <Textarea
                  placeholder="Any customization, specific modules, or additional requirements..."
                  value={form.requirements}
                  onChange={e => setForm(f => ({ ...f, requirements: e.target.value }))}
                  className="mt-1 text-sm resize-none"
                  rows={3}
                />
              </div>
              <div>
                <Label className="text-xs">Advance Payment Amount (₹) *</Label>
                <Input
                  type="number"
                  value={form.advanceAmount}
                  onChange={e => setForm(f => ({ ...f, advanceAmount: e.target.value }))}
                  className="mt-1 h-9 text-sm"
                  min="1"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Minimum ₹499 advance required</p>
              </div>
            </div>

            <Button className="w-full gap-2" onClick={handleSubmit}>
              <CreditCard className="h-4 w-4" />
              Proceed to Confirm
            </Button>
          </div>
        )}

        {step === 'confirm' && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle className="text-base">Confirm Your Order</DialogTitle>
              <DialogDescription>Review before submitting</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 p-4 bg-muted/30 rounded-xl border border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Product</span>
                <span className="font-semibold text-foreground text-right max-w-[60%]">{productName || 'On-Demand Software'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{form.clientName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium text-right">{form.clientEmail}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-border pt-3">
                <span className="text-muted-foreground">Advance Amount</span>
                <span className="text-xl font-black text-primary">₹{form.advanceAmount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Initial Status</span>
                <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px]">PENDING PAYMENT</Badge>
              </div>
            </div>

            <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg flex gap-2">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground">
                After submitting, our team will contact you with payment details. Once advance is received, status changes to <strong>Accepted</strong>.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep('form')}>
                Back
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleConfirmOrder}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {loading ? 'Submitting...' : 'Submit Order'}
              </Button>
            </div>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-4 py-4"
          >
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-foreground">Order Submitted!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your request for <strong>{productName}</strong> has been submitted.
              </p>
            </div>
            <Badge className="bg-warning/20 text-warning border-warning/30">
              STATUS: PENDING PAYMENT
            </Badge>
            <p className="text-xs text-muted-foreground">
              Our team will contact you at <strong>{form.clientEmail}</strong> with payment instructions within 24 hours.
            </p>
            <Button className="w-full" onClick={handleClose}>
              Close
            </Button>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}
