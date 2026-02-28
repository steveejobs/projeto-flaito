/**
 * Validates a CNJ (Conselho Nacional de Justiça) process number.
 * Format: NNNNNNN-DD.AAAA.J.TR.OOOO
 * Where:
 * - NNNNNNN: 7-digit sequential number
 * - DD: 2-digit check digit
 * - AAAA: 4-digit year
 * - J: 1-digit justice segment
 * - TR: 2-digit court (tribunal)
 * - OOOO: 4-digit origin unit
 */

// Remove all non-digits
const onlyDigits = (value: string): string => value.replace(/\D/g, '');

// Calculate CNJ check digit using modulo 97
const calculateCheckDigit = (proc: string, year: string, justice: string, court: string, origin: string): string => {
  // The algorithm: remainder = ((NNNNNNN * 10000000000 + AAAA * 1000000 + JTR * 10000 + OOOO) * 100) mod 97
  // DV = 97 - remainder
  
  const procNum = BigInt(proc.padStart(7, '0'));
  const yearNum = BigInt(year.padStart(4, '0'));
  const justiceNum = BigInt(justice.padStart(1, '0'));
  const courtNum = BigInt(court.padStart(2, '0'));
  const originNum = BigInt(origin.padStart(4, '0'));
  
  // Compose the number: NNNNNNN.AAAA.J.TR.OOOO (without DV)
  // Position: proc(7) + year(4) + justice(1) + court(2) + origin(4) = 18 digits
  // Formula for check digit calculation per CNJ Resolução 65/2008
  const composed = procNum * BigInt(10000000000) + yearNum * BigInt(1000000) + justiceNum * BigInt(100000) + courtNum * BigInt(10000) + originNum;
  
  const remainder = Number((composed * BigInt(100)) % BigInt(97));
  const dv = 97 - remainder;
  
  return dv.toString().padStart(2, '0');
};

// Parse CNJ number and extract components
const parseCNJ = (value: string): { proc: string; dv: string; year: string; justice: string; court: string; origin: string } | null => {
  const digits = onlyDigits(value);
  
  // Must have exactly 20 digits
  if (digits.length !== 20) {
    return null;
  }
  
  return {
    proc: digits.substring(0, 7),
    dv: digits.substring(7, 9),
    year: digits.substring(9, 13),
    justice: digits.substring(13, 14),
    court: digits.substring(14, 16),
    origin: digits.substring(16, 20),
  };
};

// Validate CNJ format (with or without separators)
export const isValidCNJFormat = (value: string): boolean => {
  // Accept formats: NNNNNNN-DD.AAAA.J.TR.OOOO or 20 digits without separators
  const digits = onlyDigits(value);
  return digits.length === 20;
};

// Validate CNJ check digit
export const isValidCNJCheckDigit = (value: string): boolean => {
  const parsed = parseCNJ(value);
  if (!parsed) return false;
  
  const expectedDV = calculateCheckDigit(parsed.proc, parsed.year, parsed.justice, parsed.court, parsed.origin);
  return parsed.dv === expectedDV;
};

// Full CNJ validation (format + check digit)
export const validateCNJ = (value: string): { valid: boolean; error?: string } => {
  if (!value || value.trim() === '') {
    return { valid: true }; // Empty is valid (optional)
  }
  
  if (!isValidCNJFormat(value)) {
    return { valid: false, error: 'Formato inválido. Use: NNNNNNN-DD.AAAA.J.TR.OOOO (20 dígitos)' };
  }
  
  if (!isValidCNJCheckDigit(value)) {
    return { valid: false, error: 'Dígito verificador inválido' };
  }
  
  return { valid: true };
};

// Format CNJ number with separators
export const formatCNJ = (value: string): string => {
  const digits = onlyDigits(value);
  if (digits.length !== 20) return value;
  
  const proc = digits.substring(0, 7);
  const dv = digits.substring(7, 9);
  const year = digits.substring(9, 13);
  const justice = digits.substring(13, 14);
  const court = digits.substring(14, 16);
  const origin = digits.substring(16, 20);
  
  return `${proc}-${dv}.${year}.${justice}.${court}.${origin}`;
};

// Generate internal identifier: LEX-YYYY-######
export const generateInternalId = (): string => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `LEX-${year}-${random}`;
};
