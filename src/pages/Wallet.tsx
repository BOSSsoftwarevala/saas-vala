import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Wallet as WalletIcon,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Search,
  Loader2,
  Users,
  Settings,
  CreditCard,
  Smartphone,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useWallet } from '@/hooks/useWallet';
import { useInvoices } from '@/hooks/useInvoices';
import { useAuth } from '@/hooks/useAuth';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { AddCreditsModal } from '@/components/wallet/AddCreditsModal';
import { AdminWalletManager } from '@/components/wallet/AdminWalletManager';
import { AutoPaySettingsModal } from '@/components/wallet/AutoPaySettingsModal';
import { WalletStatsCards } from '@/components/wallet/WalletStatsCards';
import { InvoiceList } from '@/components/invoice/InvoiceList';
import { CreateInvoiceModal } from '@/components/invoice/CreateInvoiceModal';
import { InvoicePreview } from '@/components/invoice/InvoicePreview';
import { SignatureModal } from '@/components/invoice/SignatureModal';
import { Invoice } from '@/hooks/useInvoices';

const ITEMS_PER_PAGE = 25;

const transactionStatusStyles = {
  completed: 'bg-success/20 text-success border-success/30',
  pending: 'bg-warning/20 text-warning border-warning/30',
  failed: 'bg-destructive/20 text-destructive border-destructive/30',
  cancelled: 'bg-muted text-muted-foreground border-muted-foreground/30',
};

const paymentMethodIcons: Record<string, React.ReactNode> = {
  card: <CreditCard className="h-3 w-3" />,
  upi: <Smartphone className="h-3 w-3" />,
  international: <Globe className="h-3 w-3" />,
};

