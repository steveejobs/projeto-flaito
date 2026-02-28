import { useState, useEffect, useMemo, forwardRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOfficeSession } from '@/hooks/useOfficeSession';
import { useUserRole } from '@/hooks/useUserRole';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { PlaudAssetModal } from '@/features/cases/PlaudAssetModal';
import { PlaudDiagnosticPanel } from '@/components/plaud/PlaudDiagnosticPanel';

import {
  RefreshCw,
  MoreHorizontal,
  User,
  Users,
  EyeOff,
  Link2,
  Copy,
  Inbox,
  Mic,
  Calendar,
  Globe,
  Search,
  Briefcase,
  Scale,
  ShieldAlert,
  ShieldCheck,
  FileText,
} from 'lucide-react';

// Types
interface PlaudAsset {
  id: string;
  created_at: string;
  title: string | null;
  summary: string | null;
  transcript: string | null;
  language: string | null;
  assigned_to: string | null;
  is_office_visible: boolean | null;
  case_id: string | null;
}

interface OfficeMember {
  user_id: string;
  email?: string;
  role: string;
}

interface CaseOption {
  id: string;
  title: string;
  cnj_number: string | null;
  client_name: string | null;
}

// OMNI-SÊNIOR types
type AiStatus = 'none' | 'queued' | 'running' | 'done' | 'failed';

interface SeniorAnalysis {
  id: string;
  decisao_estrategica: 'AGIR' | 'REGISTRAR' | 'SILENCIAR';
  status_juridico: string;
  risco_preclusao: 'NENHUM' | 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO' | null;
  tipo_ato: string | null;
  fase_processual: string | null;
  fato_central: string | null;
  consequencia_juridica: string | null;
  peca_sugerida: string | null;
  justificativa_silencio: string | null;
  fundamento_legal: string | null;
  checklist: string[];
}

interface NijaAnalysis {
  resumoExecutivo?: string;
  pontosChave?: string[];
  acoes?: string[];
  partesEnvolvidas?: string[];
  datasEPrazos?: { data: string; contexto: string }[];
  relevanciaJuridica?: {
    temRelevancia: boolean;
    elementos: string[];
    nivelUrgencia: string;
  };
  sentimento?: string;
  topicos?: string[];
  citacoesImportantes?: string[];
}

type TabMode = 'personal' | 'office' | 'both';

const PlaudInbox = forwardRef<HTMLDivElement, object>(function PlaudInbox(_props, ref) {
  const { user } = useAuth();
  const { officeId, ready: officeReady } = useOfficeSession(user?.id);
  const { role } = useUserRole();

  // State
  const [activeTab, setActiveTab] = useState<TabMode>('office');
  const [assets, setAssets] = useState<PlaudAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Members for "assign to other"
  const [members, setMembers] = useState<OfficeMember[]>([]);

  // OMNI-SÊNIOR: Senior analyses map
  const [seniorAnalyses, setSeniorAnalyses] = useState<Record<string, SeniorAnalysis>>({});

  // Modal state (replacing Sheet)
  const [selectedAsset, setSelectedAsset] = useState<PlaudAsset | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<NijaAnalysis | undefined>(undefined);
  const [selectedAiStatus, setSelectedAiStatus] = useState<AiStatus>('none');
  const [selectedSenior, setSelectedSenior] = useState<SeniorAnalysis | null>(null);

  // Link to case dialog
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkingAssetId, setLinkingAssetId] = useState<string | null>(null);
  const [caseSearch, setCaseSearch] = useState('');
  const [caseOptions, setCaseOptions] = useState<CaseOption[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  // Action loading
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Fetch inbox data
  const fetchInbox = async (mode: TabMode, isRefresh = false) => {
    if (!officeId) return;

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data, error } = await supabase.rpc('get_plaud_inbox', {
        p_office_id: officeId,
        p_mode: mode,
      });

      if (error) throw error;
      const fetchedAssets = (data as unknown as PlaudAsset[]) || [];
      setAssets(fetchedAssets);

      // Fetch OMNI-SÊNIOR analyses for these assets
      if (fetchedAssets.length > 0) {
        const assetIds = fetchedAssets.map(a => a.id);
        const { data: seniorData, error: seniorError } = await supabase
          .from('plaud_senior_analysis')
          .select('*')
          .in('plaud_asset_id', assetIds);

        if (!seniorError && seniorData) {
          const seniorMap: Record<string, SeniorAnalysis> = {};
          for (const s of seniorData) {
            seniorMap[s.plaud_asset_id] = {
              id: s.id,
              decisao_estrategica: s.decisao_estrategica as 'AGIR' | 'REGISTRAR' | 'SILENCIAR',
              status_juridico: s.status_juridico,
              risco_preclusao: s.risco_preclusao as 'NENHUM' | 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO' | null,
              tipo_ato: s.tipo_ato,
              fase_processual: s.fase_processual,
              fato_central: s.fato_central,
              consequencia_juridica: s.consequencia_juridica,
              peca_sugerida: s.peca_sugerida,
              justificativa_silencio: s.justificativa_silencio,
              fundamento_legal: s.fundamento_legal,
              checklist: Array.isArray(s.checklist) ? (s.checklist as string[]) : [],
            };
          }
          setSeniorAnalyses(seniorMap);
        }
      }
    } catch (err: any) {
      console.error('Erro ao buscar inbox:', err);
      toast.error('Erro ao carregar transcrições');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch members
  const fetchMembers = async () => {
    if (!officeId) return;

    try {
      const { data, error } = await supabase
        .from('office_members')
        .select('user_id, role')
        .eq('office_id', officeId)
        .eq('is_active', true);

      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      console.error('Erro ao buscar membros:', err);
    }
  };

  // Fetch cases for linking
  const fetchCases = async (search: string) => {
    if (!officeId) return;

    setLoadingCases(true);
    try {
      let query = supabase
        .from('cases')
        .select('id, title, cnj_number, clients:client_id(name)')
        .eq('office_id', officeId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(20);

      if (search.trim()) {
        query = query.or(`title.ilike.%${search}%,cnj_number.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const options: CaseOption[] = (data || []).map((c: any) => ({
        id: c.id,
        title: c.title,
        cnj_number: c.cnj_number,
        client_name: c.clients?.name || null,
      }));

      setCaseOptions(options);
    } catch (err) {
      console.error('Erro ao buscar casos:', err);
    } finally {
      setLoadingCases(false);
    }
  };

  // Effects
  useEffect(() => {
    if (officeReady && officeId) {
      fetchInbox(activeTab);
      fetchMembers();
    }
  }, [officeReady, officeId]);

  useEffect(() => {
    if (officeReady && officeId) {
      fetchInbox(activeTab);
    }
  }, [activeTab]);

  // Actions
  const handleAssignToMe = async (assetId: string) => {
    if (!user?.id) return;

    setActionLoadingId(assetId);
    try {
      const { error } = await supabase.rpc('assign_plaud_asset', {
        p_asset_id: assetId,
        p_assigned_to: user.id,
        p_office_visible: true,
      });

      if (error) throw error;
      toast.success('Transcrição atribuída a você');
      fetchInbox(activeTab, true);
    } catch (err: any) {
      console.error('Erro ao atribuir:', err);
      toast.error('Erro ao atribuir transcrição');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAssignToOther = async (assetId: string, memberId: string) => {
    setActionLoadingId(assetId);
    try {
      const { error } = await supabase.rpc('assign_plaud_asset', {
        p_asset_id: assetId,
        p_assigned_to: memberId,
        p_office_visible: true,
      });

      if (error) throw error;
      toast.success('Transcrição atribuída');
      fetchInbox(activeTab, true);
    } catch (err: any) {
      console.error('Erro ao atribuir:', err);
      toast.error('Erro ao atribuir transcrição');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleHideFromOffice = async (assetId: string, currentAssignee: string | null) => {
    setActionLoadingId(assetId);
    try {
      const { error } = await supabase.rpc('assign_plaud_asset', {
        p_asset_id: assetId,
        p_assigned_to: currentAssignee,
        p_office_visible: false,
      });

      if (error) throw error;
      toast.success('Transcrição ocultada do escritório');
      fetchInbox(activeTab, true);
    } catch (err: any) {
      console.error('Erro ao ocultar:', err);
      toast.error('Erro ao ocultar transcrição');
    } finally {
      setActionLoadingId(null);
    }
  };

  const openLinkDialog = (assetId: string) => {
    setLinkingAssetId(assetId);
    setSelectedCaseId(null);
    setCaseSearch('');
    setCaseOptions([]);
    setLinkDialogOpen(true);
    fetchCases('');
  };

  const handleLinkToCase = async () => {
    if (!linkingAssetId || !selectedCaseId) return;

    setLinking(true);
    try {
      const { error } = await supabase.rpc('link_plaud_asset_to_case', {
        p_asset_id: linkingAssetId,
        p_case_id: selectedCaseId,
      });

      if (error) throw error;
      toast.success('Transcrição vinculada ao caso');
      setLinkDialogOpen(false);
      setLinkingAssetId(null);
      // Remove from list since it now has a case_id
      setAssets((prev) => prev.filter((a) => a.id !== linkingAssetId));
    } catch (err: any) {
      console.error('Erro ao vincular:', err);
      toast.error('Erro ao vincular ao caso');
    } finally {
      setLinking(false);
    }
  };

  // Open detail modal with all data
  const openDetail = async (asset: PlaudAsset) => {
    setSelectedAsset(asset);
    setSelectedSenior(seniorAnalyses[asset.id] || null);
    
    // Fetch job status
    const { data: jobData } = await supabase
      .from('plaud_analysis_jobs')
      .select('status')
      .eq('plaud_asset_id', asset.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let aiStatus: AiStatus = 'none';
    if (jobData) {
      aiStatus = jobData.status as AiStatus;
    }
    setSelectedAiStatus(aiStatus);

    // Fetch analysis if done
    if (aiStatus === 'done') {
      const { data: analysisData } = await supabase
        .from('plaud_asset_analysis')
        .select('analysis')
        .eq('plaud_asset_id', asset.id)
        .maybeSingle();

      if (analysisData?.analysis) {
        setSelectedAnalysis(analysisData.analysis as NijaAnalysis);
      } else {
        setSelectedAnalysis(undefined);
      }
    } else {
      setSelectedAnalysis(undefined);
    }

    setDetailOpen(true);
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  // Helpers
  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const getPreview = (asset: PlaudAsset) => {
    const text = asset.summary || asset.transcript || '';
    if (text.length > 80) return text.slice(0, 80) + '...';
    return text || '(sem conteúdo)';
  };

  const isMyAsset = (asset: PlaudAsset) => asset.assigned_to === user?.id;

  const otherMembers = useMemo(
    () => members.filter((m) => m.user_id !== user?.id),
    [members, user?.id]
  );

  // OMNI-SÊNIOR: Badge helpers
  const getDecisaoBadgeVariant = (decisao: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (decisao) {
      case 'AGIR': return 'destructive';
      case 'REGISTRAR': return 'secondary';
      case 'SILENCIAR': return 'outline';
      default: return 'secondary';
    }
  };


  // Render helpers
  const renderTable = () => {
    if (loading) {
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Data</TableHead>
              <TableHead>Título</TableHead>
              <TableHead className="hidden md:table-cell">Preview</TableHead>
              <TableHead className="w-[140px]">Tags</TableHead>
              <TableHead className="w-[60px] text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableSkeleton rows={5} columns={5} />
          </TableBody>
        </Table>
      );
    }

    if (assets.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-foreground mb-1">Nenhuma transcrição recebida ainda</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            As transcrições do Plaud aparecerão aqui quando forem sincronizadas.
          </p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[140px]">Data</TableHead>
            <TableHead>Título</TableHead>
            <TableHead className="hidden md:table-cell">Preview</TableHead>
            <TableHead className="w-[140px]">Tags</TableHead>
            <TableHead className="w-[60px] text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((asset) => {
            const senior = seniorAnalyses[asset.id];
            return (
              <TableRow
                key={asset.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => openDetail(asset)}
              >
                <TableCell className="table-cell-secondary">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground/60" />
                    {formatDate(asset.created_at)}
                  </div>
                </TableCell>
                <TableCell className="table-cell-primary">
                  <div className="font-medium">{asset.title || '(sem título)'}</div>
                  <div className="text-xs text-muted-foreground mt-1 truncate max-w-[200px] md:hidden">
                    {getPreview(asset)}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground text-sm max-w-[300px] truncate">
                  {getPreview(asset)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* OMNI-SÊNIOR Badge */}
                    {senior && (
                      <Badge 
                        variant={getDecisaoBadgeVariant(senior.decisao_estrategica)} 
                        className="text-[10px] px-1.5 py-0"
                      >
                        {senior.decisao_estrategica}
                      </Badge>
                    )}
                    {asset.language && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        <Globe className="h-2.5 w-2.5 mr-1" />
                        {asset.language}
                      </Badge>
                    )}
                    {isMyAsset(asset) && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                        MEU
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="table-cell-actions" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={actionLoadingId === asset.id}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Ações</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleAssignToMe(asset.id)}>
                        <User className="h-4 w-4 mr-2" />
                        Atribuir a mim
                      </DropdownMenuItem>
                      {otherMembers.length > 0 && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Users className="h-4 w-4 mr-2" />
                            Atribuir a outro
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {otherMembers.map((m) => (
                              <DropdownMenuItem
                                key={m.user_id}
                                onClick={() => handleAssignToOther(asset.id, m.user_id)}
                              >
                                {m.user_id.slice(0, 8)}... ({m.role})
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      )}
                      <DropdownMenuItem
                        onClick={() => handleHideFromOffice(asset.id, asset.assigned_to)}
                      >
                        <EyeOff className="h-4 w-4 mr-2" />
                        Ocultar do escritório
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openLinkDialog(asset.id)}>
                        <Link2 className="h-4 w-4 mr-2" />
                        Vincular ao caso
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  if (!officeReady) {
    return (
      <div ref={ref} className="container max-w-6xl py-8">
        <Skeleton className="h-10 w-64 mb-6" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div ref={ref} className="container max-w-6xl py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-widest">
            Integrações
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight flex items-center gap-3">
            <Mic className="h-8 w-8 text-primary" />
            Plaud Inbox
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Transcrições recebidas do dispositivo Plaud aguardando processamento.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchInbox(activeTab, true)}
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Diagnostic Panel - visible to OWNER/ADMIN */}
      {officeId && (role === 'OWNER' || role === 'ADMIN') && (
        <PlaudDiagnosticPanel officeId={officeId} />
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabMode)}
        className="space-y-4"
      >
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="personal" className="gap-2">
            <User className="h-4 w-4" />
            Meu Inbox
          </TabsTrigger>
          <TabsTrigger value="office" className="gap-2">
            <Users className="h-4 w-4" />
            Escritório
          </TabsTrigger>
          <TabsTrigger value="both" className="gap-2">
            <Inbox className="h-4 w-4" />
            Tudo
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {activeTab === 'personal' && 'Minhas Transcrições'}
                  {activeTab === 'office' && 'Transcrições do Escritório'}
                  {activeTab === 'both' && 'Todas as Transcrições'}
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {assets.length} {assets.length === 1 ? 'item' : 'itens'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>{renderTable()}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* PlaudAssetModal (replacing Sheet) */}
      {selectedAsset && (
        <PlaudAssetModal
          asset={{
            id: selectedAsset.id,
            title: selectedAsset.title || '(sem título)',
            transcript: selectedAsset.transcript,
            summary: selectedAsset.summary,
            received_at: selectedAsset.created_at,
            created_at_source: null,
            audio_url: null,
            duration: null,
          }}
          analysis={selectedAnalysis}
          aiStatus={selectedAiStatus}
          seniorAnalysis={selectedSenior}
          open={detailOpen}
          onClose={() => {
            setDetailOpen(false);
            setSelectedAsset(null);
          }}
        />
      )}

      {/* Link to Case Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Vincular ao Caso
            </DialogTitle>
            <DialogDescription>
              Selecione o caso para vincular esta transcrição.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título ou CNJ..."
                value={caseSearch}
                onChange={(e) => {
                  setCaseSearch(e.target.value);
                  fetchCases(e.target.value);
                }}
                className="pl-9"
              />
            </div>

            <ScrollArea className="h-[200px] rounded-lg border">
              {loadingCases ? (
                <div className="p-4 space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : caseOptions.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nenhum caso encontrado.
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {caseOptions.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCaseId(c.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedCaseId === c.id
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent hover:bg-muted/50'
                      }`}
                    >
                      <div className="font-medium text-sm">{c.title}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        {c.cnj_number && <span>{c.cnj_number}</span>}
                        {c.client_name && (
                          <>
                            <span>•</span>
                            <span>{c.client_name}</span>
                          </>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleLinkToCase} disabled={!selectedCaseId || linking}>
              {linking ? 'Vinculando...' : 'Vincular'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

export default PlaudInbox;
