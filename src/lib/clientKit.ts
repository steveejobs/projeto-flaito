/**
 * clientKit.ts
 * 
 * Função utilitária central para geração automática do Kit do Cliente.
 * Fluxo limpo e isolado, sem dependências do código legado.
 */

import { supabase } from "@/integrations/supabase/client";

export type KitMode = "BASIC" | "CONTRACT";

export interface KitResult {
  ok: boolean;
  created?: string[];
  errors?: string[];
  missingFields?: string[];
  reason?: string;
}

export interface ContractVariables {
  tipo_remuneracao?: string;
  percentual_honorarios?: string;
  valor_fixo_honorarios?: string;
  valor_entrada?: string;
  numero_parcelas?: string;
  valor_parcela?: string;
  data_primeira_parcela?: string;
  datas_parcelas?: string[];
  metodo_pagamento?: string;
  chave_pix?: string;
  clausula_inadimplemento?: string;
  honorarios_descricao_completa?: string;
}

/**
 * Gera automaticamente o Kit do Cliente via Edge Function.
 * 
 * @param clientId - ID do cliente
 * @param mode - "BASIC" para PROC+DECL, "CONTRACT" apenas para CONTRATO
 * @param kitVars - Variáveis do contrato (apenas para mode="CONTRACT")
 * @returns Resultado da geração
 */
export async function autoGenerateClientKit(
  clientId: string,
  mode: KitMode,
  kitVars?: ContractVariables
): Promise<KitResult> {
  if (!clientId) {
    return { ok: false, reason: "client_id é obrigatório" };
  }

  const templateCodes = mode === "BASIC" ? ["PROC", "DECL"] : ["CONTRATO"];
  const variables = mode === "CONTRACT" && kitVars ? { kit: kitVars } : {};

  console.log(`[clientKit] autoGenerateClientKit: mode=${mode}, clientId=${clientId}`);

  try {
    const { data, error } = await supabase.functions.invoke("create-client-kit", {
      body: {
        client_id: clientId,
        template_codes: templateCodes,
        variables,
      },
    });

    if (error) {
      console.error("[clientKit] Edge function error:", error);
      return {
        ok: false,
        reason: error.message || "Erro ao chamar a função de geração",
      };
    }

    // Normaliza resposta
    if (!data) {
      return { ok: false, reason: "Resposta vazia do servidor" };
    }

    // Verifica campos faltantes (para CONTRATO)
    if (data.missing_fields && data.missing_fields.length > 0) {
      return {
        ok: false,
        missingFields: data.missing_fields,
        reason: "Campos obrigatórios não preenchidos",
      };
    }

    // Retorno de sucesso
    return {
      ok: data.ok === true,
      created: data.created || [],
      errors: data.errors || [],
      reason: data.reason,
    };
  } catch (err: any) {
    console.error("[clientKit] Unexpected error:", err);
    return {
      ok: false,
      reason: err?.message || "Erro inesperado",
    };
  }
}

/**
 * Labels para exibição de campos faltantes
 */
export const FIELD_LABELS: Record<string, string> = {
  tipo_remuneracao: "Tipo de Remuneração",
  percentual_honorarios: "Percentual de Honorários",
  valor_fixo_honorarios: "Valor Fixo de Honorários",
  valor_entrada: "Valor de Entrada",
  numero_parcelas: "Número de Parcelas",
  valor_parcela: "Valor da Parcela",
  data_primeira_parcela: "Data da Primeira Parcela",
  datas_parcelas: "Datas das Parcelas",
  metodo_pagamento: "Método de Pagamento",
  chave_pix: "Chave PIX",
  clausula_inadimplemento: "Cláusula de Inadimplemento",
  honorarios_descricao_completa: "Descrição Completa dos Honorários",
};
