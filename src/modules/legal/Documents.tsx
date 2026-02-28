import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileText, Search, Paperclip, Clock, Trash2, RotateCcw, FileSignature, Loader2,
  Brain, Printer, ChevronLeft, ChevronRight, X, History, Upload, Download, User, CheckSquare, AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DocumentFileActions, DocumentTimelineDrawer, DocumentSoftDeleteDialog, DocumentStatusSelect, DocumentBulkDeleteDialog, DocumentHardDeleteDialog } from '@/features/documents';
import { SignatureRequestModal } from '@/components/SignatureRequestModal';
import { getSecurityErrorMessage } from '@/lib/securityUtils';
interface Document {
  id: string;
  filename: string;
  kind: string;
  case_id: string | null;
  office_id: string;
  uploaded_at: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_reason: string | null;
  type_id: string | null;
  status: string | null;
  client_name?: string | null;
  template_code?: string | null;
}

// Mapeamento de códigos de template para nomes humanizados
const TEMPLATE_LABELS: Record<string, string> = {
  PROC: 'Procuração',
  PROCURACAO: 'Procuração',
  DECL: 'Declaração',
  DECLARACAO: 'Declaração',
  CONTRATO: 'Contrato',
};

const getDocumentDisplayName = (doc: Document): string => {
  // Primeiro tenta pelo template_code
  if (doc.template_code) {
    const label = TEMPLATE_LABELS[doc.template_code.toUpperCase()];
    if (label) return label;
  }
  // Depois pelo kind
  if (doc.kind) {
    const label = TEMPLATE_LABELS[doc.kind.toUpperCase()];
    if (label) return label;
  }
  // Fallback: usa o filename sem extensão e timestamp
  const cleanName = doc.filename
    .replace(/\.(html|pdf|docx?)$/i, '')
    .replace(/_\d{13,}$/, '') // Remove timestamps
    .replace(/_/g, ' ');
  return cleanName || 'Documento';
};

interface SignRequest {
  id: string;
  document_id: string;
  status: string;
  created_at: string;
}

type CaseSimple = { id: string; title: string };

type StatusFilter = 'all' | 'RASCUNHO' | 'PENDENTE' | 'EM_ASSINATURA' | 'ASSINADO' | 'ARQUIVADO';
type KindFilter = 'all' | 'PROC' | 'DECL' | 'CONTRATO' | 'PROCURACAO' | 'DECLARACAO' | 'OUTRO';

const PAGE_SIZE = 20;

const KIT_KINDS = ['PROC', 'DECL', 'CONTRATO', 'PROCURACAO', 'DECLARACAO'];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos os status' },
  { value: 'RASCUNHO', label: 'Rascunho' },
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'EM_ASSINATURA', label: 'Em Assinatura' },
  { value: 'ASSINADO', label: 'Assinado' },
  { value: 'ARQUIVADO', label: 'Arquivado' },
];

const KIND_OPTIONS = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'PROC', label: 'Procuração' },
  { value: 'DECL', label: 'Declaração' },
  { value: 'CONTRATO', label: 'Contrato' },
  { value: 'OUTRO', label: 'Outro' },
];

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  RASCUNHO: { label: 'Rascunho', className: 'bg-slate-100 text-slate-700' },
  PENDENTE: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-700' },
  EM_ASSINATURA: { label: 'Em Assinatura', className: 'bg-blue-100 text-blue-700' },
  ASSINADO: { label: 'Assinado', className: 'bg-green-100 text-green-700' },
  ARQUIVADO: { label: 'Arquivado', className: 'bg-gray-100 text-gray-500' },
};

