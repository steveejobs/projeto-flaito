-- ============================================================
-- MILSTONE: INSTITUTIONAL DOCUMENT ENGINE & GOVERNANCE
-- PHASE 4: PROFESSIONAL STARTER CATALOG (SEED v3)
-- ============================================================

-- 1. SEED SYSTEM TEMPLATES
-- Canonical Syntax: {{category.key}}

INSERT INTO public.document_templates (id, name, category, code, vertical, is_system, is_active, content, ai_instructions)
VALUES 
(
    '50000000-0000-0000-0000-000000000001',
    'Procuração Ad Judicia (Padrão)',
    'PROCURAÇÃO',
    'PROC_PADRAO_LEGAL',
    'LEGAL',
    true,
    true,
    '<!DOCTYPE html><html><body><h1 style="text-align:center">PROCURAÇÃO AD JUDICIA ET EXTRA</h1><p><strong>OUTORGANTE:</strong> {{client.full_name}}, inscrito no CPF sob nº {{client.cpf}}.</p><p><strong>OUTORGADO:</strong> {{office.name}}, sociedade de advogados...</p><p><strong>PODERES:</strong> Por este instrumento, o outorgante confere aos outorgados amplos poderes para o foro em geral...</p><br><p style="text-align:right">Brasília, {{custom.data_extenso}}</p></body></html>',
    'Ao preencher campos personalizados, mantenha o tom formal. Use a cidade do escritório para o local.'
),
(
    '50000000-0000-0000-0000-000000000002',
    'Contrato de Honorários Advocatícios',
    'CONTRATO',
    'CONT_HONORARIOS_BASE',
    'LEGAL',
    true,
    true,
    '<!DOCTYPE html><html><body><h1 style="text-align:center">CONTRATO DE PRESTAÇÃO DE SERVIÇOS JURÍDICOS</h1><p><strong>CONTRATANTE:</strong> {{client.full_name}}.</p><p><strong>CONTRATADA:</strong> {{office.name}}.</p><p><strong>OBJETO:</strong> Acompanhamento do processo {{case.cnj_number}}.</p><p><strong>VALOR:</strong> O valor pactuado é de R$ {{custom.valor_numeral}} ({{custom.valor_extenso}}).</p></body></html>',
    'Escreva o valor por extenso entre parênteses logo após o numeral.'
),
(
    '50000000-0000-0000-0000-000000000003',
    'Laudo de Consulta Médica (Base)',
    'LAUDO',
    'LAUDO_CLINICO_BASE',
    'MEDICAL',
    true,
    true,
    '<!DOCTYPE html><html><body><h1 style="text-align:center">LAUDO MÉDICO</h1><p><strong>PACIENTE:</strong> {{client.full_name}}</p><p><strong>DATA:</strong> {{custom.data_atendimento}}</p><hr><p><strong>RESUMO CLÍNICO:</strong></p><p>{{custom.anamnese_ia}}</p><br><br><p style="text-align:center">Assinado digitalmente por {{user.name}}</p></body></html>',
    'Consolide os sintomas relatados pelo paciente em um parágrafo técnico e objetivo.'
)
ON CONFLICT (id) DO NOTHING;

-- 2. PUBLISH INITIAL VERSIONS
INSERT INTO public.document_template_versions (template_id, version_number, content_html, status, published_at, change_log)
SELECT id, 1, content, 'published', now(), 'Carga inicial de sistema (v3)'
FROM public.document_templates
WHERE id IN (
    '50000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000003'
)
ON CONFLICT (template_id, version_number) DO NOTHING;

-- 3. LINK ACTIVE VERSION ID
UPDATE public.document_templates t
SET active_version_id = v.id
FROM public.document_template_versions v
WHERE t.id = v.template_id AND v.version_number = 1;

-- 4. SEED CUSTOM VARIABLES (Office-side definition support)
INSERT INTO public.document_variables (key, label, type, source_type, vertical, category, required, help_text)
VALUES 
    ('custom.valor_numeral', 'Valor dos Honorários (R$)', 'currency', 'manual', 'LEGAL', 'Contratual', true, 'Apenas números e pontos.'),
    ('custom.valor_extenso', 'Valor por Extenso', 'text', 'manual', 'LEGAL', 'Contratual', true, 'Ex: Dois mil reais.'),
    ('custom.data_extenso', 'Data por Extenso', 'text', 'manual', 'BOTH', 'Geral', true, 'Ex: 21 de Abril de 2026.'),
    ('custom.anamnese_ia', 'Resumo da Anamnese (IA)', 'long_text', 'ai', 'MEDICAL', 'Clínico', true, 'Consolidado gerado pela análise de voz/chat.')
ON CONFLICT (office_id, key) DO NOTHING;
