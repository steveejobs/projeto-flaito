import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  MessageSquare, 
  Send, 
  X, 
  AlertCircle, 
  Zap, 
  Lightbulb,
  Bug,
  ShieldAlert
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';

interface OperatorFeedbackButtonProps {
  incidentId?: string;
  module?: string;
}

export default function OperatorFeedbackButton({ incidentId, module }: OperatorFeedbackButtonProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>('pain_point');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);
  const location = useLocation();

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error('Por favor, descreva seu feedback');
      return;
    }

    setSending(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Não autenticado');

      // Auto-capture context
      const { error } = await supabase.from('operator_feedback').insert({
        user_id: session.session.user.id,
        feedback_type: type,
        description,
        module: module || location.pathname.split('/')[1] || 'general',
        page_url: window.location.href,
        incident_id: incidentId,
        metadata: {
            ua: navigator.userAgent,
            ts: new Date().toISOString()
        }
      });

      if (error) throw error;

      toast.success('Feedback enviado. Obrigado pela sua contribuição!');
      setOpen(false);
      setDescription('');
    } catch (err: any) {
      toast.error('Erro ao enviar feedback: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-24 h-12 w-12 rounded-full shadow-2xl bg-primary hover:bg-primary/90 border-2 border-white/20 z-50 group transition-all hover:scale-110"
        size="icon"
      >
        <MessageSquare className="h-6 w-6 text-white group-hover:rotate-12 transition-transform" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-white/10">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tighter flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              FEEDBACK DO OPERADOR
            </DialogTitle>
            <DialogDescription className="text-xs font-medium uppercase tracking-widest opacity-60">
                Ajude-nos a fechar o ciclo de aprendizado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground">Tipo de Feedback</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="bg-background border-white/5 h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pain_point" className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 mr-2 inline text-amber-500" /> Ponto de Dor (Lentidão/UX)
                  </SelectItem>
                  <SelectItem value="bug_report">
                    <Bug className="h-4 w-4 mr-2 inline text-red-500" /> Bug / Falha Técnica
                  </SelectItem>
                  <SelectItem value="improvement_idea">
                    <Lightbulb className="h-4 w-4 mr-2 inline text-primary" /> Sugestão de Melhoria
                  </SelectItem>
                  <SelectItem value="runbook_gap">
                    <ShieldAlert className="h-4 w-4 mr-2 inline text-blue-500" /> Falha no Playbook
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground">Descrição</label>
              <Textarea
                placeholder="O que aconteceu? Como podemos melhorar?"
                className="min-h-[120px] bg-background border-white/5 resize-none"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                className="hover:bg-white/5"
            >
                Cancelar
            </Button>
            <Button 
                onClick={handleSubmit} 
                disabled={sending}
                className="bg-primary text-white font-bold"
            >
              <Send className="h-4 w-4 mr-2" />
              {sending ? 'Enviando...' : 'Enviar Feedback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