const SIGN_STATUS_BADGES: Record<string, { label: string; className: string }> = {
  REQUESTED: { label: 'Solicitada', className: 'bg-amber-100 text-amber-700' },
  SENT: { label: 'Enviada', className: 'bg-blue-100 text-blue-700' },
  SIGNED: { label: 'Assinado', className: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Cancelada', className: 'bg-muted text-muted-foreground' },
  FAILED: { label: 'Falha', className: 'bg-destructive/20 text-destructive' },
};

export default function Documents() {
  const { toast } = useToast();
  const navigate = useNavigate();

  // Data state
  const [documents, setDocuments] = useState<Document[]>([]);
  const [cases, setCases] = useState<CaseSimple[]>([]);
  const [casesMap, setCasesMap] = useState<Record<string, CaseSimple>>({});
  const [signRequests, setSignRequests] = useState<Record<string, SignRequest>>({});
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  // Filters and pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [kindFilter, setKindFilter] = useState<KindFilter>('all');
  const [caseFilter, setCaseFilter] = useState<string>('ALL');
  const [showDeleted, setShowDeleted] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Active tab in detail panel
  const [activeTab, setActiveTab] = useState('conteudo');

  // Permission state
  const [userRole, setUserRole] = useState<string | null>(null);

  // Timeline drawer
  const [timelineOpen, setTimelineOpen] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  
  // Hard delete state
  const [hardDeleteDialogOpen, setHardDeleteDialogOpen] = useState(false);
  const [hardDeleteLoading, setHardDeleteLoading] = useState(false);
  const [bulkHardDeleteDialogOpen, setBulkHardDeleteDialogOpen] = useState(false);
  const [bulkHardDeleteLoading, setBulkHardDeleteLoading] = useState(false);

  // Signature modal
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: memberData, error: memberError } = await supabase
        .from('office_members')
        .select('office_id, role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (memberError || !memberData) {
        setError('Você não está vinculado a nenhum escritório');
        setLoading(false);
        return;
      }

      setUserRole(memberData.role);
      setOfficeId(memberData.office_id);

      // Use vw_documents_inbox (excludes deleted, case-linked, and CLIENT_KIT docs)
      const [docsResult, casesResult] = await Promise.all([
        supabase
          .from('vw_documents_inbox')
          .select('*')
          .eq('office_id', memberData.office_id)
          .order('uploaded_at', { ascending: false }),
        supabase
          .from('cases')
          .select('id, title')
          .eq('office_id', memberData.office_id)
          .order('title', { ascending: true }),
      ]);

      if (docsResult.error) throw docsResult.error;
      if (casesResult.error) throw casesResult.error;

      const docs = (docsResult.data || []) as unknown as Document[];
      setDocuments(docs);
      setCases(casesResult.data || []);

      // Build cases map for quick lookup
      const map: Record<string, CaseSimple> = {};
      (casesResult.data || []).forEach((c) => {
        map[c.id] = c;
      });
      setCasesMap(map);

      // Fetch latest sign request for each doc
      if (docs.length > 0) {
        const docIds = docs.map((d) => d.id);
        const { data: signData } = await supabase
          .from('document_sign_requests')
          .select('*')
          .in('document_id', docIds)
          .order('created_at', { ascending: false });

        if (signData) {
          const latestByDoc: Record<string, SignRequest> = {};
          signData.forEach((sr) => {
            if (!latestByDoc[sr.document_id]) {
              latestByDoc[sr.document_id] = sr;
            }
          });
          setSignRequests(latestByDoc);
        }
      }
    } catch (err: unknown) {
      console.error('Fetch error:', err);
      const errorMessage = getSecurityErrorMessage(err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isAdmin = userRole && ['admin', 'owner'].includes(userRole.toLowerCase());

  // Filter documents
  const filteredDocuments = useMemo(() => {
    let result = documents;

    // Deleted filter
    if (!showDeleted) {
      result = result.filter((d) => !d.deleted_at);
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((d) => d.status === statusFilter);
    }

    // Kind filter
    if (kindFilter !== 'all') {
      result = result.filter((d) => d.kind?.toUpperCase().includes(kindFilter));
    }

    // Case filter
    if (caseFilter !== 'ALL') {
      result = result.filter((d) => d.case_id === caseFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((doc) => {
        const filenameMatch = doc.filename?.toLowerCase().includes(query);
        const clientMatch = doc.client_name?.toLowerCase().includes(query);
        const caseItem = doc.case_id ? casesMap[doc.case_id] : null;
        const caseMatch = caseItem?.title?.toLowerCase().includes(query);
        const displayNameMatch = getDocumentDisplayName(doc).toLowerCase().includes(query);
        return filenameMatch || caseMatch || clientMatch || displayNameMatch;
      });
    }

    return result;
  }, [documents, searchQuery, statusFilter, kindFilter, caseFilter, showDeleted, casesMap]);

  // Pagination
  const totalPages = Math.ceil(filteredDocuments.length / PAGE_SIZE);
  const paginatedDocuments = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredDocuments.slice(start, start + PAGE_SIZE);
  }, [filteredDocuments, currentPage]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set()); // Clear selection when filters change
  }, [searchQuery, statusFilter, kindFilter, caseFilter, showDeleted]);

  // Bulk selection helpers - when showDeleted, select deleted docs; otherwise select non-deleted
  const selectableDocuments = useMemo(() => {
    if (showDeleted) {
      return paginatedDocuments.filter((d) => !!d.deleted_at);
    }
    return paginatedDocuments.filter((d) => !d.deleted_at);
  }, [paginatedDocuments, showDeleted]);

  const allPageSelected = selectableDocuments.length > 0 && selectableDocuments.every((d) => selectedIds.has(d.id));
  const somePageSelected = selectableDocuments.some((d) => selectedIds.has(d.id));

  const handleToggleSelectAll = () => {
    if (allPageSelected) {
      // Deselect all on current page
      const newSet = new Set(selectedIds);
      selectableDocuments.forEach((d) => newSet.delete(d.id));
      setSelectedIds(newSet);
    } else {
      // Select all on current page
      const newSet = new Set(selectedIds);
      selectableDocuments.forEach((d) => newSet.add(d.id));
      setSelectedIds(newSet);
    }
  };

  const handleToggleSelect = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(docId)) {
      newSet.delete(docId);
    } else {
      newSet.add(docId);
    }
    setSelectedIds(newSet);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async (reason: string) => {
    if (selectedIds.size === 0) return;
    setBulkDeleteLoading(true);
    try {
      const idsArray = Array.from(selectedIds);
      const { error } = await supabase
        .from('documents')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_reason: reason || 'Exclusão em massa',
        })
        .in('id', idsArray);

      if (error) throw error;

      toast({
        title: 'Documentos excluídos',
        description: `${idsArray.length} documento(s) arquivado(s) com sucesso.`,
      });
      setBulkDeleteDialogOpen(false);
      setSelectedIds(new Set());
      setSelectedDocument(null);
      fetchData();
    } catch (err: unknown) {
      const errorMessage = getSecurityErrorMessage(err);
      toast({ title: 'Erro', description: errorMessage, variant: 'destructive' });
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  // Hard delete individual document
  const handleHardDelete = async () => {
    if (!selectedDocument) return;
    setHardDeleteLoading(true);
    try {
      // First remove file from storage if exists
      if (selectedDocument.storage_path) {
        const bucket = selectedDocument.storage_path.includes('/') 
          ? 'documents' 
          : 'documents';
        await supabase.storage.from(bucket).remove([selectedDocument.storage_path]);
      }
      
      // Then delete record from database
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', selectedDocument.id);

      if (error) throw error;

      toast({
        title: 'Documento excluído permanentemente',
        description: 'O documento e seus arquivos foram removidos.',
      });
      setHardDeleteDialogOpen(false);
      setSelectedDocument(null);
      fetchData();
    } catch (err: unknown) {
      const errorMessage = getSecurityErrorMessage(err);
      toast({ title: 'Erro', description: errorMessage, variant: 'destructive' });
    } finally {
      setHardDeleteLoading(false);
    }
  };

  // Bulk hard delete for archived documents
  const handleBulkHardDelete = async () => {
    if (selectedIds.size === 0) return;
    setBulkHardDeleteLoading(true);
    try {
      const idsArray = Array.from(selectedIds);
      
      // Get documents info to get storage paths
      const { data: docsToDelete } = await supabase
        .from('documents')
        .select('id, storage_path')
        .in('id', idsArray);

      // Remove files from storage
      if (docsToDelete) {
        const pathsToRemove = docsToDelete
          .filter((d) => d.storage_path)
          .map((d) => d.storage_path as string);
        
        if (pathsToRemove.length > 0) {
          await supabase.storage.from('documents').remove(pathsToRemove);
        }
      }

      // Delete records from database
      const { error } = await supabase
        .from('documents')
        .delete()
        .in('id', idsArray);

      if (error) throw error;

      toast({
        title: 'Documentos excluídos permanentemente',
        description: `${idsArray.length} documento(s) removido(s) permanentemente.`,
      });
      setBulkHardDeleteDialogOpen(false);
      setSelectedIds(new Set());
      setSelectedDocument(null);
      fetchData();
    } catch (err: unknown) {
      const errorMessage = getSecurityErrorMessage(err);
      toast({ title: 'Erro', description: errorMessage, variant: 'destructive' });
    } finally {
      setBulkHardDeleteLoading(false);
    }
  };

  const handleSelectDocument = (doc: Document) => {
    setSelectedDocument(doc);
    setActiveTab('conteudo');
  };

  const getCaseTitle = (caseId: string | null): string => {
    if (!caseId) return 'Sem caso';
    return casesMap[caseId]?.title || 'Caso não encontrado';
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    const config = STATUS_BADGES[status] || { label: status, className: 'bg-muted text-muted-foreground' };
    return <Badge className={`text-[10px] ${config.className}`}>{config.label}</Badge>;
  };

  const getSignStatusBadge = (docId: string) => {
    const sr = signRequests[docId];
    if (!sr) return null;
    const config = SIGN_STATUS_BADGES[sr.status] || { label: sr.status, className: 'bg-muted text-muted-foreground' };
    return <Badge variant="outline" className={`text-[10px] ${config.className}`}>{config.label}</Badge>;
  };

  const handleSoftDelete = async (reason: string) => {
    if (!selectedDocument) return;
    setActionLoading(selectedDocument.id);
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_reason: reason || null,
        })
        .eq('id', selectedDocument.id);

      if (error) throw error;
      toast({ title: 'Documento excluído', description: 'O documento foi arquivado com sucesso.' });
      setDeleteDialogOpen(false);
      setSelectedDocument(null);
      fetchData();
    } catch (err: unknown) {
      const errorMessage = getSecurityErrorMessage(err);
      toast({ title: 'Erro', description: errorMessage, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestore = async () => {
    if (!selectedDocument) return;
    setActionLoading(selectedDocument.id);
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          deleted_at: null,
          deleted_reason: null,
        })
        .eq('id', selectedDocument.id);

      if (error) throw error;
      toast({ title: 'Documento restaurado', description: 'O documento foi restaurado com sucesso.' });
      fetchData();
      // Refresh selected document
      const { data } = await supabase
        .from('documents')
        .select('*')
        .eq('id', selectedDocument.id)
        .maybeSingle();
      if (data) {
        setSelectedDocument(data as unknown as Document);
      }
    } catch (err: unknown) {
      const errorMessage = getSecurityErrorMessage(err);
      toast({ title: 'Erro', description: errorMessage, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSignatureSuccess = () => {
    toast({ title: 'Assinatura solicitada', description: 'A solicitação de assinatura foi enviada.' });
    fetchData();
  };

  const updateStatus = async (newStatus: string) => {
    if (!selectedDocument) return;
    setActionLoading(selectedDocument.id);
    try {
      const { error } = await supabase
        .from('documents')
        .update({ status: newStatus } as any)
        .eq('id', selectedDocument.id);

      if (error) throw error;
      toast({ title: 'Status atualizado', description: `O status foi alterado para ${newStatus}.` });
      fetchData();
      // Refresh selected document
      const { data } = await supabase
        .from('documents')
        .select('*')
        .eq('id', selectedDocument.id)
        .maybeSingle();
      if (data) {
        setSelectedDocument(data as unknown as Document);
      }
    } catch (err: unknown) {
      const errorMessage = getSecurityErrorMessage(err);
      toast({ title: 'Erro', description: errorMessage, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handlePrint = () => {
    if (!selectedDocument) return;
    window.open(`/documents/print/${selectedDocument.id}`, '_blank');
  };

  const handleNijaAnalysis = () => {
    if (!selectedDocument) return;
    const params = selectedDocument.case_id
      ? `caseId=${selectedDocument.case_id}&docId=${selectedDocument.id}`
      : `docId=${selectedDocument.id}`;
    navigate(`/nija?${params}`);
  };

  const isDeleted = selectedDocument?.deleted_at;
  const isLoading = actionLoading === selectedDocument?.id;

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 lg:gap-4 overflow-hidden">
      <div className="flex h-[calc(100vh-4rem)] gap-0 lg:gap-4 overflow-hidden">
        {/* Left Column - Document List */}
        <div className={`w-full lg:w-1/3 xl:w-1/4 flex flex-col border-r border-border ${selectedDocument ? 'hidden lg:flex' : 'flex'}`}>
          {/* Header */}
          <div className="p-4 border-b border-border space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documentos
              </h1>
              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                    {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  {filteredDocuments.length} doc(s)
                </Badge>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar título, caso..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 h-9"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Filters Row */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as KindFilter)}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {KIND_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Select value={caseFilter} onValueChange={setCaseFilter}>
                  <SelectTrigger className="h-8 text-xs flex-1">
                    <SelectValue placeholder="Caso" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos os casos</SelectItem>
                    {cases.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-1.5">
                  <Switch
                    id="show-deleted"
                    checked={showDeleted}
                    onCheckedChange={setShowDeleted}
                    className="scale-75"
                  />
                  <label htmlFor="show-deleted" className="text-xs text-muted-foreground whitespace-nowrap">
                    Excluídos
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Bulk Actions Bar */}
          {selectedIds.size > 0 && (
            <div className="px-4 py-2 bg-primary/5 border-b border-border flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSelection}
                  className="h-7 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Limpar
                </Button>
                {showDeleted ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setBulkHardDeleteDialogOpen(true)}
                    className="h-7 text-xs"
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Excluir Permanentemente
                  </Button>
                ) : (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setBulkDeleteDialogOpen(true)}
                    className="h-7 text-xs"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Excluir Selecionados
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Select All Header */}
          {!loading && !error && paginatedDocuments.length > 0 && selectableDocuments.length > 0 && (
            <div className="px-4 py-2 border-b border-border flex items-center gap-2 bg-muted/30">
              <Checkbox
                id="select-all"
                checked={allPageSelected}
                onCheckedChange={handleToggleSelectAll}
                className="data-[state=checked]:bg-primary"
              />
              <label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer">
                {allPageSelected ? 'Desmarcar todos' : `Selecionar todos (${selectableDocuments.length})`}
              </label>
            </div>
          )}

          {/* Document List */}
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : error ? (
              <div className="py-12 text-center px-4">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-sm">{error}</p>
              </div>
            ) : paginatedDocuments.length === 0 ? (
              <div className="py-12 text-center px-4">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-sm">
                  {documents.length === 0 ? 'Nenhum documento cadastrado' : 'Nenhum documento encontrado'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {paginatedDocuments.map((doc) => {
                  const docIsDeleted = !!doc.deleted_at;
                  const displayName = getDocumentDisplayName(doc);
                  const uploadDate = new Date(doc.uploaded_at);
                  const formattedDate = uploadDate.toLocaleDateString('pt-BR', { 
                    day: '2-digit', 
                    month: '2-digit' 
                  });
                  const formattedTime = uploadDate.toLocaleTimeString('pt-BR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  });
                  const isSelected = selectedIds.has(doc.id);
                  
                  return (
                    <div
                      key={doc.id}
                      onClick={() => handleSelectDocument(doc)}
                      className={`p-3 cursor-pointer hover:bg-accent/50 transition-colors ${
                        selectedDocument?.id === doc.id ? 'bg-accent' : ''
                      } ${docIsDeleted ? 'opacity-60' : ''} ${isSelected ? 'bg-primary/5' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        {/* Checkbox for selection - show for non-deleted OR for deleted when showDeleted */}
                        {(showDeleted ? docIsDeleted : !docIsDeleted) && (
                          <div className="pt-0.5">
                            <Checkbox
                              checked={isSelected}
                              onClick={(e) => handleToggleSelect(doc.id, e)}
                              className="data-[state=checked]:bg-primary"
                            />
                          </div>
                        )}
                        
                        <div className="flex-1 space-y-1 min-w-0">
                          {/* Document Type Name */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {doc.storage_path && <Paperclip className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                              <span className="font-semibold text-sm md:text-base leading-tight line-clamp-1">
                                {displayName}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {getStatusBadge(doc.status)}
                              {docIsDeleted && (
                                <Badge variant="destructive" className="text-[10px]">Excluído</Badge>
                              )}
                            </div>
                          </div>

                          {/* Client Name */}
                          <p className="text-sm text-foreground/80 truncate flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            {doc.client_name || 'Sem cliente vinculado'}
                          </p>

                          {/* Date and Sign Status */}
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formattedDate} às {formattedTime}
                            </span>
                            {getSignStatusBadge(doc.id)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Document Detail */}
        <div className={`flex-1 flex flex-col overflow-hidden ${selectedDocument ? 'flex' : 'hidden lg:flex'}`}>
          {selectedDocument && officeId ? (
            <>
              {/* Mobile back button */}
              <div className="lg:hidden p-3 border-b border-border">
                <Button variant="ghost" size="sm" onClick={() => setSelectedDocument(null)}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Voltar
                </Button>
              </div>

              {/* Document Header */}
              <div className="p-4 border-b border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {selectedDocument.storage_path && <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                      <h2 className="text-lg md:text-xl font-semibold tracking-tight leading-tight truncate">
                        {getDocumentDisplayName(selectedDocument)}
                      </h2>
                    </div>
                    <p className="text-sm text-foreground/80 mt-1 flex items-center gap-1.5">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {selectedDocument.client_name || 'Sem cliente vinculado'}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                      <span className="bg-muted px-1.5 py-0.5 rounded">{selectedDocument.kind || 'OUTRO'}</span>
                      <span>•</span>
                      <span>{new Date(selectedDocument.uploaded_at).toLocaleDateString('pt-BR', { 
                        day: '2-digit', 
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                      {selectedDocument.case_id && (
                        <>
                          <span>•</span>
                          <span className="text-primary">{getCaseTitle(selectedDocument.case_id)}</span>
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {getStatusBadge(selectedDocument.status)}
                      {getSignStatusBadge(selectedDocument.id)}
                      {isDeleted && <Badge variant="destructive" className="text-[10px]">Excluído</Badge>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <div className="border-b border-border px-4 overflow-x-auto">
                  <TabsList className="h-auto bg-transparent w-full flex flex-nowrap gap-1 justify-start p-0">
                    <TabsTrigger
                      value="conteudo"
                      className="text-xs md:text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-10 px-2 md:px-3 whitespace-nowrap"
                    >
                      <FileText className="h-4 w-4 mr-1.5" />
                      <span className="hidden sm:inline">Conteúdo</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="timeline"
                      className="text-xs md:text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-10 px-2 md:px-3 whitespace-nowrap"
                    >
                      <History className="h-4 w-4 mr-1.5" />
                      <span className="hidden sm:inline">Histórico</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="assinaturas"
                      className="text-xs md:text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-10 px-2 md:px-3 whitespace-nowrap"
                    >
                      <FileSignature className="h-4 w-4 mr-1.5" />
                      <span className="hidden sm:inline">Assinaturas</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="status"
                      className="text-xs md:text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-10 px-2 md:px-3 whitespace-nowrap"
                    >
                      <Clock className="h-4 w-4 mr-1.5" />
                      <span className="hidden sm:inline">Status</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="arquivos"
                      className="text-xs md:text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent h-10 px-2 md:px-3 whitespace-nowrap"
                    >
                      <Download className="h-4 w-4 mr-1.5" />
                      <span className="hidden sm:inline">Arquivos</span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                <ScrollArea className="flex-1">
                  {/* Tab: Conteúdo */}
                  <TabsContent value="conteudo" className="p-4 m-0 space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Informações do Documento</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <span className="text-muted-foreground">Nome do arquivo:</span>
                            <p className="font-medium">{selectedDocument.filename}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Caso vinculado:</span>
                            <p className="font-medium">{getCaseTitle(selectedDocument.case_id)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tipo:</span>
                            <p className="font-medium">{selectedDocument.kind || 'OUTRO'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Status:</span>
                            <p className="font-medium">{selectedDocument.status || 'Não definido'}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Upload em:</span>
                            <p className="font-medium">
                              {new Date(selectedDocument.uploaded_at).toLocaleString('pt-BR')}
                            </p>
                          </div>
                          {selectedDocument.file_size && (
                            <div>
                              <span className="text-muted-foreground">Tamanho:</span>
                              <p className="font-medium">
                                {(selectedDocument.file_size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          )}
                          {selectedDocument.mime_type && (
                            <div>
                              <span className="text-muted-foreground">Tipo MIME:</span>
                              <p className="font-medium font-mono text-xs">{selectedDocument.mime_type}</p>
                            </div>
                          )}
                        </div>

                        {/* Quick actions */}
                        <div className="pt-3 border-t border-border flex flex-wrap gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="sm" onClick={handlePrint} disabled={isLoading || !!isDeleted}>
                                  <Printer className="h-4 w-4 mr-1" />
                                  Imprimir
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Imprimir documento</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="sm" onClick={handleNijaAnalysis} disabled={isLoading || !!isDeleted}>
                                  <Brain className="h-4 w-4 mr-1" />
                                  Analisar com NIJA
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Analisar este documento no NIJA</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Tab: Histórico */}
                  <TabsContent value="timeline" className="p-4 m-0 space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <History className="h-4 w-4" />
                          Linha do Tempo
                        </CardTitle>
                        <CardDescription>
                          Histórico de eventos e alterações do documento
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button
                          variant="outline"
                          onClick={() => setTimelineOpen(true)}
                          className="w-full"
                        >
                          <Clock className="h-4 w-4 mr-2" />
                          Abrir Linha do Tempo Completa
                        </Button>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Tab: Assinaturas */}
                  <TabsContent value="assinaturas" className="p-4 m-0 space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileSignature className="h-4 w-4" />
                          Assinaturas
                        </CardTitle>
                        <CardDescription>
                          Gerenciar solicitações de assinatura
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Current signature status */}
                        {signRequests[selectedDocument.id] && (
                          <div className="p-3 border rounded-lg bg-muted/30">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">Última solicitação:</span>
                              {(() => {
                                const sr = signRequests[selectedDocument.id];
                                const config = SIGN_STATUS_BADGES[sr.status] || SIGN_STATUS_BADGES.REQUESTED;
                                return (
                                  <Badge variant="outline" className={config.className}>
                                    {config.label}
                                  </Badge>
                                );
                              })()}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Criada em: {new Date(signRequests[selectedDocument.id].created_at).toLocaleString('pt-BR')}
                            </p>
                          </div>
                        )}

                        {/* Request signature button */}
                        {isAdmin && !isDeleted && (
                          <Button
                            onClick={() => setSignatureModalOpen(true)}
                            disabled={isLoading}
                            className="w-full"
                          >
                            {isLoading ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <FileSignature className="h-4 w-4 mr-2" />
                            )}
                            Solicitar Assinatura
                          </Button>
                        )}

                        {!isAdmin && (
                          <p className="text-sm text-muted-foreground text-center">
                            Apenas administradores podem solicitar assinaturas.
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Tab: Status */}
                  <TabsContent value="status" className="p-4 m-0 space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Status & Ações
                        </CardTitle>
                        <CardDescription>
                          Gerenciar status e ciclo de vida do documento
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Status select */}
                        <div>
                          <label className="text-sm font-medium mb-2 block">Status atual</label>
                          <DocumentStatusSelect
                            documentId={selectedDocument.id}
                            value={selectedDocument.status || ''}
                            onChange={updateStatus}
                            disabled={isLoading || !isAdmin || !!isDeleted}
                          />
                        </div>

                        {/* Delete / Restore actions */}
                        {(
                          <div className="pt-3 border-t border-border">
                            {isDeleted ? (
                              <div className="space-y-3">
                                <div className="p-3 bg-destructive/10 rounded-lg">
                                  <p className="text-sm font-medium text-destructive">Este documento foi excluído</p>
                                  {selectedDocument.deleted_reason && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Motivo: {selectedDocument.deleted_reason}
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-col gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={handleRestore}
                                    disabled={isLoading || hardDeleteLoading}
                                    className="w-full"
                                  >
                                    {isLoading ? (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                      <RotateCcw className="h-4 w-4 mr-2" />
                                    )}
                                    Restaurar Documento
                                  </Button>
                                  {isAdmin && (
                                    <Button
                                      variant="destructive"
                                      onClick={() => setHardDeleteDialogOpen(true)}
                                      disabled={isLoading || hardDeleteLoading}
                                      className="w-full"
                                    >
                                      <AlertTriangle className="h-4 w-4 mr-2" />
                                      Excluir Permanentemente
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <Button
                                variant="destructive"
                                onClick={() => setDeleteDialogOpen(true)}
                                disabled={isLoading}
                                className="w-full"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir Documento
                              </Button>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Tab: Arquivos */}
                  <TabsContent value="arquivos" className="p-4 m-0 space-y-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Download className="h-4 w-4" />
                          Arquivos & Exportação
                        </CardTitle>
                        <CardDescription>
                          Upload, download e gerenciamento de arquivos
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* File info */}
                        <div className="p-3 border rounded-lg bg-muted/30">
                          <div className="flex items-center gap-2 mb-2">
                            <Paperclip className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">
                              {selectedDocument.storage_path ? 'Arquivo anexado' : 'Sem arquivo anexado'}
                            </span>
                          </div>
                          {selectedDocument.storage_path && (
                            <p className="text-xs text-muted-foreground font-mono truncate">
                              {selectedDocument.storage_path}
                            </p>
                          )}
                        </div>

                        {/* File actions */}
                        {!isDeleted && (
                          <div className="flex flex-wrap gap-2">
                            <DocumentFileActions
                              documentId={selectedDocument.id}
                              hasFile={!!selectedDocument.storage_path}
                              onUploadComplete={fetchData}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </>
          ) : (
            /* Placeholder when no document selected */
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <FileText className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">
                  Selecione um documento
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Escolha um documento na lista ao lado para visualizar os detalhes
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Timeline Drawer */}
      <DocumentTimelineDrawer
        open={timelineOpen}
        onOpenChange={setTimelineOpen}
        documentId={selectedDocument?.id || ''}
        documentTitle={selectedDocument?.filename}
      />

      {/* Delete Dialog */}
      <DocumentSoftDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        documentTitle={selectedDocument?.filename || ''}
        onConfirm={handleSoftDelete}
      />

      {/* Bulk Delete Dialog */}
      <DocumentBulkDeleteDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        onConfirm={handleBulkDelete}
        selectedCount={selectedIds.size}
        isLoading={bulkDeleteLoading}
      />

      {/* Hard Delete Dialog (individual) */}
      <DocumentHardDeleteDialog
        open={hardDeleteDialogOpen}
        onOpenChange={setHardDeleteDialogOpen}
        onConfirm={handleHardDelete}
        selectedCount={1}
        isLoading={hardDeleteLoading}
        isBulk={false}
      />

      {/* Bulk Hard Delete Dialog */}
      <DocumentHardDeleteDialog
        open={bulkHardDeleteDialogOpen}
        onOpenChange={setBulkHardDeleteDialogOpen}
        onConfirm={handleBulkHardDelete}
        selectedCount={selectedIds.size}
        isLoading={bulkHardDeleteLoading}
        isBulk={true}
      />

      {selectedDocument && (
        <SignatureRequestModal
          open={signatureModalOpen}
          onOpenChange={setSignatureModalOpen}
          documentId={selectedDocument.id}
          documentTitle={selectedDocument.filename}
          caseId={selectedDocument.case_id}
          onSuccess={handleSignatureSuccess}
        />
      )}
    </div>
  );
}
