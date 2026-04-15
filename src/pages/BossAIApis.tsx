// Boss AI APIs Module - AI provider integrations management
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Plus,
  Globe,
  Cpu,
  DollarSign,
  Activity,
  Settings,
  MoreVertical,
  CheckCircle,
  XCircle,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Search,
  Filter,
  Zap,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AIProvider {
  id: string;
  name: string;
  category: string;
  display_name: string;
  description: string;
  created_at: string;
}

interface AIIntegration {
  id: string;
  provider_id: string;
  api_key: string;
  endpoint_url: string;
  model: string;
  priority: number;
  is_active: boolean;
  failover_enabled: boolean;
  daily_limit: number;
  daily_cost_limit: number;
  created_at: string;
  updated_at: string;
}

interface AIUsageLog {
  id: string;
  integration_id: string;
  request_id: string;
  model: string;
  tokens_used: number;
  cost: number;
  latency_ms: number;
  status: 'success' | 'error';
  error_message: string | null;
  created_at: string;
}

export default function BossAIApis() {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [integrations, setIntegrations] = useState<AIIntegration[]>([]);
  const [usageLogs, setUsageLogs] = useState<AIUsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [providersData, integrationsData, logsData] = await Promise.all([
        fetchProviders(),
        fetchIntegrations(),
        fetchUsageLogs(),
      ]);

      setProviders(providersData);
      setIntegrations(integrationsData);
      setUsageLogs(logsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchProviders = async (): Promise<AIProvider[]> => {
    const { data, error } = await supabase
      .from('ai_providers')
      .select('*')
      .order('name');

    if (error) throw error;
    return (data as AIProvider[]) || [];
  };

  const fetchIntegrations = async (): Promise<AIIntegration[]> => {
    const { data, error } = await supabase
      .from('ai_api_integrations')
      .select('*')
      .order('priority', { ascending: true });

    if (error) throw error;
    return (data as AIIntegration[]) || [];
  };

  const fetchUsageLogs = async (): Promise<AIUsageLog[]> => {
    const { data, error } = await supabase
      .from('ai_api_usage_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return (data as AIUsageLog[]) || [];
  };

  const toggleIntegration = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('ai_api_integrations')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;

      setIntegrations(prev =>
        prev.map(int =>
          int.id === id ? { ...int, is_active: isActive } : int
        )
      );
      toast.success(isActive ? 'Integration activated' : 'Integration deactivated');
    } catch (error) {
      console.error('Error toggling integration:', error);
      toast.error('Failed to update integration');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
      case 'active':
        return 'text-green-500 bg-green-500/10';
      case 'error':
      case 'inactive':
        return 'text-red-500 bg-red-500/10';
      default:
        return 'text-yellow-500 bg-yellow-500/10';
    }
  };

  const calculateDailyStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayLogs = usageLogs.filter(
      log => log.created_at.startsWith(today)
    );

    return {
      totalRequests: todayLogs.length,
      totalTokens: todayLogs.reduce((sum, log) => sum + log.tokens_used, 0),
      totalCost: todayLogs.reduce((sum, log) => sum + log.cost, 0),
      successRate: todayLogs.length > 0
        ? (todayLogs.filter(log => log.status === 'success').length / todayLogs.length) * 100
        : 100,
      avgLatency: todayLogs.length > 0
        ? todayLogs.reduce((sum, log) => sum + log.latency_ms, 0) / todayLogs.length
        : 0,
    };
  };

  const dailyStats = calculateDailyStats();

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
          <h1 className="text-3xl font-bold text-white mb-2">AI APIs</h1>
          <p className="text-slate-400">Manage AI provider integrations and monitor usage</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-5 h-5" />
          Add Integration
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <Activity className="w-5 h-5 text-blue-400" />
            <span className="text-xs text-slate-400">Today</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{dailyStats.totalRequests}</h3>
          <p className="text-sm text-slate-400">Total Requests</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <Cpu className="w-5 h-5 text-purple-400" />
            <span className="text-xs text-slate-400">Today</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{dailyStats.totalTokens.toLocaleString()}</h3>
          <p className="text-sm text-slate-400">Tokens Used</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <DollarSign className="w-5 h-5 text-green-400" />
            <span className="text-xs text-slate-400">Today</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">${dailyStats.totalCost.toFixed(2)}</h3>
          <p className="text-sm text-slate-400">Total Cost</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-xs text-slate-400">Today</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{dailyStats.successRate.toFixed(1)}%</h3>
          <p className="text-sm text-slate-400">Success Rate</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <Zap className="w-5 h-5 text-yellow-400" />
            <span className="text-xs text-slate-400">Today</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{dailyStats.avgLatency.toFixed(0)}ms</h3>
          <p className="text-sm text-slate-400">Avg Latency</p>
        </div>
      </div>

      {/* Integrations */}
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Active Integrations</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search integrations..."
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

        {integrations.length === 0 ? (
          <div className="text-center py-12">
            <Globe className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No integrations yet</h3>
            <p className="text-slate-400 mb-4">Add your first AI provider integration</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Add Integration
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {integrations.map((integration) => {
              const provider = providers.find(p => p.id === integration.provider_id);
              return (
                <div
                  key={integration.id}
                  className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={cn('p-3 rounded-xl', integration.is_active ? 'bg-green-500/20' : 'bg-slate-700/50')}>
                        <Globe className="w-6 h-6 text-slate-300" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-white">{provider?.display_name || integration.model}</h3>
                          <span className={cn('px-2 py-0.5 rounded-full text-xs', getStatusColor(integration.is_active ? 'active' : 'inactive'))}>
                            {integration.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-300">
                            Priority: {integration.priority}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 mb-2">{provider?.description || integration.model}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span>Model: {integration.model}</span>
                          <span>Daily Limit: {integration.daily_limit}</span>
                          <span>Cost Limit: ${integration.daily_cost_limit}</span>
                          {integration.failover_enabled && (
                            <span className="flex items-center gap-1 text-yellow-400">
                              <Shield className="w-3 h-3" />
                              Failover Enabled
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleIntegration(integration.id, !integration.is_active)}
                        className={cn(
                          'p-2 rounded-lg transition-colors',
                          integration.is_active
                            ? 'hover:bg-red-500/20 text-green-500 hover:text-red-500'
                            : 'hover:bg-green-500/20 text-slate-400 hover:text-green-500'
                        )}
                      >
                        {integration.is_active ? (
                          <XCircle className="w-5 h-5" />
                        ) : (
                          <CheckCircle className="w-5 h-5" />
                        )}
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
              );
            })}
          </div>
        )}
      </div>

      {/* Usage Logs */}
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Recent Usage Logs</h2>
          <button className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
            View All
            <TrendingUp className="w-4 h-4" />
          </button>
        </div>

        {usageLogs.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No usage logs yet</h3>
            <p className="text-slate-400">API usage logs will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {usageLogs.map((log) => (
              <div
                key={log.id}
                className="bg-slate-800/30 backdrop-blur-sm rounded-lg p-4 border border-slate-700/50 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className={cn('p-2 rounded-lg', getStatusColor(log.status))}>
                    {log.status === 'success' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">{log.request_id}</span>
                      <span className="text-xs text-slate-500">{log.model}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{log.tokens_used} tokens</span>
                      <span>${log.cost.toFixed(4)}</span>
                      <span>{log.latency_ms}ms</span>
                      <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
                {log.error_message && (
                  <div className="flex items-center gap-2 text-xs text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{log.error_message}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
