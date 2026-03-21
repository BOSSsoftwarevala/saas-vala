import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWallet } from '@/hooks/useWallet';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Key,
  Wallet,
  Copy,
  CheckCircle2,
  Loader2,
  Lock,
  Search,
} from 'lucide-react';

const MINIMUM_BALANCE = 5;
const KEY_COST = 5;

const generateLicenseKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array(4).fill(0).map(() =>
    Array(4).fill(0).map(() => chars[Math.floor(Math.random() * chars.length)]).join('')
  ).join('-');
};

const generateInvoiceNumber = () => {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${year}-${random}`;
};

interface DBProduct {
  id: string;
  name: string;
  slug: string;
  price: number | null;
}

export function KeyGeneratorPanel() {
  const { wallet, fetchWallet, deductBalance } = useWallet();
  const [dbProducts, setDbProducts] = useState<DBProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedKeys, setGeneratedKeys] = useState<string[]>([]);
  const [lastInvoice, setLastInvoice] = useState<string | null>(null);

  const balance = wallet?.balance || 0;
  const canGenerate = balance >= MINIMUM_BALANCE;
  const totalCost = quantity * KEY_COST;
  const hasEnoughBalance = balance >= totalCost;
  const selectedProduct = dbProducts.find(p => p.id === selectedProductId);

  // Load real products from DB
  useEffect(() => {
    const loadProducts = async () => {
      const all: DBProduct[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, slug, price')
          .eq('status', 'active')
          .neq('slug', '__payment_config__')
          .order('name')
          .range(page * 100, (page + 1) * 100 - 1);
        if (error || !data || data.length === 0) { hasMore = false; break; }
        all.push(...(data as DBProduct[]));
        if (data.length < 100) hasMore = false;
        page++;
      }
      setDbProducts(all);
      setProductsLoading(false);
    };
    loadProducts();
  }, []);

  const filteredProducts = productSearch
    ? dbProducts.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
    : dbProducts;

  const handleGenerate = async () => {
    if (!selectedProductId || !clientName.trim() || !clientEmail.trim()) {
      toast.error('Please fill all required fields');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail)) {
      toast.error('Please enter a valid email');
      return;
    }
    if (!canGenerate) {
      toast.error(`Minimum balance $${MINIMUM_BALANCE} required`);
      return;
    }
    if (!hasEnoughBalance) {
      toast.error(`Need $${totalCost}, have $${balance.toFixed(2)}`);
      return;
    }
    if (!wallet) { toast.error('Wallet not found'); return; }

    setIsGenerating(true);
    const keys: string[] = [];

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { toast.error('Please login'); setIsGenerating(false); return; }

      for (let i = 0; i < quantity; i++) {
        const key = generateLicenseKey();
        keys.push(key);
        const { error: keyError } = await supabase.from('license_keys').insert({
          license_key: key,
          product_id: selectedProductId,
          owner_name: clientName.trim(),
          owner_email: clientEmail.trim(),
          status: 'active',
          key_type: 'yearly' as const,
          created_by: userData.user.id,
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        });
        if (keyError) throw new Error(keyError.message);
      }

      // Deduct wallet
      await deductBalance(wallet.id, totalCost, `Generated ${quantity} key(s) for ${clientName}`, keys[0], 'license_key');

      // Auto invoice
      const invoiceNumber = generateInvoiceNumber();
      const { error: invErr } = await supabase.from('invoices').insert({
        invoice_number: invoiceNumber,
        user_id: userData.user.id,
        customer_name: clientName.trim(),
        customer_email: clientEmail.trim(),
        items: JSON.stringify([{
          product: selectedProduct?.name || 'License Key',
          quantity,
          unit_price: KEY_COST,
          total: totalCost
        }]),
        subtotal: totalCost,
        total_amount: totalCost,
        status: 'paid',
        notes: `Auto-invoice for ${quantity} key(s). Keys: ${keys.join(', ')}`
      });
      if (!invErr) setLastInvoice(invoiceNumber);

      // Activity log
      await supabase.from('activity_logs').insert({
        entity_type: 'license_key',
        entity_id: keys[0],
        action: 'reseller_key_generation',
        performed_by: userData.user.id,
        details: { quantity, client_name: clientName, product: selectedProduct?.name, total_cost: totalCost, invoice_number: invoiceNumber, keys }
      });

      setGeneratedKeys(keys);
      toast.success(`✅ ${quantity} key(s) generated! Invoice: ${invoiceNumber}`);
      fetchWallet();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyKey = (key: string) => { navigator.clipboard.writeText(key); toast.success('Key copied!'); };
  const copyAllKeys = () => { navigator.clipboard.writeText(generatedKeys.join('\n')); toast.success('All keys copied!'); };

  return (
    <div className="space-y-6">
      {/* Balance Block Warning */}
      {!canGenerate && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-4 flex items-center gap-4">
            <Lock className="h-8 w-8 text-destructive flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">⛔ KEY GENERATION BLOCKED</h3>
              <p className="text-sm text-muted-foreground">
                Min balance <strong>${MINIMUM_BALANCE}</strong> required. Current: <strong className="text-destructive">${balance.toFixed(2)}</strong>
              </p>
            </div>
            <Button onClick={() => window.location.href = '/reseller-dashboard?tab=wallet'}>
              <Wallet className="h-4 w-4 mr-2" /> Add Balance
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Balance</p>
          <p className={`text-xl font-bold ${canGenerate ? 'text-green-500' : 'text-destructive'}`}>${balance.toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Cost/Key</p>
          <p className="text-xl font-bold text-foreground">${KEY_COST}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Products</p>
          <p className="text-xl font-bold text-foreground">{dbProducts.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Auto Invoice</p>
          <p className="text-xl font-bold text-green-500">Enabled</p>
        </CardContent></Card>
      </div>

      {/* Key Generation Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Generate License Keys
          </CardTitle>
          <CardDescription>
            Select any product from the live catalog ({dbProducts.length} available). Each key costs ${KEY_COST}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Product Search & Select */}
          <div className="space-y-2">
            <Label>Select Product *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9 mb-2"
                disabled={!canGenerate}
              />
            </div>
            <Select value={selectedProductId} onValueChange={setSelectedProductId} disabled={!canGenerate || productsLoading}>
              <SelectTrigger>
                <SelectValue placeholder={productsLoading ? 'Loading products...' : 'Choose a product'} />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {filteredProducts.slice(0, 50).map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name} — ${product.price || 5}
                  </SelectItem>
                ))}
                {filteredProducts.length > 50 && (
                  <div className="px-2 py-1 text-xs text-muted-foreground">
                    Search to find more ({filteredProducts.length - 50} hidden)
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Client Name *</Label>
              <Input placeholder="Client name" value={clientName} onChange={(e) => setClientName(e.target.value)} disabled={!canGenerate} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>Client Email *</Label>
              <Input type="email" placeholder="client@email.com" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} disabled={!canGenerate} maxLength={255} />
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Select value={quantity.toString()} onValueChange={(v) => setQuantity(parseInt(v))} disabled={!canGenerate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 5, 10, 20].map((q) => (
                    <SelectItem key={q} value={q.toString()} disabled={q * KEY_COST > balance}>
                      {q} Key(s) — ${q * KEY_COST} {q * KEY_COST > balance ? '(Low bal)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cost Summary */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border flex items-center justify-between">
            <div>
              <span className="text-sm text-muted-foreground">Total: </span>
              <span className="text-sm text-muted-foreground">Auto-deducted • Auto-invoiced</span>
            </div>
            <span className="text-2xl font-bold text-foreground">${totalCost}</span>
          </div>

          <Button
            className="w-full h-12 text-base font-semibold"
            disabled={!canGenerate || !hasEnoughBalance || isGenerating || !selectedProductId}
            onClick={handleGenerate}
          >
            {isGenerating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
            ) : !canGenerate ? (
              <><Lock className="h-4 w-4 mr-2" /> Balance Too Low</>
            ) : (
              <><Key className="h-4 w-4 mr-2" /> Generate {quantity} Key(s) — ${totalCost}</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Keys */}
      {generatedKeys.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-green-500/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-green-500">
                    <CheckCircle2 className="h-5 w-5" /> Generated Keys
                  </CardTitle>
                  {lastInvoice && <p className="text-xs text-muted-foreground mt-1">Invoice: {lastInvoice}</p>}
                </div>
                <Button variant="outline" size="sm" onClick={copyAllKeys}>
                  <Copy className="h-4 w-4 mr-2" /> Copy All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {generatedKeys.map((key, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                    <code className="font-mono text-sm text-foreground">{key}</code>
                    <Button variant="ghost" size="sm" onClick={() => copyKey(key)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
