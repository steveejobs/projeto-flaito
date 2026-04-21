-- Remove temporariamente o trigger de proteção
DROP TRIGGER trg_block_default_templates ON public.document_templates;

-- Atualiza template PROC - Procuração (global)
UPDATE public.document_templates
SET content = '<style>
  @page {
    size: A4;
    margin: 2.5cm 2cm 2.5cm 3cm;
  }
  body {
    font-family: "Times New Roman", serif;
    font-size: 12pt;
    line-height: 1.4;
  }
  .header {
    text-align: center;
    margin-bottom: 10px;
  }
  .header img {
    max-width: 180px;
    margin-bottom: 6px;
  }
  .title {
    text-align: center;
    font-weight: bold;
    margin: 16px 0;
    text-transform: uppercase;
  }
  .signature-block {
    margin-top: 40px;
    text-align: center;
  }
  hr {
    margin: 8px 0 12px 0;
  }
</style>

<body>
  <div class="header">
    {{#if office.logo_signed_url}}
      <img src="{{office.logo_signed_url}}" alt="Logo">
    {{/if}}
    <div><strong>{{office.nome_escritorio}}</strong></div>
    <div>{{office.endereco_completo}} – {{office.cidade}}/{{office.estado}}</div>
    <div>CNPJ: {{office.cnpj}} • OAB: {{office.responsavel_oab}}{{office.responsavel_oab_uf}}</div>
    <div>Tel: {{office.telefone}} • E-mail: {{office.email}}</div>
    <hr>
  </div>

  <div class="title">PROCURAÇÃO – AD JUDICIA ET EXTRA</div>

  <p>
    {{client.nome_completo}}, {{client.nacionalidade}}, {{client.estado_civil}},
    {{client.profissao}}, portador(a) do {{client.documento_tipo}} nº {{client.documento_numero}},
    inscrito(a) no CPF sob nº {{client.cpf}}, residente e domiciliado(a) em
    {{client.endereco_completo}}, doravante denominado(a) <strong>OUTORGANTE</strong>,
    nomeia e constitui seu bastante procurador o(a) advogado(a)
    <strong>{{office.responsavel_nome}}</strong>, inscrito(a) na OAB
    {{office.responsavel_oab_uf}} sob nº {{office.responsavel_oab}}, com escritório profissional em
    {{office.endereco_completo}}, {{office.cidade}}/{{office.estado}},
    doravante denominado(a) <strong>OUTORGADO(A)</strong>.
  </p>

  <p>
    O(A) OUTORGADO(A) recebe poderes gerais e especiais para, em nome do(a) OUTORGANTE,
    representá-lo(a) em quaisquer juízos, instâncias ou tribunais, em causas de natureza
    cível, criminal, trabalhista, previdenciária, administrativa, consumerista e demais
    áreas do Direito, podendo, para tanto:
  </p>

  <p>
    a) propor ações, apresentar defesas, reconvenções, recursos e contrarrazões;<br>
    b) firmar acordos, receber, dar quitação, transigir, renunciar a direitos disponíveis,
    firmar termos de compromisso e declarações;<br>
    c) requerer certidões, vista e extração de cópias de autos físicos e eletrônicos;<br>
    d) substabelecer, com ou sem reservas de iguais poderes;<br>
    e) praticar todos os demais atos necessários ao fiel cumprimento deste mandato,
    com a cláusula <em>"ad judicia et extra"</em>, inclusive com poderes especiais
    para firmar acordos e receber valores.
  </p>

  <p>
    Os poderes aqui conferidos vigoram até expressa revogação por parte do(a) OUTORGANTE.
  </p>

  <p>
    {{office.cidade}}, {{data_extenso}}.
  </p>

  <div class="signature-block">
    ___________________________________________<br>
    {{client.nome_completo}}<br>
    CPF: {{client.cpf}}
  </div>
</body>',
    updated_at = now()
WHERE id = 'c7f7b944-5e74-43dc-91f3-2f4934be5fb3';

