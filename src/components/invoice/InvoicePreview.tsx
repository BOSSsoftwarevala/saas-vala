import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Download, Printer, PenTool } from 'lucide-react';
import { Invoice } from '@/hooks/useInvoices';
import softwareValaLogo from '@/assets/softwarevala-logo.png';
import { cn } from '@/lib/utils';

interface InvoicePreviewProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestSignature?: (invoice: Invoice) => void;
}

const statusStyles: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending: 'bg-warning/20 text-warning',
  signed: 'bg-cyan/20 text-cyan',
  paid: 'bg-success/20 text-success',
};

export function InvoicePreview({ invoice, open, onOpenChange, onRequestSignature }: InvoicePreviewProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!invoice) return null;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoice.invoice_number}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; background: white; color: #1a1a1a; }
            .invoice-container { max-width: 800px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
            .logo { height: 50px; }
            .company-info { text-align: right; }
            .company-name { font-size: 24px; font-weight: bold; color: #f97316; }
            .invoice-title { font-size: 32px; font-weight: bold; margin-bottom: 8px; }
            .invoice-number { color: #666; }
            .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
            .party-label { font-size: 12px; color: #666; text-transform: uppercase; margin-bottom: 8px; }
            .party-name { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
            .party-detail { color: #666; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #f5f5f5; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666; }
            td { padding: 12px; border-bottom: 1px solid #eee; }
            .amount { text-align: right; }
            .totals { margin-left: auto; width: 300px; }
            .total-row { display: flex; justify-content: space-between; padding: 8px 0; }
            .total-row.final { border-top: 2px solid #1a1a1a; font-size: 18px; font-weight: bold; }
            .notes { margin-top: 40px; padding: 20px; background: #f9f9f9; border-radius: 8px; }
            .notes-title { font-weight: 600; margin-bottom: 8px; }
            .signature-box { margin-top: 40px; padding: 20px; border: 1px dashed #ccc; text-align: center; }
            .signature-img { max-height: 60px; margin: 10px 0; }
            .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Invoice Preview</DialogTitle>
            <div className="flex items-center gap-2">
              {invoice.status !== 'signed' && invoice.status !== 'paid' && onRequestSignature && (
                <Button variant="outline" size="sm" className="gap-1" onClick={() => onRequestSignature(invoice)}>
                  <PenTool className="h-3 w-3" /> Request Signature
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1" onClick={handlePrint}>
                <Printer className="h-3 w-3" /> Print
              </Button>
              <Button variant="outline" size="sm" className="gap-1">
                <Download className="h-3 w-3" /> PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Invoice Content */}
        <div ref={printRef} className="bg-white text-foreground p-8 rounded-lg">
          {/* Header */}
          <div className="flex justify-between items-start mb-10">
            <div>
              <img src={softwareValaLogo} alt="Software Vala" className="h-12 mb-4" />
              <p className="text-sm text-muted-foreground">Software Vala Private Limited</p>
              <p className="text-sm text-muted-foreground">Mumbai, India</p>
              <p className="text-sm text-muted-foreground">contact@softwarevala.com</p>
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-bold text-foreground mb-2">INVOICE</h1>
              <p className="text-lg font-mono text-primary">{invoice.invoice_number}</p>
              <Badge variant="outline" className={cn('mt-2', statusStyles[invoice.status])}>
                {invoice.status.toUpperCase()}
              </Badge>
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-10 mb-10">
            <div>
              <p className="text-xs text-muted-foreground uppercase mb-2">Bill To</p>
              <p className="text-lg font-semibold text-foreground">{invoice.customer_name}</p>
              <p className="text-sm text-muted-foreground">{invoice.customer_email}</p>
              {invoice.customer_phone && (
                <p className="text-sm text-muted-foreground">{invoice.customer_phone}</p>
              )}
              {invoice.customer_address && (
                <p className="text-sm text-muted-foreground mt-2">{invoice.customer_address}</p>
              )}
            </div>
            <div className="text-right">
              <div className="mb-4">
                <p className="text-xs text-muted-foreground uppercase mb-1">Invoice Date</p>
                <p className="text-foreground">{new Date(invoice.created_at).toLocaleDateString()}</p>
              </div>
              {invoice.due_date && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-1">Due Date</p>
                  <p className="text-foreground">{new Date(invoice.due_date).toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <table className="w-full mb-8">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left py-3 text-xs uppercase text-muted-foreground">Description</th>
                <th className="text-center py-3 text-xs uppercase text-muted-foreground">Qty</th>
                <th className="text-right py-3 text-xs uppercase text-muted-foreground">Rate</th>
                <th className="text-right py-3 text-xs uppercase text-muted-foreground">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, index) => (
                <tr key={index} className="border-b border-border">
                  <td className="py-3 text-foreground">{item.description}</td>
                  <td className="py-3 text-center text-muted-foreground">{item.quantity}</td>
                  <td className="py-3 text-right text-muted-foreground">₹{item.rate.toLocaleString()}</td>
                  <td className="py-3 text-right font-medium text-foreground">₹{item.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-72">
              <div className="flex justify-between py-2 text-muted-foreground">
                <span>Subtotal</span>
                <span>₹{invoice.subtotal.toLocaleString()}</span>
              </div>
              {invoice.tax_amount && invoice.tax_amount > 0 && (
                <div className="flex justify-between py-2 text-muted-foreground">
                  <span>Tax ({invoice.tax_percent}%)</span>
                  <span>₹{invoice.tax_amount.toLocaleString()}</span>
                </div>
              )}
              {invoice.discount_amount && invoice.discount_amount > 0 && (
                <div className="flex justify-between py-2 text-muted-foreground">
                  <span>Discount ({invoice.discount_percent}%)</span>
                  <span>-₹{invoice.discount_amount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between py-3 border-t-2 border-foreground font-bold text-lg">
                <span className="text-foreground">Total</span>
                <span className="text-primary">₹{invoice.total_amount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          {(invoice.notes || invoice.terms) && (
            <div className="bg-muted/30 rounded-lg p-4 mb-8">
              {invoice.notes && (
                <div className="mb-4">
                  <p className="font-semibold text-foreground mb-1">Notes</p>
                  <p className="text-sm text-muted-foreground">{invoice.notes}</p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <p className="font-semibold text-foreground mb-1">Terms & Conditions</p>
                  <p className="text-sm text-muted-foreground">{invoice.terms}</p>
                </div>
              )}
            </div>
          )}

          {/* Signature */}
          {invoice.signature_data && (
            <div className="border border-dashed border-border rounded-lg p-6 text-center mb-8">
              <p className="text-xs text-muted-foreground uppercase mb-2">Digital Signature</p>
              <img src={invoice.signature_data} alt="Signature" className="h-16 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                Signed on {invoice.signed_at ? new Date(invoice.signed_at).toLocaleString() : 'N/A'}
                {invoice.otp_verified && ' • OTP Verified ✓'}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
            <p>Thank you for your business!</p>
            <p className="mt-1">Software Vala • www.softwarevala.com • GST: XXXXXXXXX</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
