import { supabase } from "@/integrations/supabase/client";
import { LeadAuditService } from "./leadAuditService";

export class LeadLifecycleService {
  /**
   * Move um lead para o arquivo.
   */
  static async archiveLead(leadId: string, officeId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('crm_leads')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
        archived_by: user?.id
      })
      .eq('id', leadId)
      .eq('office_id', officeId);

    if (error) throw error;

    await LeadAuditService.logActivity({
      leadId,
      officeId,
      type: 'archive',
      description: 'Lead movido para o arquivo.',
      origin: 'manual'
    });
  }

  /**
   * Move um lead para a lixeira (Soft Delete).
   */
  static async trashLead(leadId: string, officeId: string) {
    const { data: lead } = await supabase
      .from('crm_leads')
      .select('pipeline_stage')
      .eq('id', leadId)
      .single();

    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('crm_leads')
      .update({
        status: 'trashed',
        deleted_at: new Date().toISOString(),
        deleted_by: user?.id,
        previous_pipeline_stage: lead?.pipeline_stage // Salva para restauração
      })
      .eq('id', leadId)
      .eq('office_id', officeId);

    if (error) throw error;

    await LeadAuditService.logActivity({
      leadId,
      officeId,
      type: 'trash',
      description: 'Lead movido para a lixeira.',
      origin: 'manual',
      previousStage: lead?.pipeline_stage
    });
  }

  /**
   * Restaura um lead da lixeira ou do arquivo para o estado ativo.
   */
  static async restoreLead(leadId: string, officeId: string) {
    const { data: lead } = await supabase
      .from('crm_leads')
      .select('previous_pipeline_stage, status')
      .eq('id', leadId)
      .single();

    const { data: { user } } = await supabase.auth.getUser();
    
    const updates: any = {
      status: 'active',
      deleted_at: null,
      deleted_by: null,
      archived_at: null,
      archived_by: null,
      restored_at: new Date().toISOString(),
      restored_by: user?.id
    };

    // Se houver um estágio salvo, volta para ele
    if (lead?.previous_pipeline_stage) {
      updates.pipeline_stage = lead.previous_pipeline_stage;
    }

    const { error } = await supabase
      .from('crm_leads')
      .update(updates)
      .eq('id', leadId)
      .eq('office_id', officeId);

    if (error) throw error;

    await LeadAuditService.logActivity({
      leadId,
      officeId,
      type: 'restore',
      description: `Lead restaurado de ${lead?.status}.`,
      origin: 'manual',
      currentStage: updates.pipeline_stage
    });
  }

  /**
   * Marca lead como convertido.
   */
  static async convertToClient(leadId: string, officeId: string, clientId?: string) {
    const { error } = await supabase
      .from('crm_leads')
      .update({
        status: 'converted',
        pipeline_stage: 'fechado',
        client_id: clientId
      })
      .eq('id', leadId)
      .eq('office_id', officeId);

    if (error) throw error;

    await LeadAuditService.logActivity({
      leadId,
      officeId,
      type: 'conversion',
      description: 'Lead convertido em cliente com sucesso.',
      currentStage: 'fechado',
      metadata: { client_id: clientId }
    });
  }
}
