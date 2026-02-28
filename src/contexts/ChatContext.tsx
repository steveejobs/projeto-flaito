import { createContext, useContext, useState, ReactNode } from "react";

interface ChatContextType {
  activeCaseId: string | null;
  activeClientId: string | null;
  setActiveCaseId: (id: string | null) => void;
  setActiveClientId: (id: string | null) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    // Return a fallback instead of throwing to allow usage outside provider
    return {
      activeCaseId: null,
      activeClientId: null,
      setActiveCaseId: () => {},
      setActiveClientId: () => {},
    };
  }
  return context;
}

interface ChatContextProviderProps {
  children: ReactNode;
}

export function ChatContextProvider({ children }: ChatContextProviderProps) {
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [activeClientId, setActiveClientId] = useState<string | null>(null);

  return (
    <ChatContext.Provider
      value={{
        activeCaseId,
        activeClientId,
        setActiveCaseId,
        setActiveClientId,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
