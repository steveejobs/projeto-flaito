import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface OnboardingStep {
  step_key: string;
  completed: boolean;
}

const STEP_LABELS: Record<string, { title: string; description: string }> = {
  office_info: {
    title: 'Informações do Escritório',
    description: 'Configure nome, OAB e tipo do escritório',
  },
  first_client: {
    title: 'Primeiro Cliente',
    description: 'Cadastre seu primeiro cliente no sistema',
  },
  first_case: {
    title: 'Primeiro Caso',
    description: 'Crie seu primeiro caso jurídico',
  },
  first_template: {
    title: 'Primeiro Template',
    description: 'Explore os templates de documentos',
  },
};

export default function Onboarding() {
  const navigate = useNavigate();
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<string | null>(null);

  async function fetchSteps() {
    try {
      const { data, error } = await supabase.rpc('get_office_onboarding_status');
      if (error) throw error;
      setSteps(data || []);
      
      // Check if all steps completed
      if (data && data.length > 0 && data.every((s: OnboardingStep) => s.completed)) {
        toast({
          title: 'Onboarding concluído!',
          description: 'Bem-vindo ao Lexos. Você já pode usar todas as funcionalidades.',
          duration: 4000,
        });
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Error fetching onboarding steps:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os passos do onboarding.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSteps();
  }, []);

  async function handleComplete(stepKey: string) {
    setCompleting(stepKey);
    try {
      const { error } = await supabase.rpc('complete_onboarding_step', { p_step: stepKey });
      if (error) throw error;
      
      toast({
        title: 'Passo concluído!',
        description: `"${STEP_LABELS[stepKey]?.title || stepKey}" foi marcado como concluído.`,
      });
      
      await fetchSteps();
    } catch (err) {
      console.error('Error completing step:', err);
      toast({
        title: 'Erro',
        description: 'Não foi possível concluir este passo.',
        variant: 'destructive',
      });
    } finally {
      setCompleting(null);
    }
  }

  const completedCount = steps.filter(s => s.completed).length;
  const totalCount = steps.length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto py-12 px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Configure seu Escritório
          </h1>
          <p className="text-muted-foreground">
            Complete os passos abaixo para começar a usar o Lexos
          </p>
          <div className="mt-4 text-sm text-muted-foreground">
            {completedCount} de {totalCount} passos concluídos
          </div>
          <div className="mt-2 w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }}
            />
          </div>
        </div>

        <div className="space-y-4">
          {steps.map((step) => {
            const label = STEP_LABELS[step.step_key] || { 
              title: step.step_key, 
              description: 'Complete este passo para continuar' 
            };
            
            return (
              <Card 
                key={step.step_key} 
                className={step.completed ? 'border-green-200 bg-green-50/50 dark:bg-green-950/20' : ''}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {step.completed ? (
                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                      ) : (
                        <Circle className="h-6 w-6 text-muted-foreground" />
                      )}
                      <CardTitle className="text-lg">{label.title}</CardTitle>
                    </div>
                    {!step.completed && (
                      <Button
                        size="sm"
                        onClick={() => handleComplete(step.step_key)}
                        disabled={completing === step.step_key}
                      >
                        {completing === step.step_key ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Concluir'
                        )}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="ml-9">
                    {label.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {steps.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-muted-foreground">
                Nenhum passo de onboarding encontrado.
              </p>
              <Button className="mt-4" onClick={() => navigate('/dashboard')}>
                Ir para o Dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
