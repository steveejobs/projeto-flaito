import React, { createContext, useContext } from 'react';

export type MessagingContextType = 'MEDICAL' | 'LEGAL';

interface MessagingContextValue {
  context: MessagingContextType;
}

const MessagingContext = createContext<MessagingContextValue | null>(null);

export function MessagingProvider({ 
  children, 
  context 
}: { 
  children: React.ReactNode; 
  context: MessagingContextType;
}) {
  return (
    <MessagingContext.Provider value={{ context }}>
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessagingContext() {
  const context = useContext(MessagingContext);
  if (!context) {
    // Fallback to MEDICAL if not inside a shell, to ensure compatibility
    return { context: 'MEDICAL' as MessagingContextType };
  }
  return context;
}

export function useMessaging() {
  return useMessagingContext();
}
