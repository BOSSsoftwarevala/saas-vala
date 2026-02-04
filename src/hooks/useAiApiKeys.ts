import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AiApiKey {
  id: string;
  user_id: string;
  name: string;
  api_key: string;
  enabled: boolean;
  usage_limit: number;
  current_usage: number;
  last_used_at: string | null;
  created_at: string;
}

export function useAiApiKeys() {
  const [apiKeys, setApiKeys] = useState<AiApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchApiKeys = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setLoading(false);
        return;
      }

      const { data, error, count } = await supabase
        .from('ai_usage')
        .select('*', { count: 'exact' })
        .eq('user_id', userData.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching AI usage:', error);
      } else {
        // Transform ai_usage data into API key format for display
        const keys: AiApiKey[] = (data || []).map((usage) => ({
          id: usage.id,
          user_id: usage.user_id,
          name: usage.endpoint || 'API Key',
          api_key: `sk-vala-${usage.id.slice(0, 8)}...${usage.id.slice(-4)}`,
          enabled: true,
          usage_limit: 10000,
          current_usage: (usage.tokens_input || 0) + (usage.tokens_output || 0),
          last_used_at: usage.created_at,
          created_at: usage.created_at || new Date().toISOString(),
        }));
        setApiKeys(keys);
        setTotal(count || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  const getUsageStats = () => {
    const totalKeys = apiKeys.length;
    const activeKeys = apiKeys.filter(k => k.enabled).length;
    const totalRequests = apiKeys.reduce((sum, k) => sum + k.current_usage, 0);
    const totalCost = totalRequests * 0.00001; // Approximate cost

    return {
      totalKeys,
      activeKeys,
      totalRequests,
      totalCost,
    };
  };

  useEffect(() => {
    fetchApiKeys();
  }, []);

  return {
    apiKeys,
    loading,
    total,
    fetchApiKeys,
    getUsageStats,
  };
}
