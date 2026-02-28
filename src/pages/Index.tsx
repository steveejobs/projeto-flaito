import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();
  const [processingInvite, setProcessingInvite] = useState(false);

  // Process invite token from URL or fallback to email-based lookup
  useEffect(() => {
    if (loading || processingInvite || !user) return;

    const processInvite = async () => {
      setProcessingInvite(true);
      
      // 1. Try URL token first
      const inviteToken = searchParams.get('invite');
      if (inviteToken) {
        const { data, error } = await supabase.rpc('accept_office_invite', { p_token: inviteToken });
        const result = data as { success?: boolean; error?: string } | null;
        
        if (error) {
          console.error('Error accepting invite:', error);
        } else if (result?.success) {
          toast.success('Bem-vindo ao escritório!');
          navigate('/dashboard', { replace: true });
          return;
        }
      }

      // 2. Fallback: Check if user has no office and has pending invite by email
      const { data: membership } = await supabase
        .from('office_members')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!membership && user.email) {
        // User has no office - check for pending invite by email
        const { data: pendingInvite } = await supabase
          .from('office_invites')
          .select('token')
          .eq('email', user.email)
          .is('accepted_at', null)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (pendingInvite?.token) {
          const { data, error } = await supabase.rpc('accept_office_invite', { p_token: pendingInvite.token });
          const result = data as { success?: boolean; error?: string } | null;

          if (!error && result?.success) {
            toast.success('Convite aceito automaticamente!');
            navigate('/dashboard', { replace: true });
            return;
          }
        }
      }

      setProcessingInvite(false);
    };

    processInvite();
  }, [user, loading, searchParams, navigate, processingInvite]);
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <Scale className="h-16 w-16 text-primary" />
        </div>
        <h1 className="text-4xl font-bold">Lexos</h1>
        <p className="text-xl text-muted-foreground">
          Gestão jurídica inteligente, pensada para escritórios que buscam
          organização, estratégia e performance.
        </p>
        <Button size="lg" onClick={() => navigate("/login")}>
          Acessar o sistema
        </Button>
      </div>
    </div>
  );
};

export default Index;
