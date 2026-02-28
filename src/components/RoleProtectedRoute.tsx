import { forwardRef, useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOfficeRole } from '@/hooks/useOfficeRole';
import { OfficeRole, hasRole } from '@/lib/rbac/roles';
import { toast } from 'sonner';

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  minRole: OfficeRole;
}

/**
 * Protege rotas baseado no role mínimo necessário
 * Redireciona para /dashboard com toast de erro se não autorizado
 */
export const RoleProtectedRoute = forwardRef<HTMLDivElement, RoleProtectedRouteProps>(
  function RoleProtectedRoute({ children, minRole }, ref) {
    const { user, loading: authLoading } = useAuth();
    const { role, loading: roleLoading } = useOfficeRole();
    const location = useLocation();
    const toastShownRef = useRef(false);

    const isLoading = authLoading || roleLoading;
    const isAuthorized = hasRole(role, minRole);

    // Mostrar toast apenas uma vez quando acesso é negado
    useEffect(() => {
      if (!isLoading && user && !isAuthorized && !toastShownRef.current) {
        toastShownRef.current = true;
        toast.error('Acesso negado', {
          description: 'Você não tem permissão para acessar esta página.',
        });
      }
    }, [isLoading, user, isAuthorized]);

    // Reset ref quando rota muda
    useEffect(() => {
      toastShownRef.current = false;
    }, [location.pathname]);

    if (isLoading) {
      return (
        <div ref={ref} className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      );
    }

    // Não autenticado -> login
    if (!user) {
      return <Navigate to="/login" replace />;
    }

    // Não autorizado -> dashboard
    if (!isAuthorized) {
      return <Navigate to="/dashboard" replace />;
    }

    return <div ref={ref}>{children}</div>;
  }
);
