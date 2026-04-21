-- Remove o campo "Local e data" do template CONTRATO para o escritório específico
-- e também do template global para manter sincronizado

-- Template global
UPDATE public.document_templates
SET content = REPLACE(content, 
  '  <div class="clausula">
    <p class="clausula-texto"><strong>Local e data:</strong> <span id="localData"></span></p>
  </div>

  <!-- ASSINATURAS -->', 
  '  <!-- ASSINATURAS -->'),
  updated_at = now()
WHERE code = 'CONTRATO' AND office_id IS NULL;

-- Template office-specific
UPDATE public.document_templates
SET content = REPLACE(content, 
  '  <div class="clausula">
    <p class="clausula-texto"><strong>Local e data:</strong> <span id="localData"></span></p>
  </div>

  <!-- ASSINATURAS -->', 
  '  <!-- ASSINATURAS -->'),
  updated_at = now()
WHERE code = 'CONTRATO' AND office_id = '13196431-0967-407c-ba93-8cadce4a51e1';