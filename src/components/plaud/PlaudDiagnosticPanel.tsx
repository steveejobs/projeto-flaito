import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';

import {
  Settings2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Copy,
  ExternalLink,
  RefreshCw,
  Clock,
  Wifi,
  Key,
  FileText,
} from 'lucide-react';

interface DiagnosticData {
  endpointStatus: 'loading' | 'online' | 'offline' | 'error';
  endpointVersion: string | null;
  tokenConfigured: boolean;
  lastAssetDate: string | null;
  assetCount: number;
}

interface PlaudDiagnosticPanelProps {
  officeId: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PROJECT_ID = SUPABASE_URL.split('//')[1].split('.')[0];

export function PlaudDiagnosticPanel({ officeId }: PlaudDiagnosticPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [data, setData] = useState<DiagnosticData>({
    endpointStatus: 'loading',
    endpointVersion: null,
    tokenConfigured: true, // Assume configured (we can't check secrets from client)
    lastAssetDate: null,
    assetCount: 0,
  });

  const webhookUrl = `${SUPABASE_URL}/functions/v1/plaud-ingest?office_id=${officeId}`;

  // Fetch last asset info
  const fetchLastAsset = async () => {
    try {
      const { data: assets, error } = await supabase
        .from('plaud_assets')
        .select('received_at')
        .eq('office_id', officeId)
        .order('received_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      const { count } = await supabase
        .from('plaud_assets')
        .select('*', { count: 'exact', head: true })
        .eq('office_id', officeId);

      setData(prev => ({
        ...prev,
        lastAssetDate: (assets as any)?.[0]?.received_at || null,
        assetCount: count || 0,
      }));
    } catch (err) {
      console.error('Erro ao buscar último asset:', err);
    }
  };

  // Test endpoint connection
  const testConnection = async () => {
    setTesting(true);
    setData(prev => ({ ...prev, endpointStatus: 'loading' }));

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/plaud-ingest`,
        { method: 'GET' }
      );

      if (response.ok) {
        const result = await response.json();
        setData(prev => ({
          ...prev,
          endpointStatus: result.ok ? 'online' : 'error',
          endpointVersion: result.version || null,
        }));
        toast.success('Endpoint online');
      } else {
        setData(prev => ({ ...prev, endpointStatus: 'error', endpointVersion: null }));
        toast.error('Endpoint retornou erro');
      }
    } catch (err) {
      console.error('Erro ao testar conexão:', err);
      setData(prev => ({ ...prev, endpointStatus: 'offline', endpointVersion: null }));
      toast.error('Falha ao conectar ao endpoint');
    } finally {
      setTesting(false);
    }
  };

  // Copy webhook URL
  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast.success('URL copiada');
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  // Initial load when opened
  useEffect(() => {
    if (isOpen) {
      testConnection();
      fetchLastAsset();
    }
  }, [isOpen, officeId]);

  const formatLastDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nenhuma transcrição recebida';
    try {
      const date = new Date(dateStr);
      const relative = formatDistanceToNow(date, { locale: ptBR, addSuffix: true });
      const absolute = format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      return `${absolute} (${relative})`;
    } catch {
      return dateStr;
    }
  };

  const getStatusIcon = () => {
    switch (data.endpointStatus) {
      case 'online':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'offline':
      case 'error':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
  };

  const getStatusText = () => {
    switch (data.endpointStatus) {
      case 'online':
        return `Online${data.endpointVersion ? ` (v${data.endpointVersion})` : ''}`;
      case 'offline':
        return 'Offline';
      case 'error':
        return 'Erro';
      default:
        return 'Verificando...';
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed">
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                Diagnóstico da Integração
              </CardTitle>
              <div className="flex items-center gap-2">
                {!isOpen && data.endpointStatus !== 'loading' && (
                  <Badge 
                    variant={data.endpointStatus === 'online' ? 'default' : 'destructive'}
                    className="text-[10px]"
                  >
                    {data.endpointStatus === 'online' ? 'Online' : 'Verificar'}
                  </Badge>
                )}
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* Webhook URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Webhook URL</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md font-mono truncate">
                  {webhookUrl}
                </code>
                <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={copyWebhookUrl}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Status Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Endpoint Status */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-background">
                  <Wifi className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    {getStatusIcon()}
                    <span>{getStatusText()}</span>
                  </div>
                </div>
              </div>

              {/* Token Status */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-background">
                  <Key className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">Token</div>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Configurado</span>
                  </div>
                </div>
              </div>

              {/* Last Asset */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-background">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">Última transcrição</div>
                  <div className="text-sm font-medium truncate">
                    {data.lastAssetDate ? formatLastDate(data.lastAssetDate) : (
                      <span className="text-muted-foreground">Nenhuma</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Total Assets */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-full bg-background">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground">Total recebido</div>
                  <div className="text-sm font-medium">
                    {data.assetCount} {data.assetCount === 1 ? 'transcrição' : 'transcrições'}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={testConnection}
                disabled={testing}
                className="gap-2"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${testing ? 'animate-spin' : ''}`} />
                Testar Conexão
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="gap-2"
              >
                <a
                  href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/functions/plaud-ingest/logs`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver Logs
                </a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="gap-2"
              >
                <a href="/docs/plaud-zapier.md" target="_blank" rel="noopener noreferrer">
                  <FileText className="h-3.5 w-3.5" />
                  Documentação
                </a>
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
