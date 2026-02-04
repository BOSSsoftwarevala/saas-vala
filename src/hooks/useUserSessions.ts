import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface UserSession {
  id: string;
  user_id: string;
  device_name: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  location: string | null;
  is_current: boolean;
  last_active_at: string;
  created_at: string;
}

function detectDeviceInfo() {
  const ua = navigator.userAgent;
  
  // Detect browser
  let browser = 'Unknown Browser';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';

  // Detect OS
  let os = 'Unknown OS';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  // Detect device type
  let deviceType = 'desktop';
  if (/Mobi|Android/i.test(ua)) deviceType = 'mobile';
  else if (/Tablet|iPad/i.test(ua)) deviceType = 'tablet';

  // Generate device name
  const deviceName = `${browser} on ${os}`;

  return { browser, os, deviceType, deviceName };
}

export function useUserSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const fetchSessions = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('last_active_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const registerCurrentSession = async () => {
    if (!user) return;

    const { browser, os, deviceType, deviceName } = detectDeviceInfo();
    
    // Check if we have a stored session ID for this browser
    const storedSessionId = localStorage.getItem('current_session_id');
    
    if (storedSessionId) {
      // Update existing session
      const { error } = await supabase
        .from('user_sessions')
        .update({ 
          last_active_at: new Date().toISOString(),
          is_current: true 
        })
        .eq('id', storedSessionId)
        .eq('user_id', user.id);

      if (!error) {
        setCurrentSessionId(storedSessionId);
        return;
      }
    }

    // Create new session
    const { data, error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: user.id,
        device_name: deviceName,
        device_type: deviceType,
        browser,
        os,
        is_current: true,
      })
      .select()
      .single();

    if (!error && data) {
      localStorage.setItem('current_session_id', data.id);
      setCurrentSessionId(data.id);
    }
  };

  const revokeSession = async (sessionId: string) => {
    if (sessionId === currentSessionId) {
      toast.error('Cannot revoke current session. Use logout instead.');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;
      
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast.success('Device session revoked successfully');
    } catch (error) {
      console.error('Error revoking session:', error);
      toast.error('Failed to revoke session');
    }
  };

  const revokeAllOtherSessions = async () => {
    if (!user || !currentSessionId) return;

    try {
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .eq('user_id', user.id)
        .neq('id', currentSessionId);

      if (error) throw error;
      
      setSessions(prev => prev.filter(s => s.id === currentSessionId));
      toast.success('All other sessions have been revoked');
    } catch (error) {
      console.error('Error revoking sessions:', error);
      toast.error('Failed to revoke sessions');
    }
  };

  useEffect(() => {
    if (user) {
      registerCurrentSession();
      fetchSessions();
    }
  }, [user]);

  return {
    sessions,
    loading,
    currentSessionId,
    fetchSessions,
    revokeSession,
    revokeAllOtherSessions,
  };
}
