import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shield, Check, X, Minus, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Definição completa da matriz RBAC do LEXOS
const PERMISSIONS_MATRIX = {
  "Gestão de Clientes": [
    { action: "Visualizar clientes", OWNER: true, ADMIN: true, MEMBER: true },
    { action: "Criar clientes", OWNER: true, ADMIN: true, MEMBER: true },
    { action: "Editar clientes", OWNER: true, ADMIN: true, MEMBER: true },
    { action: "Arquivar clientes", OWNER: true, ADMIN: true, MEMBER: true },
    { action: "Excluir clientes (hard delete)", OWNER: true, ADMIN: true, MEMBER: true },
    { action: "Gerar Kit de Documentos", OWNER: true, ADMIN: true, MEMBER: true },
  ],
  "Gestão de Casos": [
    { action: "Visualizar casos", OWNER: true, ADMIN: true, MEMBER: true },
    { action: "Criar casos", OWNER: true, ADMIN: true, MEMBER: true },
    { action: "Editar casos", OWNER: true, ADMIN: true, MEMBER: true },
    { action: "Alterar status/estágio", OWNER: true, ADMIN: true, MEMBER: true },
    { action: "Excluir casos", OWNER: true, ADMIN: true, MEMBER: false },
  ],
  "Documentos": [
    { action: "Visualizar documentos", OWNER: true, ADMIN: true, MEMBER: true },
    { action: "Upload de documentos", OWNER: true, ADMIN: true, MEMBER: true },
    { action: "Download de documentos", OWNER: true, ADMIN: true, MEMBER: true },
    { action: "Excluir documentos (soft)", OWNER: true, ADMIN: true, MEMBER: true },
    { action: "Excluir documentos (hard)", OWNER: true, ADMIN: false, MEMBER: false },
    { action: "Restaurar documentos", OWNER: true, ADMIN: true, MEMBER: false },
  ],
  "NIJA (Análise IA)": [
    { action: "Executar extrações", OWNER: true, ADMIN: true, MEMBER: true },
    { action: "Análise de prescrição", OWNER: true, ADMIN: true, MEMBER: true },
    { action: "Comparação de estratégias", OWNER: true, ADMIN: true, MEMBER: true },
    { action: "Geração de petições", OWNER: true, ADMIN: true, MEMBER: true },
    { action: "Visualizar créditos/quota", OWNER: true, ADMIN: true, MEMBER: false },
  ],
  "Agenda": [
    { action: "Visualizar agenda", OWNER: true, ADMIN: true, MEMBER: true },
    { action: "Criar compromissos", OWNER: true, ADMIN: true, MEMBER: true },
    { action: "Editar compromissos", OWNER: true, ADMIN: true, MEMBER: true },
    { action: "Excluir compromissos", OWNER: true, ADMIN: true, MEMBER: true },
    { action: "Sincronizar Google Agenda", OWNER: true, ADMIN: true, MEMBER: false },
  ],
  "Configurações do Escritório": [
    { action: "Visualizar configurações", OWNER: true, ADMIN: true, MEMBER: false },
    { action: "Editar dados do escritório", OWNER: true, ADMIN: false, MEMBER: false },
    { action: "Upload de logo/identidade", OWNER: true, ADMIN: true, MEMBER: false },
    { action: "Gerenciar modelos de docs", OWNER: true, ADMIN: true, MEMBER: false },
    { action: "Configurar integrações", OWNER: true, ADMIN: false, MEMBER: false },
  ],
  "Gestão de Membros": [
    { action: "Visualizar membros", OWNER: true, ADMIN: true, MEMBER: true },
    { action: "Convidar membros", OWNER: true, ADMIN: true, MEMBER: false },
    { action: "Editar perfil de membros", OWNER: true, ADMIN: "partial", MEMBER: false },
    { action: "Alterar role de membros", OWNER: true, ADMIN: false, MEMBER: false },
    { action: "Remover membros", OWNER: true, ADMIN: false, MEMBER: false },
    { action: "Editar próprio perfil", OWNER: true, ADMIN: true, MEMBER: true },
  ],
  "Administração do Sistema": [
    { action: "Acessar painel admin", OWNER: true, ADMIN: false, MEMBER: false },
    { action: "Visualizar auditoria", OWNER: true, ADMIN: true, MEMBER: false },
    { action: "Manutenção de storage", OWNER: true, ADMIN: false, MEMBER: false },
    { action: "Gerenciar cron jobs", OWNER: true, ADMIN: false, MEMBER: false },
    { action: "Executar diagnósticos", OWNER: true, ADMIN: false, MEMBER: false },
  ],
};

const RLS_POLICIES = [
  {
    table: "clients",
    description: "Clientes são isolados por office_id",
    policies: ["SELECT/INSERT/UPDATE/DELETE: office_id = user.office_id"],
  },
  {
    table: "cases",
    description: "Casos isolados por office_id com permissões de caso",
    policies: [
      "SELECT: office_id = user.office_id OR case_permissions",
      "UPDATE: office_id = user.office_id",
      "DELETE: OWNER/ADMIN only",
    ],
  },
  {
    table: "documents",
    description: "Documentos com soft-delete e isolamento por escritório",
    policies: [
      "SELECT: office_id = user.office_id AND deleted_at IS NULL",
      "INSERT/UPDATE: office_id = user.office_id",
      "DELETE: Soft delete via trigger",
    ],
  },
  {
    table: "office_members",
    description: "Membros podem ver colegas do mesmo escritório",
    policies: [
      "SELECT: Same office via lexos_is_active_member()",
      "UPDATE own: user_id = auth.uid()",
      "UPDATE others: OWNER/ADMIN hierarchy",
    ],
  },
  {
    table: "nija_extractions",
    description: "Extrações NIJA isoladas por escritório",
    policies: ["All operations: office_id = user.office_id"],
  },
];

