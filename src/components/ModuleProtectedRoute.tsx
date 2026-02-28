import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useOfficeRole } from "@/hooks/useOfficeRole";
import { OfficeModule } from "@/lib/rbac/roles";
import { Skeleton } from "@/components/ui/skeleton";

interface ModuleProtectedRouteProps {
    children: ReactNode;
    module: OfficeModule;
}

/**
 * Componente que protege rotas específicas de um módulo (LEGAL ou MEDICAL)
 */
export const ModuleProtectedRoute = ({ children, module: requiredModule }: ModuleProtectedRouteProps) => {
    const { module: currentModule, loading } = useOfficeRole();

    if (loading) {
        return (
            <div className="p-8 space-y-4">
                <Skeleton className="h-12 w-[300px]" />
                <Skeleton className="h-[400px] w-full" />
            </div>
        );
    }

    if (currentModule !== requiredModule) {
        // Redireciona para o dashboard se tentar acessar o módulo errado
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
};
