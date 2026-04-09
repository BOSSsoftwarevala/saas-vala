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

  const invoke = useCallback(async (funcName: string, action: string, data?: any) => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke(funcName, {
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
    const result = await invoke('auto-apk-pipeline', 'scan_and_register');
    if (result?.success) toast.success(result.message);
    return result;
  }, [invoke]);

  const triggerBuild = useCallback(async (catalogId: string, slug: string) => {
    const result = await invoke('auto-apk-pipeline', 'trigger_apk_build', { catalog_id: catalogId, slug });
    if (result?.success) toast.success(`🔧 APK build ${result.build?.status} for ${slug}`);
    return result;
  }, [invoke]);

  const bulkBuild = useCallback(async (limit = 10) => {
    const result = await invoke('auto-apk-pipeline', 'bulk_build', { limit });
    if (result?.success) toast.success(result.message);
    return result;
  }, [invoke]);

  const checkUpdates = useCallback(async () => {
    const result = await invoke('auto-apk-pipeline', 'check_updates');
    if (result?.success) toast.success(result.message);
    return result;
  }, [invoke]);

  const runFullPipeline = useCallback(async () => {
    toast.info('🤖 Starting full APK conversion pipeline...');
    const result = await invoke('auto-apk-pipeline', 'full_pipeline');
    if (result?.success) toast.success(result.message);
    return result;
  }, [invoke]);

  const autoMarketplaceWorkflow = useCallback(async (limit = 20) => {
    toast.info('🤖 Running auto marketplace workflow...');
    const result = await invoke('auto-apk-pipeline', 'auto_marketplace_workflow', { limit });
    if (result?.success) toast.success(result.message);
    return result;
  }, [invoke]);

  const selfHealPipeline = useCallback(async (limit = 120) => {
    toast.info('🛠️ Running self-healing checks...');
    const result = await invoke('auto-apk-pipeline', 'self_heal_pipeline', {
      limit,
      stale_minutes: 90,
      retry_limit: 3,
    });
    if (result?.success) toast.success(result.message);
    return result;
  }, [invoke]);

  const getStats = useCallback(async () => {
    const result = await invoke('auto-apk-pipeline', 'get_stats');
    if (result?.success) setStats(result);
    return result;
  }, [invoke]);

  // APK Factory actions
  const setupFactory = useCallback(async () => {
    const result = await invoke('apk-factory', 'setup_factory');
    if (result?.success) toast.success(result.message);
    return result;
  }, [invoke]);

  const triggerFactoryBuild = useCallback(async (slug: string, repoUrl?: string, productId?: string) => {
    const result = await invoke('apk-factory', 'trigger_build', { slug, repo_url: repoUrl, product_id: productId });
    if (result?.success) toast.success(result.message);
    return result;
  }, [invoke]);

  const checkBuildStatus = useCallback(async (slug?: string) => {
    const result = await invoke('apk-factory', 'check_build_status', { slug });
    return result;
  }, [invoke]);

  const registerPhpOfflineConversion = useCallback(async (payload: {
    productId: string;
    projectName?: string;
    sourceKind: 'zip_upload' | 'github_repo';
    sourceBucketPath?: string;
    sourceRepoUrl?: string;
    outputPlatform?: 'android_apk' | 'windows_exe' | 'desktop_webview' | 'electron_exe' | 'ios_bundle';
    version?: string;
    notes?: string;
  }) => {
    const result = await invoke('auto-apk-pipeline', 'register_php_offline_conversion', {
      product_id: payload.productId,
      project_name: payload.projectName,
      source_kind: payload.sourceKind,
      source_bucket_path: payload.sourceBucketPath,
      source_repo_url: payload.sourceRepoUrl,
      output_platform: payload.outputPlatform || 'android_apk',
      version: payload.version || '1.0.0',
      notes: payload.notes,
    });
    if (result?.success) toast.success(result.message || 'PHP offline conversion queued');
    return result;
  }, [invoke]);

  const finalizePhpOfflineConversion = useCallback(async (payload: {
    queueId: string;
    productId: string;
    outputPlatform: 'android_apk' | 'windows_exe' | 'desktop_webview' | 'electron_exe' | 'ios_bundle';
    version: string;
    filePath: string;
    fileSize?: number;
    fileHash?: string;
    licenseRuntimeBundle?: Record<string, unknown>;
    buildMeta?: Record<string, unknown>;
  }) => {
    const result = await invoke('auto-apk-pipeline', 'finalize_php_offline_conversion', {
      queue_id: payload.queueId,
      product_id: payload.productId,
      output_platform: payload.outputPlatform,
      version: payload.version,
      file_path: payload.filePath,
      file_size: payload.fileSize,
      file_hash: payload.fileHash,
      license_runtime_bundle: payload.licenseRuntimeBundle || {},
      build_meta: payload.buildMeta || {},
    });
    if (result?.success) toast.success(result.message || 'PHP offline build finalized');
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
    autoMarketplaceWorkflow,
    selfHealPipeline,
    getStats,
    setupFactory,
    triggerFactoryBuild,
    checkBuildStatus,
    registerPhpOfflineConversion,
    finalizePhpOfflineConversion,
  };
}
