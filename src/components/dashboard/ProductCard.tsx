import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Package, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ProductActionModal } from '@/components/dashboard/ProductActionModal';
import { toast } from 'sonner';
import type { DashboardProduct } from '@/lib/dashboardApi';

interface ProductCardProps {
  product?: DashboardProduct | null;
  name?: string;
  description?: string;
  price?: number;
  status?: 'active' | 'draft' | 'archived';
  type?: 'product' | 'demo' | 'apk';
  onClick?: () => void;
  onEdit?: (product: Partial<DashboardProduct>) => Promise<void>;
  onDelete?: (productId: string) => Promise<void>;
  onDeploy?: (productId: string, serverId: string) => Promise<void>;
  servers?: Array<{ id: string; name: string }>;
}

const statusStyles = {
  active: 'bg-success/20 text-success border-success/30',
  draft: 'bg-warning/20 text-warning border-warning/30',
  archived: 'bg-muted text-muted-foreground border-muted-foreground/30',
  inactive: 'bg-destructive/20 text-destructive border-destructive/30',
};

const typeStyles = {
  product: 'border-l-primary',
  demo: 'border-l-cyan',
  apk: 'border-l-purple',
};

export function ProductCard({
  product,
  name: legacyName,
  description: legacyDescription,
  price: legacyPrice,
  status: legacyStatus,
  type: legacyType,
  onClick,
  onEdit,
  onDelete,
  onDeploy,
  servers = [],
}: ProductCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<'view' | 'edit' | 'deploy' | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Use product object if available, otherwise fall back to legacy props
  const displayProduct = product || {
    id: '',
    name: legacyName || '',
    description: legacyDescription || '',
    price: legacyPrice || 0,
    status: (legacyStatus as 'active' | 'draft' | 'archived') || 'active',
    created_at: new Date().toISOString(),
  };

  const displayName = product?.name || legacyName || '';
  const displayDescription = product?.description || legacyDescription;
  const displayPrice = product?.price ?? legacyPrice;
  const displayStatus = (product?.status as 'active' | 'draft' | 'archived' | 'inactive') || legacyStatus || 'active';
  const displayType = legacyType || 'product';

  const handleOpenModal = (action: 'view' | 'edit' | 'deploy') => {
    setModalAction(action);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!product?.id || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(product.id);
      toast.success('Product deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          'glass-card-hover min-w-[280px] max-w-[280px] rounded-xl p-4 border-l-4 cursor-pointer',
          typeStyles[displayType]
        )}
        onClick={onClick}
      >
        <div className="mb-3 flex items-start justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-border bg-popover">
              <DropdownMenuItem onClick={() => handleOpenModal('view')}>View</DropdownMenuItem>
              {onEdit && <DropdownMenuItem onClick={() => handleOpenModal('edit')}>Edit</DropdownMenuItem>}
              {onDeploy && <DropdownMenuItem onClick={() => handleOpenModal('deploy')}>Deploy</DropdownMenuItem>}
              {onDelete && (
                <DropdownMenuItem onClick={handleDelete} disabled={deleting} className="text-destructive">
                  {deleting ? 'Deleting...' : 'Delete'}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <h3 className="mb-1 truncate font-semibold text-foreground">{displayName}</h3>
        {displayDescription && <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{displayDescription}</p>}

        <div className="flex items-center justify-between">
          <Badge variant="outline" className={cn('capitalize', statusStyles[displayStatus])}>
            {displayStatus}
          </Badge>
          {displayPrice !== undefined && <span className="font-semibold text-primary">₹{displayPrice.toLocaleString()}</span>}
        </div>
      </div>

      <ProductActionModal
        open={modalOpen}
        action={modalAction}
        product={product || null}
        onClose={() => {
          setModalOpen(false);
          setModalAction(null);
        }}
        onSave={onEdit}
        onDeploy={onDeploy}
        servers={servers}
      />
    </>
  );
}
