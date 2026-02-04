import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LicenseKey {
  id: string;
  product_id: string;
  license_key: string;
  key_type: 'lifetime' | 'yearly' | 'monthly' | 'trial';
  status: 'active' | 'expired' | 'suspended' | 'revoked';
  owner_email: string | null;
  owner_name: string | null;
  device_id: string | null;
  max_devices: number;
  activated_devices: number;
  expires_at: string | null;
  activated_at: string | null;
  notes: string | null;
  created_at: string;
}

export function useLicenseKeys() {
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('license_keys')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to fetch license keys');
      console.error(error);
    } else {
      setKeys((data || []) as LicenseKey[]);
    }
    setLoading(false);
  }, []);

  const generateKeyString = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let j = 0; j < 4; j++) {
      if (j > 0) result += '-';
      for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    return result;
  };

  const createKey = async (key: Partial<LicenseKey>) => {
    const { data: userData } = await supabase.auth.getUser();
    const licenseKey = key.license_key || generateKeyString();
    
    const { data, error } = await supabase
      .from('license_keys')
      .insert({
        product_id: key.product_id || '',
        license_key: licenseKey,
        key_type: key.key_type || 'yearly',
        status: key.status || 'active',
        owner_email: key.owner_email,
        owner_name: key.owner_name,
        max_devices: key.max_devices || 1,
        expires_at: key.expires_at,
        notes: key.notes,
        created_by: userData.user?.id
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create license key');
      throw error;
    }
    toast.success('License key created: ' + licenseKey);
    // Real-time will handle refresh
    return data;
  };

  const updateKey = async (id: string, updates: Partial<LicenseKey>) => {
    const { error } = await supabase
      .from('license_keys')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast.error('Failed to update license key');
      throw error;
    }
    toast.success('License key updated');
    // Real-time will handle refresh
  };

  const deleteKey = async (id: string) => {
    const { error } = await supabase
      .from('license_keys')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete license key');
      throw error;
    }
    toast.success('License key deleted');
    // Real-time will handle refresh
  };

  const suspendKey = async (id: string) => {
    await updateKey(id, { status: 'suspended' });
  };

  const activateKey = async (id: string) => {
    await updateKey(id, { status: 'active' });
  };

  const revokeKey = async (id: string) => {
    await updateKey(id, { status: 'revoked' });
  };

  useEffect(() => {
    fetchKeys();

    // Real-time subscription for live updates
    const channel = supabase
      .channel('license-keys-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'license_keys' }, () => {
        fetchKeys();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchKeys]);

  return {
    keys,
    loading,
    fetchKeys,
    createKey,
    updateKey,
    deleteKey,
    suspendKey,
    activateKey,
    revokeKey,
    generateKeyString
  };
}
