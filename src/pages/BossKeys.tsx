// Boss Keys Module - Key management and validation
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Key,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Shield,
  Activity,
  AlertTriangle,
  Trash2,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface KeyData {
  id: string;
  product_id: string;
  type: 'api' | 'feature' | 'license';
  key_value: string;
  key_hash: string;
  status: 'active' | 'suspended' | 'expired' | 'revoked';
  usage_limit: number;
  used_count: number;
  expiry_date: string | null;
  grace_period_days: number;
  assigned_user_id: string | null;
  assigned_reseller_id: string | null;
  device_bindings: Record<string, unknown>;
  fail_count: number;
  notes: string | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
  product_name?: string;
}

interface Product {
  id: string;
  name: string;
}

export default function BossKeys() {
  const [keys, setKeys] = useState<KeyData[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [keyType, setKeyType] = useState<'api' | 'feature' | 'license'>('license');
  const [usageLimit, setUsageLimit] = useState(100);
  const [expiryDays, setExpiryDays] = useState(365);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [keysData, productsData] = await Promise.all([
        fetchKeys(),
        fetchProducts(),
      ]);

      setKeys(keysData);
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchKeys = async (): Promise<KeyData[]> => {
    const { data, error } = await supabase
      .from('keys')
      .select('*, products!inner(name)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data as KeyData[]).map(k => ({
      ...k,
      product_name: (k as any).products?.name,
    }));
  };

  const fetchProducts = async (): Promise<Product[]> => {
    const { data, error } = await supabase
      .from('products')
      .select('id, name')
      .eq('status', 'active');

    if (error) throw error;
    return (data as Product[]) || [];
  };

  const generateKey = async () => {
    if (!selectedProduct) {
      toast.error('Please select a product first');
      return;
    }

    try {
      const keyValue = generateRandomKey();
      const keyHash = btoa(keyValue);

      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + expiryDays);

      const { data, error } = await supabase
        .from('keys')
        .insert({
          product_id: selectedProduct,
          type: keyType,
          key_value: keyValue,
          key_hash: keyHash,
          status: 'active',
          usage_limit: usageLimit,
          used_count: 0,
          expiry_date: expiryDate.toISOString(),
          grace_period_days: 7,
          assigned_user_id: null,
          assigned_reseller_id: null,
          device_bindings: {},
          fail_count: 0,
          notes: null,
          last_verified_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Key generated successfully');
      setShowGenerateModal(false);
      loadData();
    } catch (error) {
      console.error('Error generating key:', error);
      toast.error('Failed to generate key');
    }
  };

  const generateRandomKey = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      if (i > 0 && i % 8 === 0) result += '-';
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const toggleKeyStatus = async (id: string, status: 'active' | 'suspended') => {
    try {
      const { error } = await supabase
        .from('keys')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      setKeys(prev =>
        prev.map(k =>
          k.id === id ? { ...k, status } : k
        )
      );
      toast.success(`Key ${status}`);
    } catch (error) {
      console.error('Error updating key:', error);
      toast.error('Failed to update key');
    }
  };

  const revokeKey = async (id: string) => {
    try {
      const { error } = await supabase
        .from('keys')
        .update({ status: 'revoked' })
        .eq('id', id);

      if (error) throw error;

      setKeys(prev =>
        prev.map(k =>
          k.id === id ? { ...k, status: 'revoked' } : k
        )
      );
      toast.success('Key revoked');
    } catch (error) {
      console.error('Error revoking key:', error);
      toast.error('Failed to revoke key');
    }
  };

  const copyKey = (keyValue: string) => {
    navigator.clipboard.writeText(keyValue);
    toast.success('Key copied to clipboard');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-500 bg-green-500/10';
      case 'suspended':
        return 'text-yellow-500 bg-yellow-500/10';
      case 'expired':
        return 'text-orange-500 bg-orange-500/10';
      case 'revoked':
        return 'text-red-500 bg-red-500/10';
      default:
        return 'text-blue-500 bg-blue-500/10';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'api':
        return <Shield className="w-4 h-4" />;
      case 'feature':
        return <Activity className="w-4 h-4" />;
      case 'license':
        return <Key className="w-4 h-4" />;
      default:
        return <Key className="w-4 h-4" />;
    }
  };

  const filteredKeys = keys.filter(key =>
    key.key_value.toLowerCase().includes(searchQuery.toLowerCase()) ||
    key.product_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalKeys = keys.length;
  const activeKeys = keys.filter(k => k.status === 'active').length;
  const suspendedKeys = keys.filter(k => k.status === 'suspended').length;
  const expiredKeys = keys.filter(k => k.status === 'expired').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Keys Management</h1>
          <p className="text-slate-400">Generate, manage, and validate API, feature, and license keys</p>
        </div>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-5 h-5" />
          Generate Key
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <Key className="w-5 h-5 text-blue-400" />
            <span className="text-xs text-slate-400">Total</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{totalKeys}</h3>
          <p className="text-sm text-slate-400">Total Keys</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-xs text-slate-400">Active</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{activeKeys}</h3>
          <p className="text-sm text-slate-400">Active Keys</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <Clock className="w-5 h-5 text-yellow-400" />
            <span className="text-xs text-slate-400">Suspended</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{suspendedKeys}</h3>
          <p className="text-sm text-slate-400">Suspended Keys</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <XCircle className="w-5 h-5 text-red-400" />
            <span className="text-xs text-slate-400">Expired</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{expiredKeys}</h3>
          <p className="text-sm text-slate-400">Expired Keys</p>
        </div>
      </div>

      {/* Keys List */}
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Keys</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search keys..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-800/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <button className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
              <Filter className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {filteredKeys.length === 0 ? (
          <div className="text-center py-12">
            <Key className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No keys generated yet</h3>
            <p className="text-slate-400 mb-4">Generate your first key to get started</p>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Generate Key
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredKeys.map((key) => (
              <div
                key={key.id}
                className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={cn('p-3 rounded-xl', key.status === 'active' ? 'bg-green-500/20' : 'bg-slate-700/50')}>
                      {getTypeIcon(key.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">{key.key_value}</h3>
                        <span className={cn('px-2 py-0.5 rounded-full text-xs', getStatusColor(key.status))}>
                          {key.status}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-300 capitalize">
                          {key.type}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mb-2">{key.product_name || 'Unknown Product'}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Usage: {key.used_count}/{key.usage_limit}</span>
                        <span>Fail Count: {key.fail_count}</span>
                        {key.expiry_date && (
                          <span>Expires: {new Date(key.expiry_date).toLocaleDateString()}</span>
                        )}
                        <span>Created: {new Date(key.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyKey(key.key_value)}
                      className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <Copy className="w-5 h-5 text-slate-400" />
                    </button>
                    {key.status === 'active' ? (
                      <button
                        onClick={() => toggleKeyStatus(key.id, 'suspended')}
                        className="p-2 rounded-lg hover:bg-yellow-500/20 transition-colors text-slate-400 hover:text-yellow-500"
                      >
                        <Clock className="w-5 h-5" />
                      </button>
                    ) : key.status === 'suspended' ? (
                      <button
                        onClick={() => toggleKeyStatus(key.id, 'active')}
                        className="p-2 rounded-lg hover:bg-green-500/20 transition-colors text-slate-400 hover:text-green-500"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                    ) : null}
                    <button
                      onClick={() => revokeKey(key.id)}
                      className="p-2 rounded-lg hover:bg-red-500/20 transition-colors text-slate-400 hover:text-red-500"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
                      <Settings className="w-5 h-5 text-slate-400" />
                    </button>
                    <button className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
                      <MoreVertical className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generate Key Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-700">
            <h2 className="text-xl font-semibold text-white mb-4">Generate New Key</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Select Product</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="">Choose a product...</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Key Type</label>
                <select
                  value={keyType}
                  onChange={(e) => setKeyType(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="license">License Key</option>
                  <option value="api">API Key</option>
                  <option value="feature">Feature Key</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Usage Limit</label>
                <input
                  type="number"
                  value={usageLimit}
                  onChange={(e) => setUsageLimit(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Expiry (Days)</label>
                <input
                  type="number"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-700 text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={generateKey}
                disabled={!selectedProduct}
                className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generate Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
