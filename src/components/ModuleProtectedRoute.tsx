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
        // Spinner minimalista mas visível (substituindo o ponto minúsculo que sumia no preto)
        return (
            <div className="min-h-[50vh] flex items-center justify-center bg-transparent transition-all duration-500">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-400 dark:border-slate-500" />
            </div>
        );
    }

    if (currentModule !== requiredModule) {
        console.warn(`[ModuleProtectedRoute] AUDIT | ACTION: FORBIDDEN_MODULE_ACCESS | CURRENT: ${currentModule} | REQUIRED: ${requiredModule} | REDIRECTING`);
        const destination = currentModule === 'MEDICAL' ? '/medical/dashboard' : '/dashboard';
        return <Navigate to={destination} replace />;
    }

    return <>{children}</>;
};
