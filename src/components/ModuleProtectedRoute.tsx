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
        // Removido o Skeleton para cumprir a diretriz de "não ter carregamentos visíveis"
        // Retornamos um container suave e muito minimalista
        return (
            <div className="min-h-[50vh] flex items-center justify-center bg-transparent transition-all duration-500">
                <div className="w-1.5 h-1.5 bg-slate-200/50 rounded-full animate-pulse" />
            </div>
        );
    }

    // Em uma plataforma híbrida, permitimos acessar ambos os módulos livremente.
    // if (currentModule !== requiredModule) {
    //     return <Navigate to="/dashboard" replace />;
    // }

    return <>{children}</>;
};
