// Boss Audit Logs Module - System activity and security logs
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  FileText,
  Search,
  Filter,
  Download,
  RefreshCw,
  Shield,
  AlertTriangle,
  CheckCircle,
  User,
  Settings,
  Trash2,
  Calendar,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  changes: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  status: 'success' | 'failure' | 'warning';
  created_at: string;
  user_email?: string;
  user_name?: string;
}

export default function BossAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failure' | 'warning'>('all');
  const [actionFilter, setActionFilter] = useState('all');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*, users!inner(email, full_name)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setLogs((data as AuditLog[]).map(log => ({
        ...log,
        user_email: (log as any).users?.email,
        user_name: (log as any).users?.full_name,
      })));
    } catch (error) {
      console.error('Error loading logs:', error);
      toast.error('Failed to load logs');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-500 bg-green-500/10';
      case 'failure':
        return 'text-red-500 bg-red-500/10';
      case 'warning':
        return 'text-yellow-500 bg-yellow-500/10';
      default:
        return 'text-blue-500 bg-blue-500/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4" />;
      case 'failure':
        return <AlertTriangle className="w-4 h-4" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;

    return matchesSearch && matchesStatus && matchesAction;
  });

  const totalLogs = logs.length;
  const successLogs = logs.filter(l => l.status === 'success').length;
  const failureLogs = logs.filter(l => l.status === 'failure').length;
  const warningLogs = logs.filter(l => l.status === 'warning').length;

  const uniqueActions = Array.from(new Set(logs.map(l => l.action)));

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
          <h1 className="text-3xl font-bold text-white mb-2">Audit Logs</h1>
          <p className="text-slate-400">Track system activities and security events</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 text-white hover:bg-slate-800 transition-colors">
            <Download className="w-4 h-4" />
            Export Logs
          </button>
          <button
            onClick={loadLogs}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 text-white hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <FileText className="w-5 h-5 text-blue-400" />
            <span className="text-xs text-slate-400">Total</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{totalLogs}</h3>
          <p className="text-sm text-slate-400">Total Logs</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-xs text-slate-400">Success</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{successLogs}</h3>
          <p className="text-sm text-slate-400">Successful Actions</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-xs text-slate-400">Failures</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{failureLogs}</h3>
          <p className="text-sm text-slate-400">Failed Actions</p>
        </div>

        <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <Shield className="w-5 h-5 text-yellow-400" />
            <span className="text-xs text-slate-400">Warnings</span>
          </div>
          <h3 className="text-2xl font-bold text-white mb-1">{warningLogs}</h3>
          <p className="text-sm text-slate-400">Warning Events</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="all">All Status</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
              <option value="warning">Warning</option>
            </select>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="all">All Actions</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
            <button className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
              <Filter className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No logs found</h3>
            <p className="text-slate-400">Audit logs will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800/50 border-b border-slate-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Action</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Entity</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">User</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">IP Address</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Timestamp</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className={cn('flex items-center gap-2 px-2 py-1 rounded-full text-xs w-fit', getStatusColor(log.status))}>
                        {getStatusIcon(log.status)}
                        <span className="capitalize">{log.status}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-white">{log.action}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <span className="text-sm text-white">{log.entity_type}</span>
                        <span className="text-xs text-slate-500 ml-2">#{log.entity_id.slice(0, 8)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-sm text-slate-300">{log.user_name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-400">{log.ip_address || '-'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button className="p-2 rounded-lg hover:bg-slate-800 transition-colors">
                          <FileText className="w-4 h-4 text-slate-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
