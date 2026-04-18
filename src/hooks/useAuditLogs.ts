import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

type AuditAction = 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout' | 'suspend' | 'activate';

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: AuditAction;
  table_name: string;
  record_id: string | null;
  old_data: Json | null;
  new_data: Json | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export function useAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async (filters?: {
    userId?: string;
    tableName?: string;
    action?: AuditAction;
    startDate?: string;
    endDate?: string;
  }) => {
    setLoading(true);
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters?.tableName) {
      query = query.eq('table_name', filters.tableName);
    }
    if (filters?.action) {
      query = query.eq('action', filters.action);
    }
    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data, error } = await query;

    if (error) {
      toast.error('Failed to fetch audit logs');
      console.error(error);
    } else {
      setLogs((data || []) as AuditLog[]);
    }
    setLoading(false);
  };

  const logAction = async (
    action: AuditAction,
    tableName: string,
    recordId?: string,
    oldData?: Record<string, unknown>,
    newData?: Record<string, unknown>
  ) => {
    const { data: userData } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        user_id: userData.user?.id,
        action,
        table_name: tableName,
        record_id: recordId,
        old_data: oldData as Json,
        new_data: newData as Json,
        user_agent: navigator.userAgent
      });

    if (error) {
      console.error('Failed to log action:', error);
    }
  };

  const exportLogs = () => {
    const csv = [
      ['ID', 'User ID', 'Action', 'Table', 'Record ID', 'Created At'].join(','),
      ...logs.map(log => [
        log.id,
        log.user_id || '',
        log.action,
        log.table_name,
        log.record_id || '',
        log.created_at
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Logs exported');
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return {
    logs,
    loading,
    fetchLogs,
    logAction,
    exportLogs
  };
}
