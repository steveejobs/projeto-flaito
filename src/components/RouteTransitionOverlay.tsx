import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

type Props = { children: React.ReactNode; ms?: number };

/**
 * Overlay de transição suave entre rotas.
 * Mantém children sempre montados e exibe overlay temporário ao mudar de rota.
 */
export function RouteTransitionOverlay({ children, ms = 180 }: Props) {
  const location = useLocation();
  const prevPath = useRef(location.pathname);
  const timer = useRef<number | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      setShow(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setShow(false), ms);
      prevPath.current = location.pathname;
    }
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [location.pathname, ms]);

  return (
    <div className="relative h-full w-full">
      {children}
      {show && (
        <div 
          className="absolute inset-0 bg-background/50 z-40 pointer-events-none transition-opacity duration-150"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
