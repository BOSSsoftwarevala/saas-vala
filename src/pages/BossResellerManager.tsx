// Boss Reseller Manager Module - Reseller management and commission tracking
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Users,
  Plus,
  Search,
  Filter,
  MoreVertical,
  TrendingUp,
  DollarSign,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  RefreshCw,
  AlertTriangle,
  Award,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Reseller {
  id: string;
  user_id: string;
  commission_rate: number;
  discount_rate: number;
  max_keys: number;
  assigned_keys_count: number;
  total_sales: number;
  status: 'active' | 'suspended' | 'pending';
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_name?: string;
}

interface ResellerSale {
  id: string;
  reseller_id: string;
  order_id: string;
  commission_amount: number;
  created_at: string;
}

interface ProductReseller {
  id: string;
  product_id: string;
  reseller_id: string;
  discount_rate: number;
  created_at: string;
}

export default function BossResellerManager() {
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [sales, setSales] = useState<ResellerSale[]>([]);
  const [productResellers, setProductResellers] = useState<ProductReseller[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState<Reseller | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [resellersData, salesData, productResellersData] = await Promise.all([
        fetchResellers(),
        fetchSales(),
        fetchProductResellers(),
      ]);

      setResellers(resellersData);
      setSales(salesData);
      setProductResellers(productResellersData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchResellers = async (): Promise<Reseller[]> => {
    const { data, error } = await supabase
      .from('resellers')
      .select('*, users!inner(email, full_name)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data as Reseller[]).map(r => ({
      ...r,
      user_email: (r as any).users?.email,
      user_name: (r as any).users?.full_name,
    }));
  };

  const fetchSales = async (): Promise<ResellerSale[]> => {
    const { data, error } = await supabase
      .from('reseller_sales')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return (data as ResellerSale[]) || [];
  };

  const fetchProductResellers = async (): Promise<ProductReseller[]> => {
    const { data, error } = await supabase
      .from('product_resellers')
      .select('*');

    if (error) throw error;
    return (data as ProductReseller[]) || [];
  };

  const toggleResellerStatus = async (id: string, status: 'active' | 'suspended') => {
    try {
      const { error } = await supabase
        .from('resellers')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      setResellers(prev =>
        prev.map(r =>
          r.id === id ? { ...r, status } : r
        )
      );
      toast.success(`Reseller ${status}`);
    } catch (error) {
      console.error('Error updating reseller:', error);
      toast.error('Failed to update reseller');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-500 bg-green-500/10';
      case 'suspended':
        return 'text-red-500 bg-red-500/10';
      case 'pending':
        return 'text-yellow-500 bg-yellow-500/10';
      default:
        return 'text-blue-500 bg-blue-500/10';
    }
  };

  const filteredResellers = resellers.filter(reseller =>
    reseller.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    reseller.user_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalResellers = resellers.length;
  const activeResellers = resellers.filter(r => r.status === 'active').length;
  const totalSales = resellers.reduce((sum, r) => sum + r.total_sales, 0);
  const totalCommission = sales.reduce((sum, s) => sum + s.commission_amount, 0);

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
          <h1 className="text-3xl font-bold text-white mb-2">Reseller Manager</h1>
          <p className="text-slate-400">Manage resellers, commissions, and product assignments</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-5 h-5" />
          Add Reseller
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <Users className="w-5 h-5 text-blue-400" />
            <span className="text-xs text-slate-400">Total</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{totalResellers}</h3>
          <p className="text-sm text-slate-400">Resellers</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-xs text-slate-400">Active</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{activeResellers}</h3>
          <p className="text-sm text-slate-400">Active Resellers</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <DollarSign className="w-5 h-5 text-green-400" />
            <span className="text-xs text-slate-400">Total</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">${totalSales.toLocaleString()}</h3>
          <p className="text-sm text-slate-400">Total Sales</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <Award className="w-5 h-5 text-purple-400" />
            <span className="text-xs text-slate-400">Total</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">${totalCommission.toLocaleString()}</h3>
          <p className="text-sm text-slate-400">Commission Paid</p>
        </div>
      </div>

      {/* Resellers List */}
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Resellers</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search resellers..."
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

        {filteredResellers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No resellers yet</h3>
            <p className="text-slate-400 mb-4">Add your first reseller to get started</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Add Reseller
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredResellers.map((reseller) => (
              <div
                key={reseller.id}
                className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={cn('p-3 rounded-xl', reseller.status === 'active' ? 'bg-green-500/20' : 'bg-slate-700/50')}>
                      <Users className="w-6 h-6 text-slate-300" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">{reseller.user_name || 'Unknown'}</h3>
                        <span className={cn('px-2 py-0.5 rounded-full text-xs', getStatusColor(reseller.status))}>
                          {reseller.status}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mb-2">{reseller.user_email || 'No email'}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Commission: {reseller.commission_rate}%</span>
                        <span>Discount: {reseller.discount_rate}%</span>
                        <span>Keys: {reseller.assigned_keys_count}/{reseller.max_keys}</span>
                        <span>Sales: ${reseller.total_sales.toLocaleString()}</span>
                        <span>{new Date(reseller.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {reseller.status === 'active' ? (
                      <button
                        onClick={() => toggleResellerStatus(reseller.id, 'suspended')}
                        className="p-2 rounded-lg hover:bg-red-500/20 transition-colors text-slate-400 hover:text-red-500"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleResellerStatus(reseller.id, 'active')}
                        className="p-2 rounded-lg hover:bg-green-500/20 transition-colors text-slate-400 hover:text-green-500"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                    )}
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

      {/* Recent Sales */}
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Recent Sales</h2>
          <button className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
            View All
            <TrendingUp className="w-4 h-4" />
          </button>
        </div>

        {sales.length === 0 ? (
          <div className="text-center py-12">
            <Target className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No sales yet</h3>
            <p className="text-slate-400">Reseller sales will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sales.map((sale) => {
              const reseller = resellers.find(r => r.id === sale.reseller_id);
              return (
                <div
                  key={sale.id}
                  className="bg-slate-800/30 backdrop-blur-sm rounded-lg p-4 border border-slate-700/50 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-green-500/20">
                      <DollarSign className="w-4 h-4 text-green-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">{reseller?.user_name || 'Unknown Reseller'}</span>
                        <span className="text-xs text-slate-500">{sale.order_id}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>Commission: ${sale.commission_amount.toFixed(2)}</span>
                        <span>{new Date(sale.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-green-500">+${sale.commission_amount.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
