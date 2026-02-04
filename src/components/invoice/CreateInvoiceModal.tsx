import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { useInvoices, InvoiceItem, InvoiceFormData } from '@/hooks/useInvoices';

interface CreateInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateInvoiceModal({ open, onOpenChange }: CreateInvoiceModalProps) {
  const { createInvoice } = useInvoices();
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<InvoiceFormData>({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_address: '',
    items: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
    tax_percent: 18,
    discount_percent: 0,
    notes: '',
    terms: 'Payment due within 30 days. All digital products are non-refundable.',
    due_date: ''
  });

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Recalculate amount
    if (field === 'quantity' || field === 'rate') {
      newItems[index].amount = Number(newItems[index].quantity) * Number(newItems[index].rate);
    }
    
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', quantity: 1, rate: 0, amount: 0 }]
    });
  };

  const removeItem = (index: number) => {
    if (formData.items.length === 1) return;
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => sum + item.amount, 0);
  };

  const calculateTax = () => {
    return (calculateSubtotal() * (formData.tax_percent || 0)) / 100;
  };

  const calculateDiscount = () => {
    return (calculateSubtotal() * (formData.discount_percent || 0)) / 100;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax() - calculateDiscount();
  };

  const handleSubmit = async () => {
    if (!formData.customer_name || !formData.customer_email) {
      return;
    }

    const validItems = formData.items.filter(item => item.description && item.amount > 0);
    if (validItems.length === 0) {
      return;
    }

    setSubmitting(true);
    try {
      await createInvoice({
        ...formData,
        items: validItems
      });
      onOpenChange(false);
      // Reset form
      setFormData({
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        customer_address: '',
        items: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
        tax_percent: 18,
        discount_percent: 0,
        notes: '',
        terms: 'Payment due within 30 days. All digital products are non-refundable.',
        due_date: ''
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>
            Create a professional invoice with Software Vala branding
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Customer Details */}
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Customer Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer Name *</Label>
                <Input
                  placeholder="John Doe"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  placeholder="john@example.com"
                  value={formData.customer_email}
                  onChange={(e) => setFormData({ ...formData, customer_email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  placeholder="+91 98765 43210"
                  value={formData.customer_phone}
                  onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                placeholder="Full address..."
                value={formData.customer_address}
                onChange={(e) => setFormData({ ...formData, customer_address: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-foreground">Line Items</h4>
              <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
                <Plus className="h-3 w-3" /> Add Item
              </Button>
            </div>
            
            <div className="space-y-3">
              {formData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5 space-y-1">
                    {index === 0 && <Label className="text-xs">Description</Label>}
                    <Input
                      placeholder="Product or service"
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {index === 0 && <Label className="text-xs">Qty</Label>}
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {index === 0 && <Label className="text-xs">Rate (₹)</Label>}
                    <Input
                      type="number"
                      min="0"
                      value={item.rate}
                      onChange={(e) => updateItem(index, 'rate', Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    {index === 0 && <Label className="text-xs">Amount</Label>}
                    <Input value={`₹${item.amount.toLocaleString()}`} disabled />
                  </div>
                  <div className="col-span-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive"
                      onClick={() => removeItem(index)}
                      disabled={formData.items.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">₹{calculateSubtotal().toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm items-center gap-4">
              <span className="text-muted-foreground">Tax (%)</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  className="w-20 h-8 text-right"
                  value={formData.tax_percent}
                  onChange={(e) => setFormData({ ...formData, tax_percent: Number(e.target.value) })}
                />
                <span className="text-foreground w-24 text-right">₹{calculateTax().toLocaleString()}</span>
              </div>
            </div>
            <div className="flex justify-between text-sm items-center gap-4">
              <span className="text-muted-foreground">Discount (%)</span>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  className="w-20 h-8 text-right"
                  value={formData.discount_percent}
                  onChange={(e) => setFormData({ ...formData, discount_percent: Number(e.target.value) })}
                />
                <span className="text-foreground w-24 text-right">-₹{calculateDiscount().toLocaleString()}</span>
              </div>
            </div>
            <div className="border-t border-border pt-2 flex justify-between font-semibold">
              <span className="text-foreground">Total</span>
              <span className="text-primary text-lg">₹{calculateTotal().toLocaleString()}</span>
            </div>
          </div>

          {/* Notes & Terms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Terms & Conditions</Label>
              <Textarea
                placeholder="Payment terms..."
                value={formData.terms}
                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !formData.customer_name || !formData.customer_email}
            className="bg-orange-gradient text-white"
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
