// src/lib/nija/eventSegments.ts
// Gerenciamento de segmentos de eventos (case_event_segments)

import { supabase } from "@/integrations/supabase/client";
import type { EprocEventCategory } from "@/nija/connectors/eproc/eventDictionary";

/**
 * Tipos de documentos processuais identificáveis
 */
export type DocumentNature = 
  | "peticao" 
  | "decisao" 
  | "comunicacao" 
  | "prova" 
  | "sistemico"
  | "procuracao"
  | "anexo";

/**
 * Estrutura de um segmento de evento para inserção
 */
export interface EventSegmentInput {
  caseId: string;
  eventId: string;
  officeId: string;
  seqNumber: number;
  eventDate: string | null; // ISO date
  rawDescription: string;
  documentNature: DocumentNature;
  label: string;
  tjtoCode?: string | null;
  excerpt?: string | null;
  confidence: "high" | "medium" | "low";
}

/**
 * Estrutura de um segmento de evento retornado do banco
 */
export interface EventSegment {
  id: string;
  case_id: string;
  event_id: string;
  office_id: string;
  seq: number;
  event_date: string | null;
  raw_description: string;
  document_nature: DocumentNature;
  label: string;
  tjto_code: string | null;
  excerpt: string | null;
  confidence: "high" | "medium" | "low";
  created_at: string;
}

/**
 * Mapeia categoria eProc para nature
 */
export function mapCategoryToNature(category: EprocEventCategory | string | undefined): DocumentNature {
  if (!category) return "sistemico";
  
  const normalized = category.toLowerCase();
  
  switch (normalized) {
    case "peticao":
    case "petição":
      return "peticao";
    case "decisao":
    case "decisão":
      return "decisao";
    case "comunicacao":
    case "comunicação":
      return "comunicacao";
    case "prova":
      return "prova";
    case "procuracao":
    case "procuração":
      return "procuracao";
    case "anexo":
      return "anexo";
    case "sistemico":
    case "sistêmico":
    default:
      return "sistemico";
  }
}

/**
 * Salva segmentos de eventos no banco
 */
export async function saveEventSegments(
  segments: EventSegmentInput[]
): Promise<{ success: boolean; count: number; error?: string }> {
  if (segments.length === 0) {
    return { success: true, count: 0 };
  }
  
  // Preparar dados para inserção
  const rows = segments.map((seg) => ({
    case_id: seg.caseId,
    event_id: seg.eventId,
    office_id: seg.officeId,
    seq: seg.seqNumber,
    event_date: seg.eventDate,
    raw_description: seg.rawDescription,
    document_nature: seg.documentNature,
    label: seg.label,
    tjto_code: seg.tjtoCode || null,
    excerpt: seg.excerpt || null,
    confidence: seg.confidence,
  }));
  
  // NOTE: Types will be updated after regenerating Supabase types
  const { error } = await (supabase as any)
    .from("case_event_segments")
    .insert(rows);
  if (error) {
    console.error("[eventSegments] Erro ao salvar segmentos:", error);
    return { success: false, count: 0, error: error.message };
  }
  
  console.log(`[eventSegments] ${rows.length} segmentos salvos`);
  return { success: true, count: rows.length };
}

/**
 * Remove todos os segmentos de um evento específico
 */
export async function deleteEventSegments(eventId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("case_event_segments")
    .delete()
    .eq("event_id", eventId);
  
  if (error) {
    console.error("[eventSegments] Erro ao deletar segmentos:", error);
  }
}

/**
 * Remove todos os segmentos de um caso
 */
export async function deleteCaseSegments(caseId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("case_event_segments")
    .delete()
    .eq("case_id", caseId);
  
  if (error) {
    console.error("[eventSegments] Erro ao deletar segmentos do caso:", error);
  }
}

/**
 * Busca segmentos de um caso
 */
export async function getCaseSegments(caseId: string): Promise<EventSegment[]> {
  const { data, error } = await (supabase as any)
    .from("case_event_segments")
    .select("*")
    .eq("case_id", caseId)
    .order("seq", { ascending: true });
  
  if (error) {
    console.error("[eventSegments] Erro ao buscar segmentos:", error);
    return [];
  }
  
  return (data || []) as EventSegment[];
}

/**
 * Busca segmentos por nature (tipo de documento)
 */
export async function getSegmentsByNature(
  caseId: string, 
  nature: DocumentNature
): Promise<EventSegment[]> {
  const { data, error } = await (supabase as any)
    .from("case_event_segments")
    .select("*")
    .eq("case_id", caseId)
    .eq("document_nature", nature)
    .order("event_date", { ascending: false });
  
  if (error) {
    console.error("[eventSegments] Erro ao buscar por nature:", error);
    return [];
  }
  
  return (data || []) as EventSegment[];
}

/**
 * Atualiza a natureza de um segmento específico
 */
export async function updateSegmentNature(
  segmentId: string,
  newNature: DocumentNature
): Promise<{ success: boolean; error?: string }> {
  const { error } = await (supabase as any)
    .from("case_event_segments")
    .update({ document_nature: newNature })
    .eq("id", segmentId);
  
  if (error) {
    console.error("[eventSegments] Erro ao atualizar nature:", error);
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

/**
 * Labels amigáveis para cada DocumentNature
 */
export const NATURE_LABELS: Record<DocumentNature, string> = {
  peticao: "Petição",
  decisao: "Decisão",
  comunicacao: "Comunicação",
  prova: "Prova",
  sistemico: "Sistêmico",
  procuracao: "Procuração",
  anexo: "Anexo",
};
