import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Database,
  Download,
  Trash2,
  PlayCircle,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  Calendar,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Backup {
  id: string;
  timestamp: string;
  size: number;
  status: 'success' | 'failed' | 'in_progress';
  type: 'full' | 'incremental' | 'database';
  location: string;
}

export function ServerBackups() {
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [servers, setServers] = useState<any[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    fetchServers();
  }, []);

  useEffect(() => {
    if (selectedServerId) {
      fetchBackups();
    }
  }, [selectedServerId]);

  const fetchServers = async () => {
    try {
      const { data, error } = await supabase
        .from('servers')
        .select('id, name, status')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServers(data || []);
      if (data?.[0]) {
        setSelectedServerId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch servers:', err);
      toast.error('Failed to fetch servers');
    } finally {
      setLoading(false);
    }
  };

  const fetchBackups = async () => {
    if (!selectedServerId) return;

    try {
      const { data, error } = await supabase.functions.invoke('server-agent', {
        body: {
          action: 'list_backups',
          serverId: selectedServerId,
        },
      });

      if (error) throw error;

      if (data?.backups) {
        setBackups(data.backups);
      }
    } catch (err) {
      console.error('Failed to fetch backups:', err);
      toast.error('Failed to fetch backups');
    }
  };

  const createBackup = async () => {
    if (!selectedServerId) {
      toast.error('Please select a server');
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('server-agent', {
        body: {
          action: 'create_backup',
          serverId: selectedServerId,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Backup created successfully');
        fetchBackups();
      }
    } catch (err: any) {
      console.error('Failed to create backup:', err);
      toast.error(`Backup failed: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const restoreBackup = async (backupId: string) => {
    if (!confirm('Restore from this backup? This cannot be undone.')) return;

    setRestoring(backupId);
    try {
      const { data, error } = await supabase.functions.invoke('server-agent', {
        body: {
          action: 'restore_backup',
          serverId: selectedServerId,
          backupId,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Backup restoration started');
        fetchBackups();
      }
    } catch (err: any) {
      console.error('Failed to restore backup:', err);
      toast.error(`Restore failed: ${err.message}`);
    } finally {
      setRestoring(null);
    }
  };

  const deleteBackup = async (backupId: string) => {
    if (!confirm('Delete this backup? This cannot be undone.')) return;

    try {
      const { data, error } = await supabase.functions.invoke('server-agent', {
        body: {
          action: 'delete_backup',
          serverId: selectedServerId,
          backupId,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Backup deleted');
        fetchBackups();
      }
    } catch (err: any) {
      console.error('Failed to delete backup:', err);
      toast.error(`Delete failed: ${err.message}`);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'success') return 'bg-success text-success-foreground';
    if (status === 'failed') return 'bg-destructive text-destructive-foreground';
    return 'bg-warning text-warning-foreground';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'success') return <CheckCircle2 className="h-4 w-4" />;
    if (status === 'failed') return <AlertTriangle className="h-4 w-4" />;
    return <Clock className="h-4 w-4 animate-spin" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return <div className="text-center py-8"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
  }

  const failedBackups = backups.filter((b) => b.status === 'failed');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-cyan" />
              Server Backups
            </CardTitle>
            <CardDescription>Create and manage automated backups</CardDescription>
          </div>
          <Button onClick={createBackup} disabled={creating} size="sm">
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Backup
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Server Selection */}
        <div>
          <label className="text-sm font-medium">Select Server</label>
          <select
            value={selectedServerId || ''}
            onChange={(e) => setSelectedServerId(e.target.value)}
            className="w-full mt-2 px-3 py-2 bg-background border border-input rounded-md"
          >
            {servers.map((server) => (
              <option key={server.id} value={server.id}>
                {server.name} ({server.status})
              </option>
            ))}
          </select>
        </div>

        {selectedServerId && (
          <>
            {/* Failed Backups Alert */}
            {failedBackups.length > 0 && (
              <Alert className="border-destructive bg-destructive/5">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-destructive">
                  {failedBackups.length} backup(s) failed. Please check server logs.
                </AlertDescription>
              </Alert>
            )}

            {/* Backup Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Total Backups</p>
                <p className="text-2xl font-bold">{backups.length}</p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Total Size</p>
                <p className="text-2xl font-bold">
                  {formatSize(backups.reduce((a, b) => a + (b.size || 0), 0))}
                </p>
              </div>
            </div>

            {/* Backups List */}
            <div className="space-y-3">
              <h4 className="font-medium">Recent Backups</h4>
              {backups.length === 0 ? (
                <p className="text-sm text-muted-foreground">No backups yet</p>
              ) : (
                backups.slice(0, 10).map((backup) => (
                  <div key={backup.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(backup.status)}
                        <div>
                          <p className="font-medium text-sm">{backup.type.toUpperCase()}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(backup.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{formatSize(backup.size)}</span>
                        <Badge className={getStatusColor(backup.status)}>
                          {backup.status.toUpperCase()}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => restoreBackup(backup.id)}
                        disabled={restoring === backup.id || backup.status !== 'success'}
                        className="flex-1 text-xs"
                      >
                        {restoring === backup.id ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Restoring...
                          </>
                        ) : (
                          <>
                            <PlayCircle className="h-3 w-3 mr-1" />
                            Restore
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteBackup(backup.id)}
                        className="flex-1 text-xs"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 text-xs">
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