export default function Wallet() {
  const { 
    wallet, 
    transactions, 
    loading, 
    total, 
    fetchTransactions, 
    fetchWallet,
    activeLicenses,
    expiringLicenses,
    getLastPaymentStatus 
  } = useWallet();
  const { invoices, loading: invoicesLoading } = useInvoices();
  const { isSuperAdmin } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('transactions');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddCredits, setShowAddCredits] = useState(false);
  const [showAutoPaySettings, setShowAutoPaySettings] = useState(false);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);
  const [signatureInvoice, setSignatureInvoice] = useState<Invoice | null>(null);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const filteredTransactions = transactions.filter(
    (tx) =>
      tx.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate stats
  const thisMonthCredits = transactions
    .filter(t => t.type === 'credit' && t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0);
  
  const thisMonthDebits = transactions
    .filter(t => t.type === 'debit' && t.status === 'completed')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const pendingAmount = transactions
    .filter(t => t.status === 'pending')
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const lastPayment = getLastPaymentStatus();

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchTransactions(page, ITEMS_PER_PAGE);
  };

  const getPaymentMethod = (tx: typeof transactions[0]) => {
    const meta = tx.meta as Record<string, unknown> | null;
    return meta?.payment_method as string || null;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              Wallet & Billing
            </h2>
            <p className="text-muted-foreground">
              Manage your credits, invoices, and agreements
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={() => setShowAutoPaySettings(true)}
            >
              <Settings className="h-4 w-4" />
              Auto Pay
            </Button>
            <Button 
              className="bg-orange-gradient hover:opacity-90 text-white gap-2"
              onClick={() => setShowAddCredits(true)}
            >
              <Plus className="h-4 w-4" />
              Add Credits
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <WalletStatsCards
          balance={wallet?.balance || 0}
          loading={loading}
          thisMonthCredits={thisMonthCredits}
          thisMonthDebits={thisMonthDebits}
          pendingAmount={pendingAmount}
          lastPaymentStatus={lastPayment.status}
          lastPaymentAmount={lastPayment.amount}
          activeLicenses={activeLicenses}
          expiringLicenses={expiringLicenses}
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="glass-card rounded-xl p-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <TabsList className="bg-muted">
                <TabsTrigger value="transactions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Transactions
                </TabsTrigger>
                <TabsTrigger value="invoices" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Invoices
                </TabsTrigger>
                <TabsTrigger value="agreements" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Agreements
                </TabsTrigger>
                {isSuperAdmin && (
                  <TabsTrigger value="admin" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-1">
                    <Users className="h-3 w-3" />
                    All Wallets
                  </TabsTrigger>
                )}
              </TabsList>

              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-muted/50 border-border"
                />
              </div>
            </div>
          </div>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="mt-6">
            <div className="glass-card rounded-xl overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <WalletIcon className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-foreground mb-2">No transactions found</h3>
                  <p className="text-muted-foreground">Your transaction history will appear here</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-muted/50">
                        <TableHead className="text-muted-foreground">Description</TableHead>
                        <TableHead className="text-muted-foreground">Type</TableHead>
                        <TableHead className="text-muted-foreground">Product</TableHead>
                        <TableHead className="text-muted-foreground">Method</TableHead>
                        <TableHead className="text-muted-foreground">Date</TableHead>
                        <TableHead className="text-muted-foreground">Status</TableHead>
                        <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.map((tx) => {
                        const paymentMethod = getPaymentMethod(tx);
                        return (
                          <TableRow key={tx.id} className="border-border hover:bg-muted/30">
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div
                                  className={cn(
                                    'h-8 w-8 rounded-lg flex items-center justify-center',
                                    tx.type === 'credit' || tx.type === 'refund' ? 'bg-success/20' : 'bg-muted'
                                  )}
                                >
                                  {tx.type === 'credit' || tx.type === 'refund' ? (
                                    <ArrowUpRight className="h-4 w-4 text-success" />
                                  ) : (
                                    <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <span className="text-foreground">{tx.description || 'Transaction'}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {tx.type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {tx.reference_type === 'license' && tx.reference_id ? (
                                <Badge variant="outline" className="text-xs">
                                  License #{tx.reference_id.slice(0, 8)}
                                </Badge>
                              ) : tx.reference_type === 'product' && tx.reference_id ? (
                                <Badge variant="outline" className="text-xs">
                                  Product
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {paymentMethod ? (
                                <div className="flex items-center gap-1.5">
                                  {paymentMethodIcons[paymentMethod] || <CreditCard className="h-3 w-3" />}
                                  <span className="text-xs text-muted-foreground capitalize">{paymentMethod}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(tx.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={cn(transactionStatusStyles[tx.status])}
                              >
                                {tx.status}
                              </Badge>
                            </TableCell>
                            <TableCell
                              className={cn(
                                'text-right font-semibold',
                                tx.type === 'credit' || tx.type === 'refund' ? 'text-success' : 'text-foreground'
                              )}
                            >
                              {tx.type === 'credit' || tx.type === 'refund' ? '+' : '-'}₹{Math.abs(tx.amount).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={total}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={handlePageChange}
                  />
                </>
              )}
            </div>
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="mt-6">
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button 
                  className="bg-orange-gradient hover:opacity-90 text-white gap-2"
                  onClick={() => setShowCreateInvoice(true)}
                >
                  <Plus className="h-4 w-4" />
                  Create Invoice
                </Button>
              </div>
              <div className="glass-card rounded-xl overflow-hidden">
                <InvoiceList 
                  invoices={invoices} 
                  loading={invoicesLoading}
                  onView={(invoice) => setPreviewInvoice(invoice)}
                  onEdit={(invoice) => setPreviewInvoice(invoice)}
                  onRequestSignature={(invoice) => setSignatureInvoice(invoice)}
                />
              </div>
            </div>
          </TabsContent>

          {/* Agreements Tab */}
          <TabsContent value="agreements" className="mt-6">
            <div className="glass-card rounded-xl p-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-display text-lg font-bold text-foreground mb-2">
                No Agreements Yet
              </h3>
              <p className="text-muted-foreground mb-4">
                Upload contracts and agreements with your clients
              </p>
              <Button 
                className="bg-orange-gradient hover:opacity-90 text-white gap-2"
                onClick={() => toast.info('Agreement Upload', { description: 'Document upload feature coming soon. Contact support to share agreements.' })}
              >
                <Plus className="h-4 w-4" />
                Upload Agreement
              </Button>
            </div>
          </TabsContent>

          {/* Admin Wallets Tab */}
          {isSuperAdmin && (
            <TabsContent value="admin" className="mt-6">
              <AdminWalletManager />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Add Credits Modal */}
      <AddCreditsModal
        open={showAddCredits}
        onOpenChange={setShowAddCredits}
        onSuccess={fetchWallet}
      />

      {/* Auto Pay Settings Modal */}
      <AutoPaySettingsModal
        open={showAutoPaySettings}
        onOpenChange={setShowAutoPaySettings}
      />

      {/* Create Invoice Modal */}
      <CreateInvoiceModal
        open={showCreateInvoice}
        onOpenChange={setShowCreateInvoice}
      />

      {/* Invoice Preview Modal */}
      <InvoicePreview
        invoice={previewInvoice}
        open={!!previewInvoice}
        onOpenChange={(open) => !open && setPreviewInvoice(null)}
        onRequestSignature={(invoice) => {
          setPreviewInvoice(null);
          setSignatureInvoice(invoice);
        }}
      />

      {/* Signature Modal */}
      <SignatureModal
        invoice={signatureInvoice}
        open={!!signatureInvoice}
        onOpenChange={(open) => !open && setSignatureInvoice(null)}
      />
    </DashboardLayout>
  );
}
