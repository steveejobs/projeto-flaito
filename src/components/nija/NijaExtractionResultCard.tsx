// src/components/nija/NijaExtractionResultCard.tsx
// NIJA Extraction Result Card - Display pure EPROC extraction results

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  FileSearch, 
  Copy, 
  Check, 
  FileText, 
  Users, 
  Calendar,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Scale,
  Key,
  Shield,
  Star,
  Bell,
  Link2,
  Bookmark,
} from "lucide-react";
import { 
  type EprocExtractionResult, 
  FRASE_FINAL_EXTRACAO,
  PLACEHOLDER_NAO_IDENTIFICADO,
  formatExtractionForDisplay,
  type BookmarkExtractionResult,
} from "@/nija";
import { useToast } from "@/hooks/use-toast";
import { NijaDocumentNavigator } from "./NijaDocumentNavigator";

export interface NijaExtractionResultCardProps {
  extractionResult: EprocExtractionResult | null;
  bookmarkResult?: BookmarkExtractionResult | null;
  isLoading?: boolean;
  onNavigateToPage?: (pageNumber: number) => void;
}

export function NijaExtractionResultCard({
  extractionResult,
  bookmarkResult,
  isLoading = false,
  onNavigateToPage,
}: NijaExtractionResultCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);
  const [showAllEvents, setShowAllEvents] = React.useState(false);
  const [currentPage, setCurrentPage] = React.useState(1);

  if (!extractionResult && !isLoading) {
    return null;
  }

  const handleCopy = async () => {
    if (!extractionResult) return;
    
    const text = formatExtractionForDisplay(extractionResult);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copiado!", description: "Dados da extração copiados para a área de transferência." });
    setTimeout(() => setCopied(false), 2000);
  };

  const isPlaceholder = (value: string) => value === PLACEHOLDER_NAO_IDENTIFICADO;

  // Show first 10 events by default
  const eventsToShow = showAllEvents 
    ? extractionResult?.eventos || []
    : (extractionResult?.eventos || []).slice(0, 10);
  const hasMoreEvents = (extractionResult?.eventos?.length || 0) > 10;

  return (
    <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <FileSearch className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Extração EPROC Concluída
                <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600">
                  SEM IA
                </Badge>
              </CardTitle>
              <CardDescription>
                Dados estruturados extraídos literalmente dos documentos
              </CardDescription>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-2"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : "Copiar tudo"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
            <span className="ml-3 text-sm text-muted-foreground">Extraindo dados...</span>
          </div>
        ) : extractionResult ? (
          <>
            {/* Capa do Processo */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-600" />
                <h3 className="font-medium text-sm">Capa do Processo</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 rounded-lg bg-card/50 border">
                <div>
                  <span className="text-xs text-muted-foreground">Número CNJ</span>
                  <p className={`text-sm font-mono ${isPlaceholder(extractionResult.capa.numeroCnj) ? "text-muted-foreground italic" : ""}`}>
                    {extractionResult.capa.numeroCnj}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Classe da Ação</span>
                  <p className={`text-sm ${isPlaceholder(extractionResult.capa.classeAcao) ? "text-muted-foreground italic" : ""}`}>
                    {extractionResult.capa.classeAcao}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Tipo de Ação</span>
                  <p className={`text-sm ${isPlaceholder(extractionResult.capa.tipoAcao) ? "text-muted-foreground italic" : ""}`}>
                    {extractionResult.capa.tipoAcao}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Data de Autuação</span>
                  <p className={`text-sm ${isPlaceholder(extractionResult.capa.dataAutuacao) ? "text-muted-foreground italic" : ""}`}>
                    {extractionResult.capa.dataAutuacao}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Vara/Juízo</span>
                  <p className={`text-sm ${isPlaceholder(extractionResult.capa.varaJuizo) ? "text-muted-foreground italic" : ""}`}>
                    {extractionResult.capa.varaJuizo}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Órgão Julgador</span>
                  <p className={`text-sm ${isPlaceholder(extractionResult.capa.orgaoJulgador) ? "text-muted-foreground italic" : ""}`}>
                    {extractionResult.capa.orgaoJulgador}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Juiz</span>
                  <p className={`text-sm ${isPlaceholder(extractionResult.capa.juiz) ? "text-muted-foreground italic" : ""}`}>
                    {extractionResult.capa.juiz}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Comarca</span>
                  <p className={`text-sm ${isPlaceholder(extractionResult.capa.comarca) ? "text-muted-foreground italic" : ""}`}>
                    {extractionResult.capa.comarca}
                  </p>
                </div>
                {extractionResult.capa.assuntos.length > 0 && (
                  <div className="md:col-span-2">
                    <span className="text-xs text-muted-foreground">Assuntos</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {extractionResult.capa.assuntos.map((a, idx) => (
                        <Badge key={idx} variant="outline" className="text-[10px]">
                          [{a.codigo}] {a.descricao}{a.principal ? " ★" : ""}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Informações Adicionais */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-amber-600" />
                <h3 className="font-medium text-sm">Informações Adicionais</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 rounded-lg bg-card/50 border">
                {!isPlaceholder(extractionResult.capa.chaveProcesso) && (
                  <div>
                    <span className="text-xs text-muted-foreground">Chave do Processo</span>
                    <p className="text-sm font-mono">{extractionResult.capa.chaveProcesso}</p>
                  </div>
                )}
                <div>
                  <span className="text-xs text-muted-foreground">Justiça Gratuita</span>
                  <p className="text-sm">
                    {extractionResult.capa.justicaGratuita ? (
                      <Badge className="bg-green-500/20 text-green-700 text-[10px]">✓ Sim</Badge>
                    ) : (
                      <span className="text-muted-foreground">Não</span>
                    )}
                  </p>
                </div>
                {extractionResult.capa.prioridadeAtendimento && (
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-yellow-500" />
                    <span className="text-xs">Prioridade de Atendimento</span>
                  </div>
                )}
                {extractionResult.capa.segredoJustica && (
                  <div className="flex items-center gap-1">
                    <Shield className="h-3 w-3 text-red-500" />
                    <span className="text-xs text-red-600">Segredo de Justiça</span>
                  </div>
                )}
                {extractionResult.capa.antecipacaoTutela && (
                  <div className="flex items-center gap-1">
                    <Bell className="h-3 w-3 text-orange-500" />
                    <span className="text-xs">Antecipação de Tutela</span>
                  </div>
                )}
                {extractionResult.capa.peticaoUrgente && (
                  <div className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                    <span className="text-xs text-red-600">Petição Urgente</span>
                  </div>
                )}
                {extractionResult.capa.processosApensos.length > 0 && (
                  <div className="md:col-span-4">
                    <div className="flex items-center gap-1 mb-1">
                      <Link2 className="h-3 w-3 text-blue-500" />
                      <span className="text-xs text-muted-foreground">Processos Apensos</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {extractionResult.capa.processosApensos.map((cnj, idx) => (
                        <Badge key={idx} variant="outline" className="text-[10px] font-mono">
                          {cnj}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Advogado */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-amber-600" />
                <h3 className="font-medium text-sm">Advogado</h3>
                {extractionResult.advogado.emCausaPropria && (
                  <Badge variant="outline" className="text-[10px]">em causa própria</Badge>
                )}
              </div>
              <div className="p-3 rounded-lg bg-card/50 border">
                <p className={`text-sm font-medium ${isPlaceholder(extractionResult.advogado.formatado) ? "text-muted-foreground italic" : ""}`}>
                  {extractionResult.advogado.formatado}
                </p>
                {extractionResult.advogado.oabs.length > 1 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium">Outros advogados:</span>
                    <ul className="mt-1 space-y-0.5">
                      {extractionResult.advogado.oabs.slice(1).map((oab, idx) => (
                        <li key={idx}>
                          {oab.nome ? `${oab.nome} — ` : ""}OAB {oab.oabUf} {oab.oabNumero}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Partes */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-amber-600" />
                <h3 className="font-medium text-sm">Partes</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 rounded-lg bg-card/50 border">
                {extractionResult.peticaoInicial.partesNeutras ? (
                  <div className="md:col-span-2">
                    <span className="text-xs text-muted-foreground">Partes (sem classificação)</span>
                    <p className="text-sm">{extractionResult.peticaoInicial.partesNeutras}</p>
                  </div>
                ) : extractionResult.meta.camposAusentes.includes("partes") ? (
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground italic">
                      Partes não identificadas no recorte atual
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tente anexar a capa completa ou a petição inicial do EPROC.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="text-xs text-muted-foreground">Autor(es)</span>
                      {extractionResult.peticaoInicial.autoresDetalhados.length > 0 ? (
                        <div className="space-y-1 mt-1">
                          {extractionResult.peticaoInicial.autoresDetalhados.map((autor, idx) => (
                            <div key={idx} className="text-sm">
                              <p className="font-medium">{autor.nome}</p>
                              {autor.documento && (
                                <p className="text-xs text-muted-foreground">
                                  {autor.tipo === "PF" ? "CPF" : "CNPJ"}: {autor.documento}
                                </p>
                              )}
                              {autor.procuradores && autor.procuradores.length > 0 && (
                                <p className="text-xs text-blue-600">
                                  Adv: {autor.procuradores.map(p => `${p.nome} (OAB ${p.oab})`).join("; ")}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          {PLACEHOLDER_NAO_IDENTIFICADO}
                        </p>
                      )}
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Réu(s)</span>
                      {extractionResult.peticaoInicial.reusDetalhados.length > 0 ? (
                        <div className="space-y-1 mt-1">
                          {extractionResult.peticaoInicial.reusDetalhados.map((reu, idx) => (
                            <div key={idx} className="text-sm">
                              <p className="font-medium">{reu.nome}</p>
                              {reu.documento && (
                                <p className="text-xs text-muted-foreground">
                                  {reu.tipo === "PF" ? "CPF" : "CNPJ"}: {reu.documento}
                                </p>
                              )}
                              {reu.procuradores && reu.procuradores.length > 0 && (
                                <p className="text-xs text-blue-600">
                                  Adv: {reu.procuradores.map(p => `${p.nome} (OAB ${p.oab})`).join("; ")}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          {PLACEHOLDER_NAO_IDENTIFICADO}
                        </p>
                      )}
                    </div>
                  </>
                )}
                <div className="md:col-span-2">
                  <span className="text-xs text-muted-foreground">Valor da Causa</span>
                  <p className={`text-sm ${isPlaceholder(extractionResult.peticaoInicial.valorDaCausa) ? "text-muted-foreground italic" : ""}`}>
                    {extractionResult.peticaoInicial.valorDaCausa}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Timeline de Eventos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-amber-600" />
                  <h3 className="font-medium text-sm">Linha do Tempo (Eventos Processuais)</h3>
                  <Badge variant="outline" className="text-[10px]">
                    {extractionResult.eventos.length} {extractionResult.eventos.length === 1 ? "evento" : "eventos"}
                  </Badge>
                </div>
              </div>

              {extractionResult.eventos.length === 0 ? (
                <div className="p-4 rounded-lg bg-muted/30 border border-dashed">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-sm italic">Nenhum evento identificado nos documentos analisados.</p>
                  </div>
                </div>
              ) : (
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-2 pr-3">
                    {eventsToShow.map((evento, idx) => (
                      <div 
                        key={idx} 
                        className="p-3 rounded-lg bg-card/50 border border-l-4 border-l-amber-500/50"
                      >
                        {/* Linha 1: Evento N — data hora — código */}
                        <div className="flex flex-wrap items-center gap-2 mb-1 text-sm font-medium">
                          <span className="text-foreground">
                            Evento {evento.numeroEvento ?? (idx + 1)}
                          </span>
                          {/* Only show separator and date if we have a valid date */}
                          {evento.data && evento.data !== PLACEHOLDER_NAO_IDENTIFICADO && evento.data !== "undefined" && (
                            <>
                              <span className="text-muted-foreground">—</span>
                              <span className="text-muted-foreground">
                                {evento.data}
                                {evento.hora && ` ${evento.hora}`}
                              </span>
                            </>
                          )}
                          {evento.codigoTjto && (
                            <>
                              <span className="text-muted-foreground">—</span>
                              <Badge variant="outline" className="text-[10px]">
                                {evento.codigoTjto}
                              </Badge>
                            </>
                          )}
                        </div>
                        
                        {/* Linha 2+: descricaoLiteral */}
                        <p className="text-sm text-foreground mt-1">
                          {evento.descricaoLiteral}
                        </p>
                        
                        {/* Linha final: documentoVinculado (se existir) */}
                        {evento.documentoVinculado && (
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                            📎 {evento.documentoVinculado}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {hasMoreEvents && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllEvents(!showAllEvents)}
                  className="w-full gap-2"
                >
                  {showAllEvents ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Mostrar menos
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Mostrar todos ({extractionResult.eventos.length} {extractionResult.eventos.length === 1 ? "evento" : "eventos"})
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Documentos Identificados via Marcadores do PDF */}
            {bookmarkResult?.hasBookmarks && bookmarkResult.documentos.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Bookmark className="h-4 w-4 text-primary" />
                    <h3 className="font-medium text-sm">Documentos Identificados via Marcadores</h3>
                    <Badge className="bg-primary/20 text-primary text-[10px]">
                      ALTO
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {bookmarkResult.documentos.length} {bookmarkResult.documentos.length === 1 ? "documento" : "documentos"}
                    </Badge>
                  </div>
                  
                  <NijaDocumentNavigator
                    bookmarkResult={bookmarkResult}
                    currentPage={currentPage}
                    onNavigate={(page) => {
                      setCurrentPage(page);
                      onNavigateToPage?.(page);
                    }}
                    isCollapsible={true}
                    defaultOpen={false}
                    maxVisibleItems={10}
                  />
                </div>
              </>
            )}

            {/* Metadados */}
            <Separator />
            
            <div className="p-3 rounded-lg bg-muted/30 border">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Metadados da Extração</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Data:</span>
                  <p>{new Date(extractionResult.meta.dataExtracao).toLocaleString("pt-BR")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Eventos:</span>
                  <p>{extractionResult.meta.totalEventos}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Peças:</span>
                  <p>{extractionResult.meta.totalPecas}</p>
                </div>
                {extractionResult.meta.camposAusentes.length > 0 && (
                  <div className="col-span-2 md:col-span-4">
                    <span className="text-muted-foreground">Campos ausentes:</span>
                    <p className="text-amber-600">{extractionResult.meta.camposAusentes.join(", ")}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Frase final obrigatória */}
            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <p className="text-xs text-center text-muted-foreground italic">
                {FRASE_FINAL_EXTRACAO}
              </p>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

NijaExtractionResultCard.displayName = "NijaExtractionResultCard";
