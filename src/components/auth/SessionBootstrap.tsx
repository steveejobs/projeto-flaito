import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SessionBootstrapProps {
  children: React.ReactNode;
}

/**
 * SessionBootstrap garante que o usuário autenticado possua um contexto (office) válido.
 * Se o usuário não tiver um escritório, ele chama a RPC ensure_personal_office de forma idempotente.
 */
export const SessionBootstrap = ({ children }: SessionBootstrapProps) => {
  const { user, loading: authLoading, signOut } = useAuth();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    const runBootstrap = async () => {
      if (authLoading) return;
      if (!user) {
        setIsBootstrapping(false);
        return;
      }

      try {
        setError(null);
        setIsBootstrapping(true);

        // 1. Verifica se já existe contexto no sessionStorage para evitar chamadas excessivas
        const cachedOfficeId = sessionStorage.getItem('lexos_office_id');
        if (cachedOfficeId && retryCount === 0) {
          setIsBootstrapping(false);
          return;
        }

        // 2. Executa healthcheck de sessão
        const { data: sessionData, error: sessionErr } = await supabase.rpc('lexos_healthcheck_session');
        
        if (sessionErr) throw sessionErr;

        const session = Array.isArray(sessionData) ? sessionData[0] : sessionData;
        
        // 3. Se não houver escritório, tenta o bootstrap automático (ensure_personal_office)
        if (!session?.ok && (!session?.office_id || session?.reason?.toLowerCase().includes('no active office'))) {
          console.log('SessionBootstrap: Nenhum escritório encontrado. Iniciando criação automática...');
          
          const { data: newOfficeId, error: bootstrapErr } = await supabase.rpc('ensure_personal_office');
          
          if (bootstrapErr) throw bootstrapErr;
          
          if (newOfficeId && mounted) {
            console.log('SessionBootstrap: Escritório criado/recuperado com sucesso:', newOfficeId);
            sessionStorage.setItem('lexos_office_id', newOfficeId);
          }
        } else if (session?.office_id && mounted) {
          sessionStorage.setItem('lexos_office_id', session.office_id);
        }

      } catch (err: any) {
        console.error('SessionBootstrap error:', err);
        if (mounted) {
          setError(err.message || 'Erro ao inicializar sua sessão de trabalho.');
        }
      } finally {
        if (mounted) {
          setIsBootstrapping(false);
        }
      }
    };

    runBootstrap();

    return () => {
      mounted = false;
    };
  }, [user, authLoading, retryCount]);

  // Enquanto carrega a auth principal
  if (authLoading) return null;

  // Se não está logado, não interfere (o ProtectedRoute cuidará disso)
  if (!user) return <>{children}</>;

  // Estado de carregamento do bootstrap (criação do escritório)
  if (isBootstrapping) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground space-y-6 animate-in fade-in duration-500">
        <div className="relative">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <div className="absolute inset-0 blur-xl bg-primary/20 rounded-full animate-pulse"></div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold tracking-tight">Preparando seu ambiente...</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Estamos configurando seu escritório e personalizando sua experiência.
          </p>
        </div>
      </div>
    );
  }

  // Se houver erro crítico no bootstrap
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full border border-destructive/20 bg-destructive/5 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3 text-destructive">
            <AlertCircle className="h-6 w-6" />
            <h2 className="text-lg font-bold">Falha na Inicialização</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Não conseguimos preparar seu ambiente de trabalho: <span className="font-mono text-xs opacity-80">{error}</span>
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={() => setRetryCount(prev => prev + 1)} variant="default">
              Tentar Novamente
            </Button>
            <Button onClick={() => signOut()} variant="outline">
              Sair da Conta
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
