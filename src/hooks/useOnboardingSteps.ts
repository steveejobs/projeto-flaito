
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OnboardingStep {
  step_key: string;
  completed: boolean;
}

const FALLBACK_STEPS: OnboardingStep[] = [
  { step_key: 'institutional_config', completed: false },
  { step_key: 'office_info', completed: false },
  { step_key: 'first_client', completed: false },
];

export function useOnboardingSteps() {
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchSteps = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: rpcError } = await supabase.rpc('get_office_onboarding_status');
      
      if (rpcError) throw rpcError;
      
      const finalSteps = data && data.length > 0 ? data : FALLBACK_STEPS;
      setSteps(finalSteps);
      setError(null);
      return finalSteps;
    } catch (err) {
      console.error('Failed to fetch onboarding steps:', err);
      setError(err);
      if (steps.length === 0) setSteps(FALLBACK_STEPS);
      return FALLBACK_STEPS;
    } finally {
      setLoading(false);
    }
  }, [steps.length]);

  useEffect(() => {
    fetchSteps();
  }, [fetchSteps]);

  const refresh = () => fetchSteps();

  return { steps, loading, error, refresh, setSteps };
}
