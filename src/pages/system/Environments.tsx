import { useState, useEffect } from 'react';
import { GitBranch, RefreshCw, Check, ArrowRight, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useOfficeRole } from '@/hooks/useOfficeRole';
import { getLatestSnapshots, getHealth, promoteRelease, type AuditSnapshot, type HealthData } from '@/system/audit/governanceClient';
import { supabase } from '@/integrations/supabase/client';

interface OfficeMetadata {
  env?: string;
  release?: {
    promoted_at: string;
    promoted_by: string;
    snapshot_id: string;
    target: string;
  };
}

export default function Environments() {
  const officeId = sessionStorage.getItem('lexos_office_id');
  const { role } = useOfficeRole();
  const [loading, setLoading] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [snapshots, setSnapshots] = useState<AuditSnapshot[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [metadata, setMetadata] = useState<OfficeMetadata | null>(null);

  const isOwner = role === 'OWNER';

  useEffect(() => {
    if (officeId) loadData();
  }, [officeId]);

  const loadData = async () => {
    if (!officeId) return;
    setLoading(true);
    try {
      const [snaps, healthData] = await Promise.all([
        getLatestSnapshots(officeId, 5),
        getHealth(officeId),
      ]);
      setSnapshots(snaps);
      setHealth(healthData);

      // Get office metadata
      const { data: office } = await supabase
        .from('offices')
        .select('metadata')
        .eq('id', officeId)
        .single();
      
      if (office?.metadata) {
        setMetadata(office.metadata as OfficeMetadata);
      }
    } catch (err) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handlePromote = async () => {
    if (!officeId || !isOwner) return;
    
    const latestDone = snapshots.find(s => s.status === 'DONE');
    if (!latestDone) {
      toast.error('Nenhum snapshot DONE disponível');
      return;
    }

    setPromoting(true);
    try {
      await promoteRelease(officeId, latestDone.id, 'PROD');
      toast.success('Release promovida para PROD');
      loadData();
    } catch (err) {
      toast.error('Erro ao promover release');
    } finally {
      setPromoting(false);
    }
  };

  const currentEnv = metadata?.env || 'DEV';
  const lastRelease = metadata?.release;

  const environments = [
    { 
      name: 'DEV', 
      status: currentEnv === 'DEV' ? 'active' : 'inactive',
      description: 'Ambiente de desenvolvimento'
    },
    { 
      name: 'STAGING', 
      status: currentEnv === 'STAGING' ? 'active' : 'inactive',
      description: 'Ambiente de homologação'
    },
    { 
      name: 'PROD', 
      status: lastRelease ? 'deployed' : 'pending',
      description: 'Ambiente de produção'
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitBranch className="h-6 w-6" />
            Ambientes
          </h1>
          <p className="text-muted-foreground">DEV / STAGING / PROD - Promoção controlada</p>
        </div>
        <Button onClick={loadData} disabled={loading} variant="outline">
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Environment Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {environments.map((env, i) => (
          <Card key={env.name} className={env.status === 'active' ? 'border-primary' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{env.name}</CardTitle>
                <Badge variant={
                  env.status === 'active' ? 'default' :
                  env.status === 'deployed' ? 'secondary' : 'outline'
                }>
                  {env.status === 'active' ? 'Ativo' :
                   env.status === 'deployed' ? 'Deployed' : 'Pendente'}
                </Badge>
              </div>
              <CardDescription>{env.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {env.name === 'PROD' && lastRelease && (
                <div className="text-sm text-muted-foreground">
                  <p>Última promoção: {new Date(lastRelease.promoted_at).toLocaleString('pt-BR')}</p>
                  <p className="font-mono text-xs">Snapshot: {lastRelease.snapshot_id.slice(0, 8)}...</p>
                </div>
              )}
              {i < 2 && (
                <div className="flex justify-end mt-4">
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Promotion Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Promoção Controlada
          </CardTitle>
          <CardDescription>
            Apenas OWNER pode promover releases para PROD
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded">
            <div>
              <p className="font-medium">Pré-requisitos</p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li className="flex items-center gap-2">
                  <Check className={`h-4 w-4 ${snapshots.some(s => s.status === 'DONE') ? 'text-green-500' : 'text-muted-foreground'}`} />
                  Snapshot FULL com status DONE
                </li>
                <li className="flex items-center gap-2">
                  <Check className={`h-4 w-4 ${health && health.recent_errors.length === 0 ? 'text-green-500' : 'text-yellow-500'}`} />
                  Healthcheck PASS (sem erros recentes)
                </li>
                <li className="flex items-center gap-2">
                  <Check className={`h-4 w-4 ${isOwner ? 'text-green-500' : 'text-muted-foreground'}`} />
                  Role: OWNER
                </li>
              </ul>
            </div>
            <Button 
              onClick={handlePromote} 
              disabled={!isOwner || promoting || !snapshots.some(s => s.status === 'DONE')}
              size="lg"
            >
              {promoting ? 'Promovendo...' : 'Promover para PROD'}
            </Button>
          </div>

          {!isOwner && (
            <p className="text-sm text-destructive">
              Você precisa ser OWNER para promover releases.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Snapshots */}
      <Card>
        <CardHeader>
          <CardTitle>Snapshots Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {snapshots.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-2 bg-muted rounded">
                <div>
                  <span className="font-mono text-sm">{s.id.slice(0, 8)}...</span>
                  <span className="text-muted-foreground text-sm ml-2">
                    {new Date(s.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
                <Badge variant={s.status === 'DONE' ? 'default' : 'destructive'}>
                  {s.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
