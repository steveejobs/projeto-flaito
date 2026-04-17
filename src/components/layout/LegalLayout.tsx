import { ReactNode, useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, RefreshCw, Building2, UserCog, Phone, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useChatContext } from '@/contexts/ChatContext';
import { useDevPanel } from '@/contexts/DevPanelContext';
import { OfficeUISettingsProvider } from '@/contexts/OfficeUISettingsContext';
import { HeaderNotifications } from '@/components/HeaderNotifications';
import { useOfficeSession } from '@/hooks/useOfficeSession';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { LegalSidebar } from '@/components/layout/LegalSidebar';
import { useActiveClient } from '@/contexts/ActiveClientContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LexosChatAssistant } from '@/components/LexosChatAssistant';
import { LegalClock } from '@/components/LegalClock';
import { RouteTransitionOverlay } from '@/components/RouteTransitionOverlay';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { DevDiagnosticsPanel } from '@/components/DevDiagnosticsPanel';

interface AppLayoutProps {
  children: ReactNode;
}

const RETRY_DELAY_MS = 3000;

export function LegalLayout({ children }: AppLayoutProps) {
  const { user, session, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  const { activeCaseId, activeClientId: chatActiveClientId } = useChatContext();
  const { activeProfile, setActiveClientId } = useActiveClient();
  const devPanel = useDevPanel();
  const [showRetry, setShowRetry] = useState(false);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const userId = user?.id ?? null;

  // Use the centralized office session hook (runs whenever we have userId)
  const officeSession = useOfficeSession(userId);

  // Fetch member's full_name for display in header
  useEffect(() => {
    if (!userId || !officeSession.officeId) return;

    const fetchMemberData = async () => {
      const { data } = await supabase
        .from('office_members')
        .select('full_name, avatar_url')
        .eq('user_id', userId)
        .eq('office_id', officeSession.officeId)
        .maybeSingle();

      if (data?.full_name) {
        setMemberName(data.full_name);
      }
      if (data?.avatar_url) {
        setAvatarUrl(data.avatar_url);
      }
    };

    fetchMemberData();
  }, [userId, officeSession.officeId]);

  // Only authLoading blocks the layout - officeSession runs in background
  const isBlocking = authLoading;

  // Show retry button after delay if office session is still loading
  useEffect(() => {
    if (officeSession.loading) {
      const timer = setTimeout(() => setShowRetry(true), RETRY_DELAY_MS);
      return () => clearTimeout(timer);
    } else {
      setShowRetry(false);
    }
  }, [officeSession.loading]);

  // Show toast if there's an error from office session
  useEffect(() => {
    if (officeSession.error) {
      toast({
        title: "Verificando sessão do escritório…",
        description: officeSession.error,
      });
    }
  }, [officeSession.error]);

  // Redirect to login if no session
  useEffect(() => {
    if (!authLoading && !session) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, session, navigate]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.debug("[Auth] state", { userId, authLoading, hasSession: !!session });
    }
  }, [userId, authLoading, session]);



  const handleSignOut = async () => {
    // Reset office session cache before signing out
    officeSession.reset();
    await signOut();
    toast({
      title: 'Até logo!',
      description: 'Você saiu da sua conta',
    });
    navigate('/login', { replace: true });
  };

  const handleRetry = () => {
    setShowRetry(false);
    officeSession.retry();
  };

  // Extract first and second name from full_name
  const getDisplayName = () => {
    if (!memberName) return null;
    const parts = memberName.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[1]}`;
    }
    return parts[0] || null;
  };

  // Get initials from name or fallback to email
  const getInitials = () => {
    if (memberName) {
      const parts = memberName.trim().split(' ').filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return parts[0]?.slice(0, 2)?.toUpperCase() || 'U';
    }
    return user?.email?.slice(0, 2)?.toUpperCase() || 'U';
  };

  const userInitials = getInitials();

  return (
    <OfficeUISettingsProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <LegalSidebar />
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <header className="h-16 border-b border-white/5 bg-background/60 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-50 transition-all duration-300">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-foreground/80 hover:text-primary transition-colors" />
                <div className="h-6 w-px bg-border/50" />
                <div className="hidden sm:block">
                  <LegalClock />
                </div>

                {activeProfile && (
                  <div className="ml-4 items-center pl-4 border-l border-white/10 hidden lg:flex animate-in fade-in slide-in-from-left-4 duration-500">
                    <div className="flex flex-col mr-3 text-left">
                      <span className="text-[10px] uppercase font-bold text-primary tracking-wider">Cliente em Foco</span>
                      <span className="text-sm font-semibold text-foreground leading-tight">{activeProfile.full_name}</span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10" 
                      onClick={() => setActiveClientId(null)}
                    >
                      Limpar
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <HeaderNotifications officeId={officeSession.officeId} />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                      <Avatar className="h-9 w-9">
                        {avatarUrl && <AvatarImage src={avatarUrl} alt={memberName || ''} />}
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {getDisplayName() || 'Minha Conta'}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user?.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/settings/office')}>
                      <Building2 className="mr-2 h-4 w-4" />
                      Meu Escritório
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/legal/whatsapp')}>
                      <MessageSquare className="mr-2 h-4 w-4 text-primary" />
                      <span className="font-semibold">Inbox WhatsApp</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/settings/office')}>
                      <Phone className="mr-2 h-4 w-4" />
                      Configurar WhatsApp
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/settings/profile')}>
                      <UserCog className="mr-2 h-4 w-4" />
                      Meu Perfil
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Sair
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </header>

            {/* Main content - always rendered */}
            <main className="flex-1 overflow-auto relative">
              {isBlocking ? (
                <div className="flex items-center justify-center min-h-[200px]">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span>Carregando...</span>
                  </div>
                </div>
              ) : (
                <RouteErrorBoundary onNavigateHome={() => navigate('/dashboard')}>
                  <RouteTransitionOverlay>
                    {children}
                  </RouteTransitionOverlay>
                </RouteErrorBoundary>
              )}

              {/* Office session retry overlay - non-blocking, just informational */}
              {showRetry && officeSession.loading && (
                <div className="absolute bottom-4 right-4 z-50">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => officeSession.retry()}
                    className="gap-2 shadow-lg"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Verificar sessão
                  </Button>
                </div>
              )}
            </main>
          </div>

          {/* Global Chat Assistant */}
          <LexosChatAssistant caseId={activeCaseId} clientId={chatActiveClientId} />

          {/* DEV Diagnostics Panel - toggled via sidebar menu */}
          {import.meta.env.DEV && devPanel.isOpen && (
            <DevDiagnosticsPanel
              pathname={location.pathname}
              userId={userId}
              authLoading={authLoading}
              officeSession={officeSession}
              renderCount={renderCountRef.current}
            />
          )}
        </div>
      </SidebarProvider>
    </OfficeUISettingsProvider>
  );
}
