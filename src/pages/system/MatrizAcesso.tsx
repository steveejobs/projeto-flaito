import { useState, useEffect } from 'react';
import { Grid, RefreshCw, Check, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { getMatrix, type MatrixAccess } from '@/system/audit/governanceClient';

export default function MatrizAcesso() {
  const officeId = sessionStorage.getItem('lexos_office_id');
  const [loading, setLoading] = useState(false);
  const [matrix, setMatrix] = useState<MatrixAccess | null>(null);

  useEffect(() => {
    if (officeId) loadData();
  }, [officeId]);

  const loadData = async () => {
    if (!officeId) return;
    setLoading(true);
    try {
      const data = await getMatrix(officeId);
      setMatrix(data);
    } catch (err) {
      toast.error('Erro ao carregar matriz');
    } finally {
      setLoading(false);
    }
  };

  const roles = ['OWNER', 'ADMIN', 'MEMBER', 'anon'];
  const tables = matrix?.matrix || [];

  // Determine access based on policies
  const getAccess = (table: typeof tables[0], role: string) => {
    if (!table.rls_enabled) return { access: 'full', color: 'text-destructive' };
    
    const policies = table.policies || [];
    if (policies.length === 0) return { access: 'blocked', color: 'text-muted-foreground' };
    
    const hasPolicy = policies.some(p => {
      const policyRoles = p.roles || [];
      return policyRoles.includes(role) || policyRoles.includes('public');
    });
    
    return hasPolicy 
      ? { access: 'policy', color: 'text-primary' }
      : { access: 'check', color: 'text-yellow-500' };
  };

  const AccessIcon = ({ type }: { type: string }) => {
    switch (type) {
      case 'full': return <Check className="h-4 w-4 text-green-500" />;
      case 'policy': return <Check className="h-4 w-4 text-primary" />;
      case 'blocked': return <X className="h-4 w-4 text-destructive" />;
      case 'check': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <X className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Grid className="h-6 w-6" />
            Matriz de Acesso RBAC × RLS
          </h1>
          <p className="text-muted-foreground">Visualização de permissões por tabela e role</p>
        </div>
        <Button onClick={loadData} disabled={loading} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-1">
          <Check className="h-4 w-4 text-green-500" />
          <span>Sem RLS</span>
        </div>
        <div className="flex items-center gap-1">
          <Check className="h-4 w-4 text-primary" />
          <span>Via Policy</span>
        </div>
        <div className="flex items-center gap-1">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <span>Verificar</span>
        </div>
        <div className="flex items-center gap-1">
          <X className="h-4 w-4 text-destructive" />
          <span>Bloqueado</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tabelas ({tables.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Tabela</TableHead>
                  <TableHead className="w-[80px]">RLS</TableHead>
                  {roles.map(role => (
                    <TableHead key={role} className="text-center">{role}</TableHead>
                  ))}
                  <TableHead>Policies</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((table) => (
                  <TableRow key={table.table}>
                    <TableCell className="font-mono text-sm">{table.table}</TableCell>
                    <TableCell>
                      <Badge variant={table.rls_enabled ? 'default' : 'destructive'}>
                        {table.rls_enabled ? 'ON' : 'OFF'}
                      </Badge>
                    </TableCell>
                    {roles.map(role => {
                      const { access } = getAccess(table, role);
                      return (
                        <TableCell key={role} className="text-center">
                          <AccessIcon type={access} />
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-sm text-muted-foreground">
                      {table.policies?.length || 0} policies
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
