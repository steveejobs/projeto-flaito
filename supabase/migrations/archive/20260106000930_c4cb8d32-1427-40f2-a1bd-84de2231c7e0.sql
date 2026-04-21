-- Atualizar templates PROC, DECL e CONTRATO para aumentar o tamanho da assinatura do cliente
-- Muda max-height: 60px para max-height: 100px na imagem da assinatura

UPDATE document_templates
SET content = REPLACE(content, 'max-height: 60px', 'max-height: 100px')
WHERE code IN ('PROC', 'DECL', 'CONTRATO')
  AND content LIKE '%client.signature_base64%'
  AND content LIKE '%max-height: 60px%';