import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CatalogEntry {
  id: string;
  project_name: string;
  vala_name: string | null;
  slug: string;
  file_path: string | null;
  file_size: number | null;
  uploaded_to_github: boolean;
  github_repo_url: string | null;
  github_account: string | null;
  tech_stack: Record<string, string[]>;
  detected_features: { name: string; description: string; icon: string }[];
  project_type: string | null;
  target_industry: string | null;
  ai_description: string | null;
  complexity_score: number;
  is_on_marketplace: boolean;
  marketplace_price: number;
  sales_count: number;
  status: string;
  created_at: string;
  analyzed_at: string | null;
  uploaded_at: string | null;
  listed_at: string | null;
}

interface CatalogStats {
  total: number;
  pending: number;
  analyzed: number;
  uploaded_to_github: number;
  on_marketplace: number;
  industries: Record<string, number>;
}

export function useSourceCodeCatalog() {
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [stats, setStats] = useState<CatalogStats | null>(null);

  // Add projects to catalog
  const addToCatalog = useCallback(async (projects: { project_name: string; file_path?: string; file_size?: number; github_account?: string }[]) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('source-code-manager', {
        body: { action: 'add_to_catalog', data: { projects } }
      });

      if (error) throw error;

      toast.success(`✅ ${data.added} projects added to catalog`);
      return data;
    } catch (error) {
      console.error('Add to catalog error:', error);
      toast.error('Failed to add projects');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Analyze a single project
  const analyzeProject = useCallback(async (catalogId: string, projectName: string, fileStructure?: string[]) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('source-code-manager', {
        body: { action: 'analyze_project', data: { catalogId, projectName, fileStructure } }
      });

      if (error) throw error;

      toast.success(`🔍 ${projectName} analyzed successfully`);
      return data.analysis;
    } catch (error) {
      console.error('Analyze error:', error);
      toast.error('Failed to analyze project');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Bulk analyze all pending projects
  const bulkAnalyze = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('source-code-manager', {
        body: { action: 'bulk_analyze' }
      });

      if (error) throw error;

      toast.success(`🔍 ${data.analyzed} projects analyzed`);
      return data;
    } catch (error) {
      console.error('Bulk analyze error:', error);
      toast.error('Failed to analyze projects');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Upload to GitHub
  const uploadToGitHub = useCallback(async (catalogId: string, projectName: string, description?: string, accountName?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('source-code-manager', {
        body: { action: 'upload_to_github', data: { catalogId, projectName, description, accountName } }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`🚀 Uploaded to GitHub: ${data.repo_url}`);
        return data;
      } else {
        toast.error(data.error || 'Upload failed');
        return null;
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload to GitHub');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Bulk upload to GitHub
  const bulkUploadGitHub = useCallback(async (accountName: string, limit: number = 10) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('source-code-manager', {
        body: { action: 'bulk_upload_github', data: { accountName, limit } }
      });

      if (error) throw error;

      toast.success(`🚀 ${data.uploaded} projects uploaded to GitHub`);
      return data;
    } catch (error) {
      console.error('Bulk upload error:', error);
      toast.error('Failed to upload to GitHub');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // List on marketplace
  const listOnMarketplace = useCallback(async (catalogId: string, price: number = 5, sellerId?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('source-code-manager', {
        body: { action: 'list_on_marketplace', data: { catalogId, price, sellerId } }
      });

      if (error) throw error;

      toast.success(`💰 Listed on marketplace for $${price}`);
      return data;
    } catch (error) {
      console.error('Marketplace listing error:', error);
      toast.error('Failed to list on marketplace');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get catalog stats
  const getStats = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('source-code-manager', {
        body: { action: 'get_catalog_stats' }
      });

      if (error) throw error;

      setStats(data.stats);
      return data.stats;
    } catch (error) {
      console.error('Stats error:', error);
      toast.error('Failed to get stats');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Search catalog
  const searchCatalog = useCallback(async (query?: string, industry?: string, status?: string, limit: number = 50) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('source-code-manager', {
        body: { action: 'search_catalog', data: { query, industry, status, limit } }
      });

      if (error) throw error;

      setCatalog(data.results || []);
      return data.results;
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search catalog');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Full pipeline: Analyze → Upload → List
  const runFullPipeline = useCallback(async (accountName: string = 'SaaSVala') => {
    setLoading(true);
    toast.info('🤖 Starting full pipeline...');

    try {
      // Step 1: Bulk analyze
      const analyzeResult = await bulkAnalyze();
      
      // Step 2: Bulk upload to GitHub
      const uploadResult = await bulkUploadGitHub(accountName, 20);
      
      // Step 3: Get stats
      await getStats();

      toast.success(`✅ Pipeline complete! ${analyzeResult?.analyzed || 0} analyzed, ${uploadResult?.uploaded || 0} uploaded`);
    } catch (error) {
      console.error('Pipeline error:', error);
      toast.error('Pipeline failed');
    } finally {
      setLoading(false);
    }
  }, [bulkAnalyze, bulkUploadGitHub, getStats]);

  // Sync all repos from GitHub account into catalog
  const syncGitHubRepos = useCallback(async (accountName = 'SaaSVala') => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('source-code-manager', {
        body: { action: 'sync_github_repos', data: { accountName } },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(data.message);
      }
      return data;
    } catch (err: any) {
      console.error('GitHub sync error:', err);
      toast.error('GitHub sync failed');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    catalog,
    stats,
    addToCatalog,
    analyzeProject,
    bulkAnalyze,
    uploadToGitHub,
    bulkUploadGitHub,
    listOnMarketplace,
    getStats,
    searchCatalog,
    runFullPipeline,
    syncGitHubRepos,
  };
}
