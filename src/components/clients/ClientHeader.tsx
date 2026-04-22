import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Pencil, MoreHorizontal, Archive, Trash2, Globe, Sparkles, Brain } from "lucide-react";
import { useActiveClient } from "@/contexts/ActiveClientContext";
import { ClientTabs, type TabValue } from "./ClientTabs";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ClickablePhone } from "@/components/ui/clickable-phone";
import { ClickableEmail } from "@/components/ui/clickable-email";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;

type Props = {
  client: Client;
  showBackButton?: boolean;
  onBack?: () => void;
  onEdit?: () => void;
  onArchived?: () => void;
  onDeleted?: () => void;
  activeTab?: TabValue;
  onTabChange?: (tab: TabValue) => void;
  casesCount?: number;
  docsCount?: number;
  filesCount?: number;
  timelineCount?: number;
  extraActions?: React.ReactNode;
};

function onlyDigits(v?: string | null) {
  return (v ?? "").replace(/\D+/g, "");
}

function formatCpfCnpj(doc?: string | null, personType?: "PF" | "PJ" | null) {
  const d = onlyDigits(doc);
  if (!d) return null;

  if (personType === "PJ") {
    if (d.length === 14)
      return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    return doc;
  }

  if (d.length === 11)
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return doc;
}

export function ClientHeader({
  client,
  showBackButton = false,
  onBack,
  onEdit,
  onArchived,
  onDeleted,
  activeTab = "dados",
  onTabChange,
  casesCount = 0,
  docsCount = 0,
  filesCount = 0,
  timelineCount = 0,
  extraActions,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setActiveClientId, activeClientId } = useActiveClient();

  // Dialog states
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const c = client;

  const clientId: string = c.id;
  const displayId: string | null = c.display_id ?? null;
  const clientName: string = c.full_name ?? c.name ?? "Cliente";
  const isArchived: boolean = c.status === "archived" || c.deleted_at != null;
  const source: string | null = c.source ?? null;
  const isPublicCapture = source === "public_capture";
  const aiExtracted: boolean | null = c.ai_extracted ?? null;

  const personType: "PF" | "PJ" | null = c.person_type ?? null;
  const rawDoc: string | null = personType === "PJ" ? (c.cnpj ?? null) : (c.cpf ?? null);
  const document: string | null = formatCpfCnpj(rawDoc, personType);

  const phone: string | null = c.phone ?? null;
  const email: string | null = c.email ?? null;

  const handleArchive = async () => {
    setArchiveLoading(true);
    try {
      const { error } = await supabase.rpc("archive_client", {
        p_client_id: clientId,
        p_reason: "Arquivado via menu de ações",
      });
      if (error) throw error;
      toast({ title: "Cliente arquivado", description: `${clientName} foi arquivado com sucesso.` });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      onArchived?.();
    } catch (err: any) {
      toast({ title: "Erro ao arquivar", description: err.message, variant: "destructive" });
    } finally {
      setArchiveLoading(false);
      setArchiveOpen(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const { data, error } = await supabase.rpc("hard_delete_client", { p_client_id: clientId });
      if (error) throw error;
      
      // Verificar resposta lógica da função
      if (data && typeof data === "object" && "success" in data && data.success === false) {
        throw new Error((data as Record<string, unknown>).error as string || "Erro ao excluir cliente");
      }
      
      toast({ title: "Cliente excluído", description: `${clientName} foi excluído permanentemente.` });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      onDeleted?.();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    } finally {
      setDeleteLoading(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="border-b border-border bg-card">
      {/* Linha 1 + Linha 2 */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          {/* Left side */}
          <div className="flex items-start gap-3 min-w-0">
            {showBackButton && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={onBack}
                type="button"
                aria-label="Voltar"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}

            <div className="min-w-0">
              {/* Linha 1: Nome + ID + Status + Tipo */}
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <h2 className="text-lg md:text-xl font-semibold truncate text-card-foreground">
                  {clientName}
                </h2>
                {displayId && (
                  <span className="shrink-0 text-xs font-semibold text-white bg-gradient-to-r from-slate-700 to-slate-600 px-2.5 py-1 rounded-md shadow-sm border border-slate-500/30">
                    {displayId}
                  </span>
                )}

                <Badge variant={isArchived ? "secondary" : "default"} className="shrink-0">
                  {isArchived ? "Arquivado" : "Ativo"}
                </Badge>

                {personType && (
                  <Badge variant="outline" className="shrink-0">
                    {personType === "PJ" ? "PJ" : "PF"}
                  </Badge>
                )}
              </div>

              {/* Linha 2: Badges de origem (Captação Online / Dados via IA) */}
              {(isPublicCapture || aiExtracted) && (
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  {isPublicCapture && (
                    <Badge variant="secondary" className="shrink-0 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/50">
                      <Globe className="h-3 w-3 mr-1" />
                      Captação Online
                    </Badge>
                  )}

                  {aiExtracted && (
                    <Badge variant="outline" className="shrink-0 gap-1 text-xs bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-700/50">
                      <Sparkles className="h-3 w-3" />
                      Dados via IA
                    </Badge>
                  )}
                </div>
              )}

              {/* Linha 3: Metadados */}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {document && (
                  <span className="rounded-md bg-muted/50 px-2 py-0.5 font-mono">
                    {personType === "PJ" ? "CNPJ: " : "CPF: "}{document}
                  </span>
                )}

                {phone && (
                  <ClickablePhone phone={phone} className="text-muted-foreground" />
                )}

                {email && (
                  <ClickableEmail email={email} className="text-muted-foreground truncate max-w-[260px]" />
                )}
              </div>
            </div>
          </div>

          {/* Right side: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Athena — set as active client */}
            <Button
              variant={activeClientId === clientId ? "default" : "outline"}
              size="sm"
              className={`hidden sm:inline-flex gap-1.5 ${activeClientId === clientId ? "bg-teal-600 hover:bg-teal-700 text-white" : "border-teal-200 text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-400 dark:hover:bg-teal-950/30"}`}
              onClick={() => {
                if (activeClientId === clientId) {
                  setActiveClientId(null);
                  toast({ title: "Athena", description: "Modo cliente desativado." });
                } else {
                  setActiveClientId(clientId);
                  toast({ title: "Athena", description: `Modo cliente ativado para ${clientName}.` });
                }
              }}
              type="button"
              title={activeClientId === clientId ? "Desativar modo cliente na Athena" : "Ativar Athena para este cliente"}
            >
              <Brain className="h-4 w-4" />
              {activeClientId === clientId ? "Athena ativa" : "Athena"}
            </Button>

            {extraActions}

            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={onEdit}
              type="button"
            >
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem
                  onClick={() => setArchiveOpen(true)}
                  className="cursor-pointer"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Arquivar cliente
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteOpen(true)}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir cliente
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Linha 3: Tabs */}
      {onTabChange && (
        <div className="px-4">
          <ClientTabs
            value={activeTab}
            onValueChange={onTabChange}
            casesCount={casesCount}
            docsCount={docsCount}
            filesCount={filesCount}
            timelineCount={timelineCount}
          />
        </div>
      )}

      {/* Archive Dialog */}
      <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja arquivar <strong>{clientName}</strong>? O cliente será movido para a lista de arquivados e poderá ser restaurado posteriormente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={archiveLoading}>
              {archiveLoading ? "Arquivando..." : "Arquivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente permanentemente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é <strong>irreversível</strong>. Todos os dados de <strong>{clientName}</strong> serão excluídos permanentemente, incluindo casos, documentos e arquivos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLoading ? "Excluindo..." : "Excluir permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
