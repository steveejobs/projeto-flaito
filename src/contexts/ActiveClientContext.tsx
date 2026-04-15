import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UnifiedProfile, identityService } from '@/services/identityService';

interface ActiveClientContextType {
  activeClientId: string | null;
  activeProfile: UnifiedProfile | null;
  setActiveClientId: (id: string | null) => void;
  refreshProfile: () => Promise<void>;
  isLoading: boolean;
}

const ActiveClientContext = createContext<ActiveClientContextType | undefined>(undefined);

export function ActiveClientProvider({ children }: { children: ReactNode }) {
  const [activeClientId, setActiveClientIdState] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<UnifiedProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load selection from storage on mount
  useEffect(() => {
    const stored = localStorage.getItem('active_client_id');
    if (stored) {
      setActiveClientIdState(stored);
    }
  }, []);

  // Fetch profile whenever activeClientId changes
  useEffect(() => {
    async function fetchProfile() {
      if (activeClientId) {
        setIsLoading(true);
        const profile = await identityService.getFullProfile(activeClientId);
        setActiveProfile(profile);
        setIsLoading(false);
      } else {
        setActiveProfile(null);
      }
    }

    fetchProfile();
  }, [activeClientId]);

  const setActiveClientId = (id: string | null) => {
    setActiveClientIdState(id);
    if (id) {
      localStorage.setItem('active_client_id', id);
    } else {
      localStorage.removeItem('active_client_id');
    }
  };

  const refreshProfile = async () => {
    if (activeClientId) {
      const profile = await identityService.getFullProfile(activeClientId);
      setActiveProfile(profile);
    }
  };

  return (
    <ActiveClientContext.Provider 
      value={{ 
        activeClientId, 
        activeProfile, 
        setActiveClientId, 
        refreshProfile,
        isLoading
      }}
    >
      {children}
    </ActiveClientContext.Provider>
  );
}

export function useActiveClient() {
  const context = useContext(ActiveClientContext);
  if (!context) {
    throw new Error('useActiveClient must be used within an ActiveClientProvider');
  }
  return context;
}
