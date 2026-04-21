-- =====================================================================================
-- Migration: Seed Legal MVP (Acervo Inicial do Flaito)
-- Description: Insere modelos de petições, teses, súmulas e templates básicos
-- =====================================================================================

-- 1. Ajuste de Policies RLS para permitir leitura pública dos itens seed

-- banco_juridico
CREATE POLICY "Anyone can view system banco_juridico"
    ON public.banco_juridico FOR SELECT
    USING (office_id IS NULL);

-- legal_documents
ALTER TABLE public.legal_documents ALTER COLUMN office_id DROP NOT NULL;
CREATE POLICY "Anyone can view system legal_documents"
    ON public.legal_documents FOR SELECT
    USING (office_id IS NULL);

-- document_templates já não tem policy restritiva explicitada aqui, mas se tiver, é bom:
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view system and their office templates"
    ON public.document_templates FOR SELECT
    USING (office_id IS NULL OR office_id IN (SELECT office_id FROM office_members WHERE user_id = auth.uid()));

-- legal_precedents (Súmulas/Jurisprudência)
ALTER TABLE public.legal_precedents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view system and their office precedents"
    ON public.legal_precedents FOR SELECT
    USING (office_id IS NULL OR office_id IN (SELECT office_id FROM office_members WHERE user_id = auth.uid()));


-- 2. Seed `banco_juridico` (Petições, Teses)
INSERT INTO public.banco_juridico (id, tipo, titulo, descricao, area_direito, texto_completo, tags, autor)
VALUES 
(
    '30000000-0000-0000-0000-000000000001',
    'PETICAO',
    'Ação de Indenização por Danos Morais (Inscrição Indevida SPC/Serasa)',
    'Modelo padrão para ações envolvendo negativação indevida do consumidor.',
    'Consumidor',
    'EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DO JUIZADO ESPECIAL CÍVEL DA COMARCA DE {{cidade}}/{{uf}}
    [... Corpo do modelo para inscrição indevida identificando o autor {{nome}} e a ré {{empresa}} ...]',
    '["dano moral", "consumidor", "negativacao"]'::jsonb,
    'Sistema Flaito'
),
(
    '30000000-0000-0000-0000-000000000002',
    'PETICAO',
    'Mandado de Segurança (Fornecimento de Medicamento)',
    'Ação mandamental contra o Estado para fornecimento de medicação de alto custo.',
    'Saúde / Administrativo',
    'EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA VARA DA FAZENDA PÚBLICA DA COMARCA DE {{cidade}}/{{uf}}
    [... Corpo do modelo de Mandado de Segurança com Pedido Liminar ...]',
    '["medicamento", "saude", "mandado de seguranca"]'::jsonb,
    'Sistema Flaito'
),
(
    '30000000-0000-0000-0000-000000000003',
    'TESE',
    'Prescrição Intercorrente na Execução Fiscal',
    'Tese baseada no REsp 1.340.553/RS (Tema 566 do STJ).',
    'Tributário',
    'A inércia processual da Fazenda Pública por prazo superior àquele definido para a prescrição material acarreta, a depender da prévia citação, a ocorrência de prescrição intercorrente...',
    '["execucao fiscal", "prescricao", "tributario"]'::jsonb,
    'Sistema Flaito'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Seed `legal_precedents` (Súmulas Vinculantes STF)
INSERT INTO public.legal_precedents (id, tipo, titulo, ementa, tribunal, numero, is_binding, status)
VALUES 
(
    '40000000-0000-0000-0000-000000000001',
    'SÚMULA VINCULANTE',
    'SÚMULA VINCULANTE 11 - Uso de Algemas',
    'Só é lícito o uso de algemas em casos de resistência e de fundado receio de fuga ou de perigo à integridade física própria ou alheia...',
    'STF',
    '11',
    true,
    'Ativa'
),
(
    '40000000-0000-0000-0000-000000000002',
    'SÚMULA VINCULANTE',
    'SÚMULA VINCULANTE 14 - Acesso ao Inquérito Policial',
    'É direito do defensor, no interesse do representado, ter acesso amplo aos elementos de prova que, já documentados em procedimento investigatório realizado por órgão com competência de polícia judiciária...',
    'STF',
    '14',
    true,
    'Ativa'
),
(
    '40000000-0000-0000-0000-000000000003',
    'SÚMULA VINCULANTE',
    'SÚMULA VINCULANTE 37 - Aumento de Vencimentos (Poder Judiciário)',
    'Não cabe ao Poder Judiciário, que não tem função legislativa, aumentar vencimentos de servidores públicos sob o fundamento de isonomia.',
    'STF',
    '37',
    true,
    'Ativa'
)
ON CONFLICT (id) DO NOTHING;

-- 4. Seed `document_templates` (Procurações e Contratos)
INSERT INTO public.document_templates (id, name, category, is_active, is_default, content)
VALUES 
(
    '50000000-0000-0000-0000-000000000001',
    'Procuração Ad Judicia',
    'Procurações',
    true,
    true,
    'OUTORGANTE: {{client_name}}, {{client_nationality}}, {{client_marital_status}}, portador do RG nº {{client_rg}}...
    OUTORGADO: {{lawyer_name}}, advogado(a), inscrito sob OAB nº {{oab_number}}...
    PODERES: Cláusula Ad Judicia e Ad Negotia.'
),
(
    '50000000-0000-0000-0000-000000000002',
    'Termo de Consentimento Livre e Esclarecido (TCLE) - Geral',
    'Termos',
    true,
    true,
    'Declaro, sob as penas da Lei, que autorizo o Dr(a). {{lawyer_name}} a prosseguir com a causa descrita... 
    Compreendi todos os riscos e custos.'
)
ON CONFLICT (id) DO NOTHING;
