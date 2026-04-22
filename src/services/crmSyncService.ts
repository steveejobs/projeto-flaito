import { supabase } from "@/integrations/supabase/client";
import { LeadAuditService } from "./leadAuditService";
import { LeadDeduplicationService } from "./leadDeduplicationService";

const STAGES = {
  NOVO_CONTATO: 'novo_contato',
  QUALIFICACAO: 'qualificacao',
  BRIEFING_AGENDADO: 'briefing_agendado',
  PROPOSTA_ENVIADA: 'proposta_enviada',
  FECHADO: 'fechado'
};

export class CrmSyncService {
  /**
   * Ponto de entrada para disparar regras de automação
   */
  async applyAutomationRules(officeId: string) {
    console.log(`[CrmSyncService] Iniciando regras de automação para office: ${officeId}`);
    
    try {
      // 1. Sincronizar novos clientes que ainda não são leads
      await this.syncNewClients(officeId);

      // 2. Verificar agendamentos (Mover para Briefing)
      await this.checkAppointments(officeId);

      // 3. Verificar sessões de inteligência NIJA (Mover para Qualificação)
      await this.checkIntelligenceSessions(officeId);

      console.log(`[CrmSyncService] Automação concluída com sucesso.`);
    } catch (error) {
      console.error(`[CrmSyncService] Erro na automação:`, error);
      throw error;
    }
  }

  /**
   * Regra 1: Sincronização de Clientes Base
   */
  private async syncNewClients(officeId: string) {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, full_name, email, phone')
      .eq('office_id', officeId);

    if (!clients) return;

    for (const client of clients) {
      const { data: existingLead } = await supabase
        .from('crm_leads')
        .select('id')
        .eq('client_id', client.id)
        .maybeSingle();

      if (!existingLead) {
        const { error: insertError } = await supabase
          .from('crm_leads')
          .insert({
            office_id: officeId,
            client_id: client.id,
            full_name: client.full_name,
            email: client.email,
            phone: client.phone,
            source: 'sincronizacao_interna',
            pipeline_stage: STAGES.NOVO_CONTATO,
            status: 'active'
          });

        if (!insertError) {
          console.log(`[CrmSyncService] Novo lead criado via sincronização: ${client.full_name}`);
          
          // Deduplicação Pós-Inserção
          const { data: newLead } = await supabase
            .from('crm_leads')
            .select('id')
            .eq('client_id', client.id)
            .single();

          if (newLead) {
            const matches = await LeadDeduplicationService.checkDuplicity(officeId, {
              full_name: client.full_name,
              email: client.email || undefined,
              phone: client.phone || undefined,
              client_id: client.id
            });

            if (matches.length > 0) {
              await LeadDeduplicationService.persistMatches(officeId, newLead.id, matches);
            }
          }
        }
      }
    }
  }

  /**
   * Regra 2: Movimentação por Agendamento
   * Se houver agendamento futuro ou recente, move para Briefing Agendado
   */
  private async checkAppointments(officeId: string) {
    const { data: appointments } = await supabase
      .from('agenda_medica')
      .select('*')
      .eq('office_id', officeId)
      .gte('data_hora', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Últimas 24h em diante

    if (!appointments) return;

    for (const apt of appointments) {
      if (!apt.paciente_id) continue;

      const { data: lead } = await supabase
        .from('crm_leads')
        .select('id, pipeline_stage, full_name')
        .eq('client_id', apt.paciente_id)
        .eq('status', 'active') // Apenas leads ativos
        .maybeSingle();

      if (lead && lead.pipeline_stage === STAGES.NOVO_CONTATO || lead?.pipeline_stage === STAGES.QUALIFICACAO) {
        const reason = `Agendamento detectado: ${new Date(apt.data_hora).toLocaleString('pt-BR')}`;
        
        const { error } = await supabase
          .from('crm_leads')
          .update({ 
            pipeline_stage: STAGES.BRIEFING_AGENDADO,
            last_automation_run_at: new Date().toISOString(),
            last_automation_source: 'agenda_medica',
            last_automation_reason: reason,
            last_automation_evidence: { appointment_id: apt.id, date: apt.data_hora }
          })
          .eq('id', lead.id);

        if (!error) {
          await LeadAuditService.logAutomationMove({
            leadId: lead.id,
            officeId,
            description: `Automação: Movido para Briefing devido a agendamento.`,
            previousStage: lead.pipeline_stage,
            currentStage: STAGES.BRIEFING_AGENDADO,
            ruleId: 'APPOINTMENT_DETECTED',
            triggerData: { appointment_id: apt.id }
          });
        }
      }
    }
  }

  /**
   * Regra 3: Movimentação por Sessão NIJA
   * Se iniciou uma análise de inteligência, move para Qualificação
   */
  private async checkIntelligenceSessions(officeId: string) {
    const { data: sessions } = await supabase
      .from('nija_sessions')
      .select('*')
      .eq('office_id', officeId)
      .order('created_at', { ascending: false });

    if (!sessions) return;

    for (const session of sessions) {
      if (!session.client_id) continue;

      const { data: lead } = await supabase
        .from('crm_leads')
        .select('id, pipeline_stage')
        .eq('client_id', session.client_id)
        .eq('status', 'active') // Apenas leads ativos
        .maybeSingle();

      if (lead && lead.pipeline_stage === STAGES.NOVO_CONTATO) {
        const reason = 'Análise de inteligência NIJA iniciada pelo sistema.';
        
        const { error } = await supabase
          .from('crm_leads')
          .update({ 
            pipeline_stage: STAGES.QUALIFICACAO,
            last_automation_run_at: new Date().toISOString(),
            last_automation_source: 'nija_sessions',
            last_automation_reason: reason,
            last_automation_evidence: { session_id: session.id }
          })
          .eq('id', lead.id);

        if (!error) {
          await LeadAuditService.logAutomationMove({
            leadId: lead.id,
            officeId,
            description: `Automação: Movido para Qualificação devido a início de análise NIJA.`,
            previousStage: lead.pipeline_stage,
            currentStage: STAGES.QUALIFICACAO,
            ruleId: 'NIJA_SESSION_STARTED',
            triggerData: { session_id: session.id }
          });
        }
      }
    }
  }
}

export const crmSyncService = new CrmSyncService();
