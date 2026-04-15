import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Mail, Lock, UserPlus, Users, Shield, User, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const signupSchema = z.object({
  fullName: z.string().min(3, 'Nome muito curto'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string(),
  mainModule: z.enum(['JURIDICO', 'MEDICO', 'AMBOS'], {
    required_error: 'Selecione sua área de atuação',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

interface InviteData {
  id: string;
  email: string | null;
  role: 'ADMIN' | 'MEMBER';
  office_id: string;
  office_name: string;
  expires_at: string;
}

const ROLE_INFO = {
  OWNER: {
    label: 'Proprietário',
    icon: Shield,
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    description: 'Controle total do escritório, incluindo configurações críticas e gerenciamento de membros.',
  },
  ADMIN: {
    label: 'Administrador',
    icon: Shield,
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    description: 'Gerencia clientes, casos, documentos e membros. Acesso a relatórios e configurações.',
  },
  MEMBER: {
    label: 'Membro',
    icon: User,
    color: 'bg-muted text-muted-foreground border-border',
    description: 'Acesso operacional: visualiza e edita casos e documentos atribuídos.',
  },
};

export default function Signup() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mainModule, setMainModule] = useState<'JURIDICO' | 'MEDICO' | 'AMBOS' | ''>('');
  const [errors, setErrors] = useState<{ 
    fullName?: string; 
    email?: string; 
    password?: string; 
    confirmPassword?: string;
    mainModule?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const { signUp, user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const inviteToken = searchParams.get('invite');

  // Invite state
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      navigate(redirectTo, { replace: true });
    }
  }, [user, loading, navigate, redirectTo]);

  // Load invite data when token is present
  useEffect(() => {
    if (inviteToken) {
      loadInviteData(inviteToken);
    }
  }, [inviteToken]);

  const loadInviteData = async (token: string) => {
    setInviteLoading(true);
    setInviteError(null);

    try {
      // Use secure RPC function to get invite data (avoids RLS/permission issues)
      const { data, error } = await supabase.rpc('get_office_invite_public', {
        p_token: token,
      });

      // Handle RPC errors
      if (error) {
        console.error('Error fetching invite via RPC:', error);
        setInviteError('Erro ao carregar o convite. Tente novamente.');
        return;
      }

      // RPC returns empty array if invite not found, expired, or already accepted
      if (!data || data.length === 0) {
        setInviteError('Este convite não existe, expirou ou já foi utilizado');
        return;
      }

      const inviteRow = data[0];

      const inviteData: InviteData = {
        id: inviteRow.invite_id,
        email: inviteRow.email,
        role: inviteRow.role as 'ADMIN' | 'MEMBER',
        office_id: inviteRow.office_id,
        office_name: inviteRow.office_name || 'Escritório',
        expires_at: inviteRow.expires_at,
      };

      setInvite(inviteData);

      // Pre-fill email if available
      if (inviteRow.email) {
        setEmail(inviteRow.email);
      }
    } catch (err) {
      console.error('Error loading invite:', err);
      setInviteError('Erro inesperado ao carregar convite');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = signupSchema.safeParse({ 
      fullName, 
      email, 
      password, 
      confirmPassword,
      mainModule
    });
    
    if (!validation.success) {
      const fieldErrors: any = {};
      validation.error.errors.forEach((err) => {
        const field = err.path[0];
        fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    // Include invite token in redirect URL so it works on any browser/device
    const redirectUrl = inviteToken
      ? `${window.location.origin}/?invite=${inviteToken}`
      : `${window.location.origin}/`;

    const { error } = await signUp(email, password, {
      full_name: fullName,
      main_module: mainModule,
    });

    if (error) {
      setIsLoading(false);
      let message = 'Erro ao criar conta';
      if (error.message.includes('User already registered')) {
        message = 'Este email já está cadastrado';
      } else if (error.message.includes('Password should be')) {
        message = 'A senha não atende aos requisitos mínimos';
      }
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return;
    }

    // If there's an invite, store the token for processing after email confirmation
    if (invite && inviteToken) {
      // Store invite token in localStorage to process after email confirmation
      localStorage.setItem('pending_invite_token', inviteToken);

      // Try to process immediately if session is available (in case email confirmation is disabled)
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        // Session available immediately - process invite now
        const { data: result } = await supabase.rpc('accept_office_invite', { p_token: inviteToken });
        localStorage.removeItem('pending_invite_token');

        const parsedResult = result as { success?: boolean } | null;
        if (parsedResult?.success) {
          setIsLoading(false);
          toast({
            title: 'Bem-vindo!',
            description: `Você agora faz parte de ${invite.office_name}`,
          });
          navigate('/dashboard', { replace: true });
          return;
        }
      }

      // If no session yet, user needs to confirm email first
      setIsLoading(false);
      toast({
        title: 'Verifique seu email!',
        description: `Confirme seu cadastro para acessar ${invite.office_name}`,
      });
      navigate('/login', { replace: true });
      return;
    }

    setIsLoading(false);
    toast({
      title: 'Conta criada!',
      description: 'Verifique seu email para confirmar o cadastro',
    });
    navigate(redirectTo, { replace: true });
  };

  if (loading || inviteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const roleInfo = invite ? ROLE_INFO[invite.role] : null;
  const RoleIcon = roleInfo?.icon || User;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-2xl font-bold">
            {invite ? 'Aceitar Convite' : 'Criar Conta'}
          </CardTitle>
          <CardDescription>
            {invite
              ? 'Complete seu cadastro para acessar o escritório'
              : 'Preencha os dados abaixo para criar sua conta'
            }
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* Invite Banner */}
            {invite && (
              <div className="p-4 rounded-lg border bg-primary/5 border-primary/20 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">
                      Convite para {invite.office_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Você foi convidado para fazer parte da equipe
                    </p>
                  </div>
                </div>

                <div className={cn("p-3 rounded-md border", roleInfo?.color)}>
                  <div className="flex items-center gap-2 font-medium">
                    <RoleIcon className="h-4 w-4" />
                    Seu papel: {roleInfo?.label}
                  </div>
                  <p className="text-sm mt-1 opacity-80">
                    {roleInfo?.description}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Seu nome"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
              {errors.fullName && (
                <p className="text-sm text-destructive">{errors.fullName}</p>
              )}
            </div>

            <div className="space-y-3">
              <Label>Área de Atuação</Label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'JURIDICO', label: 'Jurídico', icon: Shield },
                  { value: 'MEDICO', label: 'Médico', icon: Users },
                  { value: 'AMBOS', label: 'Híbrido/Ambos', icon: UserPlus },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setMainModule(item.value as any)}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-lg border text-xs gap-2 transition-all duration-200",
                      mainModule === item.value 
                        ? "border-primary bg-primary/5 text-primary shadow-sm ring-1 ring-primary/20" 
                        : "border-border hover:bg-muted/50 text-muted-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </button>
                ))}
              </div>
              {errors.mainModule && (
                <p className="text-sm text-destructive">{errors.mainModule}</p>
              )}
              <p className="text-[11px] text-muted-foreground italic">
                * Escolha sua área principal para personalizarmos o onboarding.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={isLoading || (invite && !!invite.email)}
                />
              </div>
              {invite?.email && (
                <p className="text-xs text-muted-foreground">
                  Email definido pelo convite
                </p>
              )}
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  disabled={isLoading}
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !!inviteError}
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  {invite ? 'Criar Conta e Entrar' : 'Criar Conta'}
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Já tem uma conta?{' '}
              <Link
                to={`/login${inviteToken ? `?redirect=${encodeURIComponent(`/convite/${inviteToken}`)}` : (redirectTo !== '/dashboard' ? `?redirect=${encodeURIComponent(redirectTo)}` : '')}`}
                className="text-primary hover:underline font-medium"
              >
                Fazer login
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
