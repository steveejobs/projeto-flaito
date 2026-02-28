// Domínio base do sistema Lexos
// Em produção, usar o domínio do app publicado
// Pode ser configurado via variável de ambiente se necessário
export const APP_BASE_URL =
  import.meta.env.VITE_APP_BASE_URL ||
  'http://localhost:8080';
