import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Send,
  CheckCircle,
  Download,
  FileText,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Invoice, useInvoices } from '@/hooks/useInvoices';

interface InvoiceListProps {
  invoices: Invoice[];
  loading: boolean;
  onView: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
}

const statusStyles: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground border-muted-foreground/30',
  pending: 'bg-warning/20 text-warning border-warning/30',
  signed: 'bg-cyan/20 text-cyan border-cyan/30',
  paid: 'bg-success/20 text-success border-success/30',
  overdue: 'bg-destructive/20 text-destructive border-destructive/30',
  cancelled: 'bg-muted text-muted-foreground border-muted-foreground/30',
};

export function InvoiceList({ invoices, loading, onView, onEdit }: InvoiceListProps) {
  const { deleteInvoice, sendInvoice, markAsPaid } = useInvoices();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteId) return;
    setActionLoading(deleteId);
    await deleteInvoice(deleteId);
    setDeleteId(null);
    setActionLoading(null);
  };

  const handleSend = async (id: string) => {
    setActionLoading(id);
    await sendInvoice(id);
    setActionLoading(null);
  };

  const handleMarkPaid = async (id: string) => {
    setActionLoading(id);
    await markAsPaid(id);
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-foreground mb-2">No invoices yet</h3>
        <p className="text-muted-foreground">Create your first invoice to get started</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-muted/50">
            <TableHead className="text-muted-foreground">Invoice #</TableHead>
            <TableHead className="text-muted-foreground">Customer</TableHead>
            <TableHead className="text-muted-foreground">Amount</TableHead>
            <TableHead className="text-muted-foreground">Status</TableHead>
            <TableHead className="text-muted-foreground">Date</TableHead>
            <TableHead className="text-muted-foreground">Due Date</TableHead>
            <TableHead className="text-muted-foreground text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id} className="border-border hover:bg-muted/30">
              <TableCell>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-mono text-foreground">{invoice.invoice_number}</span>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium text-foreground">{invoice.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{invoice.customer_email}</p>
                </div>
              </TableCell>
              <TableCell>
                <span className="font-semibold text-foreground">
                  {invoice.currency === 'INR' ? '₹' : '$'}{invoice.total_amount.toLocaleString()}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className={cn('capitalize', statusStyles[invoice.status])}>
                  {invoice.status}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(invoice.created_at).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '-'}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={actionLoading === invoice.id}>
                      {actionLoading === invoice.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-popover border-border">
                    <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => onView(invoice)}>
                      <Eye className="h-4 w-4" /> View
                    </DropdownMenuItem>
                    {invoice.status === 'draft' && (
                      <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => onEdit(invoice)}>
                        <Edit className="h-4 w-4" /> Edit
                      </DropdownMenuItem>
                    )}
                    {invoice.status === 'draft' && (
                      <DropdownMenuItem className="gap-2 cursor-pointer text-primary" onClick={() => handleSend(invoice.id)}>
                        <Send className="h-4 w-4" /> Send to Customer
                      </DropdownMenuItem>
                    )}
                    {(invoice.status === 'pending' || invoice.status === 'signed') && (
                      <DropdownMenuItem className="gap-2 cursor-pointer text-success" onClick={() => handleMarkPaid(invoice.id)}>
                        <CheckCircle className="h-4 w-4" /> Mark as Paid
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem className="gap-2 cursor-pointer">
                      <Download className="h-4 w-4" /> Download PDF
                    </DropdownMenuItem>
                    {invoice.status === 'draft' && (
                      <DropdownMenuItem className="gap-2 cursor-pointer text-destructive" onClick={() => setDeleteId(invoice.id)}>
                        <Trash2 className="h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The invoice will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
