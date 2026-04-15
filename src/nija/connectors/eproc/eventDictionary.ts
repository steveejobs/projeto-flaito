// src/lib/nija/eprocEventDictionary.ts
// Dicionário de eventos do eProc com cache (memória + localStorage TTL 24h)

export type EprocEventCategory = 
  | "CITACAO" 
  | "INTIMACAO" 
  | "AUDIENCIA" 
  | "PRAZO" 
  | "PENHORA" 
  | "DECISAO" 
  | "SENTENCA" 
  | "PROTOCOLO" 
  | "OUTRO";

export interface EprocEventEntry {
  code: string;
  label: string;
  meaning: string;
  category: EprocEventCategory;
}

export interface EnrichedEprocEvent {
  rawDescription: string;
  code?: string;
  label?: string;
  meaning?: string;
  category?: EprocEventCategory;
  dateISO?: string;
  rawDate?: string;
  excerpt?: string;
  confidence: "alta" | "media" | "baixa";
  source: "pdf_local";
  eventNumber?: number;
}

const CACHE_KEY = "nija:eproc:events:v1";
const CACHE_TTL_KEY = "nija:eproc:events:v1:ttl";
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

let memoryCache: Record<string, EprocEventEntry> | null = null;

// Variáveis do Supabase obtidas do ambiente
const ENV_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ENV_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Busca dicionário de eventos do eProc com cache (memória + localStorage TTL 24h)
 */
