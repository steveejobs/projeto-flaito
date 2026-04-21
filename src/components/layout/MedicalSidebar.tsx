import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Calendar,
    Users,
    Mic,
    ClipboardList,
    Bot,
    Settings,
    MessageSquare,
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import LexosMark from '@/components/brand/LexosMark';
import { ModuleSwitcher } from './ModuleSwitcher';
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarHeader,
    SidebarFooter,
    useSidebar,
} from '@/components/ui/sidebar';

interface MenuItem {
    title: string;
    url: string;
    icon: React.ElementType;
}

const MEDICAL_MENU: MenuItem[] = [
    { title: 'Dashboard Clínico', url: '/medical/dashboard', icon: LayoutDashboard },
    { title: 'Agenda Médica', url: '/medical/agenda', icon: Calendar },
    { title: 'Decifrador IA', url: '/medical/ia', icon: Bot },
    { title: 'Studio de Agentes', url: '/medical/agent-studio', icon: Bot },
    { title: 'Pacientes', url: '/medical/patients', icon: Users },
    { title: 'Central de Atendimento', url: '/medical/inbox', icon: MessageSquare },
    { title: 'Consultas Inteligentes', url: '/medical/transcricao', icon: Mic },
    { title: 'Protocolos Clínicos', url: '/medical/protocolos', icon: ClipboardList },
];


export function MedicalSidebar() {
    const { state, setOpenMobile, isMobile } = useSidebar();
    const collapsed = state === 'collapsed';
    const location = useLocation();
    const { user } = useAuth();
    const [menuSearch, setMenuSearch] = useState('');

    const isActive = (path: string) => {
        if (path.includes('?')) {
            return location.pathname + location.search === path;
        }
        return location.pathname === path;
    };

    const handleNavClick = () => {
        if (isMobile) {
            setOpenMobile(false);
        }
    };

    return (
        <Sidebar collapsible="icon" className="border-r border-sidebar-border">
            <SidebarHeader className="border-b border-sidebar-border">
                <div className={`flex items-center gap-3 px-4 py-3 ${collapsed ? 'flex-col justify-center' : ''}`}>
                    <div className={`flex items-center gap-3 ${collapsed ? 'flex-col justify-center' : ''}`}>
                        <LexosMark
                            className={`${collapsed ? 'h-8 w-8' : 'h-10 w-10'} rounded-md shadow-sm shrink-0`}
                            style={{
                                transform: `scale(var(--sidebar-logo-scale, 1))`,
                                transformOrigin: 'center center'
                            }}
                        />
                        {!collapsed && (
                            <div className="flex flex-col min-w-0 flex-1 text-left">
                                <span className="font-extrabold text-base text-sidebar-foreground leading-tight tracking-tight">
                                    Flaito Health
                                </span>
                                <span className="text-[10px] text-teal-600 font-bold tracking-widest uppercase">
                                    Apoio à Decisão
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </SidebarHeader>

            <ModuleSwitcher />

            <SidebarContent className="overflow-y-auto pt-4">
                <SidebarGroup>
                    {!collapsed && (
                        <SidebarGroupLabel className="px-4 py-2 text-xs font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
                            Principal
                        </SidebarGroupLabel>
                    )}
                    <SidebarGroupContent className="px-2">
                        <SidebarMenu>
                            {MEDICAL_MENU.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={isActive(item.url)}
                                        tooltip={item.title}
                                    >
                                        <NavLink
                                            to={item.url}
                                            end
                                            onClick={handleNavClick}
                                            className="flex items-center gap-3 rounded-xl transition-all hover:bg-sidebar-accent px-3 py-2.5"
                                            activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                                        >
                                            <item.icon className="h-4 w-4 shrink-0" />
                                            {!collapsed && <span>{item.title}</span>}
                                        </NavLink>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border p-2">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip="Perfil">
                            <NavLink
                                to="/settings/profile"
                                className="flex items-center gap-3 rounded-xl hover:bg-sidebar-accent px-3 py-2.5 transition-colors"
                            >
                                <Settings className="h-4 w-4 shrink-0" />
                                {!collapsed && <span>Perfil</span>}
                            </NavLink>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
