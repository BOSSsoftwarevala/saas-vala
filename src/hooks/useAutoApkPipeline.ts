import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PipelineStats {
  catalog: {
    total: number;
    pending: number;
    pending_build: number;
    building: number;
    completed: number;
    listed: number;
    on_marketplace: number;
  };
  queue: {
    queued: number;
    processing: number;
    completed: number;
    failed: number;
  };
}

export function useAutoApkPipeline() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<PipelineStats | null>(null);

  const invoke = useCallback(async (action: string, data?: any) => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('auto-apk-pipeline', {
        body: { action, data },
      });
      if (error) throw error;
      return result;
    } catch (err: any) {
      console.error(`APK Pipeline [${action}]:`, err);
      toast.error(err.message || 'Pipeline error');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const scanAndRegister = useCallback(async () => {
    const result = await invoke('scan_and_register');
    if (result?.success) {
      toast.success(result.message);
    }
    return result;
  }, [invoke]);

  const triggerBuild = useCallback(async (catalogId: string, slug: string) => {
    const result = await invoke('trigger_apk_build', { catalog_id: catalogId, slug });
    if (result?.success) {
      toast.success(`🔧 APK build ${result.build?.status} for ${slug}`);
    }
    return result;
  }, [invoke]);

  const bulkBuild = useCallback(async (limit = 10) => {
    const result = await invoke('bulk_build', { limit });
    if (result?.success) {
      toast.success(result.message);
    }
    return result;
  }, [invoke]);

  const checkUpdates = useCallback(async () => {
    const result = await invoke('check_updates');
    if (result?.success) {
      toast.success(result.message);
    }
    return result;
  }, [invoke]);

  const runFullPipeline = useCallback(async () => {
    toast.info('🤖 Starting full APK conversion pipeline...');
    const result = await invoke('full_pipeline');
    if (result?.success) {
      toast.success(result.message);
    }
    return result;
  }, [invoke]);

  const getStats = useCallback(async () => {
    const result = await invoke('get_stats');
    if (result?.success) {
      setStats(result);
    }
    return result;
  }, [invoke]);

  return {
    loading,
    stats,
    scanAndRegister,
    triggerBuild,
    bulkBuild,
    checkUpdates,
    runFullPipeline,
    getStats,
  };
}
