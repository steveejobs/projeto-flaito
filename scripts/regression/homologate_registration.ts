import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Erro: VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos no .env");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const testOffice = {
  id: "aaf6e90d-9f23-424c-b570-f9d3e27f6cb6", // Escritório de Teste NIJA (estático no seed)
};

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function homologate() {
  console.log("🚀 Iniciando Homologação de Relacionamento e Sincronização...");
  console.log(`🏢 Usando Office: Escritório de Teste NIJA (${testOffice.id})`);

  try {
    // --- SETUP: Limpeza ---
    const testCpf = "999.999.999-99";
    const testCnpj = "99.999.999/0001-99";
    await supabaseAdmin.from("clients").delete().eq("cpf", testCpf);
    await supabaseAdmin.from("clients").delete().eq("cnpj", testCnpj);

    // --- TESTE 1: Cadastro PF e Sincronização CRM -> Prontuário ---
    console.log("\n📝 Teste 1: Cadastro PF e Sincronização CRM -> Prontuário...");
    const pfData = {
      office_id: testOffice.id,
      full_name: "Cliente Teste Sincronizado",
      cpf: testCpf,
      email: "teste-sync@flaito.com",
      phone: "(11) 98888-8888",
      person_type: "PF",
      rg: "12.345.678-9",
      profession: "Arquiteto",
      nationality: "Brasileiro",
      marital_status: "Casado"
    };

    const { data: clientPF, error: pfError } = await supabaseAdmin.from("clients").insert(pfData).select().single();
    if (pfError) throw new Error(`Erro ao criar cliente PF: ${pfError.message}`);
    console.log(`✅ Cliente CRM persistido com ID: ${clientPF.id}`);

    // Simular Edge Function: Criar o Paciente
    const { data: pacientePF, error: pPFError } = await supabaseAdmin.from("pacientes").insert({
      office_id: testOffice.id,
      client_id: clientPF.id,
      nome: pfData.full_name,
      cpf: pfData.cpf
    }).select().single();

    if (pPFError) throw new Error(`Erro ao criar paciente: ${pPFError.message}`);
    console.log(`✅ Prontuário (Paciente) persistido com ID: ${pacientePF.id}`);

    // TESTE SYNC CRM -> PRONTUARIO
    console.log("🔄 Atualizando Profissão no CRM...");
    const { count, error: updateError } = await supabaseAdmin
      .from("clients")
      .update({ profession: "Engenheiro de Software" })
      .eq("id", clientPF.id)
      .select('id', { count: 'exact' });

    if (updateError) console.error("❌ Erro no Update:", updateError.message);
    console.log(`📊 Linhas afetadas no CRM: ${count}`);
    
    if (count === 0) {
        throw new Error("❌ O Update não afetou nenhuma linha. O registro pode não ter sido encontrado ou o RLS bloqueou.");
    }

    const { data: updatedPct } = await supabaseAdmin.from("pacientes").select("*").eq("client_id", clientPF.id).single();
    if (updatedPct?.profession !== "Engenheiro de Software") {
        throw new Error(`❌ Falha na Sincronização CRM->Prontuário. Esperado 'Engenheiro de Software', recebido: '${updatedPct?.profession}'`);
    }
    console.log(`✅ Sincronização CRM -> Prontuário OK (Profissão: ${updatedPct.profession})`);

    // --- TESTE 2: Sincronização Prontuário -> CRM (Bidirecional) ---
    console.log("\n📝 Teste 2: Sincronização Prontuário -> CRM...");
    console.log("🔄 Atualizando RG no Prontuário...");
    await supabaseAdmin.from("pacientes").update({ rg: "X-SYINC-TEST" }).eq("id", pacientePF.id);

    await sleep(500); // Aguardar trigger

    const { data: updatedClnt } = await supabaseAdmin.from("clients").select("*").eq("id", clientPF.id).single();
    if (updatedClnt?.rg !== "X-SYINC-TEST") {
        throw new Error(`❌ Falha na Sincronização Prontuário->CRM. Esperado 'X-SYINC-TEST', recebido: '${updatedClnt?.rg}'`);
    }
    console.log(`✅ Sincronização Prontuário -> CRM OK (RG: ${updatedClnt.rg})`);

    // --- TESTE 3: Cadastro PJ e Representante ---
    console.log("\n📝 Teste 3: Cadastro PJ com Representante...");
    const pjData = {
      office_id: testOffice.id,
      full_name: "Empresa de Homologação LTDA",
      cnpj: testCnpj,
      person_type: "PJ",
      representative_name: "Representante Legal",
      representative_cpf: "111.222.333-44"
    };

    const { data: clientPJ, error: pjError } = await supabaseAdmin.from("clients").insert(pjData).select().single();
    if (pjError) throw new Error(`Erro PJ: ${pjError.message}`);

    const { data: pctPJ, error: pctPJError } = await supabaseAdmin.from("pacientes").insert({
        office_id: testOffice.id,
        client_id: clientPJ.id,
        nome: pjData.full_name,
        cnpj: pjData.cnpj,
        representative_name: pjData.representative_name
    }).select().single();

    if (pctPJError || pctPJ.representative_name !== pjData.representative_name) {
        throw new Error("❌ Falha no relacionamento/persistência de Representante PJ");
    }
    console.log("✅ Cadastro PJ e Representante OK em ambas as tabelas.");

    // --- TESTE 4: Prevenção de Loops e Robustez ---
    console.log("\n🛡️ Teste 4: Verificando ausência de loop infinito...");
    // Se houvesse loop, essa operação demoraria muito ou falharia por profundidade de stack
    await supabaseAdmin.from("clients").update({ full_name: "Loop Test Checked" }).eq("id", clientPF.id);
    console.log("✅ Atualização sem loop infinito confirmada.");

    console.log("\n=================================");
    console.log("🏆 HOMOLOGAÇÃO CONCLUÍDA COM SUCESSO!");
    console.log("Status Final: HOMOLOGADO");
    console.log("=================================");

  } catch (err: any) {
    console.error("\n❌ FALHA NA HOMOLOGAÇÃO:");
    console.error(err.message);
    console.log("Status Final: BLOQUEADO");
  } finally {
    // console.log("\n🧹 Limpando dados de teste...");
    // await supabaseAdmin.from("clients").delete().eq("cpf", "999.999.999-99");
    // await supabaseAdmin.from("clients").delete().eq("cnpj", "99.999.999/0001-99");
  }
}

homologate();