export async function getEprocEventDictionaryCached(): Promise<Record<string, EprocEventEntry>> {
  // 1. Tentar cache de memória
  if (memoryCache) return memoryCache;

  // 2. Tentar localStorage com TTL
  try {
    const ttl = localStorage.getItem(CACHE_TTL_KEY);
    const cached = localStorage.getItem(CACHE_KEY);
    if (ttl && cached && Date.now() < Number(ttl)) {
      memoryCache = JSON.parse(cached);
      return memoryCache!;
    }
  } catch (_) {
    // Ignorar erros de localStorage
  }

  // 3. Buscar do Supabase via fetch (sem depender de tipos)
  try {
    const response = await fetch(
      `${ENV_SUPABASE_URL}/rest/v1/nija_eproc_event_dictionary?is_active=eq.true&select=code,label,meaning,category`,
      {
        headers: {
          "apikey": ENV_SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${ENV_SUPABASE_ANON_KEY}`,
        },
      }
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    const dict: Record<string, EprocEventEntry> = {};
    (data ?? []).forEach((row: any) => {
      const code = String(row.code || "").toUpperCase();
      if (!code) return;
      dict[code] = {
        code,
        label: row.label || "",
        meaning: row.meaning || "",
        category: (row.category as EprocEventCategory) || "OUTRO",
      };
    });

    memoryCache = dict;
    
    // Salvar no localStorage
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(dict));
      localStorage.setItem(CACHE_TTL_KEY, String(Date.now() + TTL_MS));
    } catch (_) {
      // Ignorar erros de localStorage
    }

    return dict;
  } catch (err) {
    console.warn("[eprocEventDictionary] Erro ao buscar dicionário:", err);
    
    // Fallback: tentar cache expirado
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        memoryCache = JSON.parse(cached);
        return memoryCache!;
      }
    } catch (_) {}
    
    // Retornar dicionário hardcoded básico como último fallback
    return getHardcodedDictionary();
  }
}

/**
 * Dicionário hardcoded básico para fallback quando Supabase não está disponível
 */
function getHardcodedDictionary(): Record<string, EprocEventEntry> {
  return {
    "INIC1": { code: "INIC1", label: "Petição Inicial", meaning: "Documento que inaugura o processo judicial", category: "PROTOCOLO" },
    "DESP1": { code: "DESP1", label: "Despacho", meaning: "Determinação do juiz sem conteúdo decisório", category: "DECISAO" },
    "SENT1": { code: "SENT1", label: "Sentença", meaning: "Decisão que resolve o mérito ou extingue o processo", category: "SENTENCA" },
    "CERT1": { code: "CERT1", label: "Certidão", meaning: "Declaração de ato ou fato processual pelo cartório", category: "OUTRO" },
    "MAND1": { code: "MAND1", label: "Mandado", meaning: "Ordem judicial para cumprimento de determinação", category: "OUTRO" },
    "INTM1": { code: "INTM1", label: "Intimação", meaning: "Comunicação processual às partes ou advogados", category: "INTIMACAO" },
    "CITA1": { code: "CITA1", label: "Citação", meaning: "Comunicação ao réu para integrar o processo", category: "CITACAO" },
    "CONT1": { code: "CONT1", label: "Contestação", meaning: "Resposta do réu à petição inicial", category: "OUTRO" },
    "PETI1": { code: "PETI1", label: "Petição", meaning: "Requerimento das partes ao juízo", category: "OUTRO" },
    "DECI1": { code: "DECI1", label: "Decisão Interlocutória", meaning: "Decisão que resolve questão incidente", category: "DECISAO" },
    "AUDI1": { code: "AUDI1", label: "Ata de Audiência", meaning: "Registro de audiência realizada", category: "AUDIENCIA" },
    "BLOC1": { code: "BLOC1", label: "Bloqueio de Valores", meaning: "Ordem de bloqueio via Bacenjud/Sisbajud", category: "PENHORA" },
    "PENH1": { code: "PENH1", label: "Penhora", meaning: "Constrição de bens para garantia da execução", category: "PENHORA" },
    "EMBA1": { code: "EMBA1", label: "Embargos", meaning: "Recurso ou impugnação à execução", category: "OUTRO" },
    "REPL1": { code: "REPL1", label: "Réplica", meaning: "Manifestação do autor sobre a contestação", category: "OUTRO" },
    "ACOR1": { code: "ACOR1", label: "Acordo", meaning: "Composição amigável entre as partes", category: "OUTRO" },
    "TRAN1": { code: "TRAN1", label: "Trânsito em Julgado", meaning: "Certificação de que não cabe mais recurso", category: "OUTRO" },
    "ARQU1": { code: "ARQU1", label: "Arquivamento", meaning: "Encerramento físico do processo", category: "OUTRO" },
  };
}

/**
 * Infere categoria do evento com base no texto (fallback quando não encontra no dicionário)
 */
export function inferCategoryFromText(text: string): EprocEventCategory {
  const upper = text.toUpperCase();
  if (/CIT[AÇ]|CITE-SE/i.test(upper)) return "CITACAO";
  if (/INTIM[AÇ]|INTIME-SE/i.test(upper)) return "INTIMACAO";
  if (/AUDI[ÊE]NCIA/i.test(upper)) return "AUDIENCIA";
  if (/PRAZO|SUSPENS/i.test(upper)) return "PRAZO";
  if (/PENHORA|BLOQUEIO|BACEN|SISBAJUD|RENAJUD/i.test(upper)) return "PENHORA";
  if (/SENTEN[CÇ]A/i.test(upper)) return "SENTENCA";
  if (/DECIS[AÃ]O|DESPACHO/i.test(upper)) return "DECISAO";
  if (/DISTRIBUI|PROTOCOLO|INICIAL/i.test(upper)) return "PROTOCOLO";
  return "OUTRO";
}

/**
 * Enriquece um evento com dados do dicionário eProc
 */
export async function enrichEprocEvent(
  rawDescription: string, 
  rawDate?: string,
  eventNumber?: number
): Promise<EnrichedEprocEvent> {
  const dict = await getEprocEventDictionaryCached();
  
  // Extrair código do evento (ex: DESP1, INIC1, SENT1)
  const codeMatch = rawDescription.match(/\b([A-Z]{2,6}[0-9]{1,3})\b/i);
  const code = codeMatch?.[1]?.toUpperCase();
  
  // Converter data para ISO se possível
  let dateISO: string | undefined;
  if (rawDate) {
    const parts = rawDate.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (parts) {
      dateISO = `${parts[3]}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
    }
  }
  
  // Gerar excerpt (primeiros 150 chars da descrição)
  const excerpt = rawDescription.length > 150 
    ? rawDescription.substring(0, 150) + "..." 
    : rawDescription;
  
  if (code && dict[code]) {
    return {
      rawDescription,
      code,
      label: dict[code].label,
      meaning: dict[code].meaning,
      category: dict[code].category,
      dateISO,
      rawDate,
      excerpt,
      confidence: "alta",
      source: "pdf_local",
      eventNumber,
    };
  }
  
  // Fallback: inferir categoria por palavras-chave
  const category = inferCategoryFromText(rawDescription);
  
  return {
    rawDescription,
    code: code || undefined,
    category,
    dateISO,
    rawDate,
    excerpt,
    confidence: code ? "media" : "baixa",
    source: "pdf_local",
    eventNumber,
  };
}

/**
 * Limpa cache do dicionário (útil para forçar refresh)
 */
export function clearEprocEventCache(): void {
  memoryCache = null;
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TTL_KEY);
  } catch (_) {
    // Ignorar erros de localStorage
  }
}
