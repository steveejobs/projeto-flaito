import { forwardRef, useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useOfficeRole } from '@/hooks/useOfficeRole';
import { OfficeRole, hasRole } from '@/lib/rbac/roles';
import { toast } from 'sonner';

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  minRole: Exclude<OfficeRole, null>;
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
      // Se não tem role, será redirecionado para Onboarding (silencioso)
      // Se tem role mas não é suficiente, avisa o acesso negado
      if (!isLoading && user && role !== null && !isAuthorized && !toastShownRef.current) {
        toastShownRef.current = true;
        toast.error('Acesso negado', {
          description: 'Você não tem permissão para acessar esta página.',
        });
      }
    }, [isLoading, user, isAuthorized, role]);

    // Reset ref quando rota muda
    useEffect(() => {
      toastShownRef.current = false;
    }, [location.pathname]);

    if (isLoading) {
      return (
        <div ref={ref} className="min-h-screen flex flex-col items-center justify-center bg-transparent">
          <div className="h-10 w-10 rounded-full border-t-2 border-b-2 border-blue-500 animate-spin" />
          <p className="mt-4 text-xs font-medium text-slate-500 animate-pulse">Verificando permissões...</p>
        </div>
      );
    }

    // Não autenticado -> login (Fail-safe, AppInitializer já trata)
    if (!user) {
      return <Navigate to="/login" replace />;
    }

    // Sem escritório / sem papel atribuído -> Onboarding
    if (!role && location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
    }

    // Não autorizado por hierarquia -> Volta para a home/root do módulo
    if (!isAuthorized) {
      const defaultDest = location.pathname.startsWith('/medical') ? '/medical/dashboard' : '/dashboard';
      return <Navigate to={defaultDest} replace />;
    }

    return <div ref={ref}>{children}</div>;
  }
);
