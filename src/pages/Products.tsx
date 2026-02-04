import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Package,
  Eye,
  Edit,
  Trash2,
  Ban,
  Play,
  Loader2,
  Link2,
  Download,
  Key,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useProducts, type Product } from '@/hooks/useProducts';
import { PaginationControls } from '@/components/ui/pagination-controls';
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
import { ProductStatsCards } from '@/components/products/ProductStatsCards';
import { ProductSubNav, type ProductView } from '@/components/products/ProductSubNav';
import { CategoryManager } from '@/components/products/CategoryManager';
import { DemoMapping } from '@/components/products/DemoMapping';
import { ApkMapping } from '@/components/products/ApkMapping';
import { LicenseMapping } from '@/components/products/LicenseMapping';
import { supabase } from '@/integrations/supabase/client';

const statusStyles = {
  active: 'bg-success/20 text-success border-success/30',
  draft: 'bg-warning/20 text-warning border-warning/30',
  archived: 'bg-muted text-muted-foreground border-muted-foreground/30',
  suspended: 'bg-destructive/20 text-destructive border-destructive/30',
};

interface CategoryOption {
  id: string;
  name: string;
  parent_id: string | null;
}

export default function Products() {
  const { products, categories, loading, createProduct, updateProduct, deleteProduct, suspendProduct, activateProduct } = useProducts();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeView, setActiveView] = useState<ProductView>('products');
  const [statsFilter, setStatsFilter] = useState<string | null>(null);

  // Category hierarchy state
  const [masterCategories, setMasterCategories] = useState<CategoryOption[]>([]);
  const [subCategories, setSubCategories] = useState<CategoryOption[]>([]);
  const [microCategories, setMicroCategories] = useState<CategoryOption[]>([]);
  const [nanoCategories, setNanoCategories] = useState<CategoryOption[]>([]);
  const [totalCategories, setTotalCategories] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    price: 0,
    status: 'draft' as Product['status'],
    master_category: '',
    sub_category: '',
    micro_category: '',
    nano_category: '',
    version: '1.0.0',
  });

  // Fetch category counts and hierarchy
  useEffect(() => {
    const fetchCategoryData = async () => {
      const { data: allCategories, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (!error && allCategories) {
        setTotalCategories(allCategories.length);
        setMasterCategories(allCategories.filter(c => c.level === 'master'));
      }
    };
    fetchCategoryData();
  }, []);

  // Load dependent categories based on selection
  useEffect(() => {
    if (formData.master_category) {
      const loadSubCategories = async () => {
        const { data } = await supabase
          .from('categories')
          .select('*')
          .eq('level', 'sub')
          .eq('parent_id', formData.master_category)
          .eq('is_active', true);
        setSubCategories((data || []) as CategoryOption[]);
      };
      loadSubCategories();
    } else {
      setSubCategories([]);
    }
    setFormData(prev => ({ ...prev, sub_category: '', micro_category: '', nano_category: '' }));
  }, [formData.master_category]);

  useEffect(() => {
    if (formData.sub_category) {
      const loadMicroCategories = async () => {
        const { data } = await supabase
          .from('categories')
          .select('*')
          .eq('level', 'micro')
          .eq('parent_id', formData.sub_category)
          .eq('is_active', true);
        setMicroCategories((data || []) as CategoryOption[]);
      };
      loadMicroCategories();
    } else {
      setMicroCategories([]);
    }
    setFormData(prev => ({ ...prev, micro_category: '', nano_category: '' }));
  }, [formData.sub_category]);

  useEffect(() => {
    if (formData.micro_category) {
      const loadNanoCategories = async () => {
        const { data } = await supabase
          .from('categories')
          .select('*')
          .eq('level', 'nano')
          .eq('parent_id', formData.micro_category)
          .eq('is_active', true);
        setNanoCategories((data || []) as CategoryOption[]);
      };
      loadNanoCategories();
    } else {
      setNanoCategories([]);
    }
    setFormData(prev => ({ ...prev, nano_category: '' }));
  }, [formData.micro_category]);

  // Stats calculations
  const stats = {
    total: products.length,
    active: products.filter(p => p.status === 'active').length,
    suspended: products.filter(p => p.status === 'suspended').length,
    categories: totalCategories,
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || product.status === activeTab;
    const matchesStatsFilter = !statsFilter || 
      (statsFilter === 'active' && product.status === 'active') ||
      (statsFilter === 'suspended' && product.status === 'suspended');
    return matchesSearch && matchesTab && matchesStatsFilter;
  });

  const openCreateDialog = () => {
    setEditProduct(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      price: 0,
      status: 'draft',
      master_category: '',
      sub_category: '',
      micro_category: '',
      nano_category: '',
      version: '1.0.0',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setEditProduct(product);
    // For simplicity, we'll use nano_category as category_id (lowest level)
    setFormData({
      name: product.name,
      slug: product.slug,
      description: product.description || '',
      price: product.price,
      status: product.status,
      master_category: '',
      sub_category: '',
      micro_category: '',
      nano_category: product.category_id || '',
      version: product.version,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;
    setSubmitting(true);
    try {
      const slug = formData.slug || formData.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      // Use nano category as the final category_id
      const category_id = formData.nano_category || formData.micro_category || formData.sub_category || formData.master_category || null;
      
      if (editProduct) {
        await updateProduct(editProduct.id, { ...formData, slug, category_id });
      } else {
        await createProduct({ ...formData, slug, category_id });
      }
      setDialogOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteProduct(deleteId);
    setDeleteId(null);
  };

  const handleStatsFilterChange = (filter: string | null) => {
    if (filter === 'categories') {
      setActiveView('master');
      setStatsFilter(null);
    } else {
      setActiveView('products');
      setStatsFilter(filter);
    }
  };

  // Render content based on active view
  const renderContent = () => {
    switch (activeView) {
      case 'master':
        return <CategoryManager level="master" title="Master Categories" />;
      case 'sub':
        return <CategoryManager level="sub" title="Sub Categories" />;
      case 'micro':
        return <CategoryManager level="micro" title="Micro Categories" />;
      case 'nano':
        return <CategoryManager level="nano" title="Nano Categories" />;
      case 'demos':
        return <DemoMapping />;
      case 'apks':
        return <ApkMapping />;
      case 'licenses':
        return <LicenseMapping />;
      default:
        return renderProductList();
    }
  };

  const renderProductList = () => (
    <>
      {/* Filters */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
            <TabsList className="bg-muted">
              <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                All ({products.length})
              </TabsTrigger>
              <TabsTrigger value="active" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Active
              </TabsTrigger>
              <TabsTrigger value="draft" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Draft
              </TabsTrigger>
              <TabsTrigger value="suspended" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                Suspended
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
            <Button 
              variant="outline" 
              size="icon" 
              className="border-border"
              onClick={() => toast.info('Filter options coming soon')}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-foreground mb-2">No products found</h3>
            <p className="text-muted-foreground mb-4">Get started by adding your first product</p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-muted/50">
                  <TableHead className="text-muted-foreground">Name</TableHead>
                  <TableHead className="text-muted-foreground">Price</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Links</TableHead>
                  <TableHead className="text-muted-foreground">Version</TableHead>
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
                        <div>
                          <span className="font-medium text-foreground">{product.name}</span>
                          <p className="text-xs text-muted-foreground">{product.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {product.price > 0 ? (
                        <span className="font-semibold text-primary">₹{product.price}</span>
                      ) : (
                        <span className="text-muted-foreground">Free</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('capitalize', statusStyles[product.status])}>
                        {product.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Link2 className="h-3 w-3 text-muted-foreground" />
                        <Download className="h-3 w-3 text-muted-foreground" />
                        <Key className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground font-mono text-sm">{product.version}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">{new Date(product.created_at).toLocaleDateString()}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border-border">
                          <DropdownMenuItem 
                            className="gap-2 cursor-pointer"
                            onClick={() => toast.info('Product Details', { description: 'Full product view coming soon' })}
                          >
                            <Eye className="h-4 w-4" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => openEditDialog(product)}>
                            <Edit className="h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          {product.status === 'suspended' ? (
                            <DropdownMenuItem className="gap-2 cursor-pointer text-success" onClick={() => activateProduct(product.id)}>
                              <Play className="h-4 w-4" /> Activate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem className="gap-2 cursor-pointer text-warning" onClick={() => suspendProduct(product.id)}>
                              <Ban className="h-4 w-4" /> Suspend
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="gap-2 cursor-pointer text-destructive" onClick={() => setDeleteId(product.id)}>
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {products.length > 25 && (
              <PaginationControls
                currentPage={1}
                totalPages={Math.ceil(products.length / 25)}
                totalItems={products.length}
                itemsPerPage={25}
                onPageChange={() => {}}
              />
            )}
          </>
        )}
      </div>
    </>
  );

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
          {activeView === 'products' && (
            <Button onClick={openCreateDialog} className="bg-orange-gradient hover:opacity-90 text-white gap-2">
              <Plus className="h-4 w-4" />
              Add Product
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <ProductStatsCards
          totalProducts={stats.total}
          activeProducts={stats.active}
          suspendedProducts={stats.suspended}
          totalCategories={stats.categories}
          activeFilter={statsFilter}
          onFilterChange={handleStatsFilterChange}
        />

        {/* Sub Navigation */}
        <ProductSubNav activeView={activeView} onViewChange={setActiveView} />

        {/* Content */}
        {renderContent()}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
            <DialogDescription>
              {editProduct ? 'Update product details' : 'Create a new product in your catalog'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Product Name *</Label>
              <Input
                placeholder="Enterprise CRM"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                placeholder="enterprise-crm"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              />
            </div>
            
            {/* 4-Level Category Selection */}
            <div className="space-y-3 p-3 rounded-lg bg-muted/50">
              <Label className="text-sm font-medium">Category Hierarchy</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Master Category</Label>
                  <Select value={formData.master_category} onValueChange={(v) => setFormData({ ...formData, master_category: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select master" />
                    </SelectTrigger>
                    <SelectContent>
                      {masterCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Sub Category</Label>
                  <Select 
                    value={formData.sub_category} 
                    onValueChange={(v) => setFormData({ ...formData, sub_category: v })}
                    disabled={!formData.master_category}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sub" />
                    </SelectTrigger>
                    <SelectContent>
                      {subCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Micro Category</Label>
                  <Select 
                    value={formData.micro_category} 
                    onValueChange={(v) => setFormData({ ...formData, micro_category: v })}
                    disabled={!formData.sub_category}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select micro" />
                    </SelectTrigger>
                    <SelectContent>
                      {microCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Nano Category</Label>
                  <Select 
                    value={formData.nano_category} 
                    onValueChange={(v) => setFormData({ ...formData, nano_category: v })}
                    disabled={!formData.micro_category}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select nano" />
                    </SelectTrigger>
                    <SelectContent>
                      {nanoCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Price (₹)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Version</Label>
                <Input
                  placeholder="1.0.0"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as Product['status'] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Product description..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || !formData.name.trim()}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editProduct ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the product and all associated data.
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
    </DashboardLayout>
  );
}
