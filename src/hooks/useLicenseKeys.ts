import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { keysApi } from '@/lib/api';

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

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await keysApi.list();
      const data = res?.data || res || [];
      setKeys(Array.isArray(data) ? data as LicenseKey[] : []);
    } catch (e: any) {
      console.error('Keys fetch error:', e);
      // Fallback: try direct Supabase query
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data } = await supabase.from('license_keys').select('*').order('created_at', { ascending: false });
        setKeys((data || []) as LicenseKey[]);
      } catch {
        toast.error('Failed to fetch license keys');
      }
    }
    setLoading(false);
  };

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
    try {
      const res = await keysApi.generate(key);
      const created = res?.data || res;
      toast.success('License key created: ' + (created?.license_key || 'OK'));
      await fetchKeys();
      return created;
    } catch (e: any) {
      console.error('Key create error:', e);
      toast.error('Key generation failed');
      throw e;
    }
  };

  const updateKey = async (id: string, updates: Partial<LicenseKey>) => {
    try {
      if (updates.status === 'active') {
        await keysApi.activate(id);
      } else if (updates.status === 'suspended') {
        await keysApi.deactivate(id);
      }
      toast.success('License key updated');
      await fetchKeys();
    } catch (e: any) {
      toast.error('Failed to update license key');
      throw e;
    }
  };

  const deleteKey = async (id: string) => {
    try {
      await keysApi.delete(id);
      toast.success('License key deleted');
      await fetchKeys();
    } catch (e: any) {
      toast.error('Failed to delete license key');
      throw e;
    }
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
  }, []);

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
