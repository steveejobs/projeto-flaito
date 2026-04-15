export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // Remove tudo que não for dígito
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 0) return null;
  
  // Se começar com 55 e tiver 12 ou 13 dígitos
  if (cleaned.startsWith('55') && cleaned.length >= 12) {
    cleaned = cleaned.substring(2);
  }
  
  // O número limpo (com DDD) geralmente tem 10 ou 11 dígitos
  return cleaned;
}
