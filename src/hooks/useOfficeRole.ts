import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { OfficeRole, normalizeRole, OfficeModule, normalizeModule } from '@/lib/rbac/roles';
import { withTimeout } from '@/lib/utils';

interface UseOfficeRoleResult {
  role: OfficeRole;
  officeId: string | null;
  module: OfficeModule;
  loading: boolean;
  refresh: () => Promise<void>;
}


/**
 * Hook que obtém o role do usuário via lexos_healthcheck_session.
 * Fonte única de verdade para o estado de autorização do frontend.
 * 
 * Regra: Sem office_id válido -> role = null
 */
export function useOfficeRole(): UseOfficeRoleResult {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<OfficeRole>(null);
  const [module, setModule] = useState<OfficeModule>('LEGAL');
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);


  const fetchRole = useCallback(async () => {
    if (!user?.id) {
      setRole(null);
      setOfficeId(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // O healthcheck é a autoridade sobre o vínculo usuário <-> escritório
      const rpcPromise = supabase.rpc('lexos_healthcheck_session').maybeSingle();
      const result = await withTimeout(
        Promise.resolve(rpcPromise),
        8000,
        'useOfficeRole:healthcheck'
      );
      
      const { data: healthRaw } = result as { data: any; error: any };
      
      // Validação de contrato: O backend PRECISA retornar a propriedade 'ok'
      if (healthRaw && !healthRaw.hasOwnProperty('ok')) {
        console.error('[useOfficeRole] Erro de contrato de sessão: RPC não retornou campo "ok". Verifique a versão do banco.');
        setRole(null);
        setOfficeId(null);
        setLoading(false);
        return;
      }

      const health = healthRaw ?? null;

      if (health?.ok && health.office_id) {
        setRole(normalizeRole(health.role));
        setOfficeId(health.office_id);

        // Buscar metadados do escritório para UX de módulo
        const { data: officeData } = await supabase
          .from('offices')
          .select('office_type')
          .eq('id', health.office_id)
          .maybeSingle();

        setModule(normalizeModule(officeData?.office_type));
      } else {
        // Sem escritório vinculado: Estado Estrito NULL
        setRole(null);
        setOfficeId(null);
        setModule('LEGAL');
      }

    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[useOfficeRole] Falha na resolução de autorização:', err);
      }
      setRole(null);
      setOfficeId(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    fetchRole();
  }, [authLoading, fetchRole]);

  return {
    role,
    officeId,
    module,
    loading,
    refresh: fetchRole,
  };

}
