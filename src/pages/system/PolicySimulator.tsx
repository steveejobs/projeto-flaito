import { useState } from 'react';
import { Shield, Play, Copy, Check, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { simulatePolicy, type PolicySimulationResult } from '@/system/audit/governanceClient';

export default function PolicySimulator() {
  const officeId = sessionStorage.getItem('lexos_office_id');
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<string>('MEMBER');
  const [userId, setUserId] = useState<string>('');
  const [caseId, setCaseId] = useState<string>('');
  const [result, setResult] = useState<PolicySimulationResult | null>(null);

  const handleSimulate = async () => {
    if (!officeId) return;
    setLoading(true);
    try {
      const data = await simulatePolicy(
        officeId,
        role,
        userId || undefined,
        caseId || undefined
      );
      setResult(data);
      toast.success('Simulação concluída');
    } catch (err) {
      toast.error('Erro na simulação');
    } finally {
      setLoading(false);
    }
  };

  const copyReport = () => {
    if (!result) return;
    
    let md = `# Relatório de Simulação de Políticas\n\n`;
    md += `**Role:** ${result.simulated_role}\n`;
    md += `**User ID:** ${result.user_id || 'N/A'}\n`;
    md += `**Case ID:** ${result.case_id || 'N/A'}\n`;
    md += `**Gerado em:** ${result.generated_at}\n\n`;
    
    md += `## Tabelas\n\n`;
    md += `| Tabela | RLS | SELECT | INSERT | UPDATE | DELETE | Policies |\n`;
    md += `|--------|-----|--------|--------|--------|--------|----------|\n`;
    result.tables.forEach(t => {
      md += `| ${t.table} | ${t.rls_enabled ? 'ON' : 'OFF'} | ${t.select} | ${t.insert} | ${t.update} | ${t.delete} | ${t.policies_count} |\n`;
    });
    
    md += `\n## Rotas\n\n`;
    result.routes.forEach(r => {
      md += `- ${r.path}: ${r.allowed ? '✅ Permitido' : '❌ Bloqueado'} (min: ${r.min_role})\n`;
    });
    
    navigator.clipboard.writeText(md);
    toast.success('Relatório copiado');
  };

  const AccessIcon = ({ allowed }: { allowed: boolean }) => {
    return allowed 
      ? <Check className="h-4 w-4 text-green-500" />
      : <X className="h-4 w-4 text-destructive" />;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6" />
          Simulador de Políticas
        </h1>
        <p className="text-muted-foreground">Simule acesso por role/usuário sem executar ações</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Role</label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWNER">OWNER</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                  <SelectItem value="MEMBER">MEMBER</SelectItem>
                  <SelectItem value="anon">anon</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">User ID (opcional)</label>
              <Input 
                placeholder="UUID do usuário"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Case ID (opcional)</label>
              <Input 
                placeholder="UUID do caso"
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
              />
            </div>

            <div className="flex items-end">
              <Button onClick={handleSimulate} disabled={loading} className="w-full">
                <Play className="mr-2 h-4 w-4" />
                {loading ? 'Simulando...' : 'Simular'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          <div className="flex justify-end">
            <Button variant="outline" onClick={copyReport}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar Relatório
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Tabelas ({result.tables.length})</CardTitle>
                <CardDescription>Permissões teóricas baseadas em RLS</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tabela</TableHead>
                        <TableHead>RLS</TableHead>
                        <TableHead>SELECT</TableHead>
                        <TableHead>INSERT</TableHead>
                        <TableHead>UPDATE</TableHead>
                        <TableHead>DELETE</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.tables.slice(0, 30).map((t) => (
                        <TableRow key={t.table}>
                          <TableCell className="font-mono text-xs">{t.table}</TableCell>
                          <TableCell>
                            <Badge variant={t.rls_enabled ? 'default' : 'destructive'} className="text-xs">
                              {t.rls_enabled ? 'ON' : 'OFF'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{t.select}</TableCell>
                          <TableCell className="text-xs">{t.insert}</TableCell>
                          <TableCell className="text-xs">{t.update}</TableCell>
                          <TableCell className="text-xs">{t.delete}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rotas</CardTitle>
                <CardDescription>Acesso baseado em minRole</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {result.routes.map((r, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="font-mono text-sm">{r.path}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{r.min_role}</Badge>
                          <AccessIcon allowed={r.allowed} />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
