import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  normalizeCPF, 
  normalizeRG, 
  normalizeCNH, 
  compareNames, 
  parseBrazilianDate,
  calculateDedupScore
} from "../_shared/brazilianUtils.ts";
import { requireResourceAccess, requireOfficeMembership } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, document_id, patient_id, data: inputData } = await req.json();

    if (action === "PROCESS_DOCUMENT") {
      // 1. Validar Acesso ao Recurso (Zero Trust)
      const auth = await requireResourceAccess(req, {
        resourceType: 'patient_documents',
        resourceId: document_id,
        minRole: 'MEMBER'
      });

      if (!auth.ok) return auth.response;
      const supabase = auth.adminClient;
      const officeId = auth.membership.office_id;

      // 2. Obter metadados do documento (já validado que pertence ao office)
      const { data: doc, error: docErr } = await supabase
        .from("patient_documents")
        .select("*")
        .eq("id", document_id)
        .single();
      
      if (docErr || !doc) throw new Error("Documento não encontrado.");

      // 2. Chamar o Engine de OCR (nija-extract-image)
      // Nota: Em produção, poderíamos usar invoke ou simplesmente importar a lógica
      const { data: ocrRes, error: ocrErr } = await supabase.functions.invoke("nija-extract-image", {
        body: { 
          imageBase64: doc.storage_path, // Assumindo que o storage_path pode ser passado ou resolvido
          mode: "patient_intake" 
        }
      });

      if (ocrErr) throw new Error(`Falha no OCR: ${ocrErr.message}`);
      const extraction = ocrRes.extraction; // { fields: { name: { value, confidence }, ... } }

      // 3. Normalização Brasileira Crítica
      const normalizedFields: any = {};
      const confidenceFields: any = {};
      const sourceFields: any = {};

      for (const [key, field] of Object.entries(extraction.fields)) {
        let val = field.value;
        let isValid = true;

        if (key === 'cpf') {
          const res = normalizeCPF(val);
          val = res.value;
          isValid = res.isValid;
        } else if (key === 'rg') {
          val = normalizeRG(val);
        } else if (key === 'birth_date') {
          val = parseBrazilianDate(val);
        }

        normalizedFields[key] = val;
        confidenceFields[key] = field.confidence * (isValid ? 1 : 0.5); // Malus para falha de checksum
        sourceFields[key] = 'ocr_extraction';
      }

      // 4. Gerenciamento de Versão
      const { data: versions } = await supabase
        .from("patient_document_extractions")
        .select("version_number")
        .eq("patient_document_id", document_id)
        .order("version_number", { ascending: false })
        .limit(1);
      
      const nextVersion = (versions?.[0]?.version_number || 0) + 1;

      // 5. Ingestão Versionada
      const { data: extractionRecord, error: extErr } = await supabase
        .from("patient_document_extractions")
        .insert({
          patient_document_id: document_id,
          version_number: nextVersion,
          extracted_json: extraction,
          normalized_json: normalizedFields,
          confidence_json: confidenceFields,
          field_source_json: sourceFields,
          is_head: true,
          worker_version: "nija-intake-v1.0"
        })
        .select()
        .single();

      if (extErr) throw extErr;

      // 6. Deduplicação Preventiva
      const matchCriteria: any = {};
      if (normalizedFields.cpf) {
        const { data: matches } = await supabase
          .from("pacientes")
          .select("id, nome, cpf, data_nascimento, rg")
          .eq("cpf", normalizedFields.cpf)
          .neq("id", patient_id || '00000000-0000-0000-0000-000000000000');

        if (matches && matches.length > 0) {
          for (const match of matches) {
            const { score, criteria } = calculateDedupScore(normalizedFields, match);
            if (score > 0.8) {
              await supabase.from("patient_deduplication_suggestions").upsert({
                office_id: doc.office_id,
                source_patient_id: patient_id || matches[0].id, // Caso seja novo cadastro
                target_patient_id: match.id,
                matching_score: score,
                matching_criteria: criteria,
                status: 'PENDING'
              });
            }
          }
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        extraction_id: extractionRecord.id,
        version: nextVersion,
        normalized: normalizedFields 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "COMMIT_INTAKE") {
      const { patient_id, confirmed_data, extraction_id } = inputData;

      // 1. Validar Acesso ao Paciente (Zero Trust)
      const auth = await requireResourceAccess(req, {
        resourceType: 'pacientes',
        resourceId: patient_id,
        minRole: 'MEMBER'
      });

      if (!auth.ok) return auth.response;
      const supabase = auth.adminClient;
      const officeId = auth.membership.office_id;
      const userId = auth.user.uid;

      // 2. Obter estado atual para auditoria (já validado que pertence ao office)
      const { data: currentPatient } = await supabase
        .from("pacientes")
        .select("*")
        .eq("id", patient_id)
        .single();

      // 2. Registrar Auditoria de Campo (Audit Trail)
      const auditEntries = [];
      for (const [key, newValue] of Object.entries(confirmed_data)) {
        const oldValue = currentPatient?.[key];
        
        if (oldValue !== newValue) {
          auditEntries.push({
            patient_id,
            field_name: key,
            old_value: String(oldValue || ''),
            new_value: String(newValue || ''),
            provenance: 'manual_correction',
            extraction_id,
            changed_by: user_id,
            change_reason: 'Human confirmation during intake'
          });
        }
      }

      if (auditEntries.length > 0) {
        await supabase.from("patient_field_audit_log").insert(auditEntries);
      }

      // 3. Efetivar cadastro
      const { error: patchErr } = await supabase
        .from("pacientes")
        .update(confirmed_data)
        .eq("id", patient_id);

      if (patchErr) throw patchErr;

      // 4. Marcar extração como revisada
      await supabase
        .from("patient_document_extractions")
        .update({ 
          status: 'confirmed', 
          reviewed_by: user_id, 
          reviewed_at: new Date().toISOString() 
        })
        .eq("id", extraction_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    throw new Error("Ação inválida.");

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
