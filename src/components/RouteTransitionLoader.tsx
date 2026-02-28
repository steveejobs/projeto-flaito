import { useEffect, useState, useRef, ReactNode } from "react";
import { useLocation } from "react-router-dom";

interface RouteTransitionLoaderProps {
  children: ReactNode;
}

/**
 * Overlay de transição suave entre rotas.
 * NÃO desmonta children — apenas mostra overlay leve por ~160ms.
 */
export function RouteTransitionLoader({ children }: RouteTransitionLoaderProps) {
  const location = useLocation();
  const [show, setShow] = useState(false);
  const prevPathRef = useRef(location.pathname);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      setShow(true);

      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout(() => {
        setShow(false);
      }, 160);

      prevPathRef.current = location.pathname;
    }

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [location.pathname]);

  return (
    <div className="relative h-full">
      {children}
      {show && (
        <div 
          className="absolute inset-0 bg-background/40 z-40 pointer-events-none transition-opacity duration-100"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
