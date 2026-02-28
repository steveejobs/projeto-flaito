import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export async function checkOnboardingRequired(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('get_office_onboarding_status');
    if (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
    
    // If any step is not completed, onboarding is required
    return Array.isArray(data) && data.some((step: { step_key: string; completed: boolean }) => !step.completed);
  } catch (err) {
    console.error('Error in checkOnboardingRequired:', err);
    return false;
  }
}

export async function blockIfNotOnboarded(): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('block_actions_if_not_onboarded');
    
    if (error) {
      if (error.message?.includes('office_not_onboarded')) {
        toast({
          title: 'Onboarding pendente',
          description: 'Finalize o onboarding do escritório antes de continuar.',
          variant: 'destructive',
        });
        return false;
      }
      console.error('Error in block check:', error);
    }
    
    return true;
  } catch (err) {
    console.error('Error in blockIfNotOnboarded:', err);
    return true; // Allow action on unexpected errors
  }
}