const PermissionCell = ({ value }: { value: boolean | string }) => {
  if (value === true) {
    return (
      <div className="flex justify-center">
        <Check className="h-5 w-5 text-green-600" />
      </div>
    );
  }
  if (value === false) {
    return (
      <div className="flex justify-center">
        <X className="h-5 w-5 text-red-500/70" />
      </div>
    );
  }
  if (value === "partial") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <div className="flex justify-center">
              <Minus className="h-5 w-5 text-amber-500" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Parcial: apenas membros com role inferior</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return <Minus className="h-5 w-5 text-muted-foreground" />;
};

export default function AdminPermissionsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          Matriz de Permissões RBAC
        </h1>
        <p className="text-muted-foreground mt-1">
          Documentação das permissões por role no sistema LEXOS
        </p>
      </div>

      <Tabs defaultValue="matrix" className="space-y-4">
        <TabsList>
          <TabsTrigger value="matrix">Matriz de Permissões</TabsTrigger>
          <TabsTrigger value="rls">Políticas RLS</TabsTrigger>
          <TabsTrigger value="hierarchy">Hierarquia</TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="space-y-6">
          {/* Legend */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  <span>Permitido</span>
                </div>
                <div className="flex items-center gap-2">
                  <Minus className="h-4 w-4 text-amber-500" />
                  <span>Parcial/Condicional</span>
                </div>
                <div className="flex items-center gap-2">
                  <X className="h-4 w-4 text-red-500/70" />
                  <span>Negado</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Permission Categories */}
          {Object.entries(PERMISSIONS_MATRIX).map(([category, permissions]) => (
            <Card key={category}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{category}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50%]">Ação</TableHead>
                      <TableHead className="text-center w-[16%]">
                        <Badge variant="default" className="bg-amber-600">OWNER</Badge>
                      </TableHead>
                      <TableHead className="text-center w-[16%]">
                        <Badge variant="default" className="bg-blue-600">ADMIN</Badge>
                      </TableHead>
                      <TableHead className="text-center w-[16%]">
                        <Badge variant="secondary">MEMBER</Badge>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {permissions.map((perm, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{perm.action}</TableCell>
                        <TableCell><PermissionCell value={perm.OWNER} /></TableCell>
                        <TableCell><PermissionCell value={perm.ADMIN} /></TableCell>
                        <TableCell><PermissionCell value={perm.MEMBER} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="rls" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Políticas de Row-Level Security (RLS)
              </CardTitle>
              <CardDescription>
                Todas as tabelas principais possuem RLS habilitado para isolamento multi-tenant
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {RLS_POLICIES.map((policy, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                        {policy.table}
                      </code>
                      <span className="text-muted-foreground">—</span>
                      <span className="text-sm">{policy.description}</span>
                    </div>
                    <ul className="space-y-1 ml-4">
                      {policy.policies.map((p, pIdx) => (
                        <li key={pIdx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <code className="text-xs">{p}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hierarchy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Hierarquia de Roles</CardTitle>
              <CardDescription>
                Os roles seguem uma hierarquia estrita onde níveis superiores herdam permissões dos inferiores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center gap-4 py-8">
                {/* OWNER */}
                <div className="flex flex-col items-center">
                  <Badge className="bg-amber-600 text-white px-6 py-2 text-lg">OWNER</Badge>
                  <p className="text-sm text-muted-foreground mt-2 text-center max-w-md">
                    Controle total do escritório. Pode gerenciar membros, configurações, integrações e executar operações administrativas.
                  </p>
                </div>
                
                <div className="h-8 w-0.5 bg-border" />
                
                {/* ADMIN */}
                <div className="flex flex-col items-center">
                  <Badge className="bg-blue-600 text-white px-6 py-2 text-lg">ADMIN</Badge>
                  <p className="text-sm text-muted-foreground mt-2 text-center max-w-md">
                    Pode gerenciar membros MEMBER, modelos de documentos, e visualizar auditoria. Não pode alterar configurações do escritório.
                  </p>
                </div>
                
                <div className="h-8 w-0.5 bg-border" />
                
                {/* MEMBER */}
                <div className="flex flex-col items-center">
                  <Badge variant="secondary" className="px-6 py-2 text-lg">MEMBER</Badge>
                  <p className="text-sm text-muted-foreground mt-2 text-center max-w-md">
                    Acesso operacional: clientes, casos, documentos, agenda. Pode editar apenas seu próprio perfil.
                  </p>
                </div>
              </div>

              <div className="mt-8 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Verificação de Role no Código</h4>
                <code className="text-sm block bg-background p-3 rounded border">
                  {`import { hasRole } from "@/lib/rbac/roles";

// Verifica hierarquia: OWNER > ADMIN > MEMBER
if (hasRole(userRole, "ADMIN")) {
  // Permite OWNER e ADMIN
}`}
                </code>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
