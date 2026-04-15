import { useEffect, useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  FileText,
  Building2,
  BarChart3,
  Bell,
  Eye,
  Search,
  Brain,
  Bot,
  FolderTree,
  Wrench,
  ChevronRight,
  Settings,
  Shield,
  Calendar,
  CreditCard,
  History,
  Coins,
  Link2,
  ClipboardList,
  FolderOpen,
  Bug,
  X,
  Palette,
  HardDrive,
  Mic,
  Star,
  Stethoscope,
  Scale,
  Sparkles,
  MessageSquare,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOfficeRole } from '@/hooks/useOfficeRole';
import { OfficeRole, hasRole, OfficeModule } from '@/lib/rbac/roles';
import { NavLink } from '@/components/NavLink';
import { useOfficeBranding } from '@/contexts/OfficeBrandingContext';
import { useDevPanel } from '@/contexts/DevPanelContext';
import { useAuth } from '@/contexts/AuthContext';
import LexosMark from '@/components/brand/LexosMark';
import { supabase } from '@/integrations/supabase/client';
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
import { VersionButton } from '@/components/VersionButton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

// Menu item type with role requirement and keywords for search
interface MenuItem {
  title: string;
  url: string;
  icon: React.ElementType;
  minRole: OfficeRole;
  module?: OfficeModule;
  keywords?: string[];

}

// SubMenu type for nested menus inside "Sistema"
interface SubMenu {
  key: string;
  label: string;
  icon: React.ElementType;
  minRole: OfficeRole;
  module?: OfficeModule;
  items: MenuItem[];

  defaultOpen?: boolean;
}

// Menu group type with role requirement
interface MenuGroup {
  key: string;
  label: string;
  icon: React.ElementType;
  minRole: OfficeRole;
  module?: OfficeModule;
  items?: MenuItem[];

  subMenus?: SubMenu[];
  defaultOpen?: boolean;
}

