-- Atualizar template DECL para usar qualificacao_cliente (sem nome duplicado)
-- A linha 258 do JS muda de: setText($("clientIdent"), client.identificacao_cliente || "");
-- Para: setText($("clientIdent"), client.qualificacao_cliente || "");

UPDATE document_templates
SET content = REPLACE(
  content, 
  'setText($("clientIdent"), client.identificacao_cliente || "");',
  'setText($("clientIdent"), client.qualificacao_cliente || "");'
),
updated_at = NOW()
WHERE code = 'DECL' 
  AND is_active = true;