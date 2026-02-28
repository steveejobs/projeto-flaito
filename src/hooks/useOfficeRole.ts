import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { OfficeRole, normalizeRole, OfficeModule, normalizeModule } from '@/lib/rbac/roles';

interface UseOfficeRoleResult {
  role: OfficeRole;
  officeId: string | null;
  module: OfficeModule;
  loading: boolean;
  refresh: () => Promise<void>;
}


/**
 * Hook que obtém o role do usuário via lexos_healthcheck_session
 * Retorna role em UPPERCASE: OWNER | ADMIN | MEMBER
 */
export function useOfficeRole(): UseOfficeRoleResult {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<OfficeRole>('MEMBER');
  const [module, setModule] = useState<OfficeModule>('LEGAL');
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);


  const fetchRole = useCallback(async () => {
    if (!user?.id) {
      setRole('MEMBER');
      setOfficeId(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data: healthRaw } = await supabase.rpc('lexos_healthcheck_session');
      const healthArr = healthRaw as Array<{
        ok: boolean;
        office_id: string;
        role: string;
      }> | null;
      const health = healthArr?.[0] ?? null;

      if (health?.ok && health.office_id) {
        setRole(normalizeRole(health.role));
        setOfficeId(health.office_id);

        // Buscar o tipo do escritório para definir o módulo
        const { data: officeData } = await supabase
          .from('offices')
          .select('office_type')
          .eq('id', health.office_id)
          .maybeSingle();

        setModule(normalizeModule(officeData?.office_type));
      } else {
        setRole('MEMBER');
        setModule('LEGAL');
        setOfficeId(null);
      }

    } catch (err) {
      // Log apenas em DEV
      if (import.meta.env.DEV) {
        console.warn('[useOfficeRole] Erro ao buscar role:', err);
      }
      setRole('MEMBER');
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
