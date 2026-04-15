// Boss Servers Module - Server management and monitoring
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Server,
  Plus,
  Search,
  Filter,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Activity,
  Cpu,
  HardDrive,
  Memory,
  Globe,
  Shield,
  Zap,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ServerData {
  id: string;
  name: string;
  ip_address: string;
  type: 'cdn' | 'api' | 'database' | 'storage' | 'compute';
  region: string;
  status: 'online' | 'offline' | 'maintenance' | 'error';
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  uptime_seconds: number;
  last_ping_at: string;
  created_at: string;
  updated_at: string;
}

interface ServerDeployment {
  id: string;
  server_id: string;
  version: string;
  status: 'pending' | 'deploying' | 'success' | 'failed';
  started_at: string;
  completed_at: string | null;
  logs: string;
  created_by: string;
}

export default function BossServers() {
  const [servers, setServers] = useState<ServerData[]>([]);
  const [deployments, setDeployments] = useState<ServerDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [serversData, deploymentsData] = await Promise.all([
        fetchServers(),
        fetchDeployments(),
      ]);

      setServers(serversData);
      setDeployments(deploymentsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchServers = async (): Promise<ServerData[]> => {
    const { data, error } = await supabase
      .from('servers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as ServerData[]) || [];
  };

  const fetchDeployments = async (): Promise<ServerDeployment[]> => {
    const { data, error } = await supabase
      .from('server_deployments')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    return (data as ServerDeployment[]) || [];
  };

  const toggleServerStatus = async (id: string, status: 'online' | 'offline') => {
    try {
      const { error } = await supabase
        .from('servers')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      setServers(prev =>
        prev.map(s =>
          s.id === id ? { ...s, status } : s
        )
      );
      toast.success(`Server ${status}`);
    } catch (error) {
      console.error('Error updating server:', error);
      toast.error('Failed to update server');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'success':
        return 'text-green-500 bg-green-500/10';
      case 'offline':
      case 'error':
      case 'failed':
        return 'text-red-500 bg-red-500/10';
      case 'maintenance':
      case 'pending':
      case 'deploying':
        return 'text-yellow-500 bg-yellow-500/10';
      default:
        return 'text-blue-500 bg-blue-500/10';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'cdn':
        return <Globe className="w-4 h-4" />;
      case 'api':
        return <Zap className="w-4 h-4" />;
      case 'database':
        return <HardDrive className="w-4 h-4" />;
      case 'storage':
        return <HardDrive className="w-4 h-4" />;
      case 'compute':
        return <Cpu className="w-4 h-4" />;
      default:
        return <Server className="w-4 h-4" />;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const filteredServers = servers.filter(server =>
    server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    server.ip_address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalServers = servers.length;
  const onlineServers = servers.filter(s => s.status === 'online').length;
  const offlineServers = servers.filter(s => s.status === 'offline').length;
  const avgCpuUsage = servers.length > 0
    ? servers.reduce((sum, s) => sum + s.cpu_usage, 0) / servers.length
    : 0;

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
          <h1 className="text-3xl font-bold text-white mb-2">Servers</h1>
          <p className="text-slate-400">Monitor and manage server infrastructure</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-5 h-5" />
          Add Server
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <Server className="w-5 h-5 text-blue-400" />
            <span className="text-xs text-slate-400">Total</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{totalServers}</h3>
          <p className="text-sm text-slate-400">Total Servers</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-xs text-slate-400">Online</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{onlineServers}</h3>
          <p className="text-sm text-slate-400">Online Servers</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <XCircle className="w-5 h-5 text-red-400" />
            <span className="text-xs text-slate-400">Offline</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{offlineServers}</h3>
          <p className="text-sm text-slate-400">Offline Servers</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <Cpu className="w-5 h-5 text-purple-400" />
            <span className="text-xs text-slate-400">Average</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{avgCpuUsage.toFixed(1)}%</h3>
          <p className="text-sm text-slate-400">CPU Usage</p>
        </div>
      </div>

      {/* Servers List */}
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Servers</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search servers..."
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

        {filteredServers.length === 0 ? (
          <div className="text-center py-12">
            <Server className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No servers configured yet</h3>
            <p className="text-slate-400 mb-4">Add your first server to get started</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Add Server
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredServers.map((server) => (
              <div
                key={server.id}
                className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-5 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={cn('p-3 rounded-xl', server.status === 'online' ? 'bg-green-500/20' : 'bg-slate-700/50')}>
                      {getTypeIcon(server.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">{server.name}</h3>
                        <span className={cn('px-2 py-0.5 rounded-full text-xs', getStatusColor(server.status))}>
                          {server.status}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-slate-700 text-slate-300 capitalize">
                          {server.type}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mb-2">{server.ip_address} • {server.region}</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-3 h-3" />
                          <span>CPU: {server.cpu_usage}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Memory className="w-3 h-3" />
                          <span>Memory: {server.memory_usage}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <HardDrive className="w-3 h-3" />
                          <span>Disk: {server.disk_usage}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Activity className="w-3 h-3" />
                          <span>Uptime: {formatUptime(server.uptime_seconds)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {server.status === 'online' ? (
                      <button
                        onClick={() => toggleServerStatus(server.id, 'offline')}
                        className="p-2 rounded-lg hover:bg-red-500/20 transition-colors text-slate-400 hover:text-red-500"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleServerStatus(server.id, 'online')}
                        className="p-2 rounded-lg hover:bg-green-500/20 transition-colors text-slate-400 hover:text-green-500"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                    )}
                    <button className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
                      <RefreshCw className="w-5 h-5 text-slate-400" />
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

      {/* Recent Deployments */}
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Recent Deployments</h2>
        </div>

        {deployments.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No deployments yet</h3>
            <p className="text-slate-400">Deployment history will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deployments.map((deployment) => {
              const server = servers.find(s => s.id === deployment.server_id);
              return (
                <div
                  key={deployment.id}
                  className="bg-slate-800/30 backdrop-blur-sm rounded-lg p-4 border border-slate-700/50 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className={cn('p-2 rounded-lg', getStatusColor(deployment.status))}>
                      {deployment.status === 'success' ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : deployment.status === 'failed' ? (
                        <XCircle className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">{server?.name || 'Unknown Server'}</span>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full', getStatusColor(deployment.status))}>
                          {deployment.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>Version: {deployment.version}</span>
                        <span>Started: {new Date(deployment.started_at).toLocaleString()}</span>
                        {deployment.completed_at && (
                          <span>Completed: {new Date(deployment.completed_at).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {deployment.status === 'failed' && (
                    <div className="flex items-center gap-2 text-xs text-red-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Check logs for details</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
