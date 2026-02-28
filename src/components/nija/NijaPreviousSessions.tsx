// src/components/nija/NijaPreviousSessions.tsx
// Card para exibir sessões anteriores de análise NIJA

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  History,
  Trash2,
  FileText,
  Check,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  listRecentSessions,
  deleteNijaSession,
  type NijaSessionRow,
} from "@/services/nijaSession";
import { cn } from "@/lib/utils";

interface NijaPreviousSessionsProps {
  officeId: string | null;
  currentDocumentsHash: string | null;
  onLoadSession: (session: NijaSessionRow) => void;
  onSessionDeleted?: () => void;
}

export function NijaPreviousSessions({
  officeId,
  currentDocumentsHash,
  onLoadSession,
  onSessionDeleted,
}: NijaPreviousSessionsProps) {
  const [sessions, setSessions] = useState<NijaSessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Carregar sessões ao expandir
  useEffect(() => {
    if (isExpanded && officeId) {
      loadSessions();
    }
  }, [isExpanded, officeId]);

  const loadSessions = async () => {
    if (!officeId) return;
    setLoading(true);
    try {
      const data = await listRecentSessions(officeId, 10);
      setSessions(data);
    } catch (err) {
      console.error("[NijaPreviousSessions] Erro ao carregar:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (sessionId: string) => {
    setDeletingId(sessionId);
    try {
      const success = await deleteNijaSession(sessionId);
      if (success) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        onSessionDeleted?.();
      }
    } catch (err) {
      console.error("[NijaPreviousSessions] Erro ao deletar:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const isCurrentSession = (session: NijaSessionRow) => {
    return currentDocumentsHash && session.documents_hash === currentDocumentsHash;
  };

  if (!officeId) return null;

  return (
    <Card className="border-dashed">
      <CardHeader className="py-3 px-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            Análises anteriores
          </CardTitle>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 px-4 pb-4">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma análise anterior encontrada
            </p>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {sessions.map((session) => {
                  const isCurrent = isCurrentSession(session);
                  const documentNames = Array.isArray(session.document_names)
                    ? session.document_names
                    : [];

                  return (
                    <div
                      key={session.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                        isCurrent
                          ? "bg-primary/5 border-primary/30"
                          : "bg-card hover:bg-muted/50"
                      )}
                    >
                      {/* Ícone */}
                      <div className="flex-shrink-0 mt-0.5">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {session.cnj_number && (
                            <span className="text-xs font-mono text-foreground">
                              {session.cnj_number}
                            </span>
                          )}
                          {isCurrent && (
                            <Badge variant="secondary" className="text-[10px]">
                              <Check className="h-3 w-3 mr-1" />
                              Atual
                            </Badge>
                          )}
                          {session.case_id && (
                            <Badge variant="outline" className="text-[10px]">
                              Caso criado
                            </Badge>
                          )}
                        </div>

                        {/* Nomes dos arquivos */}
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          {documentNames.length > 0
                            ? documentNames.slice(0, 2).join(", ") +
                              (documentNames.length > 2 ? ` +${documentNames.length - 2}` : "")
                            : session.client_name || "Sem identificação"}
                        </p>

                        {/* Data */}
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {formatDistanceToNow(new Date(session.updated_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!isCurrent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={() => onLoadSession(session)}
                          >
                            <RefreshCw className="h-3.5 w-3.5 mr-1" />
                            Carregar
                          </Button>
                        )}

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              disabled={deletingId === session.id}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir análise?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. A sessão de análise será
                                removida permanentemente do histórico.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(session.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* Aviso de sessão idêntica */}
          {currentDocumentsHash && sessions.some(s => s.documents_hash === currentDocumentsHash) && (
            <div className="mt-3 flex items-start gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Os documentos atuais já foram analisados anteriormente. Você pode carregar
                a análise existente ou executar uma nova.
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

NijaPreviousSessions.displayName = "NijaPreviousSessions";
