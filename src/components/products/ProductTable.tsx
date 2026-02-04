import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Package,
  Edit,
  Check,
  Pause,
  Trash2,
  Link2,
  Download,
  Server,
  FileText,
  Search,
  Filter,
  AlertTriangle,
  Zap,
  Play,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Product } from '@/hooks/useProducts';

const statusStyles = {
  active: 'bg-success/20 text-success border-success/30',
  draft: 'bg-warning/20 text-warning border-warning/30',
  archived: 'bg-muted text-muted-foreground border-muted-foreground/30',
  suspended: 'bg-destructive/20 text-destructive border-destructive/30',
};

interface ProductTableProps {
  products: Product[];
  loading: boolean;
  onEdit: (product: Product) => void;
  onApprove: (product: Product) => void;
  onSuspend: (product: Product) => void;
  onActivate: (product: Product) => void;
  onDelete: (product: Product) => void;
  onAddDemo: (product: Product) => void;
  onUploadApk: (product: Product) => void;
  onDeploy: (product: Product) => void;
  onViewLogs: (product: Product) => void;
  onFixWithAI: (product: Product) => void;
}

export function ProductTable({
  products,
  loading,
  onEdit,
  onApprove,
  onSuspend,
  onActivate,
  onDelete,
  onAddDemo,
  onUploadApk,
  onDeploy,
  onViewLogs,
  onFixWithAI,
}: ProductTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || product.status === activeTab;
    return matchesSearch && matchesTab;
  });

  if (loading) {
    return (
      <div className="glass-card rounded-xl p-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
            <TabsList className="bg-muted">
              <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                All ({products.length})
              </TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="draft">Draft</TabsTrigger>
              <TabsTrigger value="suspended">Suspended</TabsTrigger>
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

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-foreground mb-2">No products found</h3>
            <p className="text-muted-foreground">Try adjusting your search or filters</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-muted/50">
                <TableHead className="text-muted-foreground w-[200px]">Product</TableHead>
                <TableHead className="text-muted-foreground">Category</TableHead>
                <TableHead className="text-muted-foreground text-center">Status</TableHead>
                <TableHead className="text-muted-foreground text-center">Demo</TableHead>
                <TableHead className="text-muted-foreground text-center">APK</TableHead>
                <TableHead className="text-muted-foreground text-center">Server</TableHead>
                <TableHead className="text-muted-foreground text-center">Licenses</TableHead>
                <TableHead className="text-muted-foreground text-center">Health</TableHead>
                <TableHead className="text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => {
                const hasError = product.status === 'suspended' || product.health_status === 'error';
                
                return (
                  <TableRow 
                    key={product.id} 
                    className={cn(
                      'border-border hover:bg-muted/30',
                      hasError && 'bg-destructive/5'
                    )}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{product.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{product.product_code}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {product.category_id ? '4-Level' : 'None'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={cn('capitalize', statusStyles[product.status])}>
                        {product.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-xs">
                        <Link2 className="h-3 w-3 mr-1" />{product.demo_count || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-xs">
                        <Download className="h-3 w-3 mr-1" />v{product.version} ({product.apk_count || 0})
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant="secondary" 
                        className={cn(
                          'text-xs',
                          (product.server_count || 0) > 0 ? 'text-success' : 'text-muted-foreground'
                        )}
                      >
                        <Server className="h-3 w-3 mr-1" />{(product.server_count || 0) > 0 ? 'Live' : '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-xs">
                        {product.license_count || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {product.health_status === 'error' ? (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />Error
                        </Badge>
                      ) : product.health_status === 'warning' ? (
                        <Badge variant="outline" className="text-xs text-warning border-warning/30">
                          <AlertTriangle className="h-3 w-3 mr-1" />Warning
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-success border-success/30">
                          OK
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Edit"
                          onClick={() => onEdit(product)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        {product.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-success"
                            title="Approve"
                            onClick={() => onApprove(product)}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {product.status === 'active' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-warning"
                            title="Suspend"
                            onClick={() => onSuspend(product)}
                          >
                            <Pause className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {product.status === 'suspended' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-success"
                            title="Activate"
                            onClick={() => onActivate(product)}
                          >
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          title="Delete"
                          onClick={() => onDelete(product)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-blue-500"
                          title="Add Demo"
                          onClick={() => onAddDemo(product)}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-purple-500"
                          title="Upload APK"
                          onClick={() => onUploadApk(product)}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-indigo-500"
                          title="Deploy"
                          onClick={() => onDeploy(product)}
                        >
                          <Server className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="View Logs"
                          onClick={() => onViewLogs(product)}
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                        {hasError && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-primary"
                            title="Fix with AI"
                            onClick={() => onFixWithAI(product)}
                          >
                            <Zap className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
