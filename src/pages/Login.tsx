import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Mail, Lock, LogIn, RefreshCw, Loader2 } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, user, loading, clearSession } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawRedirect = searchParams.get('redirect');
  const redirectTo = rawRedirect?.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/dashboard';

  // Lógica de QA Auto-Login Programático
  useEffect(() => {
    const qaAccess = searchParams.get('qa_access') === 'true';
    const isDev = import.meta.env.DEV;
    const isQAModeEnabled = import.meta.env.VITE_ENABLE_QA_MODE === 'true';

    if (isDev && isQAModeEnabled && qaAccess && !isLoading) {
      const executeQALogin = async () => {
        console.warn('[QA] Detectado acesso programático. Iniciando bypass de UI...');
        
        // 1. Limpar sessão anterior para evitar session leak
        clearSession();
        
        // Pequeno delay para garantir limpeza do storage
        await new Promise(resolve => setTimeout(resolve, 500));

        setIsLoading(true);
        const { error } = await signIn('qa-automation@flaito.com.br', 'QA_password_123!');
        setIsLoading(false);

        if (error) {
          console.error('[QA] Falha no login programático:', error);
          toast({
            title: 'Erro QA',
            description: 'Falha no login programático de QA. Verifique o console.',
            variant: 'destructive',
          });
          return;
        }

        console.log('[QA] Login programático concluído. Redirecionando...');
        toast({
          title: 'QA Mode',
          description: 'Login automatizado realizado.',
          duration: 2000,
        });
        navigate(redirectTo, { replace: true });
      };

      executeQALogin();
    }
  }, [searchParams, clearSession, signIn, navigate, redirectTo, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0] === 'email') fieldErrors.email = err.message;
        if (err.path[0] === 'password') fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      let message = 'Erro ao fazer login';
      if (error.message.includes('Invalid login credentials')) {
        message = 'Email ou senha incorretos';
      } else if (error.message.includes('Email not confirmed')) {
        message = 'Confirme seu email antes de fazer login';
      }
      toast({
        title: 'Erro',
        description: message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Bem-vindo!',
      description: 'Login realizado com sucesso',
      duration: 3000,
    });
    navigate(redirectTo, { replace: true });
  };

  const handleClearSession = () => {
    toast({
      title: 'Limpando sessão...',
      description: 'A página será recarregada',
      duration: 2000,
    });
    setTimeout(() => clearSession(), 500);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex bg-background overflow-hidden">
      {/* Visual Section - Visible only on LG+ */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-950 items-center justify-center p-12 overflow-hidden border-r border-white/5">
        {/* Animated Background Deco */}
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary/20 blur-[120px] rounded-full animate-pulse transition-all duration-[10s]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[120px] rounded-full" />
        
        <div className="relative z-10 max-w-lg space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-[0.2em] mb-4">
            A Inteligência que Advoga por Você
          </div>
          <h1 className="text-5xl font-black text-white tracking-tight leading-[1.1]">
            Transforme seu escritório <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-indigo-400">em uma potência digital.</span>
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Gestão inteligente, automação de documentos e análise preditiva de riscos em um único ecossistema premium.
          </p>
          
          <div className="pt-8 flex items-center gap-6">
            <div className="flex -space-x-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 w-10 rounded-full border-2 border-slate-950 bg-slate-800 flex items-center justify-center overflow-hidden">
                   <div className="h-full w-full bg-gradient-to-br from-slate-700 to-slate-900" />
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-500 font-medium">
              Utilizado por <span className="text-white font-bold">+500 escritórios</span> de excelência.
            </p>
          </div>
        </div>
        
        {/* Subtle SVG Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      </div>

      {/* Form Section */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 md:p-8 bg-muted/20 lg:bg-background relative">
        {/* Mobile Background Deco */}
        <div className="lg:hidden absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[80%] h-[40%] bg-primary/10 blur-[100px] rounded-full" />
        </div>

        <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="text-center lg:text-left space-y-2">
            <h2 className="text-3xl font-black tracking-tight text-foreground">Acesse sua conta</h2>
            <p className="text-muted-foreground font-medium">Bem-vindo de volta ao futuro da gestão profissional.</p>
          </div>

          <Card className="border-white/5 bg-background/50 backdrop-blur-xl shadow-2xl">
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-bold uppercase tracking-widest opacity-70">Email Profissional</Label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@escritorio.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12 bg-muted/30 border-white/5 focus-visible:ring-primary/30"
                      disabled={isLoading}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-[10px] font-bold text-destructive uppercase tracking-wider">{errors.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-bold uppercase tracking-widest opacity-70">Senha de Acesso</Label>
                    <button type="button" className="text-[10px] uppercase font-bold text-primary hover:underline">Esqueci a senha</button>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 h-12 bg-muted/30 border-white/5 focus-visible:ring-primary/30"
                      disabled={isLoading}
                    />
                  </div>
                  {errors.password && (
                    <p className="text-[10px] font-bold text-destructive uppercase tracking-wider">{errors.password}</p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4 pb-8">
                <Button type="submit" className="w-full h-12 text-sm font-bold shadow-xl shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99]" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" />
                      Entrar
                    </>
                  )}
                </Button>

                {import.meta.env.DEV && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="w-full h-10 border border-dashed border-orange-500/30 text-orange-500 hover:bg-orange-500/5 text-xs font-bold"
                    onClick={async () => {
                      setEmail('qa-automation@flaito.com.br');
                      setPassword('QA_password_123!');
                      setTimeout(() => {
                        const form = document.querySelector('form');
                        form?.requestSubmit();
                      }, 100);
                    }}
                  >
                    QA Auto-Login
                  </Button>
                )}

                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/5" />
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-bold">
                    <span className="bg-background px-2 text-muted-foreground">Ou continue com</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center font-medium">
                  Não possui acesso?{' '}
                  <Link to={`/signup${redirectTo !== '/dashboard' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`} className="text-primary hover:underline font-bold">
                    Inicie seu teste grátis
                  </Link>
                </p>
                <button
                  type="button"
                  onClick={handleClearSession}
                  className="text-[10px] uppercase font-bold text-muted-foreground/40 hover:text-muted-foreground flex items-center gap-1 mx-auto transition-colors mt-2"
                >
                  <RefreshCw className="h-3 w-3" />
                  Resetar Sessão
                </button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
