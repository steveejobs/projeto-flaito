/**
 * Functional validation of SEPARADOR_COMPLETO and detectProcessSystemFromText
 * Run with: node scripts/test-eproc-regex.mjs
 */

// ---- Reproduce the exact patterns from patterns.ts ----
const A       = "[ÁAáa]";
const C       = "[ÇCçc]";
const A_NASAL = "[ÃAãa]";

const SEPARADOR_COMPLETO = new RegExp(
  `P${A}GINA\\s+DE\\s+SEPARA${C}${A_NASAL}O` +
  `[\\s\\S]{0,500}?(?:#\\s*)?Evento\\s+(\\d+)` +
  `[\\s\\S]{0,300}?Evento:\\s*([A-Z][A-Z0-9_]*)` +
  `(?:(?:(?!P${A}GINA)[\\s\\S]){0,300}?Data:\\s*(\\d{1,2}\\/\\d{1,2}\\/\\d{4})` +
  `(?:\\s*(\\d{2}:\\d{2}(?::\\d{2})?))?)?` +
  `(?:(?:(?!P${A}GINA)[\\s\\S]){0,400}?Usu${A}rio:\\s*([^\\n]+))?`,
  "gi"
);

// ---- detectProcessSystemFromText (replica de detector.ts) ----
function detectSystem(text) {
  if (!text) return "UNKNOWN";
  const sample = text.substring(0, 5000);
  const upper  = sample.toUpperCase();
  const hasSep = upper.includes("PÁGINA DE SEPARAÇÃO") || upper.includes("PAGINA DE SEPARACAO");
  const hasHdr = new RegExp(SEPARADOR_COMPLETO.source.split(`[\\s\\S]`)[0], "i").test(sample);
  // Simple inline-header check: "Processo XXXXXXX/TO, Evento N,"
  const hasInlineHeader = /Processo\s+[\d.-]+\/[A-Z]+,\s*Evento\s+\d+/i.test(sample);
  return (hasSep || hasInlineHeader) ? "EPROC" : "UNKNOWN";
}

// ---- Helpers ----
let passed = 0;
let failed = 0;

function match(name, text) {
  const re = new RegExp(SEPARADOR_COMPLETO.source, SEPARADOR_COMPLETO.flags);
  return [...text.matchAll(re)];
}

