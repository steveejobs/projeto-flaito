import { supabase } from "@/integrations/supabase/client";
import { LeadAuditService } from "./leadAuditService";

export type MatchType = 'duplicate_probable' | 'existing_client_other_case' | 'review_required' | 'no_match';

interface MatchResult {
  matchType: MatchType;
  score: number;
  reason: any;
  matchedLeadId?: string;
  matchedClientId?: string;
}

export class LeadDeduplicationService {
  /**
   * Normaliza telefone para comparação (apenas dígitos, remove +55 inicial)
   */
  static normalizePhone(phone?: string): string {
    if (!phone) return "";
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("55") && cleaned.length > 10) {
      cleaned = cleaned.substring(2);
    }
    return cleaned;
  }

  /**
   * Normaliza email para comparação
   */
  static normalizeEmail(email?: string): string {
    if (!email) return "";
    return email.trim().toLowerCase();
  }

  /**
   * Engine de Deduplicação com Inteligência de Contexto
   */
  static async checkDuplicity(officeId: string, leadData: {
    full_name: string;
    email?: string;
    phone?: string;
    client_id?: string;
    area_id?: string; // Campo de contexto
    title?: string;
  }): Promise<MatchResult[]> {
    const matches: MatchResult[] = [];
    const normPhone = this.normalizePhone(leadData.phone);
    const normEmail = this.normalizeEmail(leadData.email);

    // 1. Busca leads e clientes do mesmo office
    const [leadsResponse, clientsResponse] = await Promise.all([
      supabase.from('crm_leads')
        .select('id, full_name, email, phone, client_id, pipeline_stage, status, notes')
        .eq('office_id', officeId)
        .neq('status', 'trashed'),
      supabase.from('clients')
        .select('id, full_name, email, phone')
        .eq('office_id', officeId)
    ]);

    const existingLeads = leadsResponse.data || [];
    const existingClients = clientsResponse.data || [];

    // 2. Heurística Contextual para Leads
    for (const lead of existingLeads) {
      const leadNormPhone = this.normalizePhone(lead.phone);
      const leadNormEmail = this.normalizeEmail(lead.email);
      
      let identityMatch = false;
      let reason: any = {};

      if (normPhone && leadNormPhone === normPhone) {
        identityMatch = true;
        reason.phone = lead.phone;
      } else if (normEmail && leadNormEmail === normEmail) {
        identityMatch = true;
        reason.email = lead.email;
      } else if (leadData.client_id && lead.client_id === leadData.client_id) {
        identityMatch = true;
        reason.client_id = lead.client_id;
      }

      if (identityMatch) {
        // Checagem de Contexto (Mesma Área ou mesmo Título de Lead)
        // Se houver sinal de que é o mesmo assunto jurídico/médico
        const contextMatch = (leadData.area_id && lead.notes?.includes(leadData.area_id)); 
        
        const matchType: MatchType = contextMatch ? 'duplicate_probable' : 'existing_client_other_case';
        
        matches.push({
          matchType,
          score: contextMatch ? 100 : 70,
          reason,
          matchedLeadId: lead.id,
          matchedClientId: lead.client_id || undefined
        });
      }
    }

    // 3. Checagem contra Clientes Convertidos
    if (matches.length === 0) {
      for (const client of existingClients) {
        const clientNormPhone = this.normalizePhone(client.phone);
        const clientNormEmail = this.normalizeEmail(client.email);

        if ((normPhone && clientNormPhone === normPhone) || 
            (normEmail && clientNormEmail === normEmail)) {
          matches.push({
            matchType: 'existing_client_other_case',
            score: 90,
            reason: { client_match: true },
            matchedClientId: client.id
          });
        }
      }
    }

    return matches;
  }

  /**
   * Persiste os matches e gera auditoria
   */
  static async persistMatches(officeId: string, leadId: string, results: MatchResult[]) {
    if (results.length === 0) return;

    let mainStatus: MatchType = 'no_match';
    if (results.some(r => r.matchType === 'duplicate_probable')) mainStatus = 'duplicate_probable';
    else if (results.some(r => r.matchType === 'existing_client_other_case')) mainStatus = 'existing_client_other_case';

    // 1. Atualiza lead
    await supabase.from('crm_leads')
      .update({ 
        duplicate_status: mainStatus,
        duplicate_checked_at: new Date().toISOString()
      })
      .eq('id', leadId);

    // 2. Insere na tabela relacional
    const inserts = results.map(r => ({
      office_id: officeId,
      lead_id: leadId,
      matched_lead_id: r.matchedLeadId,
      matched_client_id: r.matchedClientId,
      match_type: r.matchType,
      score: r.score,
      reason_payload: r.reason,
      status: 'pending'
    }));

    await supabase.from('crm_lead_matches').insert(inserts);

    // 3. Auditoria
    await LeadAuditService.logActivity({
      officeId,
      leadId,
      type: 'duplicate_detected',
      description: `Possível duplicidade detectada (${mainStatus}). Score máximo: ${Math.max(...results.map(r => r.score))}%`,
      origin: 'system'
    });
  }

  static async dismissMatch(officeId: string, matchId: string, userId: string, leadId: string) {
    await supabase.from('crm_lead_matches')
      .update({
        status: 'dismissed',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', matchId);

    await LeadAuditService.logActivity({
      officeId,
      leadId,
      type: 'duplicate_dismissed',
      description: `Duplicidade ignorada manualmente pelo consultor.`,
      actorId: userId
    });
      
    // Re-checa se ainda restam matches pendentes para limpar o badge do lead
    const { data: remaining } = await supabase
      .from('crm_lead_matches')
      .select('id')
      .eq('lead_id', leadId)
      .eq('status', 'pending');

    if (!remaining || remaining.length === 0) {
      await supabase.from('crm_leads').update({ duplicate_status: 'no_match' }).eq('id', leadId);
    }
  }
}
