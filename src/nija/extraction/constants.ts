// src/nija/extraction/constants.ts
// NIJA Extraction Constants - Single Source of Truth
// Sync with: supabase/functions/lexos-extract-text/index.ts

// ============================================================
// FILE & PAGE LIMITS
// ============================================================
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_PAGES = 200;
export const MAX_CHARS_PER_PAGE = 20000;
export const MAX_TOTAL_CHARS = 300000;

// ============================================================
// QUALITY THRESHOLDS
// ============================================================
export const MIN_CHARS_TOTAL = 1500;
export const MIN_COVERAGE_RATIO = 0.35;

// ============================================================
// IMAGE PDF DETECTION
// ============================================================
export const IMAGE_PDF_MIN_COVERAGE = 0.20;
export const IMAGE_PDF_MIN_CHARS = 500;

// ============================================================
// TIMEOUTS
// ============================================================
export const CLIENT_TIMEOUT_MS = 60000;  // 60s client-side
export const SERVER_TIMEOUT_MS = 45000;  // 45s server-side (Edge)

// ============================================================
// OCR MULTI-PAGE
// ============================================================
export const OCR_MAX_PAGES = 5;
export const OCR_RETRIES = 3;
export const OCR_BACKOFF_MS = 500;  // Exponential: 500, 1000, 2000
