import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface UserRoleData {
  role: string | null;
  officeId: string | null;
  isAdmin: boolean;
  loading: boolean;
}

export function useUserRole(): UserRoleData {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setOfficeId(null);
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      try {
        const { data, error } = await supabase
          .from('office_members')
          .select('role, office_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('Error fetching user role:', error);
          setRole(null);
          setOfficeId(null);
        } else if (data) {
          setRole(data.role);
          setOfficeId(data.office_id);
        } else {
          setRole(null);
          setOfficeId(null);
        }
      } catch (err) {
        console.error('Error fetching user role:', err);
        setRole(null);
        setOfficeId(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [user]);

  return {
    role,
    officeId,
    isAdmin: role === 'OWNER' || role === 'ADMIN',
    loading,
  };
}