-- Atualiza template DECL - Declaração (global)
UPDATE public.document_templates
SET content = '<style>
  @page {
    size: A4;
    margin: 2.5cm 2cm 2.5cm 3cm;
  }
  body {
    font-family: "Times New Roman", serif;
    font-size: 12pt;
    line-height: 1.4;
  }
  .header {
    text-align: center;
    margin-bottom: 10px;
  }
  .header img {
    max-width: 180px;
    margin-bottom: 6px;
  }
  .title {
    text-align: center;
    font-weight: bold;
    margin: 16px 0;
    text-transform: uppercase;
  }
  .signature-block {
    margin-top: 40px;
    text-align: center;
  }
  hr {
    margin: 8px 0 12px 0;
  }
</style>

<body>
  <div class="header">
    {{#if office.logo_signed_url}}
      <img src="{{office.logo_signed_url}}" alt="Logo">
    {{/if}}
    <div><strong>{{office.nome_escritorio}}</strong></div>
    <div>{{office.endereco_completo}} – {{office.cidade}}/{{office.estado}}</div>
    <div>CNPJ: {{office.cnpj}} • OAB: {{office.responsavel_oab}}{{office.responsavel_oab_uf}}</div>
    <div>Tel: {{office.telefone}} • E-mail: {{office.email}}</div>
    <hr>
  </div>

  <div class="title">DECLARAÇÃO</div>

  <p>
    Eu, <strong>{{client.nome_completo}}</strong>, {{client.nacionalidade}},
    {{client.estado_civil}}, {{client.profissao}}, portador(a) do
    {{client.documento_tipo}} nº {{client.documento_numero}}, inscrito(a) no CPF sob nº
    {{client.cpf}}, residente e domiciliado(a) em {{client.endereco_completo}},
    declaro, para os devidos fins, que:
  </p>

  <p>
    {{decl.conteudo_declaracao}}
  </p>

  <p>
    Declaro, ainda, estar ciente de que as informações aqui prestadas são verdadeiras
    e de minha inteira responsabilidade, sujeitando-me às sanções civis, administrativas
    e penais cabíveis em caso de falsidade.
  </p>

  <p>
    {{office.cidade}}, {{data_extenso}}.
  </p>

  <div class="signature-block">
    ___________________________________________<br>
    {{client.nome_completo}}<br>
    CPF: {{client.cpf}}
  </div>
</body>',
    updated_at = now()
WHERE id = '16f55ad8-11b7-401d-b9c7-2d8311fa2fe1';

-- Atualiza template CONTRATO - Contrato de Honorários (global)
UPDATE public.document_templates
SET content = '<style>
  @page {
    size: A4;
    margin: 2.5cm 2cm 2.5cm 3cm;
  }
  body {
    font-family: "Times New Roman", serif;
    font-size: 12pt;
    line-height: 1.4;
  }
  .header {
    text-align: center;
    margin-bottom: 10px;
  }
  .header img {
    max-width: 180px;
    margin-bottom: 6px;
  }
  .title {
    text-align: center;
    font-weight: bold;
    margin: 16px 0;
    text-transform: uppercase;
  }
  .clause-title {
    font-weight: bold;
    margin-top: 12px;
  }
  .signature-grid {
    margin-top: 40px;
    display: flex;
    justify-content: space-between;
  }
  .signature-col {
    width: 45%;
    text-align: center;
  }
  hr {
    margin: 8px 0 12px 0;
  }
</style>

<body>
  <div class="header">
    {{#if office.logo_signed_url}}
      <img src="{{office.logo_signed_url}}" alt="Logo">
    {{/if}}
    <div><strong>{{office.nome_escritorio}}</strong></div>
    <div>{{office.endereco_completo}} – {{office.cidade}}/{{office.estado}}</div>
    <div>CNPJ: {{office.cnpj}} • OAB: {{office.responsavel_oab}}{{office.responsavel_oab_uf}}</div>
    <div>Tel: {{office.telefone}} • E-mail: {{office.email}}</div>
    <hr>
  </div>

  <div class="title">CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS</div>

  <p>
    Pelo presente instrumento particular, de um lado
    <strong>{{client.nome_completo}}</strong>, {{client.nacionalidade}},
    {{client.estado_civil}}, {{client.profissao}}, portador(a) do
    {{client.documento_tipo}} nº {{client.documento_numero}}, CPF nº {{client.cpf}},
    residente e domiciliado(a) em {{client.endereco_completo}}, doravante denominado(a)
    <strong>CONTRATANTE</strong>;
    e, de outro lado, <strong>{{office.nome_escritorio}}</strong>, inscrita no CNPJ sob
    nº {{office.cnpj}}, com sede em {{office.endereco_completo}},
    {{office.cidade}}/{{office.estado}}, neste ato representada por seu(sua) sócio(a)
    <strong>{{office.responsavel_nome}}</strong>, OAB {{office.responsavel_oab_uf}}
    {{office.responsavel_oab}}, doravante denominado(a) <strong>CONTRATADO(A)</strong>,
    têm entre si justo e contratado o seguinte:
  </p>

  <p class="clause-title">CLÁUSULA 1ª – DO OBJETO</p>
  <p>
    O presente contrato tem por objeto a prestação de serviços advocatícios consistentes em:
    <strong>{{contract.objeto_contrato}}</strong>, bem como todas as medidas judiciais e
    extrajudiciais necessárias à defesa dos interesses do(a) CONTRATANTE.
  </p>

  <p class="clause-title">CLÁUSULA 2ª – DOS HONORÁRIOS</p>
  <p>
    Pelos serviços ora contratados, o(a) CONTRATANTE pagará ao(à) CONTRATADO(A)
    o valor total de <strong>{{contract.valor_honorarios_total}}</strong>, da seguinte forma:
  </p>
  <p>
    – Entrada: <strong>{{contract.valor_honorarios_entrada}}</strong><br>
    – Parcelas: <strong>{{contract.qtd_parcelas}}</strong> parcela(s) de
    <strong>{{contract.valor_honorarios_parcela}}</strong><br>
    – Forma de pagamento: <strong>{{contract.forma_pagamento}}</strong>.
  </p>
  <p>
    O não pagamento de qualquer parcela na data aprazada sujeitará o(a) CONTRATANTE
    à multa de {{contract.multa_percentual}}% sobre o valor em atraso, acrescida de
    juros de {{contract.juros_percentual}}% ao mês e correção monetária.
  </p>

  <p class="clause-title">CLÁUSULA 3ª – DAS DESPESAS</p>
  <p>
    Custas processuais, emolumentos, diligências, honorários de peritos e demais gastos
    necessários à condução do processo correrão por conta do(a) CONTRATANTE,
    que se compromete a adiantá-los sempre que solicitado, mediante comprovação.
  </p>

  <p class="clause-title">CLÁUSULA 4ª – DA VIGÊNCIA E RESCISÃO</p>
  <p>
    O presente contrato vigerá pelo prazo necessário ao término dos serviços descritos
    na Cláusula 1ª, podendo ser rescindido por qualquer das partes, mediante comunicação
    por escrito, respeitados os honorários proporcionais ao trabalho já realizado,
    de acordo com a Tabela de Honorários da OAB.
  </p>

  <p class="clause-title">CLÁUSULA 5ª – DO FORO</p>
  <p>
    Fica eleito o foro da Comarca de {{office.cidade}}/{{office.estado}}, com renúncia
    a qualquer outro, por mais privilegiado que seja, para dirimir eventuais controvérsias
    oriundas deste contrato.
  </p>

  <p>
    E, por estarem justos e contratados, firmam o presente em {{contract.numero_vias}}
    via(s) de igual teor e forma.
  </p>

  <p>
    {{office.cidade}}, {{data_extenso}}.
  </p>

  <div class="signature-grid">
    <div class="signature-col">
      ___________________________________________<br>
      {{client.nome_completo}}<br>
      CONTRATANTE
    </div>
    <div class="signature-col">
      ___________________________________________<br>
      {{office.responsavel_nome}}<br>
      OAB {{office.responsavel_oab_uf}} {{office.responsavel_oab}}<br>
      CONTRATADO(A)
    </div>
  </div>
</body>',
    updated_at = now()
WHERE id = '51528f78-41d7-4d5a-b6dd-6064e1204ad6';

-- Recria o trigger de proteção
CREATE TRIGGER trg_block_default_templates
  BEFORE UPDATE ON public.document_templates
  FOR EACH ROW
  EXECUTE FUNCTION block_edit_default_templates();