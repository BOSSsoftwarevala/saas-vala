import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useWallet } from '@/hooks/useWallet';
import { supabase } from '@/integrations/supabase/client';
import { dashboardApi } from '@/lib/dashboardApi';
import { toast } from 'sonner';
import {
  Key,
  Wallet,
  Copy,
  CheckCircle2,
  Loader2,
  Lock,
  Calendar,
  Package,
} from 'lucide-react';

const PLAN_OPTIONS = [
  { value: '1M', label: '1 Month', multiplier: 1 },
  { value: '3M', label: '3 Months', multiplier: 3 },
  { value: '6M', label: '6 Months', multiplier: 6 },
  { value: '12M', label: '12 Months', multiplier: 12 },
  { value: 'lifetime', label: 'Lifetime', multiplier: 24 },
] as const;

type PlanDuration = typeof PLAN_OPTIONS[number]['value'];

interface ResellerProductOption {
  id: string;
  name: string;
  price: number;
}

interface ResellerClientOption {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

interface GeneratedKeyState {
  key: string;
  resellerId: string;
  productName: string;
  planDuration: PlanDuration;
  chargedPrice: number;
  expiresAt: string | null;
}

function getPlanPrice(basePrice: number, planDuration: PlanDuration): number {
  const plan = PLAN_OPTIONS.find((item) => item.value === planDuration);
  return Number((Number(basePrice || 0) * Number(plan?.multiplier || 1)).toFixed(2));
}

export function KeyGeneratorPanel() {
  const { user } = useAuth();
  const { wallet, fetchWallet, fetchTransactions } = useWallet();
  const [products, setProducts] = useState<ResellerProductOption[]>([]);
  const [clients, setClients] = useState<ResellerClientOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PlanDuration>('1M');
  const [selectedClientId, setSelectedClientId] = useState('none');
  const [sellPriceInput, setSellPriceInput] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'none' | 'whatsapp' | 'email' | 'manual' | 'sms'>('none');
  const [deliveryTarget, setDeliveryTarget] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const generateLockRef = useRef(false);
  const [generatedKey, setGeneratedKey] = useState<GeneratedKeyState | null>(null);

  const balance = Number(wallet?.balance || 0);

  useEffect(() => {
    const loadProducts = async () => {
      setLoadingProducts(true);
      try {
        const { data, error } = await (supabase as any)
          .from('products')
          .select('id, name, price')
          .eq('status', 'active')
          .neq('license_enabled', false)
          .order('name', { ascending: true });

        if (error) throw error;

        setProducts((data || []).map((product: any) => ({
          id: product.id,
          name: product.name,
          price: Number(product.price || 0),
        })));
      } catch (error) {
        console.error('Failed to load products for reseller key generation:', error);
        toast.error('Failed to load products');
        setProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    };

    loadProducts();
  }, []);

  useEffect(() => {
    const loadClients = async () => {
      if (!user?.id) return;
      try {
        const data = await (dashboardApi as any).getResellerClients(user.id);
        setClients((data || []).map((row: any) => ({
          id: row.id,
          full_name: row.full_name,
          email: row.email || null,
          phone: row.phone || null,
        })));
      } catch (error) {
        console.error('Failed to load reseller clients', error);
      }
    };

    loadClients();
  }, [user?.id]);

  const selectedProductData = useMemo(
    () => products.find((product) => product.id === selectedProduct) || null,
    [products, selectedProduct],
  );

  const planPrice = useMemo(
    () => (selectedProductData ? getPlanPrice(selectedProductData.price, selectedPlan) : 0),
    [selectedProductData, selectedPlan],
  );

  const hasEnoughBalance = balance >= planPrice && planPrice > 0;

  const handleGenerate = async () => {
    if (generateLockRef.current || isGenerating) {
      return;
    }

    if (!user?.id) {
      toast.error('Please login to generate keys');
      return;
    }

    if (!selectedProductData) {
      toast.error('Please select a product');
      return;
    }

    if (planPrice <= 0) {
      toast.error('Invalid plan price for selected product');
      return;
    }

    if (!wallet) {
      toast.error('Wallet not found. Add balance first.');
      return;
    }

    if (!hasEnoughBalance) {
      toast.error('Insufficient balance');
      return;
    }

    const sellPrice = sellPriceInput ? Number(sellPriceInput) : undefined;
    if (sellPrice !== undefined && (!Number.isFinite(sellPrice) || sellPrice < 0)) {
      toast.error('Sell price must be zero or greater');
      return;
    }

    if (deliveryMethod !== 'none' && !deliveryTarget.trim()) {
      toast.error('Delivery target is required when delivery method is selected');
      return;
    }

    generateLockRef.current = true;
    setIsGenerating(true);
    try {
      let idempotencyKey = `${Date.now()}-fallback`;
      if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        idempotencyKey = crypto.randomUUID();
      } else if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
        const bytes = crypto.getRandomValues(new Uint8Array(8));
        idempotencyKey = `${Date.now()}-${Array.from(bytes).map((n) => n.toString(16).padStart(2, '0')).join('')}`;
      }

      const result = await (dashboardApi as any).generateResellerLicenseKey({
        userId: user.id,
        idempotencyKey,
        productId: selectedProductData.id,
        planDuration: selectedPlan,
        clientId: selectedClientId !== 'none' ? selectedClientId : undefined,
        sellPrice,
        deliveryMethod: deliveryMethod !== 'none' ? deliveryMethod : undefined,
        deliveryTarget: deliveryTarget.trim() || undefined,
      });

      setGeneratedKey({
        key: result.licenseKey.license_key,
        resellerId: String(result.resellerId || result.licenseKey?.reseller_id || ''),
        productName: selectedProductData.name,
        planDuration: selectedPlan,
        chargedPrice: Number(result.planPrice || planPrice),
        expiresAt: result.expiresAt || null,
      });

      await Promise.all([fetchWallet(), fetchTransactions()]);
      toast.success('License key generated successfully');
    } catch (error: any) {
      console.error('Reseller key generation failed:', error);
      const message = String(error?.message || '').toLowerCase();
      if (message.includes('insufficient')) {
        toast.error('Insufficient balance');
      } else if (message.includes('transaction')) {
        toast.error('Transaction failed');
      } else {
        toast.error('Key generation failed');
      }
    } finally {
      generateLockRef.current = false;
      setIsGenerating(false);
    }
  };

