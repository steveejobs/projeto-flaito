import { supabase } from "@/integrations/supabase/client";

export type LeadActivityType = 
  | 'stage_change' 
  | 'status_change' 
  | 'note' 
  | 'automation_move' 
  | 'archive' 
  | 'trash' 
  | 'restore' 
  | 'conversion'
  | 'duplicate_detected'
  | 'duplicate_dismissed'
  | 'duplicate_confirmed';

export type ActionOrigin = 'manual' | 'automation' | 'system';

interface LogActivityParams {
  leadId: string;
  officeId: string;
  type: LeadActivityType;
  description: string;
  previousStage?: string;
  currentStage?: string;
  metadata?: any;
  ruleId?: string;
  triggerData?: any;
  origin?: ActionOrigin;
  actorId?: string;
}

export class LeadAuditService {
  /**
   * Registra uma atividade estruturada no histórico do lead.
   */
  static async logActivity({
    leadId,
    officeId,
    type,
    description,
    previousStage,
    currentStage,
    metadata = {},
    ruleId,
    triggerData = {},
    origin = 'manual',
    actorId
  }: LogActivityParams) {
    try {
      // Se não houver actorId, tenta pegar do usuário logado
      let finalActorId = actorId;
      if (!finalActorId) {
        const { data: { user } } = await supabase.auth.getUser();
        finalActorId = user?.id;
      }

      const { error } = await supabase
        .from('crm_activities')
        .insert({
          lead_id: leadId,
          office_id: officeId,
          activity_type: type,
          description,
          previous_stage: previousStage,
          current_stage: currentStage,
          metadata,
          actor_id: finalActorId,
          rule_id: ruleId,
          trigger_data: triggerData,
          action_origin: origin
        });

      if (error) {
        console.error('Erro ao registrar auditoria de lead:', error);
        throw error;
      }
    } catch (err) {
      console.error('Falha crítica no LeadAuditService:', err);
    }
  }

  /**
   * Helper para registrar mudanças automáticas (IA/Regras)
   */
  static async logAutomationMove(params: Omit<LogActivityParams, 'type' | 'origin'>) {
    return this.logActivity({
      ...params,
      type: 'automation_move',
      origin: 'automation'
    });
  }
}
