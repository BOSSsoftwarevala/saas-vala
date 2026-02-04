import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  Loader2,
  History,
  Eye,
  User,
  Calendar,
  Database,
  Activity,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuditLogs, type AuditLog } from '@/hooks/useAuditLogs';
import { PaginationControls } from '@/components/ui/pagination-controls';

const ITEMS_PER_PAGE = 25;

const actionColors: Record<string, string> = {
  create: 'bg-success/20 text-success border-success/30',
  read: 'bg-primary/20 text-primary border-primary/30',
  update: 'bg-warning/20 text-warning border-warning/30',
  delete: 'bg-destructive/20 text-destructive border-destructive/30',
  login: 'bg-cyan/20 text-cyan border-cyan/30',
  logout: 'bg-muted text-muted-foreground border-border',
  suspend: 'bg-destructive/20 text-destructive border-destructive/30',
  activate: 'bg-success/20 text-success border-success/30',
};

const tableOptions = [
  'products',
  'license_keys',
  'servers',
  'wallets',
  'transactions',
  'resellers',
  'profiles',
  'demos',
  'apks',
  'leads',
];

const actionOptions = [
  'create',
  'read',
  'update',
  'delete',
  'login',
  'logout',
  'suspend',
  'activate',
];

export default function AuditLogs() {
  const { logs, loading, fetchLogs, exportLogs } = useAuditLogs();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Filters
  const [filterTable, setFilterTable] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const applyFilters = () => {
    const filters: Parameters<typeof fetchLogs>[0] = {};
    if (filterTable && filterTable !== 'all') filters.tableName = filterTable;
    if (filterAction && filterAction !== 'all') filters.action = filterAction as any;
    if (filterStartDate) filters.startDate = filterStartDate;
    if (filterEndDate) filters.endDate = filterEndDate;
    fetchLogs(filters);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilterTable('all');
    setFilterAction('all');
    setFilterStartDate('');
    setFilterEndDate('');
    setSearchQuery('');
    fetchLogs();
    setCurrentPage(1);
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.table_name.toLowerCase().includes(query) ||
      log.action.toLowerCase().includes(query) ||
      log.record_id?.toLowerCase().includes(query) ||
      log.user_id?.toLowerCase().includes(query)
    );
  });

  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);

  const stats = {
    total: logs.length,
    creates: logs.filter((l) => l.action === 'create').length,
    updates: logs.filter((l) => l.action === 'update').length,
    deletes: logs.filter((l) => l.action === 'delete').length,
  };

  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
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
              Track all system activities • Who / What / When
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => fetchLogs()} className="gap-2 border-border">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={exportLogs} className="bg-orange-gradient hover:opacity-90 text-white gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="h-10 w-10 mx-auto rounded-lg bg-primary/20 flex items-center justify-center mb-2">
              <History className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total Logs</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="h-10 w-10 mx-auto rounded-lg bg-success/20 flex items-center justify-center mb-2">
              <Activity className="h-5 w-5 text-success" />
            </div>
            <p className="text-2xl font-bold text-success">{stats.creates}</p>
            <p className="text-sm text-muted-foreground">Creates</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="h-10 w-10 mx-auto rounded-lg bg-warning/20 flex items-center justify-center mb-2">
              <Activity className="h-5 w-5 text-warning" />
            </div>
            <p className="text-2xl font-bold text-warning">{stats.updates}</p>
            <p className="text-sm text-muted-foreground">Updates</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <div className="h-10 w-10 mx-auto rounded-lg bg-destructive/20 flex items-center justify-center mb-2">
              <Activity className="h-5 w-5 text-destructive" />
            </div>
            <p className="text-2xl font-bold text-destructive">{stats.deletes}</p>
            <p className="text-sm text-muted-foreground">Deletes</p>
          </div>
        </div>

        {/* Filters */}
        <div className="glass-card rounded-xl p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Table</Label>
                <Select value={filterTable} onValueChange={setFilterTable}>
                  <SelectTrigger className="bg-muted/50 border-border">
                    <SelectValue placeholder="All Tables" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tables</SelectItem>
                    {tableOptions.map((table) => (
                      <SelectItem key={table} value={table}>
                        {table}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Action</Label>
                <Select value={filterAction} onValueChange={setFilterAction}>
                  <SelectTrigger className="bg-muted/50 border-border">
                    <SelectValue placeholder="All Actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {actionOptions.map((action) => (
                      <SelectItem key={action} value={action}>
                        {action}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Start Date</Label>
                <Input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="bg-muted/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">End Date</Label>
                <Input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="bg-muted/50 border-border"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={applyFilters} className="gap-2">
                <Filter className="h-4 w-4" />
                Apply
              </Button>
              <Button variant="outline" onClick={clearFilters} className="border-border">
                Clear
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by table, action, record ID, or user ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted/50 border-border"
            />
          </div>
        </div>

        {/* Logs Table */}
        <div className="glass-card rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : paginatedLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <History className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-foreground mb-2">No logs found</h3>
              <p className="text-muted-foreground">System activity will appear here</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-muted/50">
                    <TableHead className="text-muted-foreground">Timestamp</TableHead>
                    <TableHead className="text-muted-foreground">Action</TableHead>
                    <TableHead className="text-muted-foreground">Table</TableHead>
                    <TableHead className="text-muted-foreground">Record ID</TableHead>
                    <TableHead className="text-muted-foreground">User ID</TableHead>
                    <TableHead className="text-muted-foreground text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLogs.map((log) => (
                    <TableRow key={log.id} className="border-border hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm text-foreground">
                            {formatDate(log.created_at)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn('capitalize', actionColors[log.action])}
                        >
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Database className="h-3 w-3 text-muted-foreground" />
                          <span className="text-foreground font-mono text-sm">{log.table_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {log.record_id ? `${log.record_id.slice(0, 8)}...` : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono text-xs text-muted-foreground">
                            {log.user_id ? `${log.user_id.slice(0, 8)}...` : '-'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(log)}
                          className="gap-1"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredLogs.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>
      </div>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Log Details
            </DialogTitle>
            <DialogDescription>
              Full details of the audit log entry
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Action</Label>
                  <Badge
                    variant="outline"
                    className={cn('capitalize', actionColors[selectedLog.action])}
                  >
                    {selectedLog.action}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Table</Label>
                  <p className="font-mono text-sm text-foreground">{selectedLog.table_name}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Timestamp</Label>
                  <p className="text-sm text-foreground">{formatDate(selectedLog.created_at)}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Record ID</Label>
                  <p className="font-mono text-xs text-foreground break-all">
                    {selectedLog.record_id || '-'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">User ID</Label>
                <p className="font-mono text-xs text-foreground break-all">
                  {selectedLog.user_id || '-'}
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">IP Address</Label>
                <p className="font-mono text-sm text-foreground">
                  {selectedLog.ip_address || 'Not recorded'}
                </p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">User Agent</Label>
                <p className="font-mono text-xs text-muted-foreground break-all">
                  {selectedLog.user_agent || 'Not recorded'}
                </p>
              </div>

              {selectedLog.old_data && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Old Data</Label>
                  <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.old_data, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_data && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">New Data</Label>
                  <pre className="bg-muted rounded-lg p-3 text-xs overflow-x-auto">
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
