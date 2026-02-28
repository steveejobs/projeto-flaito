import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Clock, Users, LogIn, UserPlus } from 'lucide-react';

interface InviteData {
  id: string;
  office_id: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  office_name?: string;
}

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadInvite();
    }
  }, [token]);

  const loadInvite = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch invite by token
      const { data: inviteData, error: inviteError } = await supabase
        .from('office_invites')
        .select('id, office_id, role, expires_at, accepted_at')
        .eq('token', token)
        .single();

      if (inviteError || !inviteData) {
        setError('Convite não encontrado ou link inválido.');
        return;
      }

      // Check if already accepted
      if (inviteData.accepted_at) {
        setError('Este convite já foi utilizado.');
        return;
      }

      // Check if expired
      if (new Date(inviteData.expires_at) < new Date()) {
        setError('Este convite expirou. Solicite um novo convite ao administrador.');
        return;
      }

      // Get office name
      const { data: officeData } = await supabase
        .from('offices')
        .select('name')
        .eq('id', inviteData.office_id)
        .single();

      setInvite({
        ...inviteData,
        office_name: officeData?.name || 'Escritório',
      });
    } catch (err) {
      console.error('Error loading invite:', err);
      setError('Erro ao carregar convite.');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!invite || !user) return;

    setAccepting(true);
    try {
      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('office_members')
        .select('id')
        .eq('office_id', invite.office_id)
        .eq('user_id', user.id)
        .single();

      if (existingMember) {
        toast.info('Você já é membro deste escritório.');
        navigate('/dashboard');
        return;
      }

      // Create office member
      const { error: memberError } = await supabase
        .from('office_members')
        .insert({
          office_id: invite.office_id,
          user_id: user.id,
          role: invite.role,
          is_active: true,
        });

      if (memberError) throw memberError;

      // Mark invite as accepted
      const { error: updateError } = await supabase
        .from('office_invites')
        .update({
          accepted_at: new Date().toISOString(),
          accepted_by: user.id,
        })
        .eq('id', invite.id);

      if (updateError) {
        console.error('Error updating invite:', updateError);
        // Continue anyway since member was created
      }

      toast.success(`Bem-vindo ao ${invite.office_name}!`);
      navigate('/dashboard');
    } catch (err) {
      console.error('Error accepting invite:', err);
      toast.error('Erro ao aceitar convite. Tente novamente.');
    } finally {
      setAccepting(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'Proprietário';
      case 'ADMIN':
        return 'Administrador';
      default:
        return 'Membro';
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <Skeleton className="h-12 w-12 rounded-full mx-auto" />
            <Skeleton className="h-6 w-48 mx-auto" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-xl font-semibold">Convite Inválido</CardTitle>
            <CardDescription className="text-sm">
              {error}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => navigate('/login')}
            >
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    // User not logged in - show login/signup options
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl font-semibold">Convite para o Lexos</CardTitle>
            <CardDescription className="text-sm">
              Você foi convidado para fazer parte de <strong>{invite?.office_name}</strong> como <strong>{getRoleLabel(invite?.role || 'MEMBER')}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Para aceitar o convite, faça login ou crie uma conta.</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Button 
                className="w-full gap-2" 
                onClick={() => navigate(`/login?redirect=/convite/${token}`)}
              >
                <LogIn className="h-4 w-4" />
                Entrar na minha conta
              </Button>
              <Button 
                className="w-full gap-2" 
                variant="outline"
                onClick={() => navigate(`/signup?redirect=/convite/${token}`)}
              >
                <UserPlus className="h-4 w-4" />
                Criar uma conta
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User is logged in - show accept button
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </div>
          <CardTitle className="text-xl font-semibold">Aceitar Convite</CardTitle>
          <CardDescription className="text-sm">
            Você foi convidado para fazer parte de <strong>{invite?.office_name}</strong> como <strong>{getRoleLabel(invite?.role || 'MEMBER')}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 border border-border/50 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Escritório:</span>
              <span className="font-medium">{invite?.office_name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Permissão:</span>
              <span className="font-medium">{getRoleLabel(invite?.role || 'MEMBER')}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Seu e-mail:</span>
              <span className="font-medium text-xs">{user.email}</span>
            </div>
          </div>
          
          <Button 
            className="w-full gap-2" 
            onClick={handleAccept}
            disabled={accepting}
          >
            <CheckCircle className="h-4 w-4" />
            {accepting ? 'Aceitando...' : 'Aceitar e Entrar'}
          </Button>
          
          <Button 
            className="w-full" 
            variant="ghost"
            onClick={() => navigate('/dashboard')}
          >
            Cancelar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
