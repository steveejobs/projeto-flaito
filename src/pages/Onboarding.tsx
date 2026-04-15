import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  Building2, 
  UserPlus, 
  Settings, 
  Loader2, 
  Rocket,
  Plus,
  Eye,
  FileText,
  BadgeCheck,
  User,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useOnboardingSteps } from '@/hooks/useOnboardingSteps';
import { useOfficeRole } from '@/hooks/useOfficeRole';
import { SimpleConfigWizard } from '@/features/institutional/SimpleConfigWizard';
import { OfficeInfoWizard } from '@/features/office/OfficeInfoWizard';
import { FirstClientWizard } from '@/features/clients/FirstClientWizard';
import { useInstitutionalConfig } from '@/hooks/useInstitutionalConfig';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type StepStatus = 'pending' | 'in_progress' | 'completed';

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { steps, loading: stepsLoading, error, refresh } = useOnboardingSteps();
  const { officeId, loading: officeLoading, module: officeRoleModule } = useOfficeRole();
  const [activeStepKey, setActiveStepKey] = useState<string | null>(null);
  const { data: institutionalData, isLoading: instLoading } = useInstitutionalConfig(officeId || '');

  useEffect(() => {
    if (user) {
      console.log('[Onboarding] Sessão ativa detectada para:', user.email);
    }
    
    if (!stepsLoading && !user) {
      console.warn('[Onboarding] Redirecionando: Usuário não autenticado.');
      navigate('/login', { replace: true });
    }
  }, [user, stepsLoading, navigate]);

  // Determina o módulo (metadata bootstrap ou role)
  const mainModule = useMemo(() => {
    return officeRoleModule || user?.user_metadata?.main_module || 'JURIDICO';
  }, [officeRoleModule, user]);

  const firstName = useMemo(() => {
    const fullName = user?.user_metadata?.full_name || '';
    return fullName.split(' ')[0] || 'Aventureiro';
  }, [user]);

  // Define etapas críticas e de valor
  const criticalStepKeys = ['institutional_config', 'office_info'];
  
  // Calcula estatísticas
  const stats = useMemo(() => {
    const total = steps.length || 0;
    const completedSteps = steps.filter(s => s.completed);
    const criticalCompleted = steps.filter(s => s.completed && criticalStepKeys.includes(s.step_key)).length;
    const totalCritical = 2; // Institutional + Office
    
    const percentage = total > 0 ? Math.round((completedSteps.length / total) * 100) : 0;
    const isReady = criticalCompleted >= totalCritical;

    return { total, completed: completedSteps.length, percentage, isReady };
  }, [steps]);

  // Lógica Dr./Dra.
  const displayTitle = useMemo(() => {
    const prof = institutionalData?.professional;
    if (prof?.identNumber) {
      return mainModule === 'MEDICO' ? 'Dr(a).' : 'Dr(a).';
    }
    return '';
  }, [institutionalData, mainModule]);

  const handleStepAction = (stepKey: string) => {
    setActiveStepKey(stepKey);
  };

  const handleWizardComplete = async () => {
    setActiveStepKey(null);
    toast.success('Etapa concluída!');
    await refresh();
  };

  const goToDashboard = () => {
    if (!stats.isReady) {
      toast.error('Complete as etapas de Identidade e Unidade para acessar o sistema.');
      return;
    }
    const dest = mainModule === 'MEDICO' ? '/medical/dashboard' : '/dashboard';
    navigate(dest);
  };

  if (stepsLoading && steps.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500 mx-auto" />
          <p className="text-slate-400 animate-pulse">Sincronizando seu ambiente...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <Card className="max-w-md w-full bg-slate-900 border-red-500/20">
          <CardContent className="p-8 text-center space-y-6">
            <div className="inline-flex p-3 bg-red-500/10 rounded-full">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Erro de Sincronização</h2>
              <p className="text-slate-400 text-sm">Não conseguimos carregar seu progresso. Verifique sua conexão.</p>
            </div>
            <Button onClick={() => refresh()} className="w-full bg-slate-800 hover:bg-slate-700">
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Background Decor */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
      </div>

      <main className="flex-1 container max-w-5xl mx-auto px-6 py-12 relative z-10 flex flex-col justify-center">
        <div className="space-y-12">
          {/* Header */}
          <div className="text-center space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider"
            >
              <Rocket className="h-3.3" />
              Projeto Flaito
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl md:text-5xl font-bold text-white tracking-tight"
            >
              Olá, {displayTitle} {firstName}. <br /> <span className="text-blue-500">Prepare seu ambiente.</span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-slate-400 max-w-2xl mx-auto"
            >
              Configure o Flaito para o seu contexto profissional. Finalize as etapas de **Identidade** e **Ambiente** para liberar o acesso total.
            </motion.p>
          </div>
 
          {/* Progress Bar */}
          <div className="max-w-2xl mx-auto space-y-3 mb-12">
            <div className="flex justify-between items-end text-sm">
              <span className="text-slate-400 font-medium">Progresso de ativação</span>
              <span className="text-white font-bold">{stats.percentage}%</span>
            </div>
            <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5">
              <motion.div 
                className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                initial={{ width: 0 }}
                animate={{ width: `${stats.percentage}%` }}
                transition={{ type: 'spring', bounce: 0, duration: 1 }}
              />
            </div>
          </div>

          {/* Step Cards - Centered & Clean */}
          <div className="max-w-6xl mx-auto w-full">
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StepCard 
                  index={1}
                  title="Identidade Profissional"
                  description="Configure seu nome, títulos e ativos de assinatura."
                  icon={<Settings className="h-6 w-6" />}
                  status={steps.find(s => s.step_key === 'institutional_config')?.completed ? 'completed' : 'pending'}
                  onClick={() => handleStepAction('institutional_config')}
                />
                <StepCard 
                  index={2}
                  title={mainModule === 'MEDICO' ? "Minha Clínica" : "Meu Escritório"}
                  description={mainModule === 'MEDICO' ? "Configure os dados da unidade e branding da clínica." : "Configurações do escritório, logo e dados jurídicos."}
                  icon={<Building2 className="h-6 w-6" />}
                  status={steps.find(s => s.step_key === 'office_info')?.completed ? 'completed' : 'pending'}
                  onClick={() => handleStepAction('office_info')}
                />
                
                {mainModule === 'AMBOS' ? (
                  <StepCard 
                    index={3}
                    title="Primeiro Cliente (Jurídico)"
                    description="Cadastre um cliente real para ver o poder do NIJA."
                    icon={<UserPlus className="h-6 w-6" />}
                    status={steps.find(s => s.step_key === 'first_client')?.completed ? 'completed' : 'pending'}
                    onClick={() => handleStepAction('first_client')}
                  />
                ) : (
                  <StepCard 
                    index={3}
                    title={mainModule === 'MEDICO' ? "Primeiro Paciente" : "Primeiro Cliente"}
                    description={mainModule === 'MEDICO' ? "Simule um atendimento e gere seu primeiro laudo IA." : "Cadastre seu primeiro caso para testar o fluxo completo."}
                    icon={<Rocket className="h-6 w-6" />}
                    status={steps.find(s => s.step_key === 'first_client')?.completed ? 'completed' : 'pending'}
                    onClick={() => handleStepAction('first_client')}
                  />
                )}
              </div>

              {/* Action Footer */}
              <AnimatePresence>
                {stats.isReady && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-center pt-8 border-t border-white/5"
                  >
                    <Button 
                      size="lg"
                      onClick={goToDashboard}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-12 py-7 text-lg rounded-2xl shadow-2xl shadow-blue-600/30 group transition-all"
                    >
                      Entrar no Sistema
                      <ArrowRight className="ml-3 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      {/* Wizard Modals */}
      <Dialog open={activeStepKey !== null} onOpenChange={(open) => !open && setActiveStepKey(null)}>
        <DialogContent className="max-w-2xl bg-slate-950 border-white/10 p-1 shadow-2xl overflow-hidden flex flex-col max-h-[95vh] focus:outline-none">
          <div className="bg-slate-950 p-6 md:p-8 overflow-y-auto flex-1 minimal-scrollbar">


            <DialogHeader className="mb-6 sr-only">
              <DialogTitle>Assistente de Configuração</DialogTitle>
            </DialogHeader>

            <AnimatePresence mode="wait">
              {officeLoading ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="py-12 flex flex-col items-center justify-center space-y-4"
                >
                  <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                  <p className="text-slate-400">Sincronizando escritório...</p>
                </motion.div>
              ) : !officeId ? (
                <motion.div 
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-12 text-center space-y-6"
                >
                  <div className="p-3 bg-amber-500/10 rounded-full inline-block">
                    <AlertCircle className="h-8 w-8 text-amber-500" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-white font-semibold">Escritório não encontrado</h3>
                    <p className="text-sm text-slate-400">Houve um problema ao carregar as permissões do seu usuário.</p>
                  </div>
                  <Button onClick={() => window.location.reload()} variant="outline">Recarregar</Button>
                </motion.div>
              ) : (
                <motion.div
                  key="content"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                >
                  {activeStepKey === 'institutional_config' && (
                    <SimpleConfigWizard 
                      officeId={officeId} 
                      onComplete={handleWizardComplete} 
                    />
                  )}
                  {activeStepKey === 'office_info' && (
                    <OfficeInfoWizard 
                      officeId={officeId} 
                      onComplete={handleWizardComplete} 
                    />
                  )}
                  {activeStepKey === 'first_client' && (
                    <FirstClientWizard 
                      officeId={officeId} 
                      onComplete={handleWizardComplete} 
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const PreviewCard = ({ title, content }: { title: string; content: React.ReactNode }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between px-1">
      <Label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{title}</Label>
      <div className="h-1 w-1 rounded-full bg-blue-500/40" />
    </div>
    <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-1.5 shadow-2xl backdrop-blur-sm">
      <div className="rounded-[14px] bg-slate-100/5 overflow-hidden border border-white/5">
        {content}
      </div>
    </div>
  </div>
);

interface StepCardProps {
  index: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: StepStatus;
  onClick: () => void;
}

const StepCard = ({ index, title, description, icon, status, onClick }: StepCardProps) => {
  const isCompleted = status === 'completed';
  
  return (
    <motion.div
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
    >
      <Card 
        className={`h-full cursor-pointer transition-all duration-300 overflow-hidden relative group
          ${isCompleted 
            ? 'bg-slate-900/40 border-green-500/30' 
            : 'bg-slate-900 border-white/5 hover:border-blue-500/30 hover:bg-slate-900/80 shadow-lg hover:shadow-blue-500/10'
          }`}
        onClick={onClick}
      >
        <CardContent className="p-8 flex flex-col h-full space-y-6">
          <div className="flex justify-between items-start">
            <div className={`p-3 rounded-2xl transition-colors
              ${isCompleted ? 'bg-green-500/20 text-green-400' : 'bg-blue-600/20 text-blue-400 group-hover:bg-blue-600/30'}`}>
              {icon}
            </div>
            <div className="flex flex-col items-end gap-2">
              {isCompleted ? (
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              ) : (
                <Circle className="h-6 w-6 text-slate-700 group-hover:text-blue-500/40" />
              )}
            </div>
          </div>

          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Etapa {index}</span>
            </div>
            <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">{title}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
          </div>

          <div className="pt-4 flex items-center text-sm font-semibold">
            {isCompleted ? (
              <span className="text-green-500 flex items-center">
                Concluído
              </span>
            ) : (
              <span className="text-blue-400 group-hover:text-blue-300 flex items-center">
                Configurar agora
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
