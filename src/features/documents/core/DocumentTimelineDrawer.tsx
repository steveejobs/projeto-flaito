import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, FileText, Upload, Download, Trash2, RotateCcw, PenLine, X, FileSignature, Loader2 } from 'lucide-react';

interface DocumentTimelineDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentTitle?: string;
}

interface DocumentEvent {
  id: string;
  event_type: string;
  message: string | null;
  created_at: string;
  actor_user_id: string | null;
  metadata: unknown;
}

interface SignRequest {
  id: string;
  status: string;
  provider: string | null;
  created_at: string;
  updated_at: string;
}

const eventTypeIcons: Record<string, React.ReactNode> = {
  CREATED: <FileText className="h-4 w-4 text-green-500" />,
  UPDATED: <PenLine className="h-4 w-4 text-blue-500" />,
  UPLOADED: <Upload className="h-4 w-4 text-primary" />,
  DOWNLOADED: <Download className="h-4 w-4 text-primary" />,
  SOFT_DELETED: <Trash2 className="h-4 w-4 text-destructive" />,
  RESTORED: <RotateCcw className="h-4 w-4 text-green-500" />,
  SIGN_REQUESTED: <FileSignature className="h-4 w-4 text-amber-500" />,
};

const eventTypeLabels: Record<string, string> = {
  CREATED: 'Criado',
  UPDATED: 'Atualizado',
  UPLOADED: 'Arquivo enviado',
  DOWNLOADED: 'Download realizado',
  SOFT_DELETED: 'Excluído',
  RESTORED: 'Restaurado',
  SIGN_REQUESTED: 'Assinatura solicitada',
};

const signStatusConfig: Record<string, { label: string; className: string }> = {
  REQUESTED: { label: 'Solicitada', className: 'bg-amber-100 text-amber-700 border-amber-300' },
  SENT: { label: 'Enviada', className: 'bg-blue-100 text-blue-700 border-blue-300' },
  SIGNED: { label: 'Assinada', className: 'bg-green-100 text-green-700 border-green-300' },
  CANCELLED: { label: 'Cancelada', className: 'bg-muted text-muted-foreground border-border' },
  FAILED: { label: 'Falha', className: 'bg-destructive/20 text-destructive border-destructive/30' },
};

export function DocumentTimelineDrawer({
  open,
  onOpenChange,
  documentId,
  documentTitle,
}: DocumentTimelineDrawerProps) {
  const [events, setEvents] = useState<DocumentEvent[]>([]);
  const [signRequests, setSignRequests] = useState<SignRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('timeline');

  useEffect(() => {
    if (open && documentId) {
      fetchData();
    }
  }, [open, documentId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [eventsResult, signResult] = await Promise.all([
        supabase
          .from('document_events')
          .select('*')
          .eq('document_id', documentId)
          .order('created_at', { ascending: false }),
        supabase
          .from('document_sign_requests')
          .select('*')
          .eq('document_id', documentId)
          .order('created_at', { ascending: false }),
      ]);

      if (eventsResult.error) throw eventsResult.error;
      setEvents(eventsResult.data || []);

      if (!signResult.error) {
        setSignRequests(signResult.data || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <DrawerTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Detalhes do Documento
              </DrawerTitle>
              {documentTitle && (
                <DrawerDescription className="truncate max-w-[300px]">
                  {documentTitle}
                </DrawerDescription>
              )}
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <div className="px-4 pt-2">
            <div className="w-full overflow-x-auto no-scrollbar">
              <TabsList className="inline-flex min-w-max gap-2 mb-4 w-full grid-cols-2">
                <TabsTrigger value="timeline" className="flex items-center gap-2 whitespace-nowrap text-xs sm:text-sm">
                  <Clock className="h-4 w-4" />
                  Linha do Tempo
                </TabsTrigger>
                <TabsTrigger value="signatures" className="flex items-center gap-2 whitespace-nowrap text-xs sm:text-sm">
                  <FileSignature className="h-4 w-4" />
                  Assinaturas
                  {signRequests.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1.5">
                      {signRequests.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="timeline" className="mt-0">
            <ScrollArea className="flex-1 p-4 max-h-[55vh]">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum evento registrado para este documento.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {events.map((event, idx) => (
                    <div key={event.id} className="relative flex gap-4">
                      {/* Timeline line */}
                      {idx < events.length - 1 && (
                        <div className="absolute left-[15px] top-8 w-0.5 h-full bg-border" />
                      )}
                      {/* Icon */}
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center z-10">
                        {eventTypeIcons[event.event_type] || <Clock className="h-4 w-4" />}
                      </div>
                      {/* Content */}
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {eventTypeLabels[event.event_type] || event.event_type}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(event.created_at)}
                          </span>
                        </div>
                        {event.message && (
                          <p className="text-sm text-muted-foreground mt-1">{event.message}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="signatures" className="mt-0">
            <ScrollArea className="flex-1 p-4 max-h-[55vh]">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : signRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileSignature className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma solicitação de assinatura para este documento.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {signRequests.map((req) => {
                    const config = signStatusConfig[req.status] || signStatusConfig.REQUESTED;
                    return (
                      <div key={req.id} className="p-3 border rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className={config.className}>
                            {config.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(req.created_at)}
                          </span>
                        </div>
                        <div className="text-sm">
                          <p className="text-muted-foreground">
                            Provedor: <span className="font-medium text-foreground">{req.provider || 'Interno'}</span>
                          </p>
                          {req.updated_at !== req.created_at && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Última atualização: {formatDateTime(req.updated_at)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DrawerContent>
    </Drawer>
  );
}