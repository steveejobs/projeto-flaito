import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Protege rotas que requerem apenas autenticação (sem verificação de role)
 * Para verificação de role, use RoleProtectedRoute
 */
export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-white">
        <div className="relative">
          <div className="h-12 w-12 rounded-full border-t-2 border-b-2 border-blue-500 animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
          </div>
        </div>
        <p className="mt-4 text-sm font-medium text-slate-400 animate-pulse">
          Validando acesso...
        </p>
      </div>
    );
  }

  if (!user) {
    console.warn(`[ProtectedRoute] AUDIT | ACTION: SESSION_VALIDATION | STATUS: FAILED | ROUTE: ${window.location.pathname} | REASON: NO_USER`);
    return <Navigate to="/login" replace />;
  }

  console.log(`[ProtectedRoute] AUDIT | ACTION: SESSION_VALIDATION | STATUS: SUCCESS | ROUTE: ${window.location.pathname} | USER: ${user.id}`);
  return <>{children}</>;
};