  const copyKey = () => {
    if (!generatedKey?.key) return;
    navigator.clipboard.writeText(generatedKey.key);
    toast.success('Key copied to clipboard');
  };

  return (
    <div className="space-y-6">
      {!hasEnoughBalance && selectedProductData && planPrice > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-destructive/20 flex items-center justify-center">
                <Lock className="h-6 w-6 text-destructive" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">Insufficient Wallet Balance</h3>
                <p className="text-sm text-muted-foreground">
                  Selected plan requires <strong>${planPrice.toFixed(2)}</strong>.
                  Current balance: <strong className="text-destructive">${balance.toFixed(2)}</strong>
                </p>
              </div>
              <Button onClick={() => window.location.href = '/reseller/dashboard?tab=wallet'}>
                <Wallet className="h-4 w-4 mr-2" />
                Add Balance
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Wallet Balance</p>
                <p className="text-xl font-bold text-foreground">${balance.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Products</p>
                <p className="text-xl font-bold text-foreground">{loadingProducts ? '...' : products.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Selected Plan</p>
                <p className="text-xl font-bold text-foreground">{selectedPlan}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-secondary/20 flex items-center justify-center">
                <Key className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Plan Price</p>
                <p className="text-xl font-bold text-foreground">${planPrice.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Generate License Key
          </CardTitle>
          <CardDescription>
            Select a product and plan. The system checks wallet balance, deducts the plan price, then generates one secure license key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Select Product</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={loadingProducts || isGenerating}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingProducts ? 'Loading products...' : 'Choose a product'} />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} - ${product.price.toFixed(2)}/month
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Select Plan</Label>
              <Select value={selectedPlan} onValueChange={(value) => setSelectedPlan(value as PlanDuration)} disabled={isGenerating}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a plan" />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map((plan) => (
                    <SelectItem key={plan.value} value={plan.value}>
                      {plan.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Assign to Client (Optional)</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId} disabled={isGenerating}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No client selected</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Client Sell Price (Optional)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={sellPriceInput}
                onChange={(e) => setSellPriceInput(e.target.value)}
                placeholder="Example: 49.99"
                disabled={isGenerating}
              />
            </div>

            <div className="space-y-2">
              <Label>Delivery Method (Optional)</Label>
              <Select value={deliveryMethod} onValueChange={(value: any) => setDeliveryMethod(value)} disabled={isGenerating}>
                <SelectTrigger>
                  <SelectValue placeholder="Select delivery method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No delivery log</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {deliveryMethod !== 'none' && (
              <div className="space-y-2 md:col-span-2">
                <Label>Delivery Target</Label>
                <Input
                  value={deliveryTarget}
                  onChange={(e) => setDeliveryTarget(e.target.value)}
                  placeholder={deliveryMethod === 'email' ? 'client@email.com' : '+91 98XXXXXXXX'}
                  disabled={isGenerating}
                />
              </div>
            )}
          </div>

          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-muted-foreground">Charge Summary</span>
                <p className="text-xs text-muted-foreground">
                  Product: {selectedProductData?.name || 'Not selected'}
                </p>
              </div>
              <span className="text-xl font-bold text-foreground">${planPrice.toFixed(2)}</span>
            </div>
            {!hasEnoughBalance && selectedProductData && planPrice > 0 && (
              <p className="text-sm text-destructive mt-2">
                Balance is lower than the selected plan price.
              </p>
            )}
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={loadingProducts || isGenerating || !selectedProductData || !hasEnoughBalance}
            onClick={handleGenerate}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deducting Balance & Generating Key...
              </>
            ) : (
              <>
                <Key className="h-4 w-4 mr-2" />
                Generate Key for ${planPrice.toFixed(2)}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {generatedKey && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-card border-success/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                Generated License Key
              </CardTitle>
              <CardDescription>
                {generatedKey.productName} • {generatedKey.planDuration} • Charged ${generatedKey.chargedPrice.toFixed(2)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border gap-3">
                <code className="font-mono text-sm text-foreground break-all">{generatedKey.key}</code>
                <Button variant="ghost" size="sm" onClick={copyKey}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">
                Reseller ID: {generatedKey.resellerId || 'N/A'}
              </div>

              <div className="text-sm text-muted-foreground">
                Expires: {generatedKey.expiresAt ? new Date(generatedKey.expiresAt).toLocaleString() : 'Lifetime'}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
