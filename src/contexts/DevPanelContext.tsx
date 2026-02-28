import { createContext, useContext, useState, ReactNode } from 'react';

interface DevPanelContextType {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

const DevPanelContext = createContext<DevPanelContextType | null>(null);

export function DevPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => setIsOpen((v) => !v);
  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return (
    <DevPanelContext.Provider value={{ isOpen, toggle, open, close }}>
      {children}
    </DevPanelContext.Provider>
  );
}

export function useDevPanel() {
  const ctx = useContext(DevPanelContext);
  if (!ctx) {
    // Return no-op in production or if not wrapped
    return { isOpen: false, toggle: () => {}, open: () => {}, close: () => {} };
  }
  return ctx;
}
