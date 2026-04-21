-- ============================================================
-- MILSTONE: INSTITUTIONAL DOCUMENT ENGINE & GOVERNANCE
-- PHASE 4: PROFESSIONAL STARTER CATALOG (SEED)
-- ============================================================

-- 1. SEED SYSTEM TEMPLATES (Global)
-- Using the canonical syntax: {{entity.key}}

INSERT INTO public.document_templates (id, name, category, code, vertical, is_active, content, ai_instructions)
VALUES 
(
    '50000000-0000-0000-0000-000000000001',
    'Procuração Ad Judicia (Padrão)',
    'PROCURAÇÃO',
    'PROC_PADRAO_LEGAL',
    'LEGAL',
    true,
    '<h1>PROCURAÇÃO AD JUDICIA ET EXTRA</h1>
    <p><strong>OUTORGANTE:</strong> {{client.full_name}}, CPF nº {{client.cpf}}, residente e domiciliado em {{client.address}}.</p>
    <p><strong>OUTORGADO:</strong> {{office.name}}, através de seus advogados constituídos.</p>
    <p><strong>PODERES:</strong> Pelo presente instrumento, o outorgante confere aos outorgados amplos poderes para o foro em geral, com a cláusula ad judicia et extra, em qualquer juízo, instância ou tribunal...</p>
    <p>Cidade: {{custom.cidade}}, Data: {{custom.data_atual}}</p>',
    'Ao preencher campos personalizados, mantenha o tom formal e jurídico. Se houver menção a foro, utilize a cidade fornecida pelo usuário.'
),
(
    '50000000-0000-0000-0000-000000000002',
    'Contrato de Honorários Advocatícios',
    'CONTRATO',
    'CONT_HONORARIOS_BASE',
    'LEGAL',
    true,
    '<h1>CONTRATO DE PRESTAÇÃO DE SERVIÇOS JURÍDICOS</h1>
    <p><strong>CONTRATANTE:</strong> {{client.full_name}}.</p>
    <p><strong>CONTRATADA:</strong> {{office.name}}.</p>
    <p><strong>CLÁUSULA PRIMEIRA - DO OBJETO:</strong> O presente contrato tem como objeto a prestação de serviços jurídicos para acompanhamento do processo {{case.cnj_number}}.</p>
    <p><strong>CLÁUSULA SEGUNDA - DOS HONORÁRIOS:</strong> Pelos serviços pactuados, o CONTRATANTE pagará o valor de {{custom.valor_honorarios}}.</p>',
    'Certifique-se de que o valor dos honorários esteja escrito por extenso após o numeral, se fornecido.'
),
(
    '50000000-0000-0000-0000-000000000003',
    'Declaração de Hipossuficiência',
    'DECLARAÇÃO',
    'DECL_POBREZA_BASE',
    'LEGAL',
    true,
    '<h1>DECLARAÇÃO DE HIPOSSUFICIÊNCIA</h1>
    <p>Eu, {{client.full_name}}, inscrito no CPF sob o nº {{client.cpf}}, DECLARO para os devidos fins de direito, sob as penas da lei, que não possuo condições financeiras de arcar com as custas processuais e honorários advocatícios sem prejuízo do meu próprio sustento e de minha família.</p>
    <p>Por ser verdade, firmo a presente.</p>',
    'Não é necessária intervenção da IA para este documento, exceto se o usuário desejar adicionar observações específicas sobre a renda.'
)
ON CONFLICT (id) DO NOTHING;

-- 2. PUBLISH FIRST VERSIONS
INSERT INTO public.document_template_versions (template_id, version_number, content_html, status, published_at)
SELECT id, 1, content, 'published', now()
FROM public.document_templates
WHERE id IN (
    '50000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000003'
)
ON CONFLICT (template_id, version_number) DO NOTHING;

-- 3. UPDATE ACTIVE VERSION POINTER
UPDATE public.document_templates t
SET active_version_id = v.id
FROM public.document_template_versions v
WHERE t.id = v.template_id AND v.version_number = 1
AND t.id IN (
    '50000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000003'
);
