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
    // 1. Busca clientes ativos no escritório
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, full_name, email, phone')
      .eq('office_id', officeId)
      .is('deleted_at', null);

    if (clientsError) throw clientsError;
    if (!clients || clients.length === 0) return;

    // 2. Busca leads já existentes para evitar duplicação (Source of Truth)
    const { data: existingLeads, error: leadsError } = await supabase
      .from('crm_leads')
      .select('client_id')
      .eq('office_id', officeId);

    if (leadsError) throw leadsError;

    const existingClientIds = new Set(existingLeads?.map(l => l.client_id).filter(Boolean));

    // 3. Filtra apenas clientes que NÃO possuem lead
    const newClients = clients.filter(c => !existingClientIds.has(c.id));

    if (newClients.length === 0) {
      console.log(`[CRM] Nenhum novo lead para sincronizar.`);
      return;
    }

    console.log(`[CRM] Sincronizando ${newClients.length} novos leads.`);

    // 4. Inserção em massa (Bulk Insert)
    const leadsToInsert = newClients.map(client => ({
      office_id: officeId,
      client_id: client.id,
      full_name: client.full_name,
      email: client.email,
      phone: client.phone,
      source: 'Sistema',
      pipeline_stage: STAGES.NOVO_CONTATO
    }));

    const { data: insertedLeads, error: insertError } = await supabase
      .from('crm_leads')
      .insert(leadsToInsert)
      .select();

    if (insertError) {
      console.error(`[CRM] Erro no bulk insert de leads:`, insertError);
      return;
    }

    // 5. Logar atividade inicial para os novos leads
    if (insertedLeads && insertedLeads.length > 0) {
      const activitiesToInsert = insertedLeads.map(lead => ({
        lead_id: lead.id,
        office_id: officeId,
        activity_type: 'automation_move',
        description: 'Lead criado automaticamente via sincronização de cliente.',
        current_stage: STAGES.NOVO_CONTATO,
        metadata: { bulk_sync: true }
      }));

      await supabase.from('crm_activities').insert(activitiesToInsert);
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
      try {
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
      } catch (err) {
        console.error(`[CRM Automation] Erro ao processar agendamento para lead ${lead.id}:`, err);
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
      try {
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
      } catch (err) {
        console.error(`[CRM Automation] Erro ao processar sessão NIJA para lead ${lead.id}:`, err);
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
