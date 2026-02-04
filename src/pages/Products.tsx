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
  Package,
  Upload,
  Eye,
  Edit,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock data
const mockProducts = [
  { id: '1', name: 'Enterprise CRM', type: 'product', price: 299, status: 'active', downloads: 156, createdAt: '2024-01-15' },
  { id: '2', name: 'Inventory Pro', type: 'product', price: 149, status: 'active', downloads: 89, createdAt: '2024-01-20' },
  { id: '3', name: 'Chat App Demo', type: 'demo', price: 0, status: 'active', downloads: 342, createdAt: '2024-02-01' },
  { id: '4', name: 'Mobile POS v2.1', type: 'apk', price: 99, status: 'active', downloads: 67, createdAt: '2024-02-10' },
  { id: '5', name: 'Analytics Dashboard', type: 'product', price: 199, status: 'draft', downloads: 0, createdAt: '2024-02-15' },
  { id: '6', name: 'E-commerce Starter', type: 'demo', price: 0, status: 'archived', downloads: 234, createdAt: '2023-12-01' },
];

const statusStyles = {
  active: 'bg-success/20 text-success border-success/30',
  draft: 'bg-warning/20 text-warning border-warning/30',
  archived: 'bg-muted text-muted-foreground border-muted-foreground/30',
};

const typeStyles = {
  product: 'bg-primary/20 text-primary border-primary/30',
  demo: 'bg-cyan/20 text-cyan border-cyan/30',
  apk: 'bg-purple/20 text-purple border-purple/30',
};

export default function Products() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const filteredProducts = mockProducts.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || product.type === activeTab;
    return matchesSearch && matchesTab;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              Product Manager
            </h2>
            <p className="text-muted-foreground">
              Manage your products, demos, and APKs
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button className="bg-orange-gradient hover:opacity-90 text-white gap-2">
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
            <Button variant="outline" className="gap-2 border-border">
              <Upload className="h-4 w-4" />
              Upload APK
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="glass-card rounded-xl p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
              <TabsList className="bg-muted">
                <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  All
                </TabsTrigger>
                <TabsTrigger value="product" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Products
                </TabsTrigger>
                <TabsTrigger value="demo" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Demos
                </TabsTrigger>
                <TabsTrigger value="apk" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  APKs
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
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
        </div>

        {/* Products Table */}
        <div className="glass-card rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-muted/50">
                <TableHead className="text-muted-foreground">Name</TableHead>
                <TableHead className="text-muted-foreground">Type</TableHead>
                <TableHead className="text-muted-foreground">Price</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Downloads</TableHead>
                <TableHead className="text-muted-foreground">Created</TableHead>
                <TableHead className="text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id} className="border-border hover:bg-muted/30">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <span className="font-medium text-foreground">{product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('capitalize', typeStyles[product.type as keyof typeof typeStyles])}>
                      {product.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {product.price > 0 ? (
                      <span className="font-semibold text-primary">${product.price}</span>
                    ) : (
                      <span className="text-muted-foreground">Free</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('capitalize', statusStyles[product.status as keyof typeof statusStyles])}>
                      {product.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">{product.downloads}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">{product.createdAt}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border-border">
                        <DropdownMenuItem className="gap-2 cursor-pointer">
                          <Eye className="h-4 w-4" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer">
                          <Edit className="h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer text-destructive">
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
