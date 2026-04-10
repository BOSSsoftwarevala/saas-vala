import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Eye, Copy, Loader2, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useMarketplaceOrders, useLicenseKeys } from '@/hooks/useMarketplace';
import { toast } from 'sonner';
import { publicMarketplaceApi } from '@/lib/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function OrdersPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { orders, loading: ordersLoading, fetchOrders } = useMarketplaceOrders();
  const { licenses } = useLicenseKeys();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (user && !authLoading) {
      fetchOrders({ status: filterStatus || undefined });
    }
  }, [user, authLoading, filterStatus]);

  if (!user && !authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-lg text-muted-foreground">Please login to view your orders</p>
        <Button onClick={() => navigate('/auth')}>Login</Button>
      </div>
    );
  }

  const filteredOrders = orders.filter((order) =>
    order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.product_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/10 text-green-700';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-700';
      case 'failed':
        return 'bg-red-500/10 text-red-700';
      case 'refunded':
        return 'bg-blue-500/10 text-blue-700';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const handleCopyOrderId = (orderId: string) => {
    navigator.clipboard.writeText(orderId);
    toast.success('Order ID copied!');
  };

  const handleDownload = async (order: any) => {
    try {
      const productId = order.product_id;
      if (!productId) {
        toast.error('Product mapping missing for this order');
        return;
      }

      const result = await publicMarketplaceApi.downloadAPK(productId);
      const secureUrl = result?.download_url || result?.signed_url || result?.url;
      if (!result?.success || !secureUrl) {
        throw new Error(result?.error || 'Unable to generate secure download link');
      }

      window.open(secureUrl, '_blank', 'noopener,noreferrer');
      toast.success('Secure APK download started');
    } catch (error: any) {
      toast.error(error?.message || 'APK not available for download');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">My Orders</h1>
          <p className="text-muted-foreground">View and manage your purchases</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by order ID or product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Orders Table */}
        {ordersLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No orders found</p>
              <Button onClick={() => navigate('/marketplace')}>Continue Shopping</Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Order History ({filteredOrders.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center gap-2">
                            {order.id.substring(0, 8)}...
                            <button
                              onClick={() => handleCopyOrderId(order.id)}
                              className="hover:text-primary"
                              title="Copy full ID"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </TableCell>
                        <TableCell>{order.product_name || 'Unknown Product'}</TableCell>
                        <TableCell>${parseFloat(order.amount).toFixed(2)}</TableCell>
                        <TableCell>{order.subscription_duration_days} days</TableCell>
                        <TableCell className="capitalize text-sm">
                          {order.payment_method || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(order.payment_status)}>
                            {order.payment_status.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(order.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowDetails(true);
                              }}
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {order.payment_status === 'completed' && order.apk_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownload(order)}
                                title="Download APK"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* License Keys Summary */}
        {licenses.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Your License Keys</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {licenses.map((license) => (
                <div
                  key={license.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-semibold">{license.license_key.substring(0, 20)}...</p>
                    <p className="text-sm text-muted-foreground">
                      Expires: {new Date(license.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(license.license_key);
                      toast.success('License key copied!');
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" /> Copy
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Order Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>Order ID: {selectedOrder?.id}</DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Product</p>
                <p className="font-semibold">{selectedOrder.product_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Amount</p>
                <p className="font-semibold">${parseFloat(selectedOrder.amount).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-semibold">{selectedOrder.subscription_duration_days} days</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payment Method</p>
                <p className="font-semibold capitalize">{selectedOrder.payment_method}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge className={getStatusColor(selectedOrder.payment_status)}>
                  {selectedOrder.payment_status.toUpperCase()}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Order Date</p>
                <p className="font-semibold">
                  {new Date(selectedOrder.created_at).toLocaleString()}
                </p>
              </div>
              {selectedOrder.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="font-semibold">{selectedOrder.notes}</p>
                </div>
              )}
              <div className="flex gap-2 pt-4">
                {selectedOrder.payment_status === 'completed' && selectedOrder.apk_url && (
                  <Button
                    onClick={() => handleDownload(selectedOrder)}
                    className="flex-1 gap-2"
                  >
                    <Download className="h-4 w-4" /> Download APK
                  </Button>
                )}
                <Button variant="outline" className="flex-1" onClick={() => setShowDetails(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
