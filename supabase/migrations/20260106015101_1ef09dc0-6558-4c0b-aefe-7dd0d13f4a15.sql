-- 1. Corrigir nacionalidade da cliente Amanda
UPDATE public.clients 
SET nationality = 'brasileiro(a)'
WHERE id = '7119e5af-9da4-48dd-b75d-499587198b5d';

-- 2. Atualizar template CONTRATO global - corrigir script JS
UPDATE public.document_templates
SET content = REPLACE(
  REPLACE(
    REPLACE(content,
      -- Trocar textContent para innerHTML no kitVencimentos
      'document.getElementById("kitVencimentos").textContent = s(k.parcelas_datas_vencimento);',
      'document.getElementById("kitVencimentos").innerHTML = k.parcelas_datas_vencimento || "";'
    ),
    -- Adicionar condição por forma_pagamento para vencimentos
    'if (k.parcelas_datas_vencimento) { document.getElementById("vencimentosWrap").style.display = "block";',
    'var isParcelado = k.forma_pagamento === "parcelado" || k.forma_pagamento === "entrada_parcelas"; if (isParcelado && k.parcelas_datas_vencimento) { document.getElementById("vencimentosWrap").style.display = "block";'
  ),
  -- Adicionar condição por forma_pagamento para parcelas
  'if (k.numero_parcelas) { document.getElementById("parcelasWrap").style.display = "block";',
  'if (isParcelado && k.numero_parcelas) { document.getElementById("parcelasWrap").style.display = "block";'
),
updated_at = now()
WHERE code = 'CONTRATO' AND office_id IS NULL;

-- 3. Atualizar template CONTRATO office-specific - mesmas correções
UPDATE public.document_templates
SET content = REPLACE(
  REPLACE(
    REPLACE(content,
      'document.getElementById("kitVencimentos").textContent = s(k.parcelas_datas_vencimento);',
      'document.getElementById("kitVencimentos").innerHTML = k.parcelas_datas_vencimento || "";'
    ),
    'if (k.parcelas_datas_vencimento) { document.getElementById("vencimentosWrap").style.display = "block";',
    'var isParcelado = k.forma_pagamento === "parcelado" || k.forma_pagamento === "entrada_parcelas"; if (isParcelado && k.parcelas_datas_vencimento) { document.getElementById("vencimentosWrap").style.display = "block";'
  ),
  'if (k.numero_parcelas) { document.getElementById("parcelasWrap").style.display = "block";',
  'if (isParcelado && k.numero_parcelas) { document.getElementById("parcelasWrap").style.display = "block";'
),
updated_at = now()
WHERE code = 'CONTRATO' AND office_id = '13196431-0967-407c-ba93-8cadce4a51e1';

-- 4. Adicionar fallback de nacionalidade no script - template global
UPDATE public.document_templates
SET content = REPLACE(content,
  'if (c.nationality) parts.push(c.nationality);',
  'var nacionalidade = c.nationality; if (!nacionalidade || nacionalidade.includes("-") || /^[A-Z]{2}$/i.test(nacionalidade)) { nacionalidade = "brasileiro(a)"; } if (nacionalidade) parts.push(nacionalidade);'
),
updated_at = now()
WHERE code = 'CONTRATO' AND office_id IS NULL;

-- 5. Adicionar fallback de nacionalidade no script - template office-specific
UPDATE public.document_templates
SET content = REPLACE(content,
  'if (c.nationality) parts.push(c.nationality);',
  'var nacionalidade = c.nationality; if (!nacionalidade || nacionalidade.includes("-") || /^[A-Z]{2}$/i.test(nacionalidade)) { nacionalidade = "brasileiro(a)"; } if (nacionalidade) parts.push(nacionalidade);'
),
updated_at = now()
WHERE code = 'CONTRATO' AND office_id = '13196431-0967-407c-ba93-8cadce4a51e1';