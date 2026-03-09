import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DeployBatchResult {
  success: boolean;
  batch_offset: number;
  batch_size: number;
  deployed: number;
  failed: number;
  next_offset: number;
  has_more: boolean;
  results: Array<{
    slug: string;
    success: boolean;
    error?: string;
    custom_domain?: string;
    vercel_url?: string;
  }>;
  message: string;
}

interface DeployStatus {
  total_repos: number;
  deployed_with_subdomain: number;
  pending: number;
}

export function useBulkVercelDeploy() {
  const [deploying, setDeploying] = useState(false);
  const [status, setStatus] = useState<DeployStatus | null>(null);
  const [batchResults, setBatchResults] = useState<DeployBatchResult[]>([]);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [totalDeployed, setTotalDeployed] = useState(0);
  const [totalFailed, setTotalFailed] = useState(0);

  const getStatus = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('bulk-vercel-deploy', {
        body: { action: 'status' },
      });
      if (error) throw error;
      setStatus(data);
      return data;
    } catch (err: any) {
      toast.error('Failed to get deploy status');
      return null;
    }
  }, []);

  const deployBatch = useCallback(async (batchSize = 10, offset = 0): Promise<DeployBatchResult | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('bulk-vercel-deploy', {
        body: { action: 'deploy-batch', batch_size: batchSize, offset },
      });
      if (error) throw error;
      return data as DeployBatchResult;
    } catch (err: any) {
      toast.error(`Batch deploy failed: ${err.message}`);
      return null;
    }
  }, []);

  const deployAll = useCallback(async (batchSize = 5) => {
    setDeploying(true);
    setBatchResults([]);
    setTotalDeployed(0);
    setTotalFailed(0);
    let offset = 0;
    let hasMore = true;

    toast.info('🚀 Starting bulk Vercel deployment...');

    while (hasMore) {
      const result = await deployBatch(batchSize, offset);
      if (!result) {
        hasMore = false;
        break;
      }

      setBatchResults(prev => [...prev, result]);
      setTotalDeployed(prev => prev + result.deployed);
      setTotalFailed(prev => prev + result.failed);
      setCurrentOffset(result.next_offset);

      toast.success(result.message);
      hasMore = result.has_more;
      offset = result.next_offset;

      // Small delay between batches
      if (hasMore) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    setDeploying(false);
    await getStatus();
    toast.success(`✅ Bulk deployment complete! Deployed: ${totalDeployed}, Failed: ${totalFailed}`);
  }, [deployBatch, getStatus, totalDeployed, totalFailed]);

  const reset = useCallback(() => {
    setBatchResults([]);
    setCurrentOffset(0);
    setTotalDeployed(0);
    setTotalFailed(0);
  }, []);

  return {
    deploying,
    status,
    batchResults,
    currentOffset,
    totalDeployed,
    totalFailed,
    getStatus,
    deployBatch,
    deployAll,
    reset,
  };
}
