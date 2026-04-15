// supabase/functions/_shared/test-medical-safety-v3.ts
import { 
    enforceMedicalCapabilityV3, 
    assessMedicalDataCompleteness 
} from "./medical-safety-v3.ts";

// Helpers para simular avaliações de dados
const assessments = {
    insufficient: () => assessMedicalDataCompleteness({}),
    partial: () => assessMedicalDataCompleteness({ symptoms: ["tosse"], patient_id: "id" }),
    sufficient: () => assessMedicalDataCompleteness({ 
        symptoms: ["tosse"], 
        patient_id: "id", 
        age: 30, 
        duration: "2 dias", 
        history: "N/A", 
        consent_status: true 
    })
};

const mockOfficeId = "00000000-0000-0000-0000-000000000000";
const mockUserId = "11111111-1111-1111-1111-111111111111";

console.log("🚀 Iniciando Testes Clinical Decision Safety Engine V3\n");

// --- TESTE 1: Bloqueio por falta de consentimento ---
console.log("Teste 1: Bloqueio por falta de consentimento");
const ctx1 = {
    office_id: mockOfficeId,
    user_id: mockUserId,
    actor_role: "admin",
    audience: "patient" as any,
    context: "analysis_mode" as any,
    channel: "ui" as any,
    requested_capability: "clinical_hypothesis" as any,
    authorized_capacity: "treatment_suggestion" as any,
    consent_status: false,
    function_slug: "test-function"
};
const res1 = enforceMedicalCapabilityV3(ctx1, "O paciente parece ter gripe.", 0.9, assessments.insufficient());
console.log(`Resultado: ${res1.blocked ? "✅ BLOQUEADO" : "❌ FALHOU"}\n`);

// --- TESTE 2: Voice Channel Downgrade (Máximo observational_summary para paciente) ---
console.log("Teste 2: Voice Channel Downgrade (Máximo observational_summary para paciente)");
const ctx2 = {
    ...ctx1,
    channel: "voice" as any,
    consent_status: true,
    requested_capability: "clinical_hypothesis" as any
};
const res2 = enforceMedicalCapabilityV3(ctx2, "Sugiro investigar pneumonia.", 0.9, assessments.partial());
console.log(`Resultado: Expected observational_summary, Got: ${res2.effective_capability}`);
console.log(`${res2.effective_capability === "observational_summary" ? "✅ SUCESSO" : "❌ FALHOU"}\n`);

// --- TESTE 3: Baixa Confiança Downgrade ---
console.log("Teste 3: Baixa Confiança Downgrade (< 0.45)");
const ctx3 = { ...ctx1, consent_status: true };
const res3 = enforceMedicalCapabilityV3(ctx3, "Pode ser algo grave.", 0.3, assessments.sufficient());
console.log(`Resultado: Expected blocked/observational, Got: ${res3.effective_capability}`);
console.log(`${res3.blocked ? "✅ SUCESSO (Bloqueado por baixa confiança)" : "❌ FALHOU"}\n`);
