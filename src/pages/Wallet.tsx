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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Plus,
  Wallet as WalletIcon,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Search,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWallet } from '@/hooks/useWallet';
import { PaginationControls } from '@/components/ui/pagination-controls';

const ITEMS_PER_PAGE = 25;

const transactionStatusStyles = {
  completed: 'bg-success/20 text-success border-success/30',
  pending: 'bg-warning/20 text-warning border-warning/30',
  failed: 'bg-destructive/20 text-destructive border-destructive/30',
  cancelled: 'bg-muted text-muted-foreground border-muted-foreground/30',
};

export default function Wallet() {
  const { wallet, transactions, loading, total, fetchTransactions } = useWallet();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('transactions');
  const [currentPage, setCurrentPage] = useState(1);

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

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchTransactions(page, ITEMS_PER_PAGE);
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
          <Button className="bg-orange-gradient hover:opacity-90 text-white gap-2">
            <Plus className="h-4 w-4" />
            Add Credits
          </Button>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="glass-card-hover">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-normal">
                Current Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-orange-gradient flex items-center justify-center glow-orange">
                  <WalletIcon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-3xl font-bold font-display text-foreground">
                    {loading ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : (
                      `₹${(wallet?.balance || 0).toLocaleString()}`
                    )}
                  </p>
                  <p className="text-sm text-success flex items-center gap-1">
                    <ArrowUpRight className="h-4 w-4" />
                    +₹{thisMonthCredits.toLocaleString()} this month
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card-hover">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-normal">
                This Month's Spending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-cyan-gradient flex items-center justify-center glow-cyan">
                  <ArrowDownRight className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-3xl font-bold font-display text-foreground">
                    ₹{thisMonthDebits.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">{transactions.filter(t => t.type === 'debit').length} transactions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card-hover">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-normal">
                Pending Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-purple-gradient flex items-center justify-center glow-purple">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-3xl font-bold font-display text-foreground">₹{pendingAmount.toLocaleString()}</p>
                  <p className="text-sm text-warning">{transactions.filter(t => t.status === 'pending').length} pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
                        <TableHead className="text-muted-foreground">Date</TableHead>
                        <TableHead className="text-muted-foreground">Status</TableHead>
                        <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.map((tx) => (
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
                      ))}
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
            <div className="glass-card rounded-xl p-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-display text-lg font-bold text-foreground mb-2">
                Invoices Coming Soon
              </h3>
              <p className="text-muted-foreground mb-4">
                Invoice management will be available shortly
              </p>
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
              <Button className="bg-orange-gradient hover:opacity-90 text-white gap-2">
                <Plus className="h-4 w-4" />
                Upload Agreement
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
