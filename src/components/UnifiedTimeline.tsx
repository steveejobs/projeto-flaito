import React, { useEffect } from 'react';
import { GlobalTimeline } from './GlobalTimeline';
import { useActiveClient } from '@/contexts/ActiveClientContext';

interface UnifiedTimelineProps {
  clientId: string;
}

export const UnifiedTimeline: React.FC<UnifiedTimelineProps> = ({ clientId }) => {
  const { setActiveClientId } = useActiveClient();

  useEffect(() => {
    if (clientId) {
      setActiveClientId(clientId);
    }
  }, [clientId, setActiveClientId]);

  return <GlobalTimeline />;
};
