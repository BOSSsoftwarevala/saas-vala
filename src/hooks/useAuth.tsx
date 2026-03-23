import { useState, useEffect, useRef, createContext, useContext, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { getRiskScore, getDeviceId } from '@/lib/security';

// Auto-logout when risk score exceeds this threshold
const AUTO_LOGOUT_RISK_THRESHOLD = 90;

type AppRole = 'super_admin' | 'reseller';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  /** True only during the very first boot session check. */
  initializing: boolean;
  /** True while auth + role checks are in progress (used for route guards). */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, requestedRole?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  /** Phase 1: Auto-logout when suspicious activity is detected. */
  triggerSuspiciousLogout: (reason?: string) => Promise<void>;
  /** Phase 5: Return the stable device fingerprint for this browser. */
  getDeviceFingerprint: () => Promise<string>;
  isSuperAdmin: boolean;
  isReseller: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);

  // Prevent repeated role fetches (token refresh / multiple auth events)
  const roleRef = useRef<AppRole | null>(null);
  const lastRoleUserIdRef = useRef<string | null>(null);
  const inFlightRoleFetchRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  useEffect(() => {
    let isMounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);

        // Defer role fetching with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            if (isMounted) {
              ensureUserRole(session.user.id);
            }
          }, 0);
        } else {
          setRole(null);
          lastRoleUserIdRef.current = null;
        }

        // At this point, auth state is known; the boot phase can end.
        setInitializing(false);
      }
    );

    // THEN check for existing session
    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await ensureUserRole(session.user.id);
        } else {
          setRole(null);
          lastRoleUserIdRef.current = null;
        }
      } catch (err) {
        console.error('Error initializing session:', err);
      } finally {
        if (isMounted) setInitializing(false);
      }
    };

    initSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserRole = async (userId: string, retries = 2): Promise<void> => {
    setRoleLoading(true);
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);

        if (error) {
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
          console.error('Error fetching role:', error);
          setRole(null);
          setRoleLoading(false);
          return;
        }

        const resolvedRole: AppRole | null =
          data?.some(({ role }) => role === 'super_admin')
            ? 'super_admin'
            : data?.some(({ role }) => role === 'reseller')
              ? 'reseller'
              : null;

        setRole(resolvedRole);
        setRoleLoading(false);
        return;
      } catch (err) {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        console.error('Error in fetchUserRole:', err);
        setRole(null);
        setRoleLoading(false);
      }
    }
    setRoleLoading(false);
  };

  const ensureUserRole = (userId: string): Promise<void> => {
    // If we already have a role for this user, don't refetch.
    if (lastRoleUserIdRef.current === userId && roleRef.current) {
      return Promise.resolve();
    }

    // If a fetch is already in-flight, reuse it.
    if (inFlightRoleFetchRef.current) {
      return inFlightRoleFetchRef.current;
    }

    lastRoleUserIdRef.current = userId;
    inFlightRoleFetchRef.current = fetchUserRole(userId).finally(() => {
      inFlightRoleFetchRef.current = null;
    });

    return inFlightRoleFetchRef.current;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    // Safety net: if onAuthStateChange is delayed/missed, set state from returned session.
    if (!error) {
      const nextSession = data.session ?? (await supabase.auth.getSession()).data.session;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        setTimeout(() => ensureUserRole(nextSession.user.id), 0);
      }
    }

    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string, requestedRole?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          requested_role: requestedRole || 'user',
        },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  /**
   * Phase 1: Auto-logout when suspicious activity risk score is too high.
   * Called by security-aware components after recording a high-risk event.
   */
  const triggerSuspiciousLogout = useCallback(async (reason = 'Suspicious activity detected') => {
    const score = getRiskScore();
    if (score >= AUTO_LOGOUT_RISK_THRESHOLD) {
      try {
        if (user) {
          await supabase.from('activity_logs').insert({
            entity_type: 'security_event',
            entity_id: user.id,
            action: 'auto_logout',
            performed_by: user.id,
            details: { reason, riskScore: score },
          });
        }
      } catch (_e) {
        // Non-blocking
      }
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setRole(null);
    }
  }, [user]); // user is the only reactive dep needed — signOut is inlined to avoid circular deps

  /** Phase 5: Expose device fingerprint to callers. */
  const getDeviceFingerprint = useCallback((): Promise<string> => getDeviceId(), []);

  const loading = initializing || roleLoading;

  const value = {
    user,
    session,
    role,
    initializing,
    loading,
    signIn,
    signUp,
    signOut,
    triggerSuspiciousLogout,
    getDeviceFingerprint,
    isSuperAdmin: role === 'super_admin',
    isReseller: role === 'reseller',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
