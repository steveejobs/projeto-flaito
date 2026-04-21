
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useOfficeRole } from '@/hooks/useOfficeRole';
import { useInstitutionalConfig } from '@/hooks/useInstitutionalConfig';
import { InitialSplashScreen } from './InitialSplashScreen';
import { ResourceStatus, AuthInitializationState } from '@/types/auth-initialization';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle, Terminal } from 'lucide-react';
import { toast } from 'sonner';

interface AppInitializerProps {
  children: React.ReactNode;
}

export const AppInitializer: React.FC<AppInitializerProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading, module: rawOfficeModule, officeId } = useOfficeRole();
  const officeModule = rawOfficeModule === 'MEDICAL' || (rawOfficeModule as string) === 'MEDICO' ? 'MEDICAL' : 'LEGAL';
  const { office: config, isLoading: configLoading } = (useInstitutionalConfig as any)(officeId);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingData, setOnboardingData] = useState<any[] | null>(null);
  
  const [state, setState] = useState<AuthInitializationState>({
    auth: 'unknown',
    profile: 'unknown',
    office: 'unknown',
    config: 'unknown',
    onboarding: 'unknown',
    isStabilized: false,
  });

  const [hasResolvedInitialRoute, setHasResolvedInitialRoute] = useState(false);
  const [initialDecisionMade, setInitialDecisionMade] = useState(false);
  const [showFailSafe, setShowFailSafe] = useState(false);

  // Debug Logs
  useEffect(() => {
    if (state.isStabilized) {
      console.log('[Gatekeeper] System Stabilized. Module:', officeModule, 'Path:', location.pathname);
    }
  }, [state.isStabilized, officeModule, location.pathname]);

  // Fail-safe Timeout
  useEffect(() => {
    if (!state.isStabilized) {
      const timer = setTimeout(() => {
        console.error('[Gatekeeper] Stabilization Timeout reached (6s)');
        setShowFailSafe(true);
      }, 6000);
      return () => clearTimeout(timer);
    } else {
      setShowFailSafe(false);
    }
  }, [state.isStabilized]);

  // Fetch Onboarding Status
  useEffect(() => {
    if (state.office === 'ready' && officeId) {
      const userUuid = user?.id || 'anonymous';
      const cacheKey = `flaito_onboarding_complete_${userUuid}_${officeId}`;
      const isCachedComplete = localStorage.getItem(cacheKey) === 'true';
      
      // Se já está no cache, não precisamos dar block no loading do app
      if (isCachedComplete) {
        console.log('[Gatekeeper] Onboarding complete (cached)');
        setOnboardingData([{ step_key: 'institutional_config', completed: true }, { step_key: 'office_info', completed: true }]);
        return;
      }

      const fetchOnboarding = async () => {
        setOnboardingLoading(true);
        try {
          const { data } = await supabase.rpc('get_office_onboarding_status');
          setOnboardingData(data || []);
        } catch (err) {
          console.error('[Gatekeeper] Onboarding check failed:', err);
          setOnboardingData([]);
        } finally {
          setOnboardingLoading(false);
        }
      };
      fetchOnboarding();
    } else if (state.office === 'missing') {
      setOnboardingData(null);
      setOnboardingLoading(false);
    }
  }, [state.office, officeId]);

  // Sync state with hooks
  useEffect(() => {
    const newState: Partial<AuthInitializationState> = {};
    
    // Auth State
    if (authLoading) {
      newState.auth = 'unknown';
    } else {
      newState.auth = user ? 'ready' : 'missing';
    }

    // Office State
    if (roleLoading) {
      newState.office = 'unknown';
    } else {
      newState.office = role ? 'ready' : (newState.auth === 'ready' ? 'missing' : 'unknown');
    }

    // Onboarding State
    const userUuid = user?.id || 'anonymous';
    const cacheKey = `flaito_onboarding_complete_${userUuid}_${officeId}`;
    const isCachedComplete = officeId ? localStorage.getItem(cacheKey) === 'true' : false;

    if (isCachedComplete) {
      newState.onboarding = 'ready';
    } else if (onboardingLoading) {
      newState.onboarding = 'unknown';
    } else if (onboardingData === null) {
      newState.onboarding = (newState.auth === 'ready' && newState.office === 'ready') ? 'unknown' : 'ready';
    } else {
      const criticalSteps = ['institutional_config', 'office_info'];
      const hasData = Array.isArray(onboardingData) && onboardingData.length > 0;
      
      const isComplete = hasData && 
                         onboardingData
                           .filter(s => criticalSteps.includes(s.step_key))
                           .every(s => s.completed);
      
      if (isComplete && officeId && user?.id) {
        localStorage.setItem(cacheKey, 'true');
      }
      
      // Só marca como 'missing' se tivermos dados e eles mostrarem que está incompleto.
      // Se não tiver dados (onboardingData vazia), mantemos como 'unknown' para evitar redirect precoce.
      if (isComplete) {
        newState.onboarding = 'ready';
      } else if (newState.auth === 'ready' && newState.office === 'ready') {
        // Se temos dados e não está completo -> missing
        // Se NÃO temos dados (onboardingData é []), mas auth/office estão prontos, 
        // ainda aguardamos um pouco antes de assumir 'missing' (unknown)
        newState.onboarding = hasData ? 'missing' : 'unknown';
      } else {
        newState.onboarding = 'ready'; // Fallback seguro para não travar o app
      }
    }

    // Check if critical resources are resolved
    const criticalResolved = 
      newState.auth === 'missing' || 
      (newState.auth === 'ready' && newState.office !== 'unknown' && newState.onboarding !== 'unknown');

    if (criticalResolved) {
      newState.isStabilized = true;
    }

    setState(prev => ({ ...prev, ...newState }));
  }, [authLoading, user, roleLoading, role, configLoading, config, onboardingLoading, onboardingData]);

  const resolveRoute = useCallback(() => {
    if (!state.isStabilized || hasResolvedInitialRoute) return;

    const publicRoutes = ['/login', '/signup', '/captacao', '/convite'];
    const isPublicRoute = publicRoutes.some(route => location.pathname.startsWith(route));
    const userUuid = user?.id || 'anonymous';

    // 1. Caso: Não autenticado
    if (state.auth === 'missing') {
      if (!isPublicRoute) {
        console.warn(`[Gatekeeper] AUDIT | ACTION: NAVIGATION_DECISION | REASON: NO_SESSION | ROUTE: ${location.pathname} -> /login | USER: ${userUuid}`);
        navigate('/login', { replace: true });
        setHasResolvedInitialRoute(true);
      } else {
        // Se já está em rota pública, marcamos como resolvido
        setHasResolvedInitialRoute(true);
      }
      setInitialDecisionMade(true);
      return;
    }

    // 2. Caso: Autenticado
    if (state.auth === 'ready') {
      // Redireciona de rotas públicas se logado
      if (isPublicRoute && (location.pathname === '/login' || location.pathname === '/signup')) {
        const destination = officeModule === 'MEDICAL' ? '/medical/dashboard' : '/dashboard';
        console.log(`[Gatekeeper] AUDIT | ACTION: NAVIGATION_DECISION | REASON: ALREADY_LOGGED | ROUTE: ${location.pathname} -> ${destination} | USER: ${userUuid}`);
        navigate(destination, { replace: true });
        setHasResolvedInitialRoute(true);
        setInitialDecisionMade(true);
        return;
      }

      // Validação de Onboarding Necessário
      if (state.office === 'missing' || state.onboarding === 'missing') {
        if (location.pathname !== '/onboarding') {
          console.log(`[Gatekeeper] AUDIT | ACTION: NAVIGATION_DECISION | REASON: ONBOARDING_PENDING | ROUTE: ${location.pathname} -> /onboarding | USER: ${userUuid}`);
          navigate('/onboarding', { replace: true });
        }
        setHasResolvedInitialRoute(true);
        setInitialDecisionMade(true);
        return;
      }

      // Dashboard ou Rota Atual
      if (location.pathname === '/' || location.pathname === '') {
        const destination = officeModule === 'MEDICAL' ? '/medical/dashboard' : '/dashboard';
        console.log(`[Gatekeeper] AUDIT | ACTION: NAVIGATION_DECISION | REASON: ROOT_ACCESS | ROUTE: / -> ${destination} | USER: ${userUuid}`);
        navigate(destination, { replace: true });
        setHasResolvedInitialRoute(true);
      }
      
      setInitialDecisionMade(true);
    }
  }, [state.isStabilized, state.auth, state.office, state.onboarding, officeModule, location.pathname, navigate, hasResolvedInitialRoute, user]);

  useEffect(() => {
    // Quando estabilizado, executa a decisão de rota
    if (state.isStabilized && !initialDecisionMade) {
      resolveRoute();
    }
  }, [state.isStabilized, initialDecisionMade, resolveRoute]);

  if (showFailSafe) {
    return (
      <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-slate-950 text-white p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-amber-500/10 rounded-full">
              <AlertCircle className="h-12 w-12 text-amber-500" />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Lentidão na Inicialização</h1>
            <p className="text-slate-400 text-sm">
              O sistema está demorando mais que o esperado para sincronizar o ambiente.
            </p>
          </div>

          <div className="bg-slate-900 border border-white/5 rounded-lg p-4 text-left font-mono text-xs space-y-2">
            <div className="flex items-center gap-2 text-slate-500 border-b border-white/5 pb-2 mb-2">
              <Terminal className="h-3 w-3" />
              <span>DIAGNÓSTICO TÉCNICO</span>
            </div>
            <p>Auth: <span className={state.auth === 'ready' ? 'text-green-400' : 'text-amber-400'}>{state.auth}</span></p>
            <p>Office: <span className={state.office === 'ready' ? 'text-green-400' : 'text-amber-400'}>{state.office}</span></p>
            <p>Config: <span className={state.config === 'ready' ? 'text-green-400' : 'text-amber-400'}>{state.config}</span></p>
            <p>Stabilized: <span className="text-red-400">false</span></p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Button 
              variant="default" 
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Recarregar aplicação
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full border-white/10 hover:bg-white/5"
              onClick={() => {
                toast.info("Tentando forçar entrada...");
                setState(prev => ({ ...prev, isStabilized: true }));
              }}
            >
              Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {(!state.isStabilized || !initialDecisionMade) ? (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[9999]"
        >
          <InitialSplashScreen />
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="min-h-screen bg-background"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
