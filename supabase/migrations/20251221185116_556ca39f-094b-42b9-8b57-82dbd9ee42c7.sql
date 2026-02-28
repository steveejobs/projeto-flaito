-- Desabilita temporariamente o trigger que bloqueia edição de templates default
ALTER TABLE document_templates DISABLE TRIGGER trg_block_default_templates;

-- Atualiza template DECL (Declaração) com formatação igual à PROC
UPDATE document_templates
SET content = '<style>
  @page {
    size: A4;
    margin: 2.5cm 2.5cm 2.5cm 2.5cm;
  }
  body {
    font-family: "Times New Roman", serif;
    font-size: 12pt;
    line-height: 1.8;
    text-align: justify;
    color: #1a1a1a;
  }
  .header {
    text-align: center;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 2px solid #333;
  }
  .header img {
    max-width: 160px;
    margin-bottom: 10px;
  }
  .header .office-name {
    font-size: 14pt;
    font-weight: bold;
    margin-bottom: 4px;
  }
  .header .office-details {
    font-size: 10pt;
    color: #444;
    line-height: 1.5;
  }
  .title {
    text-align: center;
    font-weight: bold;
    font-size: 14pt;
    margin: 30px 0 25px 0;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  p {
    margin-bottom: 16px;
    text-indent: 2em;
  }
  p:first-of-type {
    text-indent: 0;
  }
  .location-date {
    text-align: right;
    margin-top: 30px;
    text-indent: 0;
  }
  .signature-block {
    margin-top: 50px;
    text-align: center;
  }
  .signature-block .signature-image {
    margin-bottom: 5px;
  }
  .signature-block .signature-image img {
    max-width: 200px;
    max-height: 80px;
  }
  .signature-block .signature-line {
    width: 300px;
    border-bottom: 1px solid #333;
    margin: 0 auto 8px auto;
  }
  .signature-block .signer-name {
    font-weight: bold;
    margin-bottom: 2px;
  }
  .signature-block .signer-doc {
    font-size: 10pt;
    color: #444;
  }
</style>

<body>
  <div class="header">
    {{#if office.logo_signed_url}}
      <img src="{{office.logo_signed_url}}" alt="Logo do Escritório">
    {{/if}}
    <div class="office-name">{{office.nome_escritorio}}</div>
    <div class="office-details">
      {{office.endereco_completo}} – {{office.cidade}}/{{office.estado}}<br>
      CNPJ: {{office.cnpj}} • OAB/{{office.responsavel_oab_uf}}: {{office.responsavel_oab}}<br>
      Tel: {{office.telefone}} • E-mail: {{office.email}}
    </div>
  </div>

  <div class="title">DECLARAÇÃO</div>

  <p>
    Eu, <strong>{{client.nome_completo}}</strong>, {{client.nacionalidade}}, {{client.estado_civil}},
    {{client.profissao}}, portador(a) do {{client.documento_tipo}} nº {{client.documento_numero}},
    inscrito(a) no CPF sob nº {{client.cpf}}, residente e domiciliado(a) em {{client.endereco_completo}},
    <strong>DECLARO</strong>, para todos os fins de direito, que as informações e documentos
    fornecidos ao escritório <strong>{{office.nome_escritorio}}</strong> são verdadeiros
    e correspondem à realidade dos fatos que pretendo ver apreciados judicial ou extrajudicialmente.
  </p>

  <p>
    Declaro, ainda, estar ciente de que a prestação de informações inverídicas pode
    caracterizar ilícito civil e/ou penal, assumindo integral responsabilidade pelas
    declarações prestadas e pelos documentos entregues.
  </p>

  <p>
    Autorizo o(a) advogado(a) responsável, <strong>{{office.responsavel_nome}}</strong>,
    inscrito(a) na OAB/{{office.responsavel_oab_uf}} nº {{office.responsavel_oab}}, a utilizar
    tais informações e documentos em minha defesa ou em meu favor, em processos judiciais
    ou procedimentos administrativos, respeitados o sigilo profissional e a legislação aplicável.
  </p>

  <p class="location-date">
    {{office.cidade}}, {{data_extenso}}.
  </p>

  <div class="signature-block">
    {{#if client.signature_base64}}
      <div class="signature-image">
        <img src="{{client.signature_base64}}" alt="Assinatura">
      </div>
    {{else}}
      <div class="signature-line"></div>
    {{/if}}
    <div class="signer-name">{{client.nome_completo}}</div>
    <div class="signer-doc">CPF: {{client.cpf}}</div>
  </div>
</body>',
    updated_at = now()
WHERE code = 'DECL' AND is_default = true;

-- Atualiza template CONTRATO (Contrato de Honorários) com formatação igual à PROC
UPDATE document_templates
SET content = '<style>
  @page {
    size: A4;
    margin: 2.5cm 2.5cm 2.5cm 2.5cm;
  }
  body {
    font-family: "Times New Roman", serif;
    font-size: 12pt;
    line-height: 1.8;
    text-align: justify;
    color: #1a1a1a;
  }
  .header {
    text-align: center;
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 2px solid #333;
  }
  .header img {
    max-width: 160px;
    margin-bottom: 10px;
  }
  .header .office-name {
    font-size: 14pt;
    font-weight: bold;
    margin-bottom: 4px;
  }
  .header .office-details {
    font-size: 10pt;
    color: #444;
    line-height: 1.5;
  }
  .title {
    text-align: center;
    font-weight: bold;
    font-size: 14pt;
    margin: 30px 0 25px 0;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  p {
    margin-bottom: 16px;
    text-indent: 2em;
  }
  p:first-of-type {
    text-indent: 0;
  }
  .clause-title {
    font-weight: bold;
    font-size: 12pt;
    margin-top: 20px;
    margin-bottom: 10px;
    text-indent: 0;
    text-transform: uppercase;
  }
  .location-date {
    text-align: right;
    margin-top: 30px;
    text-indent: 0;
  }
  .signature-blocks {
    margin-top: 50px;
    display: flex;
    justify-content: space-between;
    gap: 40px;
  }
  .signature-col {
    flex: 1;
    text-align: center;
  }
  .signature-col .signature-image {
    margin-bottom: 5px;
  }
  .signature-col .signature-image img {
    max-width: 180px;
    max-height: 70px;
  }
  .signature-col .signature-line {
    width: 100%;
    border-bottom: 1px solid #333;
    margin: 0 auto 8px auto;
  }
  .signature-col .signer-name {
    font-weight: bold;
    margin-bottom: 2px;
    font-size: 11pt;
  }
  .signature-col .signer-doc {
    font-size: 10pt;
    color: #444;
  }
</style>

<body>
  <div class="header">
    {{#if office.logo_signed_url}}
      <img src="{{office.logo_signed_url}}" alt="Logo do Escritório">
    {{/if}}
    <div class="office-name">{{office.nome_escritorio}}</div>
    <div class="office-details">
      {{office.endereco_completo}} – {{office.cidade}}/{{office.estado}}<br>
      CNPJ: {{office.cnpj}} • OAB/{{office.responsavel_oab_uf}}: {{office.responsavel_oab}}<br>
      Tel: {{office.telefone}} • E-mail: {{office.email}}
    </div>
  </div>

  <div class="title">CONTRATO DE HONORÁRIOS ADVOCATÍCIOS</div>

  <p>
    Pelo presente instrumento particular, de um lado,
    <strong>{{client.nome_completo}}</strong>, {{client.nacionalidade}}, {{client.estado_civil}},
    {{client.profissao}}, portador(a) do {{client.documento_tipo}} nº {{client.documento_numero}},
    inscrito(a) no CPF sob nº {{client.cpf}}, residente e domiciliado(a) em
    {{client.endereco_completo}}, doravante denominado(a) <strong>CONTRATANTE</strong>;
    e, de outro lado, <strong>{{office.nome_escritorio}}</strong>, inscrito no CNPJ sob nº
    {{office.cnpj}}, com sede em {{office.endereco_completo}}, {{office.cidade}}/{{office.estado}},
    neste ato representado por seu(sua) responsável técnico(a),
    <strong>{{office.responsavel_nome}}</strong>, inscrito(a) na OAB/{{office.responsavel_oab_uf}}
    sob nº {{office.responsavel_oab}}, doravante denominado(a) <strong>CONTRATADO(A)</strong>,
    têm entre si justo e contratado o seguinte:
  </p>

  <p class="clause-title">CLÁUSULA 1ª – DO OBJETO</p>
  <p>
    O presente contrato tem por objeto a prestação de serviços de advocacia e consultoria
    jurídica em favor do(a) CONTRATANTE, consistentes em:
    <strong>[DESCREVER O OBJETO DA ATUAÇÃO]</strong>.
  </p>

  <p class="clause-title">CLÁUSULA 2ª – DOS HONORÁRIOS</p>
  <p>
    Pelos serviços ora contratados, o(a) CONTRATANTE pagará ao(à) CONTRATADO(A)
    honorários no valor total de <strong>R$ ________ ({{honorarios_valor_extenso}})</strong>,
    a serem pagos da seguinte forma: <strong>{{honorarios_forma_pagamento}}</strong>.
  </p>

  <p>
    Nos casos em que houver êxito econômico (acordo, procedência, recebimento de valores,
    liberação de bens ou créditos), o(a) CONTRATADO(A) fará jus, ainda, a honorários de
    êxito correspondentes a <strong>_____% (por cento)</strong> sobre o benefício econômico
    obtido pelo(a) CONTRATANTE, além dos honorários ora ajustados.
  </p>

  <p class="clause-title">CLÁUSULA 3ª – DAS DESPESAS</p>
  <p>
    Todas as despesas necessárias à condução do caso (custas processuais, taxas, emolumentos,
    diligências de oficiais de justiça, despesas com correios, cópias, deslocamentos,
    perícias, entre outras) correrão por conta do(a) CONTRATANTE, que se compromete a
    efetuar os pagamentos sempre que solicitado(a), mediante apresentação de guias,
    orçamentos ou comprovantes.
  </p>

  <p class="clause-title">CLÁUSULA 4ª – DAS OBRIGAÇÕES DAS PARTES</p>
  <p>
    O(A) CONTRATADO(A) se obriga a atuar com zelo, diligência e observância das normas
    éticas da OAB, mantendo o(a) CONTRATANTE informado(a) sobre o andamento relevante do
    caso. O(A) CONTRATANTE se obriga a prestar informações verdadeiras, fornecer documentos
    necessários e manter atualizados seus dados de contato.
  </p>

  <p class="clause-title">CLÁUSULA 5ª – DA VIGÊNCIA E RESCISÃO</p>
  <p>
    O presente contrato entra em vigor na data de sua assinatura e vigorará até a conclusão
    dos serviços contratados, podendo ser rescindido por qualquer das partes, mediante
    comunicação por escrito, observados os honorários proporcionais ao trabalho já
    desenvolvido, sem prejuízo de eventuais honorários de êxito se o resultado já tiver
    sido alcançado ou estiver garantido.
  </p>

  <p class="clause-title">CLÁUSULA 6ª – DO FORO</p>
  <p>
    Para dirimir quaisquer controvérsias oriundas deste contrato, as partes elegem o foro
    da Comarca de <strong>{{office.cidade}}/{{office.estado}}</strong>, com renúncia a
    qualquer outro, por mais privilegiado que seja.
  </p>

  <p>
    E, por estarem assim justos e contratados, firmam o presente instrumento em
    2 (duas) vias de igual teor e forma.
  </p>

  <p class="location-date">
    {{office.cidade}}, {{data_extenso}}.
  </p>

  <div class="signature-blocks">
    <div class="signature-col">
      {{#if client.signature_base64}}
        <div class="signature-image">
          <img src="{{client.signature_base64}}" alt="Assinatura do Contratante">
        </div>
      {{else}}
        <div class="signature-line"></div>
      {{/if}}
      <div class="signer-name">{{client.nome_completo}}</div>
      <div class="signer-doc">CPF: {{client.cpf}}</div>
    </div>
    <div class="signature-col">
      {{#if office.signature_signed_url}}
        <div class="signature-image">
          <img src="{{office.signature_signed_url}}" alt="Assinatura do Advogado">
        </div>
      {{else}}
        <div class="signature-line"></div>
      {{/if}}
      <div class="signer-name">{{office.responsavel_nome}}</div>
      <div class="signer-doc">OAB/{{office.responsavel_oab_uf}} nº {{office.responsavel_oab}}</div>
    </div>
  </div>
</body>',
    updated_at = now()
WHERE code = 'CONTRATO' AND is_default = true;

-- Reabilita o trigger
ALTER TABLE document_templates ENABLE TRIGGER trg_block_default_templates;