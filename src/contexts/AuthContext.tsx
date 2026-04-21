import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { dismissAllToasts } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

// Selective cleanup for Flaito namespaces to avoid inter-tenant leakage
// SessionStorage is always cleared fully as it is tab-specific.
const selectiveCleanup = () => {
  try {
    const namespaces = [
      'sb-',             // Supabase Auth/Session
      'flaito',          // Core App State (handles flaito- and flaito_)
      'nija-',           // Legal Module
      'medical-',        // Medical Module
      'active_',         // Current resources (active_client_id, etc)
      'pending_',        // Pending actions (pending_invite_token)
      'legal_',          // Legal specific filters/states
      'last_',           // State persistence (last_office_id)
      'tjto-',           // External caches
      'eproc-'           // External caches
    ];

    console.log('[Auth] Initiating selective namespace cleanup');
    
    // Clean LocalStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (namespaces.some(ns => key.startsWith(ns)) || key.includes('supabase'))) {
            keysToRemove.push(key);
        }
    }
    
    keysToRemove.forEach(k => localStorage.removeItem(k));
    
    // Clear SessionStorage fully (safer for tab isolation)
    sessionStorage.clear();

    // Clear UI residuals
    dismissAllToasts();
    document.title = 'Flaito';
    
    console.log(`[Auth] Cleaned ${keysToRemove.length} sensitive keys from localStorage and purged UI.`);
  } catch (e) {
    console.warn('[Auth] Selective cleanup failed, falling back to global clear:', e);
    localStorage.clear();
    sessionStorage.clear();
  }
};

// Check if error is a refresh token error
const isRefreshTokenError = (error: AuthError | null): boolean => {
  if (!error) return false;
  const msg = error.message?.toLowerCase() || '';
  return (
    msg.includes('refresh token') ||
    msg.includes('invalid token') ||
    msg.includes('token not found') ||
    error.status === 400
  );
};

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const clearSession = () => {
    console.warn('[Auth] Manual session clear trigged');
    selectiveCleanup();
    queryClient.clear();
    setUser(null);
    setSession(null);
    setLoading(false);
  };

  // Process pending invite after login
  const processPendingInvite = async () => {
    const pendingToken = localStorage.getItem('pending_invite_token');
    if (!pendingToken) return;
    
    try {
      const { data: result, error } = await supabase.rpc('accept_office_invite', { p_token: pendingToken });
      
      if (error) {
        console.error('Error processing pending invite:', error);
        return;
      }
      
      const parsedResult = result as { success?: boolean; error?: string } | null;
      
      if (parsedResult?.success) {
        console.log('Pending invite processed successfully:', parsedResult);
        localStorage.removeItem('pending_invite_token');
      } else if (parsedResult?.error) {
        console.warn('Pending invite not accepted:', parsedResult.error);
        localStorage.removeItem('pending_invite_token');
      }
    } catch (err) {
      console.error('Failed to process pending invite:', err);
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return;
        
        if (event === 'SIGNED_OUT') {
           console.log('[Auth] Event: SIGNED_OUT | Cleaning cache');
           queryClient.clear();
           selectiveCleanup();
        }

        if (event === 'TOKEN_REFRESHED' && !newSession) {
          console.warn('Token refresh failed, clearing session');
          selectiveCleanup();
          queryClient.clear();
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
        
        if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && newSession?.user) {
          setTimeout(() => {
            processPendingInvite();
          }, 0);
        }
      }
    );

    supabase.auth.getSession()
      .then(({ data: { session: existingSession }, error }) => {
        if (!mounted) return;
        
        if (error && isRefreshTokenError(error)) {
          console.warn('Session recovery failed, clearing storage');
          selectiveCleanup();
          queryClient.clear();
          setSession(null);
          setUser(null);
        } else {
          setSession(existingSession);
          setUser(existingSession?.user ?? null);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        console.warn('getSession error:', err);
        selectiveCleanup();
        queryClient.clear();
        setSession(null);
        setUser(null);
        setLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, data?: Record<string, any>) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: data,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    console.log('[Auth] Initiating signOut');
    await supabase.auth.signOut();
    queryClient.clear();
    selectiveCleanup();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, clearSession }}>
      {children}
    </AuthContext.Provider>
  );
};
