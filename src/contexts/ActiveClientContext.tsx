import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UnifiedProfile, identityService } from '@/services/identityService';
import { clientStudyContextService } from '@/services/domain/clientStudyContextService';
import type { ClientStudyContext } from '@/types/clientStudyContext';

interface ActiveClientContextType {
  activeClientId: string | null;
  activeProfile: UnifiedProfile | null;
  activeStudyContext: ClientStudyContext | null;
  setActiveClientId: (id: string | null) => void;
  refreshProfile: () => Promise<void>;
  refreshStudyContext: () => Promise<void>;
  isLoading: boolean;
  isClientMode: boolean;
}

const ActiveClientContext = createContext<ActiveClientContextType | undefined>(undefined);

export function ActiveClientProvider({ children }: { children: ReactNode }) {
  const [activeClientId, setActiveClientIdState] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<UnifiedProfile | null>(null);
  const [activeStudyContext, setActiveStudyContext] = useState<ClientStudyContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load selection from storage on mount
  useEffect(() => {
    const stored = localStorage.getItem('active_client_id');
    if (stored) {
      setActiveClientIdState(stored);
    }
  }, []);

  // Fetch profile and study context whenever activeClientId changes
  useEffect(() => {
    async function fetchData() {
      if (activeClientId) {
        setIsLoading(true);
        const [profile, studyCtx] = await Promise.all([
          identityService.getFullProfile(activeClientId),
          clientStudyContextService.getByClientId(activeClientId),
        ]);
        setActiveProfile(profile);
        setActiveStudyContext(studyCtx);
        setIsLoading(false);
      } else {
        setActiveProfile(null);
        setActiveStudyContext(null);
      }
    }

    fetchData();
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

  const refreshStudyContext = async () => {
    if (activeClientId) {
      const ctx = await clientStudyContextService.getByClientId(activeClientId);
      setActiveStudyContext(ctx);
    }
  };

  return (
    <ActiveClientContext.Provider
      value={{
        activeClientId,
        activeProfile,
        activeStudyContext,
        setActiveClientId,
        refreshProfile,
        refreshStudyContext,
        isLoading,
        isClientMode: !!activeClientId,
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
