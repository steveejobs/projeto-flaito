import { supabase } from "@/integrations/supabase/client";

export const STAGES = {
  NOVO_CONTATO: 'novo_contato',
  QUALIFICACAO: 'qualificacao',
  BRIEFING_AGENDADO: 'briefing_agendado',
  PROPOSTA_ENVIADA: 'proposta_enviada',
  FECHADO: 'fechado'
} as const;

export type PipelineStage = typeof STAGES[keyof typeof STAGES];

export const crmSyncService = {
  /**
   * Executa as regras de automação para um escritório específico.
   * Pode ser chamado via hook de sincronização ou worker.
   */
  async applyAutomationRules(officeId: string) {
    if (!officeId) return;

    console.log(`[CRM Automation] Verificando regras para office_id: ${officeId}`);

    try {
      // 1. Regra: Novo Contato (Sincronizar clientes novos que não tem lead)
      await this.syncNewClients(officeId);

      // 2. Regra: Briefing Agendado (Se houver agendamento na agenda_medica)
      await this.checkAppointments(officeId);

      // 3. Regra: Qualificação (Se houver sessões de inteligência NIJA)
      await this.checkIntelligenceSessions(officeId);

      console.log(`[CRM Automation] Sincronização concluída.`);
    } catch (error) {
      console.error(`[CRM Automation] Erro:`, error);
    }
  },

  /**
   * Cria leads para clientes que ainda não existem no CRM
   */
  async syncNewClients(officeId: string) {
    // Busca clientes sem leads associados
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, full_name, email, phone')
      .eq('office_id', officeId);

    if (error) throw error;

    for (const client of (clients || [])) {
      // Verifica se já existe lead
      const { data: existingLead } = await supabase
        .from('crm_leads')
        .select('id')
        .eq('client_id', client.id)
        .maybeSingle();

      if (!existingLead) {
        console.log(`[CRM] Criando lead para cliente: ${client.full_name}`);
        
        const { data: newLead, error: insertError } = await supabase
          .from('crm_leads')
          .insert({
            office_id: officeId,
            client_id: client.id,
            full_name: client.full_name,
            email: client.email,
            phone: client.phone,
            pipeline_stage: STAGES.NOVO_CONTATO,
            source: 'Sistema'
          })
          .select()
          .single();

        if (insertError) {
           console.error(`[CRM] Erro ao inserir lead:`, insertError);
           continue;
        }

        await this.logActivity(newLead.id, officeId, {
          type: 'automation_move',
          description: 'Lead criado automaticamente via sincronização de cliente.',
          current_stage: STAGES.NOVO_CONTATO
        });
      }
    }
  },

  /**
   * Move para 'Briefing Agendado' se houver registros na agenda
   */
  async checkAppointments(officeId: string) {
    // Busca leads que ainda não estão em estágios avançados
    const { data: leads } = await supabase
      .from('crm_leads')
      .select('id, client_id, pipeline_stage')
      .eq('office_id', officeId)
      .in('pipeline_stage', [STAGES.NOVO_CONTATO, STAGES.QUALIFICACAO]);

    for (const lead of (leads || [])) {
      if (!lead.client_id) continue;

      // Verifica se tem agendamento
      const { data: appointments } = await supabase
          .from('agenda_medica')
          .select('id')
          .eq('paciente_id', lead.client_id)
          .limit(1);

      if (appointments && appointments.length > 0) {
        console.log(`[CRM] Movendo lead ${lead.id} para Briefing Agendado.`);
        
        await supabase
          .from('crm_leads')
          .update({ 
            pipeline_stage: STAGES.BRIEFING_AGENDADO,
            ai_summary: 'IA moveu lead: Agendamento detectado na agenda operacional.'
          })
          .eq('id', lead.id);

        await this.logActivity(lead.id, officeId, {
          type: 'automation_move',
          description: 'Movido automaticamente devido a registro de agendamento.',
          previous_stage: lead.pipeline_stage,
          current_stage: STAGES.BRIEFING_AGENDADO
        });
      }
    }
  },

  /**
   * Move para 'Qualificação' se houver sessões NIJA
   */
  async checkIntelligenceSessions(officeId: string) {
     const { data: leads } = await supabase
      .from('crm_leads')
      .select('id, client_id, pipeline_stage')
      .eq('office_id', officeId)
      .eq('pipeline_stage', STAGES.NOVO_CONTATO);

    for (const lead of (leads || [])) {
      if (!lead.client_id) continue;

      const { data: sessions } = await supabase
          .from('nija_sessions')
          .select('id')
          .eq('case_id', lead.client_id) // No sistema, nija_sessions muitas vezes vincula via case ou client_name
          .limit(1);

      if (sessions && sessions.length > 0) {
        await supabase
          .from('crm_leads')
          .update({ 
            pipeline_stage: STAGES.QUALIFICACAO,
            ai_summary: 'IA moveu lead: Analise de inteligência iniciada.'
          })
          .eq('id', lead.id);

        await this.logActivity(lead.id, officeId, {
          type: 'automation_move',
          description: 'Movido automaticamente devido a atividade de Inteligência NIJA.',
          previous_stage: lead.pipeline_stage,
          current_stage: STAGES.QUALIFICACAO
        });
      }
    }
  },

  /**
   * Helper para log de atividades
   */
  async logActivity(leadId: string, officeId: string, params: {
    type: string,
    description: string,
    previous_stage?: string,
    current_stage?: string,
    metadata?: any
  }) {
    await supabase.from('crm_activities').insert({
      lead_id: leadId,
      office_id: officeId,
      activity_type: params.type,
      description: params.description,
      previous_stage: params.previous_stage,
      current_stage: params.current_stage,
      metadata: params.metadata || {}
    });
  }
};
