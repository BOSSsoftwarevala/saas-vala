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
  Download,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock data
const mockTransactions = [
  { id: '1', type: 'credit', description: 'Added credits', amount: 500, date: '2024-02-15', status: 'completed' },
  { id: '2', type: 'debit', description: 'License renewal - Enterprise CRM', amount: -299, date: '2024-02-14', status: 'completed' },
  { id: '3', type: 'debit', description: 'AI API usage', amount: -47.50, date: '2024-02-13', status: 'completed' },
  { id: '4', type: 'credit', description: 'Refund - Duplicate charge', amount: 149, date: '2024-02-12', status: 'completed' },
  { id: '5', type: 'debit', description: 'Server deployment', amount: -25, date: '2024-02-11', status: 'pending' },
];

const mockInvoices = [
  { id: 'INV-001', customer: 'Acme Corp', amount: 299, date: '2024-02-15', status: 'paid' },
  { id: 'INV-002', customer: 'TechStore Inc', amount: 149, date: '2024-02-14', status: 'paid' },
  { id: 'INV-003', customer: 'GlobalTech', amount: 498, date: '2024-02-13', status: 'pending' },
  { id: 'INV-004', customer: 'RetailHub', amount: 99, date: '2024-02-10', status: 'overdue' },
];

const invoiceStatusStyles = {
  paid: 'bg-success/20 text-success border-success/30',
  pending: 'bg-warning/20 text-warning border-warning/30',
  overdue: 'bg-destructive/20 text-destructive border-destructive/30',
};

export default function Wallet() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('transactions');

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
                  <p className="text-3xl font-bold font-display text-foreground">$2,847.50</p>
                  <p className="text-sm text-success flex items-center gap-1">
                    <ArrowUpRight className="h-4 w-4" />
                    +$500 this month
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
                  <p className="text-3xl font-bold font-display text-foreground">$421.50</p>
                  <p className="text-sm text-muted-foreground">8 transactions</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card-hover">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-normal">
                Pending Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-purple-gradient flex items-center justify-center glow-purple">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-3xl font-bold font-display text-foreground">$597</p>
                  <p className="text-sm text-warning">2 pending</p>
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
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-muted/50">
                    <TableHead className="text-muted-foreground">Description</TableHead>
                    <TableHead className="text-muted-foreground">Date</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockTransactions.map((tx) => (
                    <TableRow key={tx.id} className="border-border hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'h-8 w-8 rounded-lg flex items-center justify-center',
                              tx.type === 'credit' ? 'bg-success/20' : 'bg-muted'
                            )}
                          >
                            {tx.type === 'credit' ? (
                              <ArrowUpRight className="h-4 w-4 text-success" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <span className="text-foreground">{tx.description}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{tx.date}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            tx.status === 'completed'
                              ? 'bg-success/20 text-success border-success/30'
                              : 'bg-warning/20 text-warning border-warning/30'
                          )}
                        >
                          {tx.status}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right font-semibold',
                          tx.amount > 0 ? 'text-success' : 'text-foreground'
                        )}
                      >
                        {tx.amount > 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="mt-6">
            <div className="glass-card rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-muted/50">
                    <TableHead className="text-muted-foreground">Invoice</TableHead>
                    <TableHead className="text-muted-foreground">Customer</TableHead>
                    <TableHead className="text-muted-foreground">Date</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground text-right">Amount</TableHead>
                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockInvoices.map((invoice) => (
                    <TableRow key={invoice.id} className="border-border hover:bg-muted/30">
                      <TableCell>
                        <code className="text-sm font-mono text-primary">{invoice.id}</code>
                      </TableCell>
                      <TableCell className="text-foreground">{invoice.customer}</TableCell>
                      <TableCell className="text-muted-foreground">{invoice.date}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={invoiceStatusStyles[invoice.status as keyof typeof invoiceStatusStyles]}
                        >
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground">
                        ${invoice.amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Download className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
