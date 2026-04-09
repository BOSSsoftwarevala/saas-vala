import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import type { DashboardServer, DashboardLog } from '@/lib/dashboardApi';

interface ServerActionModalProps {
  open: boolean;
  action: 'logs' | 'deploy-product' | null;
  server: DashboardServer | null;
  onClose: () => void;
  onDeployProduct?: (serverId: string, productId: string) => Promise<void>;
  logs?: DashboardLog[];
  products?: Array<{ id: string; name: string }>;
}

export function ServerActionModal({
  open,
  action,
  server,
  onClose,
  onDeployProduct,
  logs = [],
  products = [],
}: ServerActionModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');

  const handleDeployProduct = async () => {
    if (!server?.id || !selectedProduct || !onDeployProduct) return;
    setLoading(true);
    try {
      await onDeployProduct(server.id, selectedProduct);
      toast.success('Product deployed to server');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to deploy product');
    } finally {
      setLoading(false);
    }
  };

  const serverLogs = logs.filter((log) => log.table_name === 'servers' && log.record_id === server?.id);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl">
        {action === 'logs' && (
          <>
            <DialogHeader>
              <DialogTitle>Server Logs - {server?.name}</DialogTitle>
              <DialogDescription>Recent activity and deployment logs</DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-96 border border-border rounded-lg p-4">
              {serverLogs.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  No logs available for this server
                </div>
              ) : (
                <div className="space-y-3">
                  {serverLogs.map((log) => (
                    <div key={log.id} className="text-sm border-b border-border/50 pb-3 last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground capitalize">{log.action.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        By: {log.performed_by || 'System'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <DialogFooter>
              <Button onClick={onClose}>Close</Button>
            </DialogFooter>
          </>
        )}

        {action === 'deploy-product' && (
          <>
            <DialogHeader>
              <DialogTitle>Deploy Product to {server?.name}</DialogTitle>
              <DialogDescription>Select a product to deploy on this server</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Select Product</Label>
                <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a product..." />
                  </SelectTrigger>
                  <SelectContent>
                    {products.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">No products available</div>
                    ) : (
                      products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-2">
                <div className="font-medium text-foreground">Server Details</div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>Domain: {server?.name}</div>
                  <div>Region: {server?.region}</div>
                  <div>Status: {server?.status}</div>
                  <div>Load: {server?.load || 0}%</div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleDeployProduct} disabled={loading || !selectedProduct}>
                {loading ? 'Deploying...' : 'Deploy Product'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