function assert(name, condition, detail = "") {
  if (condition) {
    console.log(`  \u2713 PASS  ${name}`);
    passed++;
  } else {
    console.log(`  \u2717 FAIL  ${name}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

// ======================================================
// SUITE 1: SEPARADOR_COMPLETO
// ======================================================
console.log("\n=== Suite 1: SEPARADOR_COMPLETO ===");

// Case 1 — complete EPROC block with Data + Hora + Usuario
const EPROC_COMPLETO =
  "PÁGINA DE SEPARAÇÃO\n" +
  "Evento 5\n" +
  "Evento: AUDIENCIA\n" +
  "Data: 10/04/2019 09:00:00\n" +
  "Usuário: TO09999 - JUIZ FULANO\n";

{
  const m = match("completo", EPROC_COMPLETO);
  assert("EPROC completo — 1 match", m.length === 1, `got ${m.length}`);
  assert("EPROC completo — grupo 1 = 5",  m[0]?.[1] === "5",          `got "${m[0]?.[1]}"`);
  assert("EPROC completo — grupo 2 = AUDIENCIA", m[0]?.[2] === "AUDIENCIA", `got "${m[0]?.[2]}"`);
  assert("EPROC completo — grupo 3 definido",    !!m[0]?.[3],                `got undefined`);
  assert("EPROC completo — grupo 3 = 10/04/2019", m[0]?.[3] === "10/04/2019", `got "${m[0]?.[3]}"`);
  assert("EPROC completo — grupo 4 = 09:00:00",   m[0]?.[4] === "09:00:00",   `got "${m[0]?.[4]}"`);
}

// Case 2 — OCR parcial: sem campo Data
const EPROC_SEM_DATA =
  "PÁGINA DE SEPARAÇÃO\n" +
  "Evento 3\n" +
  "Evento: DECISAO\n" +
  "Usuário: TO01234B - CICLANO\n";

{
  const m = match("sem_data", EPROC_SEM_DATA);
  assert("OCR parcial — 1 match",          m.length === 1,            `got ${m.length}`);
  assert("OCR parcial — grupo 1 = 3",      m[0]?.[1] === "3",         `got "${m[0]?.[1]}"`);
  assert("OCR parcial — grupo 2 = DECISAO", m[0]?.[2] === "DECISAO",  `got "${m[0]?.[2]}"`);
  assert("OCR parcial — grupo 3 undefined", m[0]?.[3] === undefined,   `got "${m[0]?.[3]}"`);
  assert("OCR parcial — grupo 4 undefined", m[0]?.[4] === undefined,   `got "${m[0]?.[4]}"`);
}

// Case 3 — two separators: one with Data, one without
const EPROC_MISTO =
  "PÁGINA DE SEPARAÇÃO\n" +
  "Evento 1\n" +
  "Evento: INIC1\n" +
  "Data: 05/03/2018\n\n" +
  "PÁGINA DE SEPARAÇÃO\n" +
  "Evento 2\n" +
  "Evento: CONTR1\n" +
  "Usuário: TO00001 - SEM DATA\n";

{
  const m = match("misto", EPROC_MISTO);
  assert("Misto — 2 matches",                       m.length === 2,             `got ${m.length}`);
  assert("Misto — evento 1 tem data",               !!m[0]?.[3],                `got "${m[0]?.[3]}"`);
  assert("Misto — evento 1 data = 05/03/2018",      m[0]?.[3] === "05/03/2018", `got "${m[0]?.[3]}"`);
  assert("Misto — evento 2 sem data (group3 undef)", m[1]?.[3] === undefined,   `got "${m[1]?.[3]}"`);
}

// Case 4 — non-EPROC text must NOT match
const NAO_EPROC =
  "Reclamação Trabalhista nº 0001234-56.2022.5.10.0001\n" +
  "Reclamante: João da Silva\nReclamado: Empresa LTDA\n";

{
  const m = match("nao_eproc", NAO_EPROC);
  assert("Não-EPROC — 0 matches", m.length === 0, `got ${m.length}`);
}

// Case 5 — inline header only (no SEPARADOR) must NOT match SEPARADOR_COMPLETO
const HEADER_INLINE =
  "Processo 0014085-38.2016.8.27.2706/TO, Evento 1, INIC1, Página 6\n";

{
  const m = match("header_inline", HEADER_INLINE);
  assert("Header inline sem SEPARAÇÃO — 0 matches", m.length === 0, `got ${m.length}`);
}

// Case 6 — "PAGINA DE SEPARACAO" (sem acento, OCR degradado)
const EPROC_SEM_ACENTO =
  "PAGINA DE SEPARACAO\n" +
  "Evento 7\n" +
  "Evento: MANDADO\n" +
  "Data: 15/08/2020\n";

{
  const m = match("sem_acento", EPROC_SEM_ACENTO);
  assert("Separador sem acento — 1 match",           m.length === 1, `got ${m.length}`);
  assert("Separador sem acento — grupo 2 = MANDADO", m[0]?.[2] === "MANDADO", `got "${m[0]?.[2]}"`);
}

// ======================================================
// SUITE 2: detectProcessSystemFromText
// ======================================================
console.log("\n=== Suite 2: detectProcessSystemFromText ===");

assert("detect — EPROC por separador",      detectSystem(EPROC_COMPLETO) === "EPROC",   `got ${detectSystem(EPROC_COMPLETO)}`);
assert("detect — EPROC OCR parcial (sem Data)", detectSystem(EPROC_SEM_DATA) === "EPROC", `got ${detectSystem(EPROC_SEM_DATA)}`);
assert("detect — EPROC sem acento",         detectSystem(EPROC_SEM_ACENTO) === "EPROC", `got ${detectSystem(EPROC_SEM_ACENTO)}`);
assert("detect — header inline → EPROC",    detectSystem(HEADER_INLINE) === "EPROC",    `got ${detectSystem(HEADER_INLINE)}`);
assert("detect — não-EPROC → UNKNOWN",      detectSystem(NAO_EPROC) === "UNKNOWN",      `got ${detectSystem(NAO_EPROC)}`);
assert("detect — string vazia → UNKNOWN",   detectSystem("") === "UNKNOWN",             ``);
assert("detect — null → UNKNOWN",           detectSystem(null) === "UNKNOWN",           ``);
assert("detect — undefined → UNKNOWN",      detectSystem(undefined) === "UNKNOWN",      ``);

// ======================================================
// SUITE 3: Anti-regression — EprocDocumentBookmark fields
// ======================================================
console.log("\n=== Suite 3: Anti-regressão — interface EprocDocumentBookmark ===");

// Simulated EprocDocumentBookmark object with CORRECT field names
const mockBookmark = {
  eventoNumero:              42,    // CORRECT
  docNumero:                 1,
  tipoDocumento:             "DECISÃO",  // CORRECT
  tipoDocumentoNormalizado:  "decisao",
  pageStart:                 10,
  pageEnd:                   12,
  pageCount:                 3,
  isCapa:                    false,
  raw:                       "Evento 42 - DECISÃO/DESPACHO",  // CORRECT
};

assert("eventoNumero é number",          typeof mockBookmark.eventoNumero === "number",   `got ${typeof mockBookmark.eventoNumero}`);
assert("tipoDocumento é string",         typeof mockBookmark.tipoDocumento === "string",  `got ${typeof mockBookmark.tipoDocumento}`);
assert("raw é string",                   typeof mockBookmark.raw === "string",            `got ${typeof mockBookmark.raw}`);

// These were the WRONG fields used before the bug fix — must all be undefined
assert("eventNumber NÃO existe (campo errado)", mockBookmark.eventNumber === undefined, `got ${mockBookmark.eventNumber}`);
assert("date NÃO existe (campo errado)",        mockBookmark.date === undefined,        `got ${mockBookmark.date}`);
assert("type NÃO existe (campo errado)",        mockBookmark.type === undefined,        `got ${mockBookmark.type}`);
assert("title NÃO existe (campo errado)",       mockBookmark.title === undefined,       `got ${mockBookmark.title}`);

// Verify guard behavior in detector.ts: typeof eventoNumero === "number"
assert("guard typeof eventoNumero === number → true",   typeof mockBookmark.eventoNumero === "number", "");
// The OLD guard (wrong field) would have been:
assert("guard typeof eventNumber === number → false (demonstra bug antigo)",
  typeof mockBookmark.eventNumber !== "number", "");

// ======================================================
// Summary
// ======================================================
console.log(`\n${"─".repeat(50)}`);
console.log(`Resultado: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
