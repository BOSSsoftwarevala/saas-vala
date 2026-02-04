import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  company_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
      } else {
        setProfile(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error('Not authenticated');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: updates.full_name,
          company_name: updates.company_name,
          phone: updates.phone,
          avatar_url: updates.avatar_url,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userData.user.id);

      if (error) {
        toast.error('Failed to update profile');
        throw error;
      }

      toast.success('Profile updated successfully');
      await fetchProfile();
    } catch (err) {
      console.error('Error updating profile:', err);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return {
    profile,
    loading,
    fetchProfile,
    updateProfile,
  };
}
