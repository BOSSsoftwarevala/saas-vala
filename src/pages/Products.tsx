import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Upload,
  Eye,
  Edit,
  Trash2,
  Ban,
  Play,
  Loader2,
  Github,
  GitBranch,
  Lock,
  Globe,
  Rocket,
  Store,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
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
import { toast } from 'sonner';

const statusStyles = {
  active: 'bg-success/20 text-success border-success/30',
  draft: 'bg-warning/20 text-warning border-warning/30',
  archived: 'bg-muted text-muted-foreground border-muted-foreground/30',
  suspended: 'bg-destructive/20 text-destructive border-destructive/30',
};

const deployStyles: Record<string, string> = {
  idle: 'bg-muted text-muted-foreground',
  building: 'bg-warning/20 text-warning',
  deployed: 'bg-success/20 text-success',
  failed: 'bg-destructive/20 text-destructive',
};

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string;
  default_branch: string;
  updated_at: string;
  language: string;
  html_url: string;
}

export default function Products() {
  const navigate = useNavigate();
  const { products, categories, loading, createProduct, updateProduct, deleteProduct, suspendProduct, activateProduct } = useProducts();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Git import state
  const [gitDialogOpen, setGitDialogOpen] = useState(false);
  const [gitRepos, setGitRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [importingRepos, setImportingRepos] = useState<Set<number>>(new Set());
  const [gitConnected] = useState(true); // Always true - uses server tokens

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    price: 0,
    status: 'draft' as Product['status'],
    category_id: '',
    version: '1.0.0',
  });

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || product.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const openCreateDialog = () => {
    setEditProduct(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      price: 0,
      status: 'draft',
      category_id: '',
      version: '1.0.0',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setEditProduct(product);
    setFormData({
      name: product.name,
      slug: product.slug,
      description: product.description || '',
      price: product.price,
      status: product.status,
      category_id: product.category_id || '',
      version: product.version,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;
    setSubmitting(true);
    try {
      const slug = formData.slug || formData.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      if (editProduct) {
        await updateProduct(editProduct.id, { ...formData, slug });
      } else {
        await createProduct({ ...formData, slug });
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

  // Git import functions - uses server-side tokens, no OAuth needed
  const openGitImport = async () => {
    setGitDialogOpen(true);
    await fetchGitRepos();
  };

  const fetchGitRepos = async () => {
    setLoadingRepos(true);
    try {
      const { data, error } = await supabase.functions.invoke('github-connect', {
        body: { action: 'repos' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error('Failed to fetch repos');
      setGitRepos(data.repos || []);
    } catch (error) {
      toast.error('Failed to fetch repositories');
      console.error(error);
    } finally {
      setLoadingRepos(false);
    }
  };

  const importRepoAsProduct = async (repo: GitHubRepo) => {
    // Check if already imported
    const alreadyExists = products.some(
      (p) => p.git_repo_url === repo.html_url || p.git_repo_name === repo.full_name
    );
    if (alreadyExists) {
      toast.info(`"${repo.name}" is already imported as a product.`);
      return;
    }

    setImportingRepos((prev) => new Set(prev).add(repo.id));
    try {
      await createProduct({
        name: repo.name.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        slug: repo.name.toLowerCase(),
        description: repo.description || `Imported from GitHub: ${repo.full_name}`,
        git_repo_url: repo.html_url,
        git_repo_name: repo.full_name,
        git_default_branch: repo.default_branch,
        deploy_status: 'idle',
        status: 'draft',
        price: 0,
      });
      toast.success(`Imported "${repo.name}" as product`);
    } catch {
      toast.error(`Failed to import "${repo.name}"`);
    } finally {
      setImportingRepos((prev) => {
        const next = new Set(prev);
        next.delete(repo.id);
        return next;
      });
    }
  };

  const importAllRepos = async () => {
    const unimported = gitRepos.filter(
      (repo) => !products.some((p) => p.git_repo_url === repo.html_url || p.git_repo_name === repo.full_name)
    );
    if (unimported.length === 0) {
      toast.info('All repositories are already imported.');
      return;
    }
    for (const repo of unimported) {
      await importRepoAsProduct(repo);
    }
  };

  const isRepoImported = (repo: GitHubRepo) =>
    products.some((p) => p.git_repo_url === repo.html_url || p.git_repo_name === repo.full_name);

  const toggleMarketplace = async (product: Product) => {
    await updateProduct(product.id, { marketplace_visible: !product.marketplace_visible } as any);
  };

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
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={openGitImport} variant="outline" className="gap-2 border-border">
              <Github className="h-4 w-4" />
              Import from Git
              {gitConnected && <CheckCircle2 className="h-3 w-3 text-success" />}
            </Button>
            <Button onClick={() => navigate('/admin/add-product')} className="bg-orange-gradient hover:opacity-90 text-white gap-2">
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
              <Button variant="outline" size="icon" className="border-border">
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
              <p className="text-muted-foreground mb-4">Import from Git or add manually</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={openGitImport} className="gap-2">
                  <Github className="h-4 w-4" />
                  Import from Git
                </Button>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-muted/50">
                    <TableHead className="text-muted-foreground">Name</TableHead>
                    <TableHead className="text-muted-foreground">Source</TableHead>
                    <TableHead className="text-muted-foreground">Price</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Deploy</TableHead>
                    <TableHead className="text-muted-foreground">Marketplace</TableHead>
                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id} className="border-border hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                            {product.git_repo_url ? (
                              <Github className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <Package className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <span className="font-medium text-foreground">{product.name}</span>
                            <p className="text-xs text-muted-foreground">{product.slug}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {product.git_repo_name ? (
                          <div className="flex items-center gap-1.5">
                            <GitBranch className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                              {product.git_repo_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Manual</span>
                        )}
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
                        <Badge variant="outline" className={cn('capitalize text-xs', deployStyles[product.deploy_status || 'idle'])}>
                          {product.deploy_status || 'idle'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => toggleMarketplace(product)}
                        >
                          <Store className={cn('h-3 w-3', product.marketplace_visible ? 'text-success' : 'text-muted-foreground')} />
                          {product.marketplace_visible ? 'Listed' : 'Hidden'}
                        </Button>
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
                            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => openEditDialog(product)}>
                              <Edit className="h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            {product.git_repo_url && (
                              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => window.open(product.git_repo_url!, '_blank')}>
                                <ExternalLink className="h-4 w-4" /> Open Repo
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="gap-2 cursor-pointer">
                              <Rocket className="h-4 w-4" /> Deploy
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
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
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
            {categories.length > 0 && (
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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

      {/* Import from Git Dialog */}
      <Dialog open={gitDialogOpen} onOpenChange={setGitDialogOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              Import from Git Repository
            </DialogTitle>
            <DialogDescription>
              Select repositories to auto-create as products. Each repo becomes a deployable product.
            </DialogDescription>
          </DialogHeader>

          {loadingRepos ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : gitRepos.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No repositories found. Make sure your GitHub is connected in Servers → Git.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{gitRepos.length} repositories found</span>
                <Button size="sm" variant="outline" onClick={importAllRepos} className="gap-1 text-xs">
                  <Plus className="h-3 w-3" />
                  Import All
                </Button>
              </div>
              <ScrollArea className="h-[350px] border border-border rounded-lg">
                <div className="divide-y divide-border">
                  {gitRepos.map((repo) => {
                    const imported = isRepoImported(repo);
                    const importing = importingRepos.has(repo.id);
                    return (
                      <div key={repo.id} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {repo.private ? (
                              <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                            ) : (
                              <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                            )}
                            <span className="font-medium text-foreground text-sm truncate">{repo.name}</span>
                            {repo.language && (
                              <Badge variant="outline" className="text-[10px] border-border shrink-0">
                                {repo.language}
                              </Badge>
                            )}
                          </div>
                          {repo.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{repo.description}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            <GitBranch className="h-2.5 w-2.5 inline mr-0.5" />
                            {repo.default_branch}
                          </p>
                        </div>
                        <div className="shrink-0 ml-3">
                          {imported ? (
                            <Badge variant="outline" className="bg-success/20 text-success border-success/30 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Imported
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              disabled={importing}
                              onClick={() => importRepoAsProduct(repo)}
                            >
                              {importing ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Plus className="h-3 w-3" />
                              )}
                              Import
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setGitDialogOpen(false)}>Close</Button>
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
