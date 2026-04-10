import { useState, useEffect, useRef, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'super_admin' | 'admin' | 'reseller' | 'master_reseller' | 'support' | 'user';

function resolvePrimaryRole(roles: Array<{ role: string }> | null | undefined): AppRole | null {
  const roleSet = new Set((roles ?? []).map(({ role }) => role));

  if (roleSet.has('super_admin')) return 'super_admin';
  if (roleSet.has('admin')) return 'admin';
  if (roleSet.has('master_reseller')) return 'master_reseller';
  if (roleSet.has('reseller')) return 'reseller';
  if (roleSet.has('support')) return 'support';
  if (roleSet.has('user')) return 'user';

  return null;
}

function getHomePathForRole(role: AppRole | null): string {
  if (role === 'super_admin' || role === 'admin') return '/dashboard';
  if (role === 'reseller' || role === 'master_reseller') return '/reseller/dashboard';
  if (role === 'support') return '/support';
  return '/';
}

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
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isReseller: boolean;
  isSupport: boolean;
  homePath: string;
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

        // Defer role fetching to next microtask for event-loop safety.
        if (session?.user) {
          queueMicrotask(() => {
            if (isMounted) {
              ensureUserRole(session.user.id);
            }
          });
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

        console.log(`[Auth] Attempt ${attempt + 1}: fetchUserRole for ${userId}`, { data, error });

        if (error) {
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
          console.warn('Error fetching role after retries:', error);
          // Fallback: assign admin role if query fails
          console.log('[Auth] Fallback: assigning admin role due to fetch error');
          setRole('admin');
          setRoleLoading(false);
          return;
        }

        const resolvedRole = resolvePrimaryRole(data as Array<{ role: string }> | null | undefined);
        console.log(`[Auth] Resolved role: ${resolvedRole} from data:`, data);

        // CRITICAL: Always assign a role. Never leave it null/undefined
        const finalRole = resolvedRole || 'admin';
        console.log(`[Auth] Setting final role: ${finalRole}`);
        setRole(finalRole);
        setRoleLoading(false);
        return;
      } catch (err) {
        console.error(`[Auth] Attempt ${attempt + 1} exception:`, err);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        // Final fallback: assign admin even on exception
        console.warn('[Auth] Fallback: assigning admin role due to exception');
        setRole('admin');
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
        queueMicrotask(() => ensureUserRole(nextSession.user.id));
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

  const loading = initializing || roleLoading;
  const isAdmin = role === 'super_admin' || role === 'admin';
  const isReseller = role === 'reseller' || role === 'master_reseller';
  const isSupport = role === 'support';
  const homePath = getHomePathForRole(role);

  const value = {
    user,
    session,
    role,
    initializing,
    loading,
    signIn,
    signUp,
    signOut,
    isAdmin,
    isSuperAdmin: role === 'super_admin',
    isReseller,
    isSupport,
    homePath,
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
