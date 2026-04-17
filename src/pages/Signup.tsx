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
import { Mail, Lock, UserPlus, Users, Shield, User, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
    <div className="min-h-screen w-full flex bg-background overflow-hidden font-sans">
      {/* Visual Section - LG+ */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-950 items-center justify-center p-12 overflow-hidden border-r border-white/5">
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-indigo-600/20 blur-[130px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary/10 blur-[120px] rounded-full" />
        
        <div className="relative z-10 max-w-lg space-y-8">
          <div className="space-y-4">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <UserPlus className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-5xl font-black text-white tracking-tight leading-[1.1]">
              Comece sua <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-indigo-400 to-emerald-400 font-extrabold uppercase italic tracking-tighter">Nova Era</span> <br />
              jurídica hoje.
            </h1>
          </div>
          
          <div className="space-y-6">
            <div className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Shield className="h-5 w-5 text-emerald-400" />
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                <span className="text-white font-bold">Segurança de Grado Militar:</span> Seus dados e de seus clientes protegidos por criptografia de ponta a ponta.
              </p>
            </div>
            <div className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
              <p className="text-slate-300 text-sm leading-relaxed">
                <span className="text-white font-bold">Colaboração Imediata:</span> Convide sua equipe e centralize toda a comunicação do escritório.
              </p>
            </div>
          </div>
        </div>

        <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
      </div>

      {/* Form Section */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 md:p-8 bg-muted/20 lg:bg-background relative overflow-y-auto">
        <div className="lg:hidden absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[80%] h-[40%] bg-indigo-600/10 blur-[100px] rounded-full" />
        </div>

        <div className="w-full max-w-md space-y-8 py-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="text-center lg:text-left space-y-2">
            <h2 className="text-3xl font-black tracking-tight text-foreground uppercase italic">Crie sua Conta</h2>
            <p className="text-muted-foreground font-medium">Junte-se à elite da advocacia baseada em dados.</p>
          </div>

          <Card className="border-white/5 bg-background/50 backdrop-blur-xl shadow-2xl overflow-hidden">
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-6 pt-8">
                {invite && (
                  <div className="p-4 rounded-xl border bg-primary/5 border-primary/20 space-y-3 animate-in zoom-in-95 duration-500">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold uppercase tracking-tight">Convite: {invite.office_name}</p>
                        <p className="text-[11px] text-muted-foreground font-medium">Você está entrando em uma unidade ativa.</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Sua Área Principal</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'JURIDICO', label: 'Jurídico', icon: Shield },
                        { value: 'MEDICO', label: 'Médico', icon: Users },
                        { value: 'AMBOS', label: 'Híbrido', icon: UserPlus },
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setMainModule(item.value as any)}
                          className={cn(
                            "flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-300 gap-1.5",
                            mainModule === item.value 
                              ? "border-primary bg-primary/10 text-primary shadow-lg shadow-primary/5 ring-1 ring-primary/20" 
                              : "border-white/5 hover:bg-muted/50 text-muted-foreground"
                          )}
                        >
                          <item.icon className={cn("h-4 w-4", mainModule === item.value ? "animate-bounce" : "")} />
                          <span className="text-[9px] font-black uppercase tracking-tighter">{item.label}</span>
                        </button>
                      ))}
                    </div>
                    {errors.mainModule && (
                      <p className="text-[10px] font-bold text-destructive uppercase tracking-wider">{errors.mainModule}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Nome Profissional</Label>
                    <div className="relative group">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        id="fullName"
                        placeholder="Nome completo"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pl-10 h-11 bg-muted/30 border-white/5 focus-visible:ring-primary/30"
                        disabled={isLoading}
                      />
                    </div>
                    {errors.fullName && <p className="text-[10px] font-bold text-destructive uppercase tracking-wider">{errors.fullName}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">E-mail</Label>
                    <div className="relative group">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10 h-11 bg-muted/30 border-white/5 focus-visible:ring-primary/30"
                        disabled={isLoading || (invite && !!invite.email)}
                      />
                    </div>
                    {errors.email && <p className="text-[10px] font-bold text-destructive uppercase tracking-wider">{errors.email}</p>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Senha</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-11 bg-muted/30 border-white/5 focus-visible:ring-primary/30"
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Confirmar</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-11 bg-muted/30 border-white/5 focus-visible:ring-primary/30"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  {(errors.password || errors.confirmPassword) && (
                    <p className="text-[10px] font-bold text-destructive uppercase tracking-wider">{errors.password || errors.confirmPassword}</p>
                  )}
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-6 pb-12">
                <Button
                  type="submit"
                  className="w-full h-12 text-sm font-bold uppercase tracking-widest shadow-lg shadow-primary/25 bg-gradient-to-r from-primary to-indigo-600 hover:opacity-90 transition-all hover:scale-[1.01] active:scale-[0.99] border-none"
                  disabled={isLoading || !!inviteError}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      {invite ? 'Aceitar e Entrar' : 'Cadastrar'}
                    </>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center font-medium">
                  Já é parte do ecossistema?{' '}
                  <Link
                    to={`/login${inviteToken ? `?redirect=${encodeURIComponent(`/convite/${inviteToken}`)}` : (redirectTo !== '/dashboard' ? `?redirect=${encodeURIComponent(redirectTo)}` : '')}`}
                    className="text-primary hover:underline font-bold"
                  >
                    Fazer Login
                  </Link>
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
