-- Atualiza templates PROC para incluir assinatura eletrônica do cliente
UPDATE document_templates 
SET content = regexp_replace(
  content,
  '__________________________________________<br/>\s*<strong>\{\{client\.nome\}\}</strong>',
  CASE 
    WHEN content ~ '\{\{#if client\.signature_base64\}\}' THEN '__________________________________________<br/><strong>{{client.nome}}</strong>'
    ELSE '{{#if client.signature_base64}}<img src="{{client.signature_base64}}" alt="Assinatura" style="max-height:60px; display:block; margin:0 auto 8px;" />{{/if}}__________________________________________<br/><strong>{{client.nome}}</strong>'
  END,
  'g'
)
WHERE code = 'PROC' AND is_active = true;

-- Atualiza templates DECL para incluir assinatura eletrônica do cliente
UPDATE document_templates 
SET content = regexp_replace(
  content,
  '__________________________________________</p>\s*<p style="text-align:center; margin: 0;"><strong>\{\{client\.nome\}\}</strong>',
  CASE 
    WHEN content ~ '\{\{#if client\.signature_base64\}\}' THEN '__________________________________________</p><p style="text-align:center; margin: 0;"><strong>{{client.nome}}</strong>'
    ELSE '{{#if client.signature_base64}}<img src="{{client.signature_base64}}" alt="Assinatura" style="max-height:60px; display:block; margin:0 auto 8px;" />{{/if}}__________________________________________</p><p style="text-align:center; margin: 0;"><strong>{{client.nome}}</strong>'
  END,
  'g'
)
WHERE code = 'DECL' AND is_active = true;

-- Atualiza templates CONTRATO para incluir assinatura eletrônica do cliente
UPDATE document_templates 
SET content = regexp_replace(
  content,
  '__________________________________________<br/>\s*<strong>\{\{client\.nome\}\}</strong><br/>\s*CONTRATANTE',
  CASE 
    WHEN content ~ '\{\{#if client\.signature_base64\}\}' THEN '__________________________________________<br/><strong>{{client.nome}}</strong><br/>CONTRATANTE'
    ELSE '{{#if client.signature_base64}}<img src="{{client.signature_base64}}" alt="Assinatura" style="max-height:60px; display:block; margin:0 auto 8px;" />{{/if}}__________________________________________<br/><strong>{{client.nome}}</strong><br/>CONTRATANTE'
  END,
  'g'
)
WHERE code = 'CONTRATO' AND is_active = true;