import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Key,
  Copy,
  Pause,
  Ban,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// Mock data
const mockKeys = [
  { id: '1', key: 'VALA-XXXX-XXXX-1234', product: 'Enterprise CRM', customer: 'Acme Corp', status: 'active', expiresAt: '2025-01-15', createdAt: '2024-01-15' },
  { id: '2', key: 'VALA-XXXX-XXXX-5678', product: 'Inventory Pro', customer: 'TechStore Inc', status: 'active', expiresAt: '2025-03-20', createdAt: '2024-01-20' },
  { id: '3', key: 'VALA-XXXX-XXXX-9012', product: 'Mobile POS', customer: 'RetailHub', status: 'suspended', expiresAt: '2024-12-01', createdAt: '2024-02-01' },
  { id: '4', key: 'VALA-XXXX-XXXX-3456', product: 'Enterprise CRM', customer: 'GlobalTech', status: 'blocked', expiresAt: '2024-06-10', createdAt: '2024-02-10' },
  { id: '5', key: 'VALA-XXXX-XXXX-7890', product: 'Analytics Dashboard', customer: 'DataWorks', status: 'expired', expiresAt: '2024-01-01', createdAt: '2023-12-01' },
];

const statusConfig = {
  active: { label: 'Active', style: 'bg-success/20 text-success border-success/30' },
  suspended: { label: 'Suspended', style: 'bg-warning/20 text-warning border-warning/30' },
  blocked: { label: 'Blocked', style: 'bg-destructive/20 text-destructive border-destructive/30' },
  expired: { label: 'Expired', style: 'bg-muted text-muted-foreground border-muted-foreground/30' },
};

export default function Keys() {
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const filteredKeys = mockKeys.filter(
    (key) =>
      key.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      key.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
      key.customer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const copyToClipboard = (key: string) => {
    navigator.clipboard.writeText(key);
    toast({
      title: 'Copied!',
      description: 'License key copied to clipboard.',
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              Key Management
            </h2>
            <p className="text-muted-foreground">
              Generate and manage license keys
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button className="bg-orange-gradient hover:opacity-90 text-white gap-2">
              <Plus className="h-4 w-4" />
              Generate Key
            </Button>
            <Button variant="outline" className="gap-2 border-border">
              <Plus className="h-4 w-4" />
              Bulk Generate
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-success">1,234</p>
            <p className="text-sm text-muted-foreground">Active</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-warning">56</p>
            <p className="text-sm text-muted-foreground">Suspended</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-destructive">12</p>
            <p className="text-sm text-muted-foreground">Blocked</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-muted-foreground">89</p>
            <p className="text-sm text-muted-foreground">Expired</p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by key, product, or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted/50 border-border"
              />
            </div>
            <Button variant="outline" size="icon" className="border-border">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Keys Table */}
        <div className="glass-card rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-muted/50">
                <TableHead className="text-muted-foreground">License Key</TableHead>
                <TableHead className="text-muted-foreground">Product</TableHead>
                <TableHead className="text-muted-foreground">Customer</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Expires</TableHead>
                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredKeys.map((keyItem) => {
                const status = statusConfig[keyItem.status as keyof typeof statusConfig];
                return (
                  <TableRow key={keyItem.id} className="border-border hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-primary" />
                        <code className="text-sm font-mono text-foreground">{keyItem.key}</code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(keyItem.key)}
                        >
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground">{keyItem.product}</TableCell>
                    <TableCell className="text-muted-foreground">{keyItem.customer}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={status.style}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{keyItem.expiresAt}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border">
                          <DropdownMenuItem className="gap-2 cursor-pointer">
                            <Pause className="h-4 w-4" /> Suspend
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer">
                            <Ban className="h-4 w-4" /> Block
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer">
                            <RefreshCw className="h-4 w-4" /> Renew
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer text-destructive">
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
