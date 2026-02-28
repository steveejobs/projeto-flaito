import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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

// Helper to clear all auth-related storage
const clearAuthStorage = () => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    const sessionKeysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
        sessionKeysToRemove.push(key);
      }
    }
    sessionKeysToRemove.forEach(key => sessionStorage.removeItem(key));
  } catch (e) {
    console.warn('Failed to clear auth storage:', e);
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

  const clearSession = () => {
    clearAuthStorage();
    // Clear office bootstrap flags
    sessionStorage.removeItem("lexos_office_checked");
    sessionStorage.removeItem("lexos_office_id");
    setUser(null);
    setSession(null);
    setLoading(false);
    // Do NOT reload - navigation is handled by the caller
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
        // Remove token even if invite failed (expired, already accepted, etc.)
        localStorage.removeItem('pending_invite_token');
      }
    } catch (err) {
      console.error('Failed to process pending invite:', err);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return;
        
        // Handle token refresh errors
        if (event === 'TOKEN_REFRESHED' && !newSession) {
          console.warn('Token refresh failed, clearing session');
          clearAuthStorage();
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
        
        // Process pending invite when user signs in or confirms email
        if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && newSession?.user) {
          setTimeout(() => {
            processPendingInvite();
          }, 0);
        }
      }
    );

    // THEN check for existing session with error handling
    supabase.auth.getSession()
      .then(({ data: { session: existingSession }, error }) => {
        if (!mounted) return;
        
        if (error && isRefreshTokenError(error)) {
          console.warn('Session recovery failed (invalid refresh token), clearing storage');
          clearAuthStorage();
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
        clearAuthStorage();
        setSession(null);
        setUser(null);
        setLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    clearAuthStorage();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, clearSession }}>
      {children}
    </AuthContext.Provider>
  );
};
