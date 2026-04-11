import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useDashboardStore } from '@/hooks/useDashboardStore';
import { ResellerLayout } from '@/components/reseller/ResellerLayout';
import { ResellerOverview } from '@/components/reseller/ResellerOverview';
import { KeyGeneratorPanel } from '@/components/reseller/KeyGeneratorPanel';
import { ClientsPanel } from '@/components/reseller/ClientsPanel';
import { AddBalancePanel } from '@/components/reseller/AddBalancePanel';
import { ReferralPanel } from '@/components/reseller/ReferralPanel';
import { ChangePasswordPanel } from '@/components/reseller/ChangePasswordPanel';
import ResellerBadge from '@/components/ResellerBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  DollarSign,
  Key,
  ShoppingCart,
  Package,
  Download,
  CheckCircle,
  Loader2,
  CreditCard,
  Crown,
  Star,
  Zap,
  Gem,
} from 'lucide-react';
import { 
  resellerPlanSystem, 
  ResellerAccount, 
  ResellerPlan, 
  RESELLER_PLANS 
} from '@/lib/reseller-plans';

export default function ResellerDashboard() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { getResellerData, resellerPurchaseProduct } = useDashboardStore();
  const [resellerData, setResellerData] = useState<any>(null);
  const [resellerAccount, setResellerAccount] = useState<ResellerAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [planPurchaseDialogOpen, setPlanPurchaseDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<ResellerPlan | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchasingPlan, setPurchasingPlan] = useState(false);

  const activeTab = searchParams.get('tab') || 'products';

  useEffect(() => {
    if (activeTab === 'products' || activeTab === 'keys') {
      loadResellerData();
    }
  }, [user, activeTab]);

  const loadResellerData = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const data = await getResellerData();
      setResellerData(data);
    } catch (error) {
      console.error('Failed to load reseller data:', error);
      setResellerData(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!selectedProduct || !user?.id) return;

    setPurchasing(true);
    try {
      await resellerPurchaseProduct(selectedProduct.id);
      await loadResellerData(); // Refresh data
      setPurchaseDialogOpen(false);
      setSelectedProduct(null);
    } catch (error) {
      // Error is handled in the store
    } finally {
      setPurchasing(false);
    }
  };

  const openPurchaseDialog = (product: any) => {
    setSelectedProduct(product);
    setPurchaseDialogOpen(true);
  };

  // Load reseller account data
  useEffect(() => {
    if (user?.id) {
      const account = resellerPlanSystem.getResellerAccount(user.id);
      setResellerAccount(account || null);
    }
  }, [user]);

  // Handle plan purchase
  const handlePlanPurchase = async () => {
    if (!selectedPlan || !user?.id) return;

    setPurchasingPlan(true);
    try {
      // Simulate payment processing
      const paymentData = {
        amount: selectedPlan.price,
        currency: 'INR',
        paymentMethod: 'wallet',
        transactionId: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };

      // Check payment security
      const securityCheck = await resellerPlanSystem.checkPaymentSecurity(
        paymentData.transactionId,
        user.id
      );

      if (!securityCheck.secure) {
        toast.error(securityCheck.reason || 'Payment security check failed');
        return;
      }

      // Process payment and activate plan
      const result = await resellerPlanSystem.processPaymentAndActivatePlan(
        user.id,
        selectedPlan.id,
        paymentData
      );

      if (result.success) {
        toast.success(`${selectedPlan.badge.label} plan activated successfully!`);
        setResellerAccount(result.account || null);
        setPlanPurchaseDialogOpen(false);
        setSelectedPlan(null);
      } else {
        toast.error(result.error || 'Plan activation failed');
      }
    } catch (error) {
      console.error('Plan purchase error:', error);
      toast.error('Plan purchase failed');
    } finally {
      setPurchasingPlan(false);
    }
  };

  const openPlanPurchaseDialog = (plan: ResellerPlan) => {
    setSelectedPlan(plan);
    setPlanPurchaseDialogOpen(true);
  };

  // Generate key for reseller
  const handleGenerateKey = async () => {
    if (!user?.id) return;

    try {
      const result = await resellerPlanSystem.generateKeyForReseller(user.id);
      if (result.success) {
        toast.success('Key generated successfully!');
        // Refresh account data
        const account = resellerPlanSystem.getResellerAccount(user.id);
        setResellerAccount(account || null);
      } else {
        toast.error(result.error || 'Key generation failed');
      }
    } catch (error) {
      console.error('Key generation error:', error);
      toast.error('Key generation failed');
    }
  };

  const renderContent = () => {
    // Enhanced tabs for new reseller functionality
    if (activeTab === 'products' || activeTab === 'keys') {
      if (loading) {
        return (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        );
      }

      if (!resellerData) {
        return (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have reseller access.</p>
          </div>
        );
      }

      const { reseller, keys, products } = resellerData;
      const availableBalance = Number(reseller.wallet_balance ?? 0);

      return (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Wallet Balance</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  ${availableBalance.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Available balance
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Keys</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {keys.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total license keys
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Keys</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">
                  {keys.filter(key => key.status === 'active').length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Active keys
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">
                  ${reseller.total_sales?.toFixed(2) || '0.00'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Lifetime earnings
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Commission</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-cyan">
                  ${reseller.total_commission?.toFixed(2) || '0.00'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Earned commission
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Reseller Plan Badge Display */}
          {resellerAccount?.currentPlan && (
            <Card className="border-2 border-primary/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Crown className="h-5 w-5 text-primary" />
                      Your Reseller Plan
                    </CardTitle>
                    <CardDescription>
                      Active since {resellerAccount.planActivatedAt?.toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <ResellerBadge plan={resellerAccount.currentPlan} size="lg" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {resellerAccount.totalKeys - resellerAccount.usedKeys}
                    </div>
                    <div className="text-sm text-muted-foreground">Available Keys</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {resellerAccount.currentPlan.benefits.marginPercentage}%
                    </div>
                    <div className="text-sm text-muted-foreground">Margin</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {resellerAccount.currentPlan.benefits.maxKeysPerMonth}
                    </div>
                    <div className="text-sm text-muted-foreground">Max Keys/Month</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {resellerAccount.planExpiresAt?.toLocaleDateString()}
                    </div>
                    <div className="text-sm text-muted-foreground">Expires</div>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button onClick={handleGenerateKey} className="flex-1">
                    <Key className="h-4 w-4 mr-2" />
                    Generate Key
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reseller Plans Section */}
          {!resellerAccount?.currentPlan && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gem className="h-5 w-5" />
                  Choose Your Reseller Plan
                </CardTitle>
                <CardDescription>
                  Select a plan to unlock reseller features and start earning
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Object.values(RESELLER_PLANS).map((plan) => (
                    <Card key={plan.id} className="relative hover:shadow-lg transition-shadow">
                      <CardHeader className="text-center pb-3">
                        <div className="text-3xl mb-2">{plan.badge.emoji}</div>
                        <CardTitle className="text-lg">{plan.badge.label}</CardTitle>
                        <CardDescription>{plan.name}</CardDescription>
                      </CardHeader>
                      <CardContent className="text-center">
                        <div className="text-3xl font-bold text-primary mb-4">
                          ₹{plan.price}
                        </div>
                        <div className="space-y-2 text-sm mb-4">
                          <div className="flex justify-between">
                            <span>Free Keys:</span>
                            <span className="font-semibold">{plan.benefits.freeKeys}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Margin:</span>
                            <span className="font-semibold">{plan.benefits.marginPercentage}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Max Keys:</span>
                            <span className="font-semibold">{plan.benefits.maxKeysPerMonth}/mo</span>
                          </div>
                        </div>
                        <Button
                          onClick={() => openPlanPurchaseDialog(plan)}
                          className="w-full"
                          variant={plan.id === 'gold' ? 'default' : 'outline'}
                        >
                          {plan.id === 'gold' && <Star className="h-4 w-4 mr-2" />}
                          Choose {plan.badge.label}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Content */}
          <Tabs value={activeTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="products">Available Products</TabsTrigger>
              <TabsTrigger value="keys">My License Keys</TabsTrigger>
            </TabsList>

            {/* Products Tab */}
            <TabsContent value="products" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Available Products</CardTitle>
                  <CardDescription>
                    Purchase products at discounted reseller rates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                      <Package className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="font-semibold text-foreground mb-2">No products available</h3>
                      <p className="text-muted-foreground">Products will be available soon.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {products.map((product: any) => (
                        <Card key={product.id} className="relative">
                          <CardHeader>
                            <CardTitle className="text-lg">{product.name}</CardTitle>
                            <CardDescription className="line-clamp-2">
                              {product.description || 'No description available'}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center justify-between mb-4">
                              <span className="text-2xl font-bold text-primary">
                                ${product.price}
                              </span>
                              <Badge variant="secondary">
                                {product.status}
                              </Badge>
                            </div>
                            <Button
                              onClick={() => openPurchaseDialog(product)}
                              disabled={availableBalance < Number(product.price || 0)}
                              className="w-full"
                            >
                              {availableBalance < Number(product.price || 0) ? (
                                'Insufficient Balance'
                              ) : (
                                <>
                                  <ShoppingCart className="h-4 w-4 mr-2" />
                                  Purchase
                                </>
                              )}
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Keys Tab */}
            <TabsContent value="keys" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>My License Keys</CardTitle>
                  <CardDescription>
                    Manage your purchased license keys
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {keys.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                      <Key className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="font-semibold text-foreground mb-2">No license keys</h3>
                      <p className="text-muted-foreground">Purchase products to get license keys.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>License Key</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Purchased</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {keys.map((key: any) => (
                            <TableRow key={key.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{key.products?.name || 'Unknown Product'}</p>
                                  <p className="text-sm text-muted-foreground">
                                    ${key.products?.price || '0.00'}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                                  {key.key}
                                </code>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={key.status === 'active' ? 'default' : 'secondary'}
                                  className={cn(
                                    key.status === 'active' && 'bg-success text-success-foreground'
                                  )}
                                >
                                  {key.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {new Date(key.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => navigator.clipboard.writeText(key.key)}
                                  >
                                    <Download className="h-4 w-4 mr-2" />
                                    Copy Key
                                  </Button>
                                  {key.products?.apk_url && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => window.open(key.products.apk_url, '_blank')}
                                    >
                                      <Package className="h-4 w-4 mr-2" />
                                      Download APK
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Purchase Confirmation Dialog */}
          <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Purchase</DialogTitle>
                <DialogDescription>
                  Are you sure you want to purchase this product?
                </DialogDescription>
              </DialogHeader>

              {selectedProduct && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <h4 className="font-semibold">{selectedProduct.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedProduct.description || 'No description available'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">
                        ${selectedProduct.price}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Your balance: ${availableBalance.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span>You will receive a license key immediately after purchase</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm mt-2">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span>Wallet balance will be deducted from your account</span>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setPurchaseDialogOpen(false)}
                  disabled={purchasing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePurchase}
                  disabled={purchasing || !selectedProduct || availableBalance < Number(selectedProduct.price || 0)}
                >
                  {purchasing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Purchase for ${selectedProduct?.price}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Plan Purchase Dialog */}
          <Dialog open={planPurchaseDialogOpen} onOpenChange={setPlanPurchaseDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Plan Purchase</DialogTitle>
                <DialogDescription>
                  Upgrade your reseller account to unlock premium features
                </DialogDescription>
              </DialogHeader>

              {selectedPlan && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className="text-4xl">{selectedPlan.badge.emoji}</div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg">{selectedPlan.badge.label} Plan</h4>
                      <p className="text-sm text-muted-foreground">{selectedPlan.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-primary">
                        ₹{selectedPlan.price}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        One-time payment
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <div className="flex items-center space-x-2 text-sm">
                        <Key className="h-4 w-4 text-blue-500" />
                        <span className="font-semibold">{selectedPlan.benefits.freeKeys} Free Keys</span>
                      </div>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <div className="flex items-center space-x-2 text-sm">
                        <DollarSign className="h-4 w-4 text-green-500" />
                        <span className="font-semibold">{selectedPlan.benefits.marginPercentage}% Margin</span>
                      </div>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <div className="flex items-center space-x-2 text-sm">
                        <Package className="h-4 w-4 text-purple-500" />
                        <span className="font-semibold">{selectedPlan.benefits.maxKeysPerMonth} Keys/Month</span>
                      </div>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <div className="flex items-center space-x-2 text-sm">
                        <Crown className="h-4 w-4 text-yellow-500" />
                        <span className="font-semibold">{selectedPlan.benefits.supportLevel} Support</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                    <div className="flex items-center space-x-2 text-sm text-green-800">
                      <CheckCircle className="h-4 w-4" />
                      <span>Plan activates immediately after payment</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-green-800 mt-2">
                      <CheckCircle className="h-4 w-4" />
                      <span>Free keys added to your account instantly</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-green-800 mt-2">
                      <CheckCircle className="h-4 w-4" />
                      <span>Access to premium reseller features</span>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setPlanPurchaseDialogOpen(false)}
                  disabled={purchasingPlan}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePlanPurchase}
                  disabled={purchasingPlan || !selectedPlan}
                >
                  {purchasingPlan && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Activate {selectedPlan?.badge.label} Plan - ₹{selectedPlan?.price}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      );
    }

    // Original reseller dashboard tabs
    switch (activeTab) {
      case 'keys':
        return <KeyGeneratorPanel />;
      case 'clients':
        return <ClientsPanel />;
      case 'wallet':
        return <AddBalancePanel />;
      case 'referral':
        return <ReferralPanel />;
      case 'password':
        return <ChangePasswordPanel />;
      default:
        return <ResellerOverview />;
    }
  };

  return (
    <ResellerLayout>
      {renderContent()}
    </ResellerLayout>
  );
}