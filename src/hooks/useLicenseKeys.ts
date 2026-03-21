import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
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
  user_id?: string; // FIXED: Track ownership
}

export function useLicenseKeys() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<LicenseKey[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchKeys = async () => {
    if (!user) {
      setKeys([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // FIXED: Filter by user_id to only show user's own keys
      const { data, error } = await supabase
        .from('license_keys')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Failed to fetch license keys');
        console.error(error);
      } else {
        setKeys((data || []) as LicenseKey[]);
      }
    } catch (err) {
      console.error('Fetch keys error:', err);
      toast.error('Error fetching keys');
    } finally {
      setLoading(false);
    }
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
    if (!user) {
      toast.error('Must be signed in');
      throw new Error('User not authenticated');
    }

    // FIXED: Validate inputs
    if (!key.product_id) {
      toast.error('Product ID is required');
      throw new Error('Product ID required');
    }

    const licenseKey = key.license_key || generateKeyString();
    
    try {
      const { data, error } = await supabase
        .from('license_keys')
        .insert({
          product_id: key.product_id,
          license_key: licenseKey,
          key_type: key.key_type || 'yearly',
          status: key.status || 'active',
          owner_email: key.owner_email || user.email,
          owner_name: key.owner_name || user.user_metadata?.full_name,
          max_devices: key.max_devices || 1,
          activated_devices: key.activated_devices || 0,
          expires_at: key.expires_at,
          notes: key.notes,
          created_by: user.id,
          user_id: user.id, // FIXED: Always set user_id
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        toast.error('Failed to create license key');
        throw error;
      }
      
      toast.success('License key created: ' + licenseKey);
      await fetchKeys();
      return data;
    } catch (err) {
      console.error('Create key error:', err);
      throw err;
    }
  };

  const updateKey = async (id: string, updates: Partial<LicenseKey>) => {
    if (!user) {
      toast.error('Must be signed in');
      throw new Error('User not authenticated');
    }

    // FIXED: Verify ownership before update
    const { data: existing } = await supabase
      .from('license_keys')
      .select('user_id')
      .eq('id', id)
      .single();

    if (existing?.user_id !== user.id) {
      toast.error('Unauthorized: Cannot update this key');
      throw new Error('Unauthorized');
    }

    try {
      const { error } = await supabase
        .from('license_keys')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id); // FIXED: Double-check user_id

      if (error) {
        toast.error('Failed to update license key');
        throw error;
      }
      
      toast.success('License key updated');
      await fetchKeys();
    } catch (err) {
      console.error('Update key error:', err);
      throw err;
    }
  };

  const deleteKey = async (id: string) => {
    if (!user) {
      toast.error('Must be signed in');
      throw new Error('User not authenticated');
    }

    // FIXED: Verify ownership before deletion
    const { data: existing } = await supabase
      .from('license_keys')
      .select('user_id')
      .eq('id', id)
      .single();

    if (existing?.user_id !== user.id) {
      toast.error('Unauthorized: Cannot delete this key');
      throw new Error('Unauthorized');
    }

    try {
      const { error } = await supabase
        .from('license_keys')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id); // FIXED: Double-check user_id

      if (error) {
        toast.error('Failed to delete license key');
        throw error;
      }
      
      toast.success('License key deleted');
      await fetchKeys();
    } catch (err) {
      console.error('Delete key error:', err);
      throw err;
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
    if (user) {
      fetchKeys();
    }
  }, [user?.id]);

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
