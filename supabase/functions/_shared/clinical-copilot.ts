// supabase/functions/_shared/clinical-copilot.ts

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export type ClinicalReviewStatus = 'pending' | 'approved' | 'edited' | 'rejected';
export type ClinicalMode = 'standard' | 'professional_assisted';

export interface ClinicalDraftMetadata {
    is_ai_generated: boolean;
    review_status: ClinicalReviewStatus;
    medical_report_status?: 'ai_draft' | 'under_medical_review' | 'approved_signed' | 'approved_with_edits' | 'rejected';
    clinical_mode: ClinicalMode;
    ai_original_content?: any;
    ai_original_hash?: string;
    requested_capability: string;
    template_id?: string;
    template_version?: string;
}

/**
 * Gerencia a lógica de rascunhos e revisão humana para o Clinical Copilot V6.
 */
export class ClinicalCopilotManager {
    constructor(private supabase: SupabaseClient) {}

    /**
     * Prepara o contexto de saída para o modo Copiloto Profissional.
     * Garante que toda saída clínica sensível nasça como rascunho pendente.
     */
    prepareProfessionalDraft(
        rawOutput: any,
        capability: string,
        mode: ClinicalMode = 'standard'
    ): ClinicalDraftMetadata {
        const isProfessionalAssisted = mode === 'professional_assisted';
        
        // Capabilities que exigem rascunho em modo profissional
        const sensitiveCapabilities = [
            'report_draft', 
            'diagnostic_opinion', 
            'treatment_suggestion', 
            'prescription_draft', 
            'followup_plan'
        ];

        const requiresDraft = isProfessionalAssisted && sensitiveCapabilities.includes(capability);

        return {
            is_ai_generated: true,
            review_status: requiresDraft ? 'pending' : 'approved',
            clinical_mode: mode,
            ai_original_content: requiresDraft ? rawOutput : undefined,
            requested_capability: capability
        };
    }

    /**
     * Persiste o rascunho na auditoria de segurança expandida.
     */
    async logDraftAudit(
        auditId: string,
        metadata: ClinicalDraftMetadata,
        finalContent: string
    ) {
        const { error } = await this.supabase
            .from('medical_safety_audits')
            .update({
                is_ai_generated: metadata.is_ai_generated,
                review_status: metadata.review_status,
                clinical_mode: metadata.clinical_mode,
                final_content: finalContent,
                // O conteúdo original já está no campo raw_content do log original
            })
            .eq('id', auditId);

        if (error) console.error('Erro ao atualizar auditoria com metadados de rascunho:', error);
    }

    /**
     * Registra o início de uma revisão médica ativa.
     */
    async startActiveReview(reportId: string, userId: string) {
        const { error } = await this.supabase
            .from('governance_reports')
            .update({
                status: 'under_medical_review',
                review_started_at: new UTCDate().toISOString(),
            })
            .eq('id', reportId)
            .eq('status', 'ai_draft');

        if (error) throw error;
    }

    /**
     * Finaliza a revisão e oficializa o laudo.
     * Esta função deve ser chamada dentro de um gate de segurança server-side.
     */
    async finalizeReport(params: {
        reportId: string,
        userId: string,
        status: 'approved_signed' | 'approved_with_edits',
        editedBlocks?: any,
        sectionsViewed: string[],
        reviewTimeSeconds: number,
        signatureVersionUsed: string,
        templateSnapshot: any,
        templateHash: string,
        reportVersionHash: string
    }) {
        const { error } = await this.supabase
            .from('governance_reports')
            .update({
                status: params.status,
                review_completed_at: new UTCDate().toISOString(),
                review_time_seconds: params.reviewTimeSeconds,
                sections_viewed: params.sectionsViewed,
                was_edited: params.status === 'approved_with_edits',
                edited_blocks: params.editedBlocks,
                signed_by: params.userId,
                signed_at: new UTCDate().toISOString(),
                signature_version_used: params.signatureVersionUsed,
                template_snapshot: params.templateSnapshot,
                template_hash: params.templateHash,
                report_version_hash: params.reportVersionHash,
                signed_hash: params.reportVersionHash // No V5, o hash da versão é o hash assinado
            })
            .eq('id', params.reportId);

        if (error) throw error;
    }
}

// Helper para data UTC
class UTCDate extends Date {
    toISOString() {
        return super.toISOString();
    }
}
