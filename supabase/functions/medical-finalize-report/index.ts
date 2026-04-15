import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireOfficeMembership, logAuditEvent } from "../_shared/auth.ts";
import { ClinicalCopilotManager } from "../_shared/clinical-copilot.ts";

const ALLOWED_ORIGINS = Deno.env.get("CORS_ALLOWED_ORIGINS")?.split(",") || ["*"];

const getCorsHeaders = (origin: string | null) => {
    const isAllowed = origin && (ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes("*"));
    return {
        "Access-Control-Allow-Origin": isAllowed ? origin! : (ALLOWED_ORIGINS[0] || ""),
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
};

serve(async (req: Request) => {
    const origin = req.headers.get("origin");
    const corsHeaders = getCorsHeaders(origin);

    if (req.method === "OPTIONS") {
        return new Response(JSON.stringify({ ok: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    try {
        const { 
            reportId, 
            status, 
            editedBlocks, 
            sectionsViewed, 
            reviewTimeSeconds,
            templateId
        } = await req.json();

        // 1. Autorização
        const auth = await requireOfficeMembership(req, "medical:finalize");
        if (!auth.ok || !auth.user || !auth.membership) {
            return (auth as any).response || new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
        }

        const { user, membership, adminClient } = auth;
        const officeId = membership.office_id;

        // 2. Validação Profissional (Gate de Identidade)
        const { data: settings, error: settingsError } = await adminClient
            .from('user_medical_settings')
            .select('*')
            .eq('user_id', user.uid)
            .single();

        if (settingsError || !settings?.crm || !settings?.professional_license_display) {
            return new Response(JSON.stringify({ 
                error: "Perfil profissional incompleto. Configure seu CRM e nome oficial antes de assinar." 
            }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 3. Validação do Relatório
        const { data: report, error: reportError } = await adminClient
            .from('governance_reports')
            .select('*')
            .eq('id', reportId)
            .eq('office_id', officeId)
            .single();

        if (reportError || !report) {
            return new Response(JSON.stringify({ error: "Relatório não encontrado." }), { 
                status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }

        if (report.status !== 'under_medical_review' && report.status !== 'ai_draft') {
            return new Response(JSON.stringify({ error: "Este relatório não está em fase de revisão." }), { 
                status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }

        // 4. Validação de Revisão Ativa
        const minReviewTime = 10; // Segundos (configurável)
        if (reviewTimeSeconds < minReviewTime) {
             return new Response(JSON.stringify({ 
                error: `Tempo de revisão insuficiente (${reviewTimeSeconds}s). Realize uma leitura atenta antes de assinar.` 
            }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // 5. Snapshot do Template
        let templateSnapshot = null;
        let templateHash = null;
        if (templateId) {
            const { data: template } = await adminClient
                .from('document_templates')
                .select('*')
                .eq('id', templateId)
                .single();
            
            if (template) {
                templateSnapshot = template;
                const templateStr = JSON.stringify(template);
                const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(templateStr));
                templateHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
            }
        }

        // 6. Finalização (Criptografia e Auditoria)
        const copilot = new ClinicalCopilotManager(adminClient);
        
        // Cálculo de integridade final (Snapshot do conteúdo assinado)
        const finalContent = JSON.stringify(editedBlocks || report.ai_original_blocks);
        const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(finalContent));
        const reportVersionHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

        await copilot.finalizeReport({
            reportId,
            userId: user.uid,
            status: status === 'approved_with_edits' ? 'approved_with_edits' : 'approved_signed',
            editedBlocks: editedBlocks || null,
            sectionsViewed: sectionsViewed || [],
            reviewTimeSeconds: reviewTimeSeconds,
            signatureVersionUsed: settings.signature_version,
            templateSnapshot,
            templateHash,
            reportVersionHash
        });

        // 7. Audit Log
        await logAuditEvent(adminClient, {
            event_type: 'MEDICAL_REPORT_SIGNED',
            actor_user_id: user.uid,
            office_id: officeId,
            resource_type: 'governance_report',
            resource_id: reportId,
            action: 'update',
            metadata_json: {
                status,
                was_edited: !!editedBlocks,
                review_time: reviewTimeSeconds,
                integrity_hash: reportVersionHash
            }
        });

        return new Response(JSON.stringify({ 
            ok: true, 
            reportId, 
            status: status,
            signed_hash: reportVersionHash 
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error(`[FINALIZE] CRITICAL ERROR:`, error);
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
    }
});
