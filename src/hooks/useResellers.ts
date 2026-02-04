import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface Reseller {
  id: string;
  user_id: string;
  company_name: string | null;
  commission_percent: number;
  credit_limit: number;
  total_sales: number;
  total_commission: number;
  is_active: boolean;
  is_verified: boolean;
  meta: Json;
  created_at: string;
  updated_at: string;
  // Joined profile data
  profile?: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
}

export function useResellers() {
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchResellers = async (page = 1, limit = 25, search = '') => {
    setLoading(true);
    try {
      let query = supabase
        .from('resellers')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (search) {
        query = query.or(`company_name.ilike.%${search}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        toast.error('Failed to fetch resellers');
        console.error(error);
      } else {
        setResellers((data || []) as Reseller[]);
        setTotal(count || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  const createReseller = async (reseller: Partial<Reseller>) => {
    const { data, error } = await supabase
      .from('resellers')
      .insert({
        user_id: reseller.user_id!,
        company_name: reseller.company_name,
        commission_percent: reseller.commission_percent || 10,
        credit_limit: reseller.credit_limit || 0,
        is_active: reseller.is_active ?? true,
        is_verified: reseller.is_verified ?? false,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create reseller');
      throw error;
    }
    toast.success('Reseller created');
    await fetchResellers();
    return data;
  };

  const updateReseller = async (id: string, updates: Partial<Reseller>) => {
    const { error } = await supabase
      .from('resellers')
      .update({
        company_name: updates.company_name,
        commission_percent: updates.commission_percent,
        credit_limit: updates.credit_limit,
        is_active: updates.is_active,
        is_verified: updates.is_verified,
      })
      .eq('id', id);

    if (error) {
      toast.error('Failed to update reseller');
      throw error;
    }
    toast.success('Reseller updated');
    await fetchResellers();
  };

  const deleteReseller = async (id: string) => {
    const { error } = await supabase
      .from('resellers')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete reseller');
      throw error;
    }
    toast.success('Reseller deleted');
    await fetchResellers();
  };

  const suspendReseller = async (id: string) => {
    await updateReseller(id, { is_active: false });
  };

  const activateReseller = async (id: string) => {
    await updateReseller(id, { is_active: true });
  };

  const verifyReseller = async (id: string) => {
    await updateReseller(id, { is_verified: true });
  };

  useEffect(() => {
    fetchResellers();
  }, []);

  return {
    resellers,
    loading,
    total,
    fetchResellers,
    createReseller,
    updateReseller,
    deleteReseller,
    suspendReseller,
    activateReseller,
    verifyReseller,
  };
}