// MENU_TREE com 7 grupos conforme especificação + keywords para busca
const MENU_TREE: MenuGroup[] = [
  {
    key: 'painel',
    label: 'Painel',
    icon: LayoutDashboard,
    minRole: 'MEMBER',
    defaultOpen: true,
    items: [
      { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard, minRole: 'MEMBER', keywords: ['inicio', 'home', 'visao', 'geral', 'resumo'] },
      { title: 'CRM Inteligente', url: '/crm', icon: Sparkles, minRole: 'MEMBER', keywords: ['vendas', 'leads', 'funil', 'pipeline', 'clientes', 'prospecção'] },
      { title: 'Alertas', url: '/alerts', icon: Bell, minRole: 'MEMBER', module: 'LEGAL', keywords: ['prazos', 'vencimentos', 'urgente', 'deadline', 'notificacao', 'pendentes'] },
    ],
  },
  {
    key: 'casos',
    label: 'Casos',
    icon: Briefcase,
    minRole: 'MEMBER',
    defaultOpen: true,
    module: 'LEGAL',
    items: [
      { title: 'Casos', url: '/cases', icon: Briefcase, minRole: 'MEMBER', keywords: ['processos', 'acoes', 'demandas', 'clientes'] },
      { title: 'Documentos', url: '/documents', icon: FileText, minRole: 'MEMBER', keywords: ['arquivos', 'pecas', 'anexos', 'pdf'] },
      { title: 'Reuniões Inteligentes', url: '/legal/meetings', icon: Mic, minRole: 'MEMBER', keywords: ['audio', 'gravacao', 'transcricao', 'reuniao', 'ao vivo', 'nija'] },
      { title: 'Plaud Inbox', url: '/plaud-inbox', icon: History, minRole: 'MEMBER', keywords: ['audio', 'gravacao', 'transcricao', 'reuniao'] },
    ],
  },


  {
    key: 'clientes',
    label: 'Clientes',
    icon: Users,
    minRole: 'MEMBER',
    defaultOpen: true,
    items: [
      { title: 'Cadastro de Clientes', url: '/clientes', icon: Users, minRole: 'MEMBER', keywords: ['pessoas', 'contatos', 'partes', 'cpf', 'cnpj'] },
    ],
  },
  {
    key: 'agenda',
    label: 'Agenda',
    icon: Calendar,
    minRole: 'MEMBER',
    defaultOpen: true,
    items: [
      { title: 'Compromissos', url: '/agenda', icon: Calendar, minRole: 'MEMBER', keywords: ['reunioes', 'audiencias', 'eventos', 'horarios'] },
    ],
  },
  {
    key: 'comunicacao',
    label: 'Comunicação',
    icon: MessageSquare,
    minRole: 'MEMBER',
    defaultOpen: true,
    items: [
      { title: 'Central de Atendimento', url: '/inbox', icon: MessageSquare, minRole: 'MEMBER', keywords: ['chat', 'mensagens', 'conversa', 'zap', 'wa', 'inbox', 'atendimento', 'suporte'] },
    ],
  },
  {
    key: 'studio',
    label: 'Studio',
    icon: Bot,
    minRole: 'ADMIN',
    defaultOpen: true,
    items: [
      { title: 'Studio de Agentes', url: '/agent-studio', icon: Bot, minRole: 'ADMIN', keywords: ['ia', 'agentes', 'configuracao', 'studio', 'personalizacao'] },
      { title: 'Builder de Fluxos', url: '/flow-manager', icon: FolderTree, minRole: 'ADMIN', keywords: ['fluxos', 'automacao', 'manychat', 'editor', 'builder'] },
    ],
  },
  {
    key: 'nija',
    label: 'NIJA',
    icon: Brain,
    minRole: 'MEMBER',
    defaultOpen: true,
    items: [
      { title: 'Análise Jurídica', url: '/nija', icon: Brain, minRole: 'MEMBER', keywords: ['ia', 'inteligencia', 'artificial', 'analise', 'parecer'] },
      { title: 'Uso do NIJA', url: '/nija-usage', icon: BarChart3, minRole: 'ADMIN', keywords: ['consumo', 'tokens', 'creditos', 'uso'] },
    ],
  },
  {
    key: 'conteudo',
    label: 'Conteúdo',
    icon: FileText,
    minRole: 'MEMBER',
    defaultOpen: false,
    items: [
      { title: 'Banco Jurídico', url: '/banco-juridico', icon: Scale, minRole: 'MEMBER', keywords: ['peticoes', 'teses', 'doutrinas', 'sumulas', 'banco', 'conhecimento'] },
      { title: 'Contatos Judiciário', url: '/contatos-judiciario', icon: Building2, minRole: 'MEMBER', keywords: ['varas', 'tribunais', 'telefones', 'emails', 'judiciario'] },
      { title: 'Tipos de Documentos', url: '/document-types', icon: FileText, minRole: 'ADMIN', keywords: ['categorias', 'modelos', 'templates'] },
      { title: 'Inteligência de Caso', url: '/knowledge', icon: Brain, minRole: 'ADMIN', keywords: ['artigos', 'tutoriais', 'ajuda'] },
      { title: 'Base de Conhecimento', url: '/office-knowledge', icon: BookOpen, minRole: 'MEMBER', keywords: ['conhecimento', 'peças', 'teses'] },
      { title: 'Modelos do Kit Inicial', url: '/admin/modelos', icon: FileText, minRole: 'ADMIN', keywords: ['templates', 'padrao', 'kit'] },
      { title: 'Dicionário TJTO', url: '/admin/tjto-dictionary', icon: FileText, minRole: 'ADMIN', keywords: ['eventos', 'movimentacoes', 'tribunal'] },
      { title: 'Precedentes', url: '/admin/precedents', icon: ClipboardList, minRole: 'OWNER', keywords: ['jurisprudencia', 'decisoes', 'admin'] },
    ],
  },
  {
    key: 'sistema',
    label: 'Sistema',
    icon: Settings,
    minRole: 'MEMBER',
    defaultOpen: false,
    subMenus: [
      {
        key: 'canais',
        label: 'Canais',
        icon: Link2,
        minRole: 'ADMIN',
        items: [
          { title: 'WhatsApp (Z-API)', url: '/settings/whatsapp', icon: MessageSquare, minRole: 'ADMIN', keywords: ['whatsapp', 'zapi', 'conexao', 'instancia'] },
        ]
      }
    ]
  },
];

function SidebarSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ))}
    </div>
  );
}

// Normalize text for search (lowercase, remove accents)
const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function LegalSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { branding } = useOfficeBranding();
  const { role, module: currentModule, loading: roleLoading } = useOfficeRole();

  const { user } = useAuth();
  const devPanel = useDevPanel();
  const [alertCount, setAlertCount] = useState(0);
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [overviewOpen, setOverviewOpen] = useState(false);

  // Search and favorites states
  const [menuSearch, setMenuSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showAllFavorites, setShowAllFavorites] = useState(false);

  // Favorites localStorage key
  const favKey = useMemo(() => `lexos:favs:${user?.id || 'anon'}`, [user?.id]);

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(favKey);
      if (raw) {
        setFavorites(JSON.parse(raw));
      }
    } catch {
      // Ignore parse errors
    }
  }, [favKey]);

  // Save favorites to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(favKey, JSON.stringify(favorites));
    } catch {
      // Ignore storage errors
    }
  }, [favKey, favorites]);

  // Toggle favorite
  const toggleFav = (url: string) => {
    setFavorites(prev =>
      prev.includes(url)
        ? prev.filter(p => p !== url)
        : [...prev, url]
    );
  };

  // Get officeId from localStorage (set by useOfficeSession in AppLayout)
  useEffect(() => {
    const storedOfficeId = sessionStorage.getItem('lexos_office_id');
    setOfficeId(storedOfficeId);
  }, []);

  // Fetch unread alerts count
  useEffect(() => {
    if (!officeId) return;

    const fetchAlertCount = async () => {
      try {
        const { count, error } = await supabase
          .from('case_deadlines')
          .select('*', { count: 'exact', head: true })
          .eq('office_id', officeId)
          .eq('status', 'pending');

        if (!error && count !== null) {
          setAlertCount(count);
        }
      } catch (err) {
        console.error('[AppSidebar] Error fetching alert count:', err);
      }
    };

    fetchAlertCount();
    const interval = setInterval(fetchAlertCount, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [officeId]);

  // Initialize open groups state
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    MENU_TREE.forEach((group) => {
      initial[group.key] = group.defaultOpen ?? true;
    });
    return initial;
  });

  // State for submenus (nested inside Sistema)
  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    MENU_TREE.forEach((group) => {
      if (group.subMenus) {
        group.subMenus.forEach((sub) => {
          initial[sub.key] = sub.defaultOpen ?? false;
        });
      }
    });
    return initial;
  });

  const isActive = (path: string) => {
    if (path.includes('?')) {
      return location.pathname + location.search === path;
    }
    return location.pathname === path;
  };

  const hasActiveItemInGroup = (items?: MenuItem[]) => {
    if (!items) return false;
    return items.some((item) => isActive(item.url));
  };

  const toggleGroup = (group: string) => {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const toggleSubMenu = (subKey: string) => {
    setOpenSubMenus((prev) => ({ ...prev, [subKey]: !prev[subKey] }));
  };

  // Fecha o drawer mobile ao navegar
  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Check if item matches search term
  const itemMatchesSearch = (item: MenuItem, searchTerm: string): boolean => {
    if (!searchTerm) return true;
    const normalizedSearch = norm(searchTerm);
    const titleMatch = norm(item.title).includes(normalizedSearch);
    const urlMatch = norm(item.url).includes(normalizedSearch);
    const keywordsMatch = item.keywords?.some(k => norm(k).includes(normalizedSearch)) ?? false;
    return titleMatch || urlMatch || keywordsMatch;
  };

  // Filtra itens baseado no role do usuário e ambiente (para DEV items)
  const filterItemsByRole = (items: MenuItem[]): MenuItem[] => {
    return items.filter((item) => {
      if (item.url === '#dev-panel') {
        return import.meta.env.DEV && hasRole(role, item.minRole);
      }
      return hasRole(role, item.minRole);
    });
  };

  // Filtra submenus baseado no role do usuário
  const filterSubMenusByRole = (subMenus: SubMenu[]): SubMenu[] => {
    return subMenus
      .filter((sub) => hasRole(role, sub.minRole))
      .map((sub) => ({
        ...sub,
        items: filterItemsByRole(sub.items),
      }))
      .filter((sub) => sub.items.length > 0);
  };

  // Filtered menu with role, module and search
  const filteredMenu = useMemo((): MenuGroup[] => {
    const searchTerm = menuSearch.trim();

    return MENU_TREE
      .filter((group) => hasRole(role, group.minRole) && (!group.module || group.module === currentModule))
      .map((group) => {
        if (group.subMenus) {
          const filteredSubMenus = group.subMenus
            .filter((sub) => hasRole(role, sub.minRole) && (!sub.module || sub.module === currentModule))
            .map((sub) => {
              const filteredItems = sub.items
                .filter((item) => {
                  if (item.url === '#dev-panel') {
                    return import.meta.env.DEV && hasRole(role, item.minRole);
                  }
                  return hasRole(role, item.minRole) && (!item.module || item.module === currentModule);
                })
                .filter((item) => itemMatchesSearch(item, searchTerm));
              return { ...sub, items: filteredItems };
            })
            .filter((sub) => sub.items.length > 0);

          return { ...group, subMenus: filteredSubMenus };
        }

        const filteredItems = group.items
          ? group.items
            .filter((item) => {
              if (item.url === '#dev-panel') {
                return import.meta.env.DEV && hasRole(role, item.minRole);
              }
              return hasRole(role, item.minRole) && (!item.module || item.module === currentModule);
            })
            .filter((item) => itemMatchesSearch(item, searchTerm))
          : [];

        return { ...group, items: filteredItems };
      })
      .filter((group) =>
        (group.items && group.items.length > 0) ||
        (group.subMenus && group.subMenus.length > 0)
      );
  }, [role, currentModule, menuSearch]);


  // Flatten all menu items for favorites
  const allMenuItems = useMemo((): MenuItem[] => {
    const items: MenuItem[] = [];
    MENU_TREE.forEach((group) => {
      if (group.items) {
        items.push(...group.items);
      }
      if (group.subMenus) {
        group.subMenus.forEach((sub) => {
          items.push(...sub.items);
        });
      }
    });
    return items;
  }, []);

  // Favorites items filtered by role and search
  const favoritesItems = useMemo((): MenuItem[] => {
    const searchTerm = menuSearch.trim();
    return allMenuItems
      .filter((item) => favorites.includes(item.url))
      .filter((item) => {
        if (item.url === '#dev-panel') {
          return import.meta.env.DEV && hasRole(role, item.minRole);
        }
        return hasRole(role, item.minRole);
      })
      .filter((item) => itemMatchesSearch(item, searchTerm));
  }, [allMenuItems, favorites, role, menuSearch]);

  const displayedFavorites = showAllFavorites ? favoritesItems : favoritesItems.slice(0, 8);
  const hasMoreFavorites = favoritesItems.length > 8;

  const renderMenuItems = (items: MenuItem[], indent: number = 0) => (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.title} className="group/item">
          {item.url === '#dev-panel' ? (
            // Render DEV toggle button
            <div className="flex items-center w-full">
              <SidebarMenuButton
                tooltip="Toggle DEV Diagnostics"
                onClick={() => {
                  devPanel.toggle();
                  if (isMobile) setOpenMobile(false);
                }}
                className={`flex-1 flex items-center gap-3 rounded-md transition-colors hover:bg-sidebar-accent px-3 py-2.5 min-h-[44px] md:px-2 md:py-1.5 md:min-h-0 cursor-pointer ${indent > 0 ? `pl-${indent + 4}` : ''} ${devPanel.isOpen ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : ''
                  }`}
              >
                <item.icon className="h-4 w-4 shrink-0 text-destructive" />
                <span className={collapsed ? 'sr-only' : 'text-sm'}>
                  {devPanel.isOpen ? 'Ocultar Painel DEV' : 'Mostrar Painel DEV'}
                </span>
              </SidebarMenuButton>
            </div>
          ) : (
            // Normal NavLink render with favorite star
            <div className="flex items-center w-full">
              <SidebarMenuButton
                asChild
                isActive={isActive(item.url)}
                tooltip={item.title}
                className="flex-1"
              >
                <NavLink
                  to={item.url}
                  end
                  onClick={handleNavClick}
                  className={`flex items-center gap-3 rounded-md transition-colors hover:bg-sidebar-accent px-3 py-2.5 min-h-[44px] md:px-2 md:py-1.5 md:min-h-0 ${indent > 0 ? `pl-${indent + 4}` : ''}`}
                  activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                >
                  <item.icon className="h-4 w-4 shrink-0 opacity-80" />
                  <span className={collapsed ? 'sr-only' : 'text-sm flex-1'}>
                    {item.title}
                  </span>
                </NavLink>
              </SidebarMenuButton>
              {!collapsed && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFav(item.url);
                  }}
                  className={`p-1.5 rounded-md transition-all ${favorites.includes(item.url)
                    ? 'text-yellow-500 opacity-100'
                    : 'text-sidebar-foreground/40 opacity-0 group-hover/item:opacity-100 hover:text-yellow-500'
                    }`}
                  title={favorites.includes(item.url) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                >
                  <Star
                    className="h-4 w-4"
                    fill={favorites.includes(item.url) ? 'currentColor' : 'none'}
                  />
                </button>
              )}
            </div>
          )}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  const renderSubMenus = (subMenus: SubMenu[]) => {
    return subMenus.map((sub) => {
      const Icon = sub.icon;
      const isOpen = openSubMenus[sub.key];
      const hasActiveItem = hasActiveItemInGroup(sub.items);

      return (
        <Collapsible
          key={sub.key}
          open={isOpen || hasActiveItem}
          onOpenChange={() => toggleSubMenu(sub.key)}
        >
          <CollapsibleTrigger asChild>
            <div
              className={`flex items-center justify-between cursor-pointer hover:bg-sidebar-accent/50 rounded-md px-4 py-2.5 ml-2 mr-2 ${collapsed ? 'justify-center' : ''
                }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-sidebar-foreground/70" />
                {!collapsed && (
                  <span className="text-xs font-medium text-sidebar-foreground/80">
                    {sub.label}
                  </span>
                )}
              </div>
              {!collapsed && (
                <ChevronRight
                  className={`h-4 w-4 text-sidebar-foreground/50 transition-transform ${isOpen || hasActiveItem ? 'rotate-90' : ''
                    }`}
                />
              )}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="pl-4">
              {renderMenuItems(sub.items, 2)}
            </div>
          </CollapsibleContent>
        </Collapsible>
      );
    });
  };

  const renderCollapsibleGroup = (group: MenuGroup) => {
    const Icon = group.icon;
    const isOpen = openGroups[group.key];
    const hasActiveItem = group.items ? hasActiveItemInGroup(group.items) : false;
    const hasActiveSubMenu = group.subMenus?.some((sub) => hasActiveItemInGroup(sub.items)) ?? false;

    return (
      <Collapsible
        key={group.key}
        open={isOpen || hasActiveItem || hasActiveSubMenu}
        onOpenChange={() => toggleGroup(group.key)}
      >
        <SidebarGroup>
          <CollapsibleTrigger asChild>
            <SidebarGroupLabel
              className={`flex items-center justify-between cursor-pointer hover:bg-sidebar-accent/50 rounded-md px-3 py-2 min-h-[40px] md:px-2 md:py-1 md:min-h-0 ${collapsed ? 'justify-center' : ''
                }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-sidebar-foreground/50" />
                {!collapsed && (
                  <span className="text-xs font-bold uppercase tracking-widest text-sidebar-foreground/60">
                    {group.label}
                  </span>
                )}
              </div>
              {!collapsed && (
                <ChevronRight
                  className={`h-5 w-5 md:h-4 md:w-4 transition-transform ${isOpen || hasActiveItem || hasActiveSubMenu ? 'rotate-90' : ''
                    }`}
                />
              )}
            </SidebarGroupLabel>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarGroupContent className="pl-2">
              {group.items && renderMenuItems(group.items)}
              {group.subMenus && renderSubMenus(group.subMenus)}
            </SidebarGroupContent>
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Logo Header */}
      <SidebarHeader className="border-b border-sidebar-border bg-gradient-to-b from-sidebar-accent/30 to-transparent">
        <div className={`flex items-center gap-3 px-4 py-3 ${collapsed ? 'flex-col justify-center' : ''}`}>
          <Dialog open={overviewOpen} onOpenChange={setOverviewOpen}>
            <DialogTrigger asChild>
              <button
                className={`flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity ${collapsed ? 'flex-col justify-center' : ''}`}
                title="Ver visão geral do sistema"
              >
                <LexosMark
                  className={`${collapsed ? 'h-8 w-8' : 'h-10 w-10'} rounded-md shadow-sm shrink-0`}
                  variant="light"
                  style={{
                    transform: `scale(var(--sidebar-logo-scale, 1))`,
                    transformOrigin: 'center center'
                  }}
                />
                {!collapsed && (
                  <div className="flex flex-col min-w-0 flex-1 text-left">
                    <span className="font-extrabold text-base text-sidebar-foreground leading-tight tracking-tight">
                      Lexos
                    </span>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-sidebar-foreground/50 font-bold tracking-widest uppercase">
                        Inteligência Legal
                      </span>
                      {branding?.nome_escritorio && (
                        <span className="text-[9px] text-primary/70 font-mono truncate max-w-[120px]">
                          {branding.nome_escritorio}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </button>
            </DialogTrigger>

            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                  <LexosMark className="h-10 w-10 rounded-lg" variant="light" />
                  Visão Geral do LEXOS
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 text-muted-foreground mt-4">
                <p>
                  O LEXOS é uma plataforma de gestão jurídica multi-escritório,
                  construída sobre React + TypeScript no frontend e Supabase no
                  backend, com módulos específicos para clientes, casos,
                  documentos, prazos, relatórios e inteligência jurídica NIJA.
                </p>

                <Separator />

                <div>
                  <h3 className="text-lg font-semibold mb-2 text-foreground">Camadas Principais</h3>
                  <ul className="list-disc ml-6 space-y-1">
                    <li><strong>Frontend:</strong> React, TypeScript, Tailwind e biblioteca UI própria.</li>
                    <li><strong>Backend:</strong> Supabase (Postgres + Auth + RLS) com modelo multi-escritório.</li>
                    <li><strong>IA NIJA:</strong> engine própria integrada com logs de uso.</li>
                    <li><strong>Governança:</strong> auditoria de eventos, acessos e trilhas de assinatura.</li>
                  </ul>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-semibold mb-2 text-foreground">Domínios Funcionais</h3>
                  <ul className="list-disc ml-6 space-y-1">
                    <li><strong>Clientes:</strong> cadastro, documentos, arquivos, interação e assinatura.</li>
                    <li><strong>Casos:</strong> timeline, kanban, checklist, despesas e prazos.</li>
                    <li><strong>Documentos:</strong> tipos, templates, geração, exportação e assinatura.</li>
                    <li><strong>NIJA:</strong> análises avançadas com rastreio de uso.</li>
                  </ul>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-semibold mb-2 text-foreground">Pilares de Projeto</h3>
                  <ul className="list-disc ml-6 space-y-1">
                    <li><strong>Multi-escritório:</strong> tudo segmentado por office_id.</li>
                    <li><strong>Segurança:</strong> RLS por escritório, caso e tipo de documento.</li>
                    <li><strong>Auditoria:</strong> logs completos de eventos e acessos.</li>
                    <li><strong>Escalabilidade:</strong> organização modular por domínio.</li>
                  </ul>
                </div>

                {/* Botão de fechar no rodapé */}
                <div className="flex justify-end pt-4 mt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setOverviewOpen(false)}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Fechar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </SidebarHeader>

      <ModuleSwitcher />

      {/* Search Input */}
      {!collapsed && (
        <div className="px-3 py-2 border-b border-sidebar-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Buscar no menu..."
              value={menuSearch}
              onChange={(e) => setMenuSearch(e.target.value)}
              className="h-8 text-sm pl-8 pr-8 bg-sidebar-accent/30 border-sidebar-border"
            />
            {menuSearch && (
              <button
                onClick={() => setMenuSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-sidebar-accent"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      )}

      <SidebarContent className="overflow-y-auto">
        {roleLoading ? (
          <SidebarSkeleton />
        ) : (
          <>
            {/* Favorites Section */}
            {favoritesItems.length > 0 && !collapsed && (
              <SidebarGroup>
                <SidebarGroupLabel className="flex items-center gap-2 px-4 py-2">
                  <Star className="h-4 w-4 text-yellow-500" fill="currentColor" />
                  <span className="text-xs font-semibold uppercase tracking-wide">Favoritos</span>
                </SidebarGroupLabel>
                <SidebarGroupContent className="pl-2">
                  <SidebarMenu>
                    {displayedFavorites.map((item) => (
                      <SidebarMenuItem key={`fav-${item.url}`} className="group/item">
                        <div className="flex items-center w-full">
                          <SidebarMenuButton
                            asChild
                            isActive={isActive(item.url)}
                            tooltip={item.title}
                            className="flex-1"
                          >
                            <NavLink
                              to={item.url}
                              end
                              onClick={handleNavClick}
                              className="flex items-center gap-3 rounded-md transition-colors hover:bg-sidebar-accent px-4 py-2 md:px-3 md:py-1.5"
                              activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                            >
                              <item.icon className="h-4 w-4 shrink-0" />
                              <span className="text-sm flex-1">{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleFav(item.url);
                            }}
                            className="p-1.5 rounded-md text-yellow-500 hover:text-yellow-600 transition-colors"
                            title="Remover dos favoritos"
                          >
                            <Star className="h-4 w-4" fill="currentColor" />
                          </button>
                        </div>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                  {hasMoreFavorites && (
                    <button
                      onClick={() => setShowAllFavorites(!showAllFavorites)}
                      className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 px-4 text-left transition-colors"
                    >
                      {showAllFavorites
                        ? 'Ver menos'
                        : `Ver mais (${favoritesItems.length - 8})`}
                    </button>
                  )}
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {/* Regular Menu Groups */}
            {filteredMenu.map((group) => renderCollapsibleGroup(group))}
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Configurações">
              <NavLink
                to="/settings/office"
                className="flex items-center gap-3 rounded-xl hover:bg-sidebar-accent px-3 py-2.5 transition-colors"
                activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
              >
                <Settings className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="text-sm">Configurações</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
