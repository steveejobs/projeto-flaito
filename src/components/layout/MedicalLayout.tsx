import { ReactNode, useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, RefreshCw, UserCog, Building2, Phone, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDevPanel } from '@/contexts/DevPanelContext';
import { HeaderNotifications } from '@/components/HeaderNotifications';
import { useOfficeSession } from '@/hooks/useOfficeSession';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { MedicalSidebar } from '@/components/layout/MedicalSidebar';
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
import { RouteTransitionOverlay } from '@/components/RouteTransitionOverlay';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { DevDiagnosticsPanel } from '@/components/DevDiagnosticsPanel';
import { LegalClock } from '@/components/LegalClock';
import { useActiveClient } from '@/contexts/ActiveClientContext';

interface MedicalLayoutProps {
    children: ReactNode;
}

const RETRY_DELAY_MS = 3000;

function MedicalLayoutInner({ children }: MedicalLayoutProps) {
    const { user, session, loading: authLoading, signOut } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const renderCountRef = useRef(0);
    renderCountRef.current += 1;
    const devPanel = useDevPanel();
    const [showRetry, setShowRetry] = useState(false);
    const [memberName, setMemberName] = useState<string | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

    const userId = user?.id ?? null;
    const officeSession = useOfficeSession(userId);

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

    const isBlocking = authLoading;

    useEffect(() => {
        if (officeSession.loading) {
            const timer = setTimeout(() => setShowRetry(true), RETRY_DELAY_MS);
            return () => clearTimeout(timer);
        } else {
            setShowRetry(false);
        }
    }, [officeSession.loading]);

    useEffect(() => {
        if (officeSession.error) {
            toast({
                title: "Verificando sessão clínica…",
                description: officeSession.error,
            });
        }
    }, [officeSession.error]);

    useEffect(() => {
        if (!authLoading && !session) {
            navigate("/login", { replace: true });
        }
    }, [authLoading, session, navigate]);

    const handleSignOut = async () => {
        officeSession.reset();
        await signOut();
        navigate('/login', { replace: true });
    };

    const getDisplayName = () => {
        if (!memberName) return null;
        const parts = memberName.trim().split(' ').filter(Boolean);
        if (parts.length >= 2) {
            return `${parts[0]} ${parts[1]}`;
        }
        return parts[0] || null;
    };

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
    const { activeProfile, setActiveClientId } = useActiveClient();

    return (
        <SidebarProvider>
            <div className="medical-theme min-h-screen flex w-full bg-background font-inter text-foreground">
                <MedicalSidebar />
                <div className="flex-1 flex flex-col bg-background text-foreground overflow-hidden">
                    {/* Header clean/Apple style */}
                    <header className="h-16 border-b border-border/50 bg-background/80 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-50 transition-all duration-300 shadow-sm shrink-0">
                        <div className="flex items-center gap-4 flex-1">
                            <SidebarTrigger className="text-muted-foreground hover:text-teal-600 transition-colors" />
                            <div className="h-6 w-px bg-gray-200" />

                            <div className="hidden sm:block">
                                <LegalClock />
                            </div>
                            
                            {activeProfile && (
                                <div className="ml-4 flex items-center pl-4 border-l border-teal-100 hidden lg:flex animate-in fade-in slide-in-from-left-4 duration-500">
                                    <div className="flex flex-col mr-3">
                                        <span className="text-[10px] uppercase font-bold text-teal-600 tracking-wider">Cliente Ativo</span>
                                        <span className="text-sm font-semibold text-foreground leading-tight">{activeProfile.full_name}</span>
                                    </div>
                                    <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => {
                                        setActiveClientId(null);
                                        if (location.pathname.includes('/paciente/') || location.pathname.includes('/atendimento/')) {
                                            navigate('/medical/patients');
                                        }
                                    }}>
                                        Encerrar
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <HeaderNotifications officeId={officeSession.officeId} />

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-accent ring-1 ring-border">
                                        <Avatar className="h-9 w-9">
                                            {avatarUrl && <AvatarImage src={avatarUrl} alt={memberName || ''} />}
                                            <AvatarFallback className="bg-teal-50 text-teal-700 font-medium">
                                                {userInitials}
                                            </AvatarFallback>
                                        </Avatar>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56 medical-theme" align="end" forceMount>
                                    <DropdownMenuLabel className="font-normal">
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-semibold text-foreground">
                                                {getDisplayName() || 'Doutor(a)'}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {user?.email}
                                            </p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => navigate('/settings/profile')} className="cursor-pointer">
                                        <UserCog className="mr-2 h-4 w-4 text-muted-foreground" />
                                        <span className="text-foreground">Meu Perfil</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => navigate('/settings/office')} className="cursor-pointer">
                                        <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                                        <span className="text-foreground">Meu Escritório</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => navigate('/medical/whatsapp')} className="cursor-pointer">
                                        <MessageSquare className="mr-2 h-4 w-4 text-emerald-500" />
                                        <span className="text-foreground font-semibold">Inbox WhatsApp</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => navigate('/settings/office')} className="cursor-pointer">
                                        <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                                        <span className="text-foreground">Configurar WhatsApp</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50">
                                        <LogOut className="mr-2 h-4 w-4" />
                                        <span>Sair do Sistema</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </header>

                    <main className="flex-1 overflow-auto relative p-4 sm:p-6 max-w-7xl mx-auto w-full">
                        {isBlocking ? (
                            <div className="flex items-center justify-center min-h-[400px]">
                                <div className="flex flex-col items-center gap-4 text-muted-foreground">
                                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-teal-500" />
                                    <span className="text-sm font-medium tracking-wider uppercase text-muted-foreground">Iniciando ambiente seguro</span>
                                </div>
                            </div>
                        ) : (
                            <RouteErrorBoundary onNavigateHome={() => navigate('/medical/dashboard')}>
                                <RouteTransitionOverlay>
                                    {children}
                                </RouteTransitionOverlay>
                            </RouteErrorBoundary>
                        )}

                        {showRetry && officeSession.loading && (
                            <div className="absolute bottom-6 right-6 z-50">
                                <Button
                                    variant="outline"
                                    onClick={() => officeSession.retry()}
                                    className="gap-2 shadow-lg rounded-full bg-background border-border text-foreground hover:bg-accent px-6"
                                >
                                    <RefreshCw className="h-4 w-4 animate-spin-slow" />
                                    Sincronizando
                                </Button>
                            </div>
                        )}
                    </main>
                </div>

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
    );
}

export function MedicalLayout({ children }: MedicalLayoutProps) {
    return (
        <MedicalLayoutInner>
            {children}
        </MedicalLayoutInner>
    );
}
