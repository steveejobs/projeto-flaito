import { supabase } from "@/integrations/supabase/client";
import { resolveDocumentContext } from "@/utils/documentContextResolver";
import { DocumentTemplateId } from "@/types/institutional";

// Re-using some formatting logic if possible, but keep it simple
const PRINT_CSS = `
<style>
  @media print {
    @page { margin: 20mm; size: A4; }
    body { padding: 0 !important; margin: 0 !important; background: white !important; }
    #signature-fallback { display: none !important; }
  }
  body { font-family: Arial, sans-serif; line-height: 1.5; color: #000; background: white; max-width: 800px; margin: 0 auto; padding: 40px; }
</style>
`;

export interface CaseDocumentGeneratorResult {
  ok: boolean;
  doc_id?: string;
  error?: string;
}

export async function generateCaseDocumentHtml(
  caseId: string,
  templateCode: string, // e.g., "PROC", "CONTRATO"
  customVariables: Record<string, unknown> = {},
  visualTemplateId: DocumentTemplateId = 'premium_elegant'
): Promise<CaseDocumentGeneratorResult> {
  try {
    console.log("[caseDocumentHtmlGenerator] Starting generation for case:", caseId, "with visual template:", visualTemplateId);

    // 1. Fetch case
    const { data: caseRes, error: caseErr } = await supabase
      .from("cases")
      .select("*")
      .eq("id", caseId)
      .single();

    if (caseErr || !caseRes) throw new Error("Caso não encontrado");

    // 2. Fetch client
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("*")
      .eq("id", caseRes.client_id)
      .single();

    if (clientErr || !client) throw new Error("Cliente não encontrado");

    // 3. Fetch office
    const { data: office, error: officeErr } = await supabase
      .from("offices")
      .select("*")
      .eq("id", caseRes.office_id)
      .single();

    if (officeErr || !office) throw new Error("Escritório não encontrado");

    // 4. Fetch signature
    const { data: clientSig } = await supabase
      .from("vw_client_signatures")
      .select("*")
      .eq("client_id", client.id)
      .limit(1)
      .maybeSingle();

    // 5. Fetch template
    const { data: template, error: tplErr } = await supabase
      .from("document_templates")
      .select("id, content")
      .eq("office_id", office.id)
      .eq("code", templateCode)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (tplErr || !template) throw new Error(`Template ativo com código ${templateCode} não encontrado para este escritório.`);

    // 5.1 Resolve Institutional Context (Fallback logic)
    const { data: { user } } = await supabase.auth.getUser();
    const institutionalContext = await resolveDocumentContext({
      officeId: office.id,
      userId: user?.id || "",
      isMedical: false
    });

    // Override visual template choice
    if (institutionalContext.templateMetadata) {
      institutionalContext.templateMetadata.id = visualTemplateId;
    }

    // 6. Build variables
    const fullVars = {
      client: {
        ...client,
        signature_base64: clientSig?.signature_base64 || null,
      },
      office,
      case: caseRes,
      custom: customVariables,
      institutional: institutionalContext, // Novo: Disponível para o template engine
    };

    // 7. Render HTML using rpc (This renders the BODY of the document)
    const { data: renderedBody, error: renderErr } = await supabase.rpc("render_template_preview", {
      p_template_id: template.id,
      p_data: fullVars as any,
    });

    if (renderErr) throw new Error("Falha ao renderizar template: " + renderErr.message);

    if (!renderedBody || typeof renderedBody !== "string") {
      throw new Error("Renderização retornou um documento vazio");
    }

    // 7.1 Assemble with Professional Engine
    const { renderDocument } = await import("@/lib/document-engine");
    const { SignatureBlock } = await import("@/lib/document-engine/sections/SignatureBlock");
    
    const signatureHtml = SignatureBlock(institutionalContext.professional, client.full_name);
    
    const finalHtml = await renderDocument(institutionalContext, renderedBody, {
      addSignatureBlock: signatureHtml
    });


    // 8. Upload to Storage (documents bucket)
    const normalizedName = `${templateCode}_${Date.now()}`.toLowerCase().replace(/\s+/g, "_");
    const fileName = `${office.id}/${caseId}/${normalizedName}.html`;

    const blob = new Blob([finalHtml], { type: "text/html;charset=utf-8" });
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from("documents")
      .upload(fileName, blob, { upsert: true, contentType: "text/html" });

    if (uploadErr) throw new Error("Erro ao enviar HTML para storage: " + uploadErr.message);

    // 9. Insert into documents table
    const docKind = templateCode === "PROC" ? "PROCURACAO" : templateCode === "CONTRATO" ? "CONTRATO" : "OUTROS";
    
    // We construct the DB record
    const { data: docRecord, error: docErr } = await supabase
      .from("documents")
      .insert({
        office_id: office.id,
        client_id: client.id,
        case_id: caseId,
        filename: `${templateCode} - ${client.full_name}`,
        mime_type: "text/html",
        storage_bucket: "documents",
        storage_path: uploadData.path,
        status: "NOVO",
        kind: docKind as any,
        institutional_snapshot: institutionalContext as any, // Capturado no momento da emissão
      })
      .select("id")
      .single();

    if (docErr) throw new Error("Erro ao salvar registro na tabela documents: " + docErr.message);

    // Optional: Log to generated_documents history for CaseGeneratedHistory
    await supabase.from("generated_documents").insert({
        case_id: caseId,
        office_id: office.id,
        template_id: template.id,
        data_used: fullVars,
    });

    console.log("[caseDocumentHtmlGenerator] Successfully generated doc_id:", docRecord.id);

    return { ok: true, doc_id: docRecord.id };
  } catch (err: any) {
    console.error("[caseDocumentHtmlGenerator] Error:", err);
    return { ok: false, error: err.message };
  }
}
