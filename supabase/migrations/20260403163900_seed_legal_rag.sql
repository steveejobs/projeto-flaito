-- Seeds de documentos jurídicos para RAG (legal_documents)
-- Foco: Temas recorrentes para validação do Motor V2

INSERT INTO legal_documents (title, type, ramo, content, context_metadata)
VALUES
('Tese: Inversão do Ônus da Prova no CDC', 'TESE', 'CIVIL', 
'A inversão do ônus da prova, nos termos do artigo 6º, inciso VIII, do Código de Defesa do Consumidor, não é automática, dependendo da constatação de verossimilhança das alegações ou da hipossuficiência do consumidor. No entanto, em casos de falha na prestação de serviço bancário, a prova da regularidade da transação cabe exclusivamente à instituição financeira, dado o seu dever de segurança.',
'{"tags": ["CDC", "Consumidor", "Ônus da Prova", "Bancário"]}'::jsonb),

('Precedente: Dano Moral In Re Ipsa - Inscrição Indevida', 'PRECEDENTE', 'CIVIL', 
'O Superior Tribunal de Justiça (STJ) consolidou o entendimento de que a inscrição indevida do nome do consumidor em cadastros de inadimplentes configura dano moral in re ipsa, ou seja, dano presumido que dispensa a prova do efetivo prejuízo. Valor médio de indenização fixado entre 5 e 15 salários mínimos, conforme a capacidade econômica das partes.',
'{"tribunal": "STJ", "sumula": "385", "tags": ["SPC", "SERASA", "Dano Moral"]}'::jsonb),

('Tese: Prescrição Intercorrente Execução Fiscal', 'TESE', 'FAZENDARIA', 
'Nos termos da Súmula 314 do STJ, "em execução fiscal, não localizados bens penhoráveis, suspende-se o processo por um ano, findo o qual se inicia o prazo da prescrição quinquenal intercorrente". A contagem é automática e independe de nova intimação da Fazenda Pública após o decurso do prazo de suspensão.',
'{"tags": ["Tributário", "Execução Fiscal", "Prescrição"]}'::jsonb),

('Precedente: Responsabilidade Objetiva do Hospital', 'PRECEDENTE', 'CIVIL', 
'A responsabilidade dos hospitais, no que tange aos serviços técnico-hospitalares (hospedagem, alimentação, exames, enfermagem), é objetiva, prescindindo da prova de culpa. Contudo, quanto aos atos médicos, a responsabilidade é subjetiva, dependendo da prova da culpa do profissional (negligência, imprudência ou imperícia).',
'{"tribunal": "STJ", "tags": ["Saúde", "Erro Médico", "Responsabilidade Civil"]}'::jsonb),

('Tese: Estabilidade Provisória da Gestante', 'TESE', 'TRABALHISTA', 
'O desconhecimento do estado gravídico pelo empregador não afasta o direito ao pagamento da indenização decorrente da estabilidade (Art. 10, II, b, do ADCT). A proteção objetiva a maternidade e o nascituro, sendo devida a reintegração ou indenização substitutiva desde a concepção até cinco meses após o parto.',
'{"tags": ["Trabalhista", "Gestante", "Estabilidade"]}'::jsonb),

('Precedente: Desconsideração da Personalidade Jurídica', 'PRECEDENTE', 'CIVIL', 
'Para a aplicação da Teoria Maior da desconsideração (Art. 50 do Código Civil), exige-se a demonstração de desvio de finalidade ou confusão patrimonial. Já para a Teoria Menor (Art. 28, § 5º do CDC), basta que a personalidade jurídica seja obstáculo ao ressarcimento de prejuízos causados aos consumidores.',
'{"tags": ["Empresarial", "CDC", "Execução"]}'::jsonb),

('Tese: Cerceamento de Defesa - Indeferimento de Oitiva', 'TESE', 'CIVIL', 
'O indeferimento de prova testemunhal tempestivamente requerida e essencial para o esclarecimento de fatos controversos configura cerceamento de defesa e violação ao princípio do contraditório e da ampla defesa (Art. 5º, LV, CF). A nulidade da sentença é impositiva para reabertura da instrução processual.',
'{"tags": ["Processual", "Provas", "Nulidade"]}'::jsonb),

('Precedente: Taxas Condominiais - Natureza Propter Rem', 'PRECEDENTE', 'CIVIL', 
'As dívidas de condomínio têm natureza propter rem, aderindo à coisa e obrigando o proprietário atual, ainda que originadas em data anterior à aquisição. A legitimidade passiva pode ser tanto do proprietário constante do registro quanto do promitente comprador, desde que comprovada a imissão na posse e ciência do condomínio.',
'{"tags": ["Imobiliário", "Condomínio", "STJ"]}'::jsonb),

('Tese: Impenhorabilidade do Bem de Família', 'TESE', 'CIVIL', 
'O imóvel residencial próprio do casal, ou da entidade familiar, é impenhorável e não responderá por qualquer tipo de dívida civil, comercial, fiscal, previdenciária ou de outra natureza, salvo as exceções taxativas da Lei 8.009/90 (ex: fiança em contrato de locação, pensão alimentícia).',
'{"tags": ["Execução", "Família", "Lei 8009/90"]}'::jsonb),

('Precedente: Danos Estéticos e Dano Moral - Cumulatividade', 'PRECEDENTE', 'CIVIL', 
'Súmula 387 do STJ: "É lícita a cumulação das indenizações de dano estético e dano moral". Embora originados do mesmo fato, as rubricas possuem fundamentos distintos: um focado na dor psíquica/sofrimento e outro na alteração física/deformidade permanente da vítima.',
'{"tribunal": "STJ", "sumula": "387", "tags": ["Responsabilidade Civil", "Acidente"]}'::jsonb);
