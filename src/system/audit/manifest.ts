/**
 * Frontend Manifest Builder
 * Gera manifesto determinístico do frontend para auditoria
 */

export interface RouteInfo {
  path: string;
  component: string;
  protected: boolean;
  minRole: 'MEMBER' | 'ADMIN' | 'OWNER' | null;
}

export interface MenuInfo {
  label: string;
  path: string;
  minRole: 'MEMBER' | 'ADMIN' | 'OWNER';
  group: string;
}

export interface WorkflowInfo {
  name: string;
  steps: string[];
  rpcs: string[];
  edges: string[];
}

export interface FrontendManifest {
  version: string;
  generated_at: string;
  routes: RouteInfo[];
  menu: MenuInfo[];
  layout: {
    providers: string[];
    shell: string[];
  };
  workflows: Record<string, WorkflowInfo>;
  services: Record<string, { rpcs: string[]; edges: string[] }>;
}

export function buildFrontendManifest(): FrontendManifest {
  const routes: RouteInfo[] = [
    // Public routes
    { path: '/', component: 'Index', protected: false, minRole: null },
    { path: '/login', component: 'Login', protected: false, minRole: null },
    { path: '/signup', component: 'Signup', protected: false, minRole: null },
    
    // Protected routes - MEMBER
    { path: '/dashboard', component: 'Dashboard', protected: true, minRole: 'MEMBER' },
    { path: '/cases', component: 'Cases', protected: true, minRole: 'MEMBER' },
    { path: '/clientes', component: 'Clientes', protected: true, minRole: 'MEMBER' },
    { path: '/documents', component: 'Documents', protected: true, minRole: 'MEMBER' },
    { path: '/agenda', component: 'Agenda', protected: true, minRole: 'MEMBER' },
    { path: '/nija', component: 'Nija', protected: true, minRole: 'MEMBER' },
    { path: '/alerts', component: 'DeadlineAlerts', protected: true, minRole: 'MEMBER' },
    { path: '/meu-escritorio', component: 'MeuEscritorio', protected: true, minRole: 'MEMBER' },
    
    // Protected routes - ADMIN
    { path: '/document-types', component: 'DocumentTypes', protected: true, minRole: 'ADMIN' },
    { path: '/knowledge', component: 'Knowledge', protected: true, minRole: 'ADMIN' },
    { path: '/settings/office', component: 'OfficeSettings', protected: true, minRole: 'ADMIN' },
    { path: '/settings/members', component: 'OfficeMembers', protected: true, minRole: 'ADMIN' },
    { path: '/nija-usage', component: 'NijaUsage', protected: true, minRole: 'ADMIN' },
    { path: '/integrations', component: 'Integrations', protected: true, minRole: 'ADMIN' },
    { path: '/system/governanca', component: 'Governanca', protected: true, minRole: 'ADMIN' },
    { path: '/system/auditoria', component: 'Auditoria', protected: true, minRole: 'ADMIN' },
    { path: '/system/diagramas', component: 'Diagramas', protected: true, minRole: 'ADMIN' },
    { path: '/system/matriz-acesso', component: 'MatrizAcesso', protected: true, minRole: 'ADMIN' },
    { path: '/system/integracoes', component: 'Integracoes', protected: true, minRole: 'ADMIN' },
    { path: '/system/rebuild', component: 'Rebuild', protected: true, minRole: 'ADMIN' },
    { path: '/system/saude', component: 'Saude', protected: true, minRole: 'ADMIN' },
    { path: '/system/policy-simulator', component: 'PolicySimulator', protected: true, minRole: 'ADMIN' },
    
    // Protected routes - OWNER
    { path: '/system/environments', component: 'Environments', protected: true, minRole: 'OWNER' },
    { path: '/system/maintenance', component: 'AdminMaintenance', protected: true, minRole: 'OWNER' },
    { path: '/admin/precedents', component: 'PrecedentsAdmin', protected: true, minRole: 'OWNER' },
  ];

  const menu: MenuInfo[] = [
    // Painel
    { label: 'Dashboard', path: '/dashboard', minRole: 'MEMBER', group: 'Painel' },
    { label: 'Alertas', path: '/alerts', minRole: 'MEMBER', group: 'Painel' },
    
    // Casos
    { label: 'Casos', path: '/cases', minRole: 'MEMBER', group: 'Casos' },
    { label: 'Documentos', path: '/documents', minRole: 'MEMBER', group: 'Casos' },
    
    // Clientes
    { label: 'Cadastro de Clientes', path: '/clientes', minRole: 'MEMBER', group: 'Clientes' },
    
    // NIJA
    { label: 'Análise Jurídica', path: '/nija', minRole: 'MEMBER', group: 'NIJA' },
    { label: 'Uso do NIJA', path: '/nija-usage', minRole: 'ADMIN', group: 'NIJA' },
    
    // Sistema > Governança
    { label: 'Centro de Governança', path: '/system/governanca', minRole: 'ADMIN', group: 'Sistema > Governança' },
    { label: 'Auditoria', path: '/system/auditoria', minRole: 'ADMIN', group: 'Sistema > Governança' },
    { label: 'Diagramas', path: '/system/diagramas', minRole: 'ADMIN', group: 'Sistema > Governança' },
    { label: 'Matriz de Acesso', path: '/system/matriz-acesso', minRole: 'ADMIN', group: 'Sistema > Governança' },
    { label: 'Integrações', path: '/system/integracoes', minRole: 'ADMIN', group: 'Sistema > Governança' },
    { label: 'Rebuild', path: '/system/rebuild', minRole: 'ADMIN', group: 'Sistema > Governança' },
    { label: 'Saúde', path: '/system/saude', minRole: 'ADMIN', group: 'Sistema > Governança' },
    { label: 'Simulador de Políticas', path: '/system/policy-simulator', minRole: 'ADMIN', group: 'Sistema > Governança' },
    { label: 'Ambientes', path: '/system/environments', minRole: 'OWNER', group: 'Sistema > Governança' },
  ];

  const workflows: Record<string, WorkflowInfo> = {
    clientes: {
      name: 'Gestão de Clientes',
      steps: ['Cadastro', 'Documentos', 'Casos'],
      rpcs: ['clients.insert', 'clients.update', 'clients.select'],
      edges: ['public-client-registration'],
    },
    casos: {
      name: 'Gestão de Casos',
      steps: ['Criação', 'Documentação', 'Timeline', 'Fechamento'],
      rpcs: ['cases.insert', 'cases.update', 'case_events.insert'],
      edges: ['nija-full-analysis', 'lexos-generate-document'],
    },
    documentos: {
      name: 'Gestão de Documentos',
      steps: ['Upload', 'Processamento', 'Assinatura'],
      rpcs: ['documents.insert', 'generated_docs.insert'],
      edges: ['lexos-extract-text', 'lexos-render-document'],
    },
    agenda: {
      name: 'Gestão de Agenda',
      steps: ['Criação', 'Notificação', 'Conclusão'],
      rpcs: ['agenda_items.insert', 'agenda_items.update'],
      edges: ['gcal_sync_events'],
    },
    nija: {
      name: 'Análise NIJA',
      steps: ['Upload', 'Extração', 'Análise', 'Geração'],
      rpcs: ['analysis_subjects.insert'],
      edges: ['nija-extract-image', 'nija-full-analysis', 'nija-generate-petition'],
    },
  };

  const services: Record<string, { rpcs: string[]; edges: string[] }> = {
    dashboard: { rpcs: ['cases.select', 'clients.select', 'agenda_items.select'], edges: [] },
    cases: { rpcs: ['cases.*', 'case_events.*', 'case_deadlines.*'], edges: ['nija-full-analysis'] },
    clients: { rpcs: ['clients.*', 'documents.*'], edges: ['public-client-registration'] },
    documents: { rpcs: ['documents.*', 'generated_docs.*'], edges: ['lexos-extract-text', 'lexos-render-document'] },
    nija: { rpcs: ['analysis_subjects.*'], edges: ['nija-*'] },
    governance: { rpcs: ['lexos_audit_*', 'lexos_policy_simulate', 'lexos_promote_release'], edges: ['lexos-governance-run', 'lexos-rebuild-engine', 'lexos-export-kit'] },
  };

  return {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    routes,
    menu,
    layout: {
      providers: ['QueryClientProvider', 'TooltipProvider', 'AuthProvider', 'OfficeBrandingProvider', 'DevPanelProvider', 'ChatContextProvider'],
      shell: ['AppShell', 'AppSidebar', 'SidebarProvider'],
    },
    workflows,
    services,
  };
}
