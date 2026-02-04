import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Upload,
  Ban,
  Play,
  RefreshCw,
  Package,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ProductControlBarProps {
  totalProducts: number;
  activeProducts: number;
  suspendedProducts: number;
  draftProducts: number;
  onAddProduct: () => void;
  onBulkImport: () => void;
  onBulkSuspend: () => void;
  onBulkActivate: () => void;
  onRefresh: () => void;
}

export function ProductControlBar({
  totalProducts,
  activeProducts,
  suspendedProducts,
  draftProducts,
  onAddProduct,
  onBulkImport,
  onBulkSuspend,
  onBulkActivate,
  onRefresh,
}: ProductControlBarProps) {
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Status Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="gap-2 py-1.5 px-3 bg-muted/50">
            <Package className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold">{totalProducts}</span>
            <span className="text-muted-foreground">Total</span>
          </Badge>
          <Badge variant="outline" className="gap-2 py-1.5 px-3 bg-success/10 border-success/30">
            <CheckCircle className="h-3.5 w-3.5 text-success" />
            <span className="font-semibold text-success">{activeProducts}</span>
            <span className="text-muted-foreground">Active</span>
          </Badge>
          <Badge variant="outline" className="gap-2 py-1.5 px-3 bg-destructive/10 border-destructive/30">
            <Ban className="h-3.5 w-3.5 text-destructive" />
            <span className="font-semibold text-destructive">{suspendedProducts}</span>
            <span className="text-muted-foreground">Suspended</span>
          </Badge>
          <Badge variant="outline" className="gap-2 py-1.5 px-3 bg-warning/10 border-warning/30">
            <FileText className="h-3.5 w-3.5 text-warning" />
            <span className="font-semibold text-warning">{draftProducts}</span>
            <span className="text-muted-foreground">Draft</span>
          </Badge>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={onAddProduct}
            className="bg-orange-gradient hover:opacity-90 text-white gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onBulkImport}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Bulk Import</span>
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-warning border-warning/30 hover:bg-warning/10"
              >
                <Ban className="h-4 w-4" />
                <span className="hidden sm:inline">Bulk Suspend</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Bulk Suspend Products?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will suspend all active products. Suspended products will be hidden from resellers.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onBulkSuspend}
                  className="bg-warning text-warning-foreground hover:bg-warning/90"
                >
                  Confirm Suspend
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-success border-success/30 hover:bg-success/10"
              >
                <Play className="h-4 w-4" />
                <span className="hidden sm:inline">Bulk Activate</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Bulk Activate Products?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will activate all suspended products. Active products will be visible to resellers.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onBulkActivate}
                  className="bg-success text-success-foreground hover:bg-success/90"
                >
                  Confirm Activate
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            className="h-9 w-9"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
