import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { toast } from 'sonner';
import { useProducts, type Product } from '@/hooks/useProducts';
import { useRealTimeStats } from '@/hooks/useRealTimeStats';
import { logProductActivity } from '@/hooks/useProductActions';
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

// Components
import { ProductSidebar, type ProductView } from '@/components/products/ProductSidebar';
import { ProductKPIBoxes } from '@/components/products/ProductKPIBoxes';
import { ProductControlBar } from '@/components/products/ProductControlBar';
import { LiveControlPanel } from '@/components/products/LiveControlPanel';
import { ProductTable } from '@/components/products/ProductTable';
import { ProductSlidePanel } from '@/components/products/ProductSlidePanel';
import { DemoSlidePanel } from '@/components/products/DemoSlidePanel';
import { ApkSlidePanel } from '@/components/products/ApkSlidePanel';
import { CategoryManager } from '@/components/products/CategoryManager';
import { DemoMapping } from '@/components/products/DemoMapping';
import { ApkMapping } from '@/components/products/ApkMapping';
import { LicenseMapping } from '@/components/products/LicenseMapping';
import { ValidationStatusCard } from '@/components/products/ValidationStatusCard';

export default function Products() {
  const { products, loading, fetchProducts, updateProduct, deleteProduct, suspendProduct, activateProduct } = useProducts();
  const { stats: realTimeStats, refetch: refetchStats } = useRealTimeStats();
  const [activeView, setActiveView] = useState<ProductView>('products');

  // Slide panel states
  const [productPanelOpen, setProductPanelOpen] = useState(false);
  const [demoPanelOpen, setDemoPanelOpen] = useState(false);
  const [apkPanelOpen, setApkPanelOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);

  // Stats from products (local fallback merged with realtime)
  const stats = {
    total: realTimeStats.totalProducts || products.length,
    active: realTimeStats.activeProducts || products.filter(p => p.status === 'active').length,
    draft: realTimeStats.draftProducts || products.filter(p => p.status === 'draft').length,
    suspended: realTimeStats.suspendedProducts || products.filter(p => p.status === 'suspended').length,
  };

  // KPI action handlers
  const handleKPIAction = (action: string) => {
    switch (action) {
      case 'add_product':
        setSelectedProduct(null);
        setProductPanelOpen(true);
        break;
      case 'view_all':
        setActiveView('products');
        break;
      case 'bulk_suspend':
        handleBulkSuspend();
        break;
      case 'edit_active':
        toast.info('Select a product from the table to edit');
        break;
      case 'approve_drafts':
        handleApproveDrafts();
        break;
      case 'delete_drafts':
        toast.info('Select draft products to delete');
        break;
      case 'activate_suspended':
        handleBulkActivate();
        break;
      case 'view_suspend_reason':
        toast.info('Select a suspended product to view reason');
        break;
      case 'add_demo':
        toast.info('Select a product first to add demo');
        break;
      case 'view_demos':
        setActiveView('demos');
        break;
      case 'open_demos':
        setActiveView('demos');
        break;
      case 'stop_demos':
        toast.info('Select demos to stop');
        break;
      case 'upload_apk':
        toast.info('Select a product first to upload APK');
        break;
      case 'manage_versions':
        setActiveView('apks');
        break;
      case 'mark_unstable':
        toast.info('Select an APK to mark as unstable');
        break;
      case 'rollback_apk':
        toast.info('Select an APK to rollback');
        break;
      case 'view_licenses':
        setActiveView('licenses');
        break;
      case 'block_license':
        toast.info('Select a license to block');
        break;
      case 'renew_licenses':
        toast.info('License renewal coming soon');
        break;
      case 'notify_expiring':
        toast.success('Expiry notifications sent');
        break;
      case 'redeploy_server':
        toast.info('Select a server to redeploy');
        break;
      case 'view_logs':
        toast.info('Select a product to view logs');
        break;
      case 'fix_with_ai':
        toast.info('AI fix feature coming soon');
        break;
      case 'view_error_report':
        toast.info('Error report coming soon');
        break;
      default:
        break;
    }
  };

  const handleBulkSuspend = async () => {
    const activeProducts = products.filter(p => p.status === 'active');
    for (const product of activeProducts) {
      await suspendProduct(product.id);
      await logProductActivity('suspend', product.id, { bulk: true });
    }
    toast.success(`${activeProducts.length} products suspended`);
    refetchStats();
  };

  const handleBulkActivate = async () => {
    const suspendedProducts = products.filter(p => p.status === 'suspended');
    for (const product of suspendedProducts) {
      await activateProduct(product.id);
      await logProductActivity('activate', product.id, { bulk: true });
    }
    toast.success(`${suspendedProducts.length} products activated`);
    refetchStats();
  };

  const handleApproveDrafts = async () => {
    const draftProducts = products.filter(p => p.status === 'draft');
    for (const product of draftProducts) {
      await updateProduct(product.id, { status: 'active' });
      await logProductActivity('approve', product.id, { from: 'draft', to: 'active' });
    }
    toast.success(`${draftProducts.length} products approved`);
    refetchStats();
  };

  const handleBulkImport = () => {
    toast.info('Bulk Import', { description: 'CSV import feature coming soon' });
  };

  const handleRefresh = () => {
    fetchProducts();
    refetchStats();
    toast.success('Data refreshed');
  };

  // Table action handlers
  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setProductPanelOpen(true);
  };

  const handleApprove = async (product: Product) => {
    await updateProduct(product.id, { status: 'active' });
    await logProductActivity('approve', product.id, { from: product.status, to: 'active' });
    refetchStats();
  };

  const handleSuspend = async (product: Product) => {
    await suspendProduct(product.id);
    await logProductActivity('suspend', product.id, { from: product.status, to: 'suspended' });
    refetchStats();
  };

  const handleActivate = async (product: Product) => {
    await activateProduct(product.id);
    await logProductActivity('activate', product.id, { from: product.status, to: 'active' });
    refetchStats();
  };

  const handleDelete = async () => {
    if (!deleteProductId) return;
    await logProductActivity('delete', deleteProductId, { action: 'permanent_delete' });
    await deleteProduct(deleteProductId);
    setDeleteProductId(null);
    refetchStats();
  };

  const handleAddDemo = (product: Product) => {
    setSelectedProduct(product);
    setDemoPanelOpen(true);
  };

  const handleUploadApk = (product: Product) => {
    setSelectedProduct(product);
    setApkPanelOpen(true);
  };

  const handleDeploy = (product: Product) => {
    toast.info('Deploy to Server', { description: `Deploying ${product.name}...` });
  };

  const handleViewLogs = (product: Product) => {
    toast.info('Product Logs', { description: `Viewing logs for ${product.name}` });
  };

  const handleFixWithAI = (product: Product) => {
    toast.info('AI Analysis', { description: `Analyzing ${product.name} for issues...` });
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
        return (
          <>
            {/* Validation Status */}
            <ValidationStatusCard />

            {/* KPI Boxes */}
            <ProductKPIBoxes
              totalProducts={stats.total}
              activeProducts={stats.active}
              draftProducts={stats.draft}
              suspendedProducts={stats.suspended}
              totalDemos={realTimeStats.totalDemos}
              liveDemos={realTimeStats.liveDemos}
              totalApks={realTimeStats.totalApks}
              stableApks={realTimeStats.stableApks}
              licensesIssued={realTimeStats.licensesIssued}
              expiringLicenses={realTimeStats.expiringLicenses}
              serverDeployments={realTimeStats.serverDeployments}
              productErrors={realTimeStats.productErrors}
              onAction={handleKPIAction}
            />

            {/* Product Table */}
            <ProductTable
              products={products}
              loading={loading}
              onEdit={handleEdit}
              onApprove={handleApprove}
              onSuspend={handleSuspend}
              onActivate={handleActivate}
              onDelete={(p) => setDeleteProductId(p.id)}
              onAddDemo={handleAddDemo}
              onUploadApk={handleUploadApk}
              onDeploy={handleDeploy}
              onViewLogs={handleViewLogs}
              onFixWithAI={handleFixWithAI}
            />
          </>
        );
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">
            Product Manager
          </h2>
          <p className="text-muted-foreground">
            Manage your products, demos, and APKs
          </p>
        </div>

        {/* Control Bar */}
        <ProductControlBar
          totalProducts={stats.total}
          activeProducts={stats.active}
          suspendedProducts={stats.suspended}
          draftProducts={stats.draft}
          onAddProduct={() => {
            setSelectedProduct(null);
            setProductPanelOpen(true);
          }}
          onBulkImport={handleBulkImport}
          onBulkSuspend={handleBulkSuspend}
          onBulkActivate={handleBulkActivate}
          onRefresh={handleRefresh}
        />

        {/* Main Layout */}
        <div className="flex gap-4">
          {/* Left Sub-Sidebar */}
          <ProductSidebar activeView={activeView} onViewChange={setActiveView} />

          {/* Center Content */}
          <div className="flex-1 space-y-4 min-w-0">
            {renderContent()}
          </div>

          {/* Right Live Panel */}
          <LiveControlPanel />
        </div>
      </div>

      {/* Slide Panels */}
      <ProductSlidePanel
        open={productPanelOpen}
        onOpenChange={setProductPanelOpen}
        product={selectedProduct}
        onSave={() => { fetchProducts(); refetchStats(); }}
      />

      <DemoSlidePanel
        open={demoPanelOpen}
        onOpenChange={setDemoPanelOpen}
        productId={selectedProduct?.id || null}
        demo={null}
        onSave={() => { fetchProducts(); refetchStats(); }}
      />

      <ApkSlidePanel
        open={apkPanelOpen}
        onOpenChange={setApkPanelOpen}
        productId={selectedProduct?.id || null}
        apk={null}
        onSave={() => { fetchProducts(); refetchStats(); }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteProductId} onOpenChange={() => setDeleteProductId(null)}>
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
