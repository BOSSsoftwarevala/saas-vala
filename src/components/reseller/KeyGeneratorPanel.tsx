import { useState } from 'react';
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
  AlertCircle,
  Wallet,
  Copy,
  CheckCircle2,
  Loader2,
  Lock,
  FileText,
  Receipt,
} from 'lucide-react';

const MINIMUM_BALANCE = 50;
const KEY_COST = 5;

const products = [
  { id: 'restaurant-pos', name: 'Restaurant POS System', price: 5 },
  { id: 'hotel-mgmt', name: 'Hotel Management System', price: 5 },
  { id: 'retail-pos', name: 'Retail POS System', price: 5 },
  { id: 'salon-mgmt', name: 'Salon Management System', price: 5 },
  { id: 'gym-mgmt', name: 'Gym Management System', price: 5 },
];

// Generate license key format: XXXX-XXXX-XXXX-XXXX
const generateLicenseKey = () => {
  return Array(4).fill(0).map(() => 
    Math.random().toString(36).substring(2, 6).toUpperCase()
  ).join('-');
};

// Generate invoice number
const generateInvoiceNumber = () => {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `INV-${year}-${random}`;
};

export function KeyGeneratorPanel() {
  const { wallet, fetchWallet, deductBalance } = useWallet();
  const [selectedProduct, setSelectedProduct] = useState('');
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
  const selectedProductData = products.find(p => p.id === selectedProduct);

  const handleGenerate = async () => {
    if (!selectedProduct || !clientName.trim() || !clientEmail.trim()) {
      toast.error('Please fill all required fields');
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!canGenerate) {
      toast.error(`⛔ BLOCKED: Minimum balance of $${MINIMUM_BALANCE} required`, {
        description: `Your balance: $${balance.toFixed(2)}. Add funds to continue.`
      });
      return;
    }

    if (!hasEnoughBalance) {
      toast.error(`⛔ BLOCKED: Insufficient balance`, {
        description: `Need $${totalCost} but have $${balance.toFixed(2)}`
      });
      return;
    }

    if (!wallet) {
      toast.error('Wallet not found');
      return;
    }

    setIsGenerating(true);
    const keys: string[] = [];

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error('Please login to generate keys');
        return;
      }

      // Get product from database - product_id is required
      const { data: productData } = await supabase
        .from('products')
        .select('id, name')
        .limit(1)
        .maybeSingle();

      if (!productData) {
        toast.error('No products found. Please add a product first.');
        setIsGenerating(false);
        return;
      }

      // Generate keys and insert into database
      for (let i = 0; i < quantity; i++) {
        const key = generateLicenseKey();
        keys.push(key);

        // Insert license key with all required fields
        const { error: keyError } = await supabase.from('license_keys').insert({
          license_key: key,
          product_id: productData.id,
          owner_name: clientName,
          owner_email: clientEmail,
          status: 'active',
          key_type: 'yearly' as const,
          created_by: userData.user.id,
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        });

        if (keyError) {
          console.error('Key insert error:', keyError);
          throw new Error(`Failed to create key: ${keyError.message}`);
        }
      }

      // Deduct from wallet
      await deductBalance(
        wallet.id,
        totalCost,
        `Generated ${quantity} license key(s) for ${clientName}`,
        keys[0], // Reference first key
        'license_key'
      );

      // Auto-generate invoice
      const invoiceNumber = generateInvoiceNumber();
      const invoiceData = {
        invoice_number: invoiceNumber,
        user_id: userData.user.id,
        customer_name: clientName,
        customer_email: clientEmail,
        items: JSON.stringify([{
          product: selectedProductData?.name || 'License Key',
          quantity: quantity,
          unit_price: KEY_COST,
          total: totalCost
        }]),
        subtotal: totalCost,
        total_amount: totalCost,
        status: 'paid',
        notes: `Auto-generated invoice for ${quantity} license key(s). Keys: ${keys.join(', ')}`
      };

      const { error: invoiceError } = await supabase
        .from('invoices')
        .insert(invoiceData);

      if (!invoiceError) {
        setLastInvoice(invoiceNumber);
        toast.success(`📄 Invoice ${invoiceNumber} auto-generated`);
      }

      // Log activity
      await supabase.from('activity_logs').insert({
        entity_type: 'license_key',
        entity_id: keys[0],
        action: 'reseller_key_generation',
        performed_by: userData.user.id,
        details: {
          quantity,
          client_name: clientName,
          client_email: clientEmail,
          product: selectedProductData?.name,
          total_cost: totalCost,
          invoice_number: invoiceNumber,
          keys: keys
        }
      });

      setGeneratedKeys(keys);
      toast.success(`✅ ${quantity} license key(s) generated successfully!`, {
        description: `Invoice: ${invoiceNumber} | Charged: $${totalCost}`
      });
      
      // Refresh wallet
      fetchWallet();
      
    } catch (error: any) {
      console.error('Key generation error:', error);
      toast.error('Failed to generate keys: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('Key copied to clipboard!');
  };

  const copyAllKeys = () => {
    navigator.clipboard.writeText(generatedKeys.join('\n'));
    toast.success('All keys copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Balance Warning - HARD BLOCK */}
      {!canGenerate && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-destructive/20 flex items-center justify-center">
                <Lock className="h-6 w-6 text-destructive" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">⛔ KEY GENERATION BLOCKED</h3>
                <p className="text-sm text-muted-foreground">
                  Minimum balance of <strong>${MINIMUM_BALANCE}</strong> required.
                  Current balance: <strong className="text-destructive">${balance.toFixed(2)}</strong>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add at least ${(MINIMUM_BALANCE - balance).toFixed(2)} to unlock key generation
                </p>
              </div>
              <Button onClick={() => window.location.href = '/reseller-dashboard?tab=wallet'}>
                <Wallet className="h-4 w-4 mr-2" />
                Add Balance
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Balance Info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${canGenerate ? 'bg-success/20' : 'bg-destructive/20'}`}>
                <Wallet className={`h-5 w-5 ${canGenerate ? 'text-success' : 'text-destructive'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Your Balance</p>
                <p className={`text-xl font-bold ${canGenerate ? 'text-success' : 'text-destructive'}`}>
                  ${balance.toFixed(2)}
                </p>
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
                <p className="text-sm text-muted-foreground">Cost Per Key</p>
                <p className="text-xl font-bold text-foreground">${KEY_COST}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Min. Balance</p>
                <p className="text-xl font-bold text-foreground">${MINIMUM_BALANCE}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Auto Invoice</p>
                <p className="text-xl font-bold text-success">Enabled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Key Generation Form */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Generate License Keys
          </CardTitle>
          <CardDescription>
            Create license keys for your clients. Each key costs ${KEY_COST}. 
            <strong className="text-primary"> Auto-Invoice & Auto-Billing enabled.</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Select Product *</Label>
              <Select value={selectedProduct} onValueChange={setSelectedProduct} disabled={!canGenerate}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} - ${product.price}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quantity</Label>
              <Select 
                value={quantity.toString()} 
                onValueChange={(v) => setQuantity(parseInt(v))}
                disabled={!canGenerate}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 5, 10, 20, 50].map((q) => (
                    <SelectItem 
                      key={q} 
                      value={q.toString()}
                      disabled={q * KEY_COST > balance}
                    >
                      {q} Key(s) - ${q * KEY_COST} {q * KEY_COST > balance && '(Insufficient)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client Name *</Label>
              <Input
                placeholder="Enter client name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                disabled={!canGenerate}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Client Email *</Label>
              <Input
                type="email"
                placeholder="client@example.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                disabled={!canGenerate}
                maxLength={255}
              />
            </div>
          </div>

          {/* Cost Summary */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-muted-foreground">Total Cost:</span>
                <p className="text-xs text-muted-foreground">
                  Auto-deducted from wallet • Invoice auto-generated
                </p>
              </div>
              <span className="text-xl font-bold text-foreground">${totalCost}</span>
            </div>
            {!hasEnoughBalance && canGenerate && (
              <p className="text-sm text-destructive mt-2">
                ⛔ Insufficient balance for this order
              </p>
            )}
          </div>

          <Button
            className="w-full"
            size="lg"
            disabled={!canGenerate || !hasEnoughBalance || isGenerating || !selectedProduct}
            onClick={handleGenerate}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating & Billing...
              </>
            ) : !canGenerate ? (
              <>
                <Lock className="h-4 w-4 mr-2" />
                Balance Below ${MINIMUM_BALANCE} - BLOCKED
              </>
            ) : (
              <>
                <Key className="h-4 w-4 mr-2" />
                Generate {quantity} Key(s) - Charge ${totalCost}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Keys */}
      {generatedKeys.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="glass-card border-success/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-success">
                    <CheckCircle2 className="h-5 w-5" />
                    Generated Keys
                  </CardTitle>
                  {lastInvoice && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Invoice: {lastInvoice}
                    </p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={copyAllKeys}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {generatedKeys.map((key, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border"
                  >
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