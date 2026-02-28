/**
 * Utility para construir analysis_key única para deduplicação de snapshots NIJA.
 * analysis_key = sha256(documents_hash + actingSide + ramo + mode + engine_version)
 */

const ENGINE_VERSION = "3.0-hybrid";

export interface AnalysisKeyParams {
  documentsHash: string;
  actingSide: "AUTOR" | "REU";
  ramo: string;
  mode: "SUPERVISED" | "AUTOMATIC";
  engineVersion?: string;
}

/**
 * Constrói um hash SHA-256 representando a chave única de uma análise NIJA.
 * Essa chave é usada para buscar snapshots existentes antes de reprocessar.
 */
export async function buildAnalysisKey(params: AnalysisKeyParams): Promise<string> {
  const payload = JSON.stringify({
    documentsHash: params.documentsHash,
    actingSide: params.actingSide,
    ramo: params.ramo || "AUTO",
    mode: params.mode,
    engineVersion: params.engineVersion || ENGINE_VERSION,
  });

  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const buf = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(buf));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Computa hash dos documentos para uso na analysis_key.
 */
export async function computeDocumentsHash(
  documents: Array<{ id: string; filename: string; content: string; kind?: string }>
): Promise<string> {
  if (!documents || documents.length === 0) return "NO_DOCS";

  const minimalDocs = documents.map((d) => ({
    id: d.id,
    kind: d.kind,
    filename: d.filename,
    contentLength: d.content?.length || 0,
  }));

  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(minimalDocs));

  const buf = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(buf));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
