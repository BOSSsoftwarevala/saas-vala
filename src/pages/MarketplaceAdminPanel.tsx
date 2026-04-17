import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { marketplaceApi, MarketplaceProduct, MarketplaceCategory, MarketplaceOrder, MarketplaceReview } from '@/lib/marketplaceApi';
import { 
  Plus, Edit, Trash2, Eye, CheckCircle, XCircle, 
  Package, Folder, ShoppingCart, MessageSquare, Users,
  Loader2, Search, Filter, Download, TrendingUp, Star
} from 'lucide-react';

export default function MarketplaceAdminPanel() {
  const [activeTab, setActiveTab] = useState('products');
  const [loading, setLoading] = useState(false);
  
  // Products state
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [productForm, setProductForm] = useState<Partial<MarketplaceProduct>>({});
  
  // Categories state
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MarketplaceCategory | null>(null);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [categoryForm, setCategoryForm] = useState<Partial<MarketplaceCategory>>({});
  
  // Orders state
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<MarketplaceOrder | null>(null);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  
  // Reviews state
  const [reviews, setReviews] = useState<MarketplaceReview[]>([]);
  const [selectedReview, setSelectedReview] = useState<MarketplaceReview | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  
  // Search and filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, [activeTab]);

  // Real-time sync with Supabase
  useEffect(() => {
    let subscription: any;

    if (activeTab === 'products') {
      subscription = marketplaceApi.subscribeToProducts((payload) => {
        console.log('Product change:', payload);
        loadData();
      });
    }

    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'products':
          const productsData = await marketplaceApi.getProducts();
          setProducts(productsData);
          break;
        case 'categories':
          const categoriesData = await marketplaceApi.getCategories();
          setCategories(categoriesData);
          break;
        case 'orders':
          const ordersData = await marketplaceApi.getAllOrders();
          setOrders(ordersData);
          break;
        case 'reviews':
          const reviewsData = await marketplaceApi.getAllReviews();
          setReviews(reviewsData);
          break;
      }
    } catch (error) {
      toast.error('Failed to load data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Products CRUD
  const handleCreateProduct = () => {
    setSelectedProduct(null);
    setProductForm({
      title: '',
      slug: '',
      description: '',
      short_description: '',
      price: 0,
      currency: 'USD',
      is_active: true,
      is_approved: false,
      is_featured: false,
      tags: [],
      features: {},
      requirements: {},
      version: '1.0.0'
    });
    setShowProductDialog(true);
  };

  const handleEditProduct = (product: MarketplaceProduct) => {
    setSelectedProduct(product);
    setProductForm(product);
    setShowProductDialog(true);
  };

  const handleSaveProduct = async () => {
    setLoading(true);
    try {
      if (selectedProduct) {
        await marketplaceApi.updateProduct(selectedProduct.id, productForm);
        toast.success('Product updated successfully');
      } else {
        await marketplaceApi.createProduct(productForm);
        toast.success('Product created successfully');
      }
      setShowProductDialog(false);
      loadData();
    } catch (error) {
      toast.error('Failed to save product');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    setLoading(true);
    try {
      await marketplaceApi.deleteProduct(id);
      toast.success('Product deleted successfully');
      loadData();
    } catch (error) {
      toast.error('Failed to delete product');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleProductActive = async (product: MarketplaceProduct) => {
    setLoading(true);
    try {
      await marketplaceApi.updateProduct(product.id, { is_active: !product.is_active });
      toast.success('Product status updated');
      loadData();
    } catch (error) {
      toast.error('Failed to update product status');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleProductApproved = async (product: MarketplaceProduct) => {
    setLoading(true);
    try {
      await marketplaceApi.updateProduct(product.id, { is_approved: !product.is_approved });
      toast.success('Product approval status updated');
      loadData();
    } catch (error) {
      toast.error('Failed to update product approval');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Categories CRUD
  const handleCreateCategory = () => {
    setSelectedCategory(null);
    setCategoryForm({
      name: '',
      slug: '',
      description: '',
      icon: '',
      sort_order: 0,
      is_active: true
    });
    setShowCategoryDialog(true);
  };

  const handleEditCategory = (category: MarketplaceCategory) => {
    setSelectedCategory(category);
    setCategoryForm(category);
    setShowCategoryDialog(true);
  };

  const handleSaveCategory = async () => {
    setLoading(true);
    try {
      if (selectedCategory) {
        await marketplaceApi.updateCategory(selectedCategory.id, categoryForm);
        toast.success('Category updated successfully');
      } else {
        await marketplaceApi.createCategory(categoryForm);
        toast.success('Category created successfully');
      }
      setShowCategoryDialog(false);
      loadData();
    } catch (error) {
      toast.error('Failed to save category');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    setLoading(true);
    try {
      await marketplaceApi.deleteCategory(id);
      toast.success('Category deleted successfully');
      loadData();
    } catch (error) {
      toast.error('Failed to delete category');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Orders management
  const handleViewOrder = (order: MarketplaceOrder) => {
    setSelectedOrder(order);
    setShowOrderDialog(true);
  };

  const handleUpdateOrderStatus = async (order: MarketplaceOrder, status: string) => {
    setLoading(true);
    try {
      await marketplaceApi.updateOrder(order.id, { status });
      toast.success('Order status updated');
      loadData();
    } catch (error) {
      toast.error('Failed to update order status');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Reviews management
  const handleApproveReview = async (review: MarketplaceReview) => {
    setLoading(true);
    try {
      await marketplaceApi.approveReview(review.id);
      toast.success('Review approved');
      loadData();
    } catch (error) {
      toast.error('Failed to approve review');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReview = async (id: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return;
    
    setLoading(true);
    try {
      await marketplaceApi.deleteReview(id);
      toast.success('Review deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete review');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Filter functions
  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchesSearch = o.order_number.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

  const filteredReviews = useMemo(() => {
    return reviews.filter(r => 
      r.comment?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [reviews, searchQuery]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Marketplace Admin</h1>
            <p className="text-muted-foreground">Manage products, categories, orders, and reviews</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Refresh
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="products">
              <Package className="h-4 w-4 mr-2" />
              Products
            </TabsTrigger>
            <TabsTrigger value="categories">
              <Folder className="h-4 w-4 mr-2" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="orders">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="reviews">
              <MessageSquare className="h-4 w-4 mr-2" />
              Reviews
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Products ({filteredProducts.length})</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search products..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 w-64"
                      />
                    </div>
                    <Button onClick={handleCreateProduct}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Product
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Sales</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.title}</TableCell>
                        <TableCell>{product.category?.name || 'N/A'}</TableCell>
                        <TableCell>${product.price.toFixed(2)}</TableCell>
                        <TableCell>{product.sales_count}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            {product.rating_average.toFixed(1)} ({product.rating_count})
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Badge variant={product.is_active ? 'default' : 'secondary'}>
                              {product.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                            <Badge variant={product.is_approved ? 'default' : 'outline'}>
                              {product.is_approved ? 'Approved' : 'Pending'}
                            </Badge>
                            {product.is_featured && <Badge variant="secondary">Featured</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleEditProduct(product)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleToggleProductActive(product)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleToggleProductApproved(product)}>
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteProduct(product.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Categories ({categories.length})</CardTitle>
                  <Button onClick={handleCreateCategory}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Category
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Icon</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Sort Order</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell>{category.icon}</TableCell>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell>{category.slug}</TableCell>
                        <TableCell>{category.sort_order}</TableCell>
                        <TableCell>
                          <Badge variant={category.is_active ? 'default' : 'secondary'}>
                            {category.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleEditCategory(category)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteCategory(category.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Orders ({filteredOrders.length})</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search orders..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 w-64"
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="refunded">Refunded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>{order.product?.title || 'N/A'}</TableCell>
                        <TableCell>${order.amount.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={
                            order.status === 'completed' ? 'default' :
                            order.status === 'pending' ? 'secondary' :
                            order.status === 'cancelled' ? 'destructive' : 'outline'
                          }>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => handleViewOrder(order)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            {order.status === 'pending' && (
                              <Button size="sm" variant="ghost" onClick={() => handleUpdateOrderStatus(order, 'completed')}>
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Reviews ({filteredReviews.length})</CardTitle>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search reviews..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 w-64"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rating</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Comment</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReviews.map((review) => (
                      <TableRow key={review.id}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            {review.rating}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{review.title}</TableCell>
                        <TableCell className="max-w-xs truncate">{review.comment}</TableCell>
                        <TableCell>{review.product_id}</TableCell>
                        <TableCell>
                          <Badge variant={review.is_approved ? 'default' : 'secondary'}>
                            {review.is_approved ? 'Approved' : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {!review.is_approved && (
                              <Button size="sm" variant="ghost" onClick={() => handleApproveReview(review)}>
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteReview(review.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Product Dialog */}
        <Dialog open={showProductDialog} onOpenChange={setShowProductDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedProduct ? 'Edit Product' : 'Add Product'}</DialogTitle>
              <DialogDescription>
                {selectedProduct ? 'Update product details' : 'Create a new product'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={productForm.title || ''}
                  onChange={(e) => setProductForm({ ...productForm, title: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={productForm.slug || ''}
                  onChange={(e) => setProductForm({ ...productForm, slug: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="short_description">Short Description</Label>
                <Textarea
                  id="short_description"
                  value={productForm.short_description || ''}
                  onChange={(e) => setProductForm({ ...productForm, short_description: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={productForm.description || ''}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  rows={5}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="price">Price</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    value={productForm.price || 0}
                    onChange={(e) => setProductForm({ ...productForm, price: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    value={productForm.currency || 'USD'}
                    onChange={(e) => setProductForm({ ...productForm, currency: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select 
                  value={productForm.category_id || ''} 
                  onValueChange={(value) => setProductForm({ ...productForm, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveProduct} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : 'Save'}
                </Button>
                <Button variant="outline" onClick={() => setShowProductDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Category Dialog */}
        <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedCategory ? 'Edit Category' : 'Add Category'}</DialogTitle>
              <DialogDescription>
                {selectedCategory ? 'Update category details' : 'Create a new category'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={categoryForm.name || ''}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={categoryForm.slug || ''}
                  onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="icon">Icon</Label>
                <Input
                  id="icon"
                  value={categoryForm.icon || ''}
                  onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={categoryForm.description || ''}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="sort_order">Sort Order</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={categoryForm.sort_order || 0}
                  onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: parseInt(e.target.value) })}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveCategory} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : 'Save'}
                </Button>
                <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Order Dialog */}
        <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Order Details</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4">
                <div>
                  <Label>Order Number</Label>
                  <p className="font-medium">{selectedOrder.order_number}</p>
                </div>
                <div>
                  <Label>Product</Label>
                  <p className="font-medium">{selectedOrder.product?.title}</p>
                </div>
                <div>
                  <Label>Amount</Label>
                  <p className="font-medium">${selectedOrder.amount.toFixed(2)} {selectedOrder.currency}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge variant={
                    selectedOrder.status === 'completed' ? 'default' :
                    selectedOrder.status === 'pending' ? 'secondary' :
                    selectedOrder.status === 'cancelled' ? 'destructive' : 'outline'
                  }>
                    {selectedOrder.status}
                  </Badge>
                </div>
                <div>
                  <Label>Created</Label>
                  <p>{new Date(selectedOrder.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  {selectedOrder.status === 'pending' && (
                    <Button onClick={() => handleUpdateOrderStatus(selectedOrder, 'completed')}>
                      Mark Complete
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setShowOrderDialog(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
