/**
 * NIJA Document Navigator
 * UI component for navigating through documents identified via PDF bookmarks
 */

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  Bookmark,
  FileSearch,
  Scale,
  MessageSquare,
  Paperclip,
  Gavel,
  Send,
  Check,
} from "lucide-react";
import { type EprocDocumentBookmark, type BookmarkExtractionResult } from "@/nija/connectors/pdf/pdfBookmarkExtractor";
import { type DocumentNature } from "@/nija/extraction/eventSegments";

// ============================================================
// TYPES
// ============================================================

export interface NijaDocumentNavigatorProps {
  bookmarkResult: BookmarkExtractionResult | null;
  currentPage?: number;
  onNavigate?: (pageNumber: number, documento: EprocDocumentBookmark) => void;
  isCollapsible?: boolean;
  defaultOpen?: boolean;
  maxVisibleItems?: number;
}

// ============================================================
// NATURE ICONS & COLORS
// Available DocumentNature: peticao, decisao, comunicacao, prova, sistemico, procuracao, anexo
// ============================================================

const NATURE_CONFIG: Record<DocumentNature, { icon: React.ElementType; color: string; label: string }> = {
  peticao: { icon: FileText, color: "bg-primary/20 text-primary border-primary/30", label: "Petição" },
  procuracao: { icon: Scale, color: "bg-secondary/20 text-secondary-foreground border-secondary/30", label: "Procuração" },
  decisao: { icon: Gavel, color: "bg-accent/20 text-accent-foreground border-accent/30", label: "Decisão" },
  comunicacao: { icon: Send, color: "bg-muted text-muted-foreground border-muted", label: "Comunicação" },
  prova: { icon: FileSearch, color: "bg-primary/10 text-primary border-primary/20", label: "Prova" },
  sistemico: { icon: MessageSquare, color: "bg-muted text-muted-foreground border-muted", label: "Sistêmico" },
  anexo: { icon: Paperclip, color: "bg-muted/50 text-muted-foreground border-muted", label: "Anexo" },
};

// ============================================================
// COMPONENT
// ============================================================

export function NijaDocumentNavigator({
  bookmarkResult,
  currentPage,
  onNavigate,
  isCollapsible = true,
  defaultOpen = true,
  maxVisibleItems = 20,
}: NijaDocumentNavigatorProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const [showAll, setShowAll] = React.useState(false);
  
  // Count by type - moved before early return to satisfy hooks rules
  const typeCounts = React.useMemo(() => {
    if (!bookmarkResult || !bookmarkResult.documentos) return {};
    const counts: Record<string, number> = {};
    for (const doc of bookmarkResult.documentos) {
      const nature = doc.tipoDocumentoNormalizado;
      counts[nature] = (counts[nature] || 0) + 1;
    }
    return counts;
  }, [bookmarkResult]);
  
  // No bookmarks available
  if (!bookmarkResult || !bookmarkResult.hasBookmarks || bookmarkResult.documentos.length === 0) {
    return null;
  }
  
  const { documentos, cnj, totalPages } = bookmarkResult;
  
  // Find current document based on page
  const currentDoc = currentPage
    ? documentos.find(d => 
        d.pageEnd !== null 
          ? currentPage >= d.pageStart && currentPage <= d.pageEnd
          : currentPage >= d.pageStart
      )
    : null;
  
  // Limit visible items unless showing all
  const visibleDocs = showAll ? documentos : documentos.slice(0, maxVisibleItems);
  const hasMoreDocs = documentos.length > maxVisibleItems;
  
  const content = (
    <CardContent className="p-0">
      {/* Stats row */}
      <div className="flex flex-wrap gap-1 px-3 py-2 border-b bg-muted/30">
        {Object.entries(typeCounts).map(([nature, count]) => {
          const config = NATURE_CONFIG[nature as DocumentNature] || NATURE_CONFIG.anexo;
          return (
            <Badge 
              key={nature} 
              variant="outline" 
              className={`text-[10px] ${config.color}`}
            >
              {config.label}: {count}
            </Badge>
          );
        })}
      </div>
      
      {/* Document list */}
      <ScrollArea className="max-h-[400px]">
        <div className="p-2 space-y-1">
          {visibleDocs.map((doc, idx) => {
            const config = NATURE_CONFIG[doc.tipoDocumentoNormalizado] || NATURE_CONFIG.anexo;
            const IconComponent = config.icon;
            const isCurrentDoc = currentDoc && doc.eventoNumero === currentDoc.eventoNumero && doc.docNumero === currentDoc.docNumero;
            
            return (
              <button
                key={`${doc.eventoNumero}-${doc.docNumero}-${idx}`}
                onClick={() => onNavigate?.(doc.pageStart, doc)}
                className={`
                  w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors
                  hover:bg-accent/50 group
                  ${isCurrentDoc ? "bg-primary/10 border border-primary/30" : ""}
                `}
              >
                {/* Icon */}
                <div className={`
                  flex-shrink-0 h-7 w-7 rounded-md flex items-center justify-center
                  ${config.color}
                `}>
                  <IconComponent className="h-3.5 w-3.5" />
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {!doc.isCapa && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        E{doc.eventoNumero}.{doc.docNumero}
                      </span>
                    )}
                    <span className="text-sm font-medium truncate">
                      {doc.tipoDocumento}
                    </span>
                    {isCurrentDoc && (
                      <Check className="h-3 w-3 text-primary flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {doc.pageCount !== null ? (
                      <>Pág. {doc.pageStart}{doc.pageEnd && doc.pageEnd !== doc.pageStart ? `–${doc.pageEnd}` : ""} ({doc.pageCount} {doc.pageCount === 1 ? "página" : "páginas"})</>
                    ) : (
                      <>Pág. {doc.pageStart}</>
                    )}
                  </div>
                </div>
                
                {/* Confidence badge */}
                <Badge 
                  variant="outline" 
                  className="text-[9px] bg-primary/10 text-primary border-primary/30 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ALTO
                </Badge>
              </button>
            );
          })}
          
          {/* Show more button */}
          {hasMoreDocs && !showAll && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(true)}
              className="w-full text-xs text-muted-foreground"
            >
              Ver mais {documentos.length - maxVisibleItems} documentos
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
          )}
          
          {showAll && hasMoreDocs && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAll(false)}
              className="w-full text-xs text-muted-foreground"
            >
              Ver menos
              <ChevronUp className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </ScrollArea>
    </CardContent>
  );
  
  if (!isCollapsible) {
    return (
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bookmark className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                Documentos via Marcadores
                <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30">
                  {documentos.length} docs
                </Badge>
              </CardTitle>
              {cnj && (
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  {cnj}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        {content}
      </Card>
    );
  }
  
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-accent/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bookmark className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    Documentos via Marcadores
                    <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30">
                      {documentos.length} docs
                    </Badge>
                    <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30">
                      {totalPages} págs
                    </Badge>
                  </CardTitle>
                  {cnj && (
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      {cnj}
                    </p>
                  )}
                </div>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {content}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
