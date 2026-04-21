-- Flaito Legal Depth Expansion Seed
-- Adiciona densidade e conteúdo profundo ao acervo jurídico do Flaito

-- 1. Massificar banco_juridico e legal_documents
INSERT INTO public.legal_documents (title, type, content, tags, area, office_id)
VALUES 
    (
        'Petição Inicial - Ação Indenizatória por Erro Médico', 
        'PETICAO', 
        'EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA ___ VARA CÍVEL DA COMARCA DE ...\n\n[NOME DO AUTOR], [QUALIFICAÇÃO]...\n\nI - DOS FATOS\nO Autor submeteu-se a procedimento cirúrgico na data de... \n\nII - DO DIREITO\nA responsabilidade civil do médico, embora subjetiva, restou evidenciada pela negligência configurada em...\n\nIII - DOS PEDIDOS\nRequer a condenação em danos morais e materiais...', 
        ARRAY['civil', 'indenizacao', 'erro medico'], 
        'Civil', 
        'ff000000-0000-0000-0000-000000000000'
    ),
    (
        'Contestação Trabalhista - Justa Causa', 
        'PETICAO', 
        'EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DA ___ VARA DO TRABALHO DE ...\n\n[EMPRESA RECLAMADA]...\n\nI - MÉRITO\nA justa causa aplicada foi proporcional e imediata ao ato de insubordinação grave ocorrido em...', 
        ARRAY['trabalhista', 'contestacao', 'justa causa'], 
        'Trabalhista', 
        'ff000000-0000-0000-0000-000000000000'
    ),
    (
        'Tese de Repercussão Geral: Tema 1046 STF', 
        'TESE', 
        'A validade da norma coletiva de trabalho que limita ou restringe direito trabalhista não assegurado constitucionalmente. É constitucional acordo ou convenção coletiva que restringe direito trabalhista...', 
        ARRAY['stf', 'tema 1046', 'trabalhista', 'sindicato'], 
        'Trabalhista', 
        'ff000000-0000-0000-0000-000000000000'
    ),
    (
        'Súmula 387 STJ', 
        'SUMULA', 
        'É lícita a cumulação das indenizações de dano estético e dano moral.', 
        ARRAY['stj', 'sumula', 'dano estético', 'indenizacao'], 
        'Civil', 
        'ff000000-0000-0000-0000-000000000000'
    ),
    (
        'Procuração Ad Judicia et Extra - Pessoa Jurídica', 
        'PROCURACAO', 
        'OUTORGANTE: [NOME DA EMPRESA], CNPJ nº..., com sede em..., neste ato representada por seu sócio administrador...\n\nOUTORGADO: [NOME DO ADVOGADO], OAB/... nº...\n\nPODERES: Pela presente procuração, a OUTORGANTE nomeia e constitui o OUTORGADO seu bastante procurador, conferindo-lhe poderes amplos, gerais e irrevogáveis para o foro em geral, com a cláusula ad judicia et extra...', 
        ARRAY['procuracao', 'pj', 'representacao'], 
        'Cível', 
        'ff000000-0000-0000-0000-000000000000'
    ),
    (
        'Habeas Corpus - Prisão Preventiva sem Fundamentação', 
        'PETICAO', 
        'EXCELENTÍSSIMO SENHOR DESEMBARGADOR PRESIDENTE DO TRIBUNAL DE JUSTIÇA DO ESTADO DE ...\n\nI. DA ILEGALIDADE DA PRISÃO PREVENTIVA: \nA decisão singular não apontou de forma concreta quais os fundamentos fáticos ensejadores do art. 312 do CPP...', 
        ARRAY['penal', 'habeas corpus', 'preventiva'], 
        'Penal', 
        'ff000000-0000-0000-0000-000000000000'
    );
