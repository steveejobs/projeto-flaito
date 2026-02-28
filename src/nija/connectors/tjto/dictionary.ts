import { supabase } from "@/integrations/supabase/client";

export type TjtoDocEntry = { label: string; legal_desc: string; category: string };
export type EnrichedDoc = { raw: string; code?: string; label?: string; legal_desc?: string; category?: string };

const CACHE_KEY = "nija:tjto:dict:v1";
const CACHE_TTL_KEY = "nija:tjto:dict:v1:ttl";
const TTL_MS = 24 * 60 * 60 * 1000;

let memoryCache: Record<string, TjtoDocEntry> | null = null;

export function extractDocCode(raw: string): string | null {
  // Padrão 1: "VisualizarINIC1" ou similar
  const m1 = raw.match(/Visualizar([A-Z]+[0-9]+)/i);
  if (m1?.[1]) return m1[1].toUpperCase();
  
  // Padrão 2: Código no final da string (ex: "documento INIC1")
  const m2 = raw.match(/([A-Z]+[0-9]+)$/i);
  if (m2?.[1]) return m2[1].toUpperCase();
  
  // Padrão 3: Código no início após hífen (ex: "- INIC1 Petição")
  const m3 = raw.match(/[-–]\s*([A-Z]+[0-9]+)\s/i);
  if (m3?.[1]) return m3[1].toUpperCase();
  
  // Padrão 4: Código entre parênteses (ex: "(DESP1)")
  const m4 = raw.match(/\(([A-Z]+[0-9]+)\)/i);
  if (m4?.[1]) return m4[1].toUpperCase();
  
  // Padrão 5: Código isolado no texto (ex: "PETIÇÃO INICIAL INIC1")
  const m5 = raw.match(/\b([A-Z]{2,6}[0-9]{1,3})\b/i);
  if (m5?.[1]) return m5[1].toUpperCase();
  
  return null;
}

export async function getTjtoDictionaryCached(): Promise<Record<string, TjtoDocEntry>> {
  if (memoryCache) return memoryCache;

  try {
    const ttl = localStorage.getItem(CACHE_TTL_KEY);
    const cached = localStorage.getItem(CACHE_KEY);
    if (ttl && cached && Date.now() < Number(ttl)) {
      memoryCache = JSON.parse(cached);
      return memoryCache!;
    }
  } catch (_) {}

  try {
    const { data, error } = await supabase
      .from("nija_tjto_document_dictionary")
      .select("code,label,legal_desc,category")
      .eq("active", true);

    if (error) throw error;

    const dict: Record<string, TjtoDocEntry> = {};
    (data ?? []).forEach((row: any) => {
      const code = String(row.code || "").toUpperCase();
      if (!code) return;
      dict[code] = {
        label: String(row.label || ""),
        legal_desc: String(row.legal_desc || ""),
        category: String(row.category || ""),
      };
    });

    memoryCache = dict;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(dict));
      localStorage.setItem(CACHE_TTL_KEY, String(Date.now() + TTL_MS));
    } catch (_) {}

    return dict;
  } catch (err) {
    console.error("[tjtoDictionary] fetch error", err);
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        memoryCache = JSON.parse(cached);
        return memoryCache!;
      }
    } catch (_) {}
    return {};
  }
}

export async function enrichDoc(raw: string): Promise<EnrichedDoc> {
  const code = extractDocCode(raw || "");
  if (!code) return { raw, label: "Outros Documentos", category: "ANEXO" };

  const dict = await getTjtoDictionaryCached();
  const entry = dict[code];

  if (!entry) return { raw, code, label: "Outros Documentos", category: "ANEXO" };

  return { raw, code, label: entry.label, legal_desc: entry.legal_desc, category: entry.category };
}

export function clearTjtoCache(): void {
  memoryCache = null;
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TTL_KEY);
  } catch (_) {}
}
