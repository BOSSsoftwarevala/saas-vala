import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, Download, Filter, RefreshCw, Eye, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { auditLogger, type AuditLog, type LogFilter } from '@/lib/auditLogs';
import { 
  Search,
  FileText,
  User,
  Package,
  Key,
  Server,
  CreditCard,
  Loader2,
  Eye,
  Download,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/integrations/supabase/types';
import { auditLogsIntegrator } from '@/lib/offline/moduleIntegration';

type AuditLog = Database['public']['Tables']['audit_logs']['Row'];
type AuditAction = Database['public']['Enums']['audit_action'];

const actionColors: Record<AuditAction, string> = {
  create: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  update: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  delete: 'bg-red-500/20 text-red-400 border-red-500/30',
  read: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  login: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  logout: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  activate: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  suspend: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const tableIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  products: Package,
  license_keys: Key,
  servers: Server,
  transactions: CreditCard,
  profiles: User,
};

export default function AuditLogs() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<AuditAction | 'all'>('all');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    console.log('[AuditLogs] MODULE LOADED');
    // Initialize module integration with all 30 micro validations
    const init = async () => {
      try {
        await auditLogsIntegrator.initialize();
        setInitialized(true);
      } catch (error) {
        console.error('Failed to initialize audit logs module:', error);
        setInitialized(true);
      }
    };

    init();

    // Cleanup on unmount
    return () => {
      auditLogsIntegrator.cleanup();
    };
  }, []);

  const fetchLogs = async () => {
    // Click lock to prevent double clicks
    const lockKey = 'fetch-logs';
    if (!auditLogsIntegrator.acquireClickLock(lockKey)) {
      return;
    }

    try {
      await auditLogsIntegrator.withSafeLoading(async () => {
        let query = supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500);

        if (actionFilter !== 'all') {
          query = query.eq('action', actionFilter);
        }
        if (tableFilter !== 'all') {
          query = query.eq('table_name', tableFilter);
        }

        const { data, error } = await auditLogsIntegrator.withNetworkRetry(() => query);
        if (error) throw error;

        // Apply API edge case handling
        const result = auditLogsIntegrator.handleApiSafe(data, []);
        setLogs(result.data || []);

        auditLogsIntegrator.logAction('logs_fetched', { count: result.data?.length });
      }, setLoading, (error) => {
        const safeError = auditLogsIntegrator.getSafeError(error);
        toast.error(safeError);
      });
    } finally {
      auditLogsIntegrator.releaseClickLock(lockKey);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, tableFilter]);

  const filteredLogs = auditLogsIntegrator.safeMap(logs, (log) => {
    // Null shield for safe access
    const tableName = auditLogsIntegrator.safeString(log.table_name, '');
    const action = auditLogsIntegrator.safeString(log.action, '');
    const recordId = auditLogsIntegrator.safeString(log.record_id, '');
    const searchLower = auditLogsIntegrator.safeString(searchQuery, '').toLowerCase();

    return (
      tableName.toLowerCase().includes(searchLower) ||
      action.toLowerCase().includes(searchLower) ||
      recordId.includes(searchLower)
    );
  });

  const uniqueTables = auditLogsIntegrator.safeMap(logs, (l) => auditLogsIntegrator.safeString(l.table_name, ''));
  const uniqueTablesSet = [...new Set(uniqueTables)];

  const exportLogs = () => {
    // Click lock to prevent double clicks
    const lockKey = 'export-logs';
    if (!auditLogsIntegrator.acquireClickLock(lockKey)) {
      return;
    }

    try {
      // Apply array safety
      const safeFilteredLogs = auditLogsIntegrator.nullShield(filteredLogs, []);

      const csv = [
        ['ID', 'Table', 'Action', 'Record ID', 'User ID', 'IP Address', 'Created At'].join(','),
        ...safeFilteredLogs.map(log => [
          auditLogsIntegrator.safeString(log.id, ''),
          auditLogsIntegrator.safeString(log.table_name, ''),
          auditLogsIntegrator.safeString(log.action, ''),
          auditLogsIntegrator.safeString(log.record_id, ''),
          auditLogsIntegrator.safeString(log.user_id, ''),
          auditLogsIntegrator.safeString(log.ip_address, ''),
          auditLogsIntegrator.safeString(log.created_at, '')
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();

      auditLogsIntegrator.logAction('logs_exported', { count: safeFilteredLogs.length });
      toast.success('Logs exported successfully');
    } catch (error) {
      const safeError = auditLogsIntegrator.getSafeError(error);
      toast.error(safeError);
    } finally {
      auditLogsIntegrator.releaseClickLock(lockKey);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              Audit Logs
            </h2>
            <p className="text-muted-foreground">
              System-wide activity tracking and compliance records
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate('/products')} className="gap-2">
              <Package className="h-4 w-4" />
              Products
            </Button>
            <Button variant="outline" onClick={() => navigate('/keys')} className="gap-2">
              <Key className="h-4 w-4" />
              Keys
            </Button>
            <Button variant="outline" onClick={() => navigate('/resellers')} className="gap-2">
              <Users className="h-4 w-4" />
              Resellers
            </Button>
            <Button variant="outline" onClick={fetchLogs} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={exportLogs} className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="glass-card rounded-xl p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div className="relative flex-1 md:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted/50 border-border"
              />
            </div>
            <div className="flex items-center gap-3">
              <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as AuditAction | 'all')}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                </SelectContent>
              </Select>
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Table" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tables</SelectItem>
                  {uniqueTablesSet.map(table => (
                    <SelectItem key={table} value={table}>{table}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{logs.length}</p>
            <p className="text-sm text-muted-foreground">Total Logs</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-primary">
              {logs.filter(l => l.action === 'create').length}
            </p>
            <p className="text-sm text-muted-foreground">Creates</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-primary">
              {logs.filter(l => l.action === 'update').length}
            </p>
            <p className="text-sm text-muted-foreground">Updates</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-primary">
              {logs.filter(l => l.action === 'delete').length}
            </p>
            <p className="text-sm text-muted-foreground">Deletes</p>
          </div>
        </div>

        {/* Logs Table */}
        <div className="glass-card rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-foreground mb-2">No audit logs found</h3>
              <p className="text-muted-foreground">Activity will appear here as users interact with the system</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-muted/50">
                  <TableHead className="text-muted-foreground">Table</TableHead>
                  <TableHead className="text-muted-foreground">Action</TableHead>
                  <TableHead className="text-muted-foreground">Record ID</TableHead>
                  <TableHead className="text-muted-foreground">User</TableHead>
                  <TableHead className="text-muted-foreground">IP Address</TableHead>
                  <TableHead className="text-muted-foreground">Timestamp</TableHead>
                  <TableHead className="text-muted-foreground text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.slice(0, 100).map((log) => {
                  const Icon = tableIcons[log.table_name] || FileText;
                  return (
                    <TableRow key={log.id} className="border-border hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">{log.table_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('uppercase text-xs', actionColors[log.action])}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {log.record_id?.slice(0, 8)}...
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {log.user_id?.slice(0, 8) || 'System'}...
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {log.ip_address || 'N/A'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {new Date(log.created_at || '').toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Log Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Table</p>
                  <p className="font-medium">{selectedLog.table_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Action</p>
                  <Badge variant="outline" className={cn('uppercase', actionColors[selectedLog.action])}>
                    {selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Record ID</p>
                  <p className="font-mono text-sm">{selectedLog.record_id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">User ID</p>
                  <p className="font-mono text-sm">{selectedLog.user_id || 'System'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">IP Address</p>
                  <p className="font-mono text-sm">{selectedLog.ip_address || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">User Agent</p>
                  <p className="text-sm truncate">{selectedLog.user_agent || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Timestamp</p>
                  <p>{new Date(selectedLog.created_at || '').toLocaleString()}</p>
                </div>
              </div>
              
              {selectedLog.old_data && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Old Data</p>
                  <pre className="bg-muted/50 p-4 rounded-lg text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.old_data, null, 2)}
                  </pre>
                </div>
              )}
              
              {selectedLog.new_data && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">New Data</p>
                  <pre className="bg-muted/50 p-4 rounded-lg text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.new_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
