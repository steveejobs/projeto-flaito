// src/services/nijaSession.ts
// Service para persistir e recuperar sessões de análise NIJA

import { supabase } from "@/integrations/supabase/client";
import type { EprocExtractionResult } from "@/nija";
import type { Json } from "@/integrations/supabase/types";

export interface NijaSessionData {
  id?: string;
  officeId: string;
  createdBy: string;
  documentsHash: string;
  documentCount: number;
  documentNames: string[];
  documentIds?: string[];
  extractionResult?: EprocExtractionResult | null;
  analysisResult?: unknown | null;
  cnjNumber?: string | null;
  clientName?: string | null;
  opponentName?: string | null;
  actingSide?: "REU" | "AUTOR";
  caseId?: string | null;
  status?: "in_progress" | "completed" | "failed";
}

export interface NijaSessionRow {
  id: string;
  office_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  documents_hash: string;
  document_names: string[];
  document_ids: string[];
  extraction_result: unknown | null;
  analysis_result: unknown | null;
  cnj_number: string | null;
  client_name: string | null;
  opponent_name: string | null;
  acting_side: string | null;
  case_id: string | null;
  status: string;
}

// ======================================================
// LOCAL STORAGE (Sessão atual)
// ======================================================

const NIJA_SESSION_KEY = "nija_current_session";

export function saveSessionToLocalStorage(data: NijaSessionData): void {
  try {
    localStorage.setItem(NIJA_SESSION_KEY, JSON.stringify({
      ...data,
      savedAt: new Date().toISOString(),
    }));
  } catch (err) {
    console.warn("[NijaSession] Erro ao salvar no localStorage:", err);
  }
}

export function getSessionFromLocalStorage(): (NijaSessionData & { savedAt: string }) | null {
  try {
    const stored = localStorage.getItem(NIJA_SESSION_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (err) {
    console.warn("[NijaSession] Erro ao ler localStorage:", err);
    return null;
  }
}

export function clearSessionFromLocalStorage(): void {
  try {
    localStorage.removeItem(NIJA_SESSION_KEY);
  } catch (err) {
    console.warn("[NijaSession] Erro ao limpar localStorage:", err);
  }
}

// ======================================================
// SUPABASE (Histórico completo)
// ======================================================

/**
 * Salva ou atualiza uma sessão NIJA no banco
 */
export async function saveNijaSession(data: NijaSessionData): Promise<string> {
  // Se já existe sessão com mesmo hash, atualiza
  const existing = await findSessionByDocumentsHash(data.officeId, data.documentsHash);
  
  const payload = {
    office_id: data.officeId,
    created_by: data.createdBy,
    documents_hash: data.documentsHash,
    document_names: data.documentNames as Json,
    document_ids: (data.documentIds || []) as Json,
    extraction_result: (data.extractionResult ? JSON.parse(JSON.stringify(data.extractionResult)) : null) as Json,
    analysis_result: (data.analysisResult ? JSON.parse(JSON.stringify(data.analysisResult)) : null) as Json,
    cnj_number: data.cnjNumber || null,
    client_name: data.clientName || null,
    opponent_name: data.opponentName || null,
    acting_side: data.actingSide || null,
    case_id: data.caseId || null,
    status: data.status || "completed",
    updated_at: new Date().toISOString(),
    // Campos obrigatórios existentes (preenchidos com defaults)
    mode: "EXTRACTION_ONLY",
    attachments: [] as Json,
    output_checklist: [] as Json,
    output_alerts: [] as Json,
  };

  if (existing) {
    // Atualizar sessão existente
    const { error } = await supabase
      .from("nija_sessions")
      .update(payload)
      .eq("id", existing.id);

    if (error) throw error;
    return existing.id;
  } else {
    // Criar nova sessão
    const { data: inserted, error } = await supabase
      .from("nija_sessions")
      .insert(payload)
      .select("id")
      .single();

    if (error) throw error;
    return inserted.id;
  }
}

/**
 * Busca sessão pelo hash dos documentos
 */
export async function findSessionByDocumentsHash(
  officeId: string,
  documentsHash: string
): Promise<NijaSessionRow | null> {
  const { data, error } = await supabase
    .from("nija_sessions")
    .select("*")
    .eq("office_id", officeId)
    .eq("documents_hash", documentsHash)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[NijaSession] Erro ao buscar por hash:", error);
    return null;
  }

  return data as NijaSessionRow | null;
}

/**
 * Lista sessões recentes do escritório
 */
export async function listRecentSessions(
  officeId: string,
  limit = 20
): Promise<NijaSessionRow[]> {
  const { data, error } = await supabase
    .from("nija_sessions")
    .select("*")
    .eq("office_id", officeId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[NijaSession] Erro ao listar sessões:", error);
    return [];
  }

  return (data || []) as NijaSessionRow[];
}

/**
 * Busca uma sessão pelo ID
 */
export async function getSessionById(sessionId: string): Promise<NijaSessionRow | null> {
  const { data, error } = await supabase
    .from("nija_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    console.error("[NijaSession] Erro ao buscar sessão:", error);
    return null;
  }

  return data as NijaSessionRow | null;
}

/**
 * Deleta uma sessão
 */
export async function deleteNijaSession(sessionId: string): Promise<boolean> {
  const { error } = await supabase
    .from("nija_sessions")
    .delete()
    .eq("id", sessionId);

  if (error) {
    console.error("[NijaSession] Erro ao deletar sessão:", error);
    return false;
  }

  return true;
}

/**
 * Computa hash SHA-256 dos documentos para comparação
 */
export async function computeDocumentsHash(contents: string[]): Promise<string> {
  const combined = contents.join("|||");
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
