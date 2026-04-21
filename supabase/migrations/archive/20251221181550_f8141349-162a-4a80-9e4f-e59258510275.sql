-- Desabilita temporariamente o trigger para atualizar o template padrão
ALTER TABLE document_templates DISABLE TRIGGER trg_block_default_templates;

-- Atualiza o template de Procuração com visual melhorado e suporte a assinatura
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
  .powers-list {
    margin: 20px 0 20px 2em;
    text-indent: 0;
  }
  .powers-list p {
    text-indent: 0;
    margin-bottom: 8px;
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

  <div class="title">PROCURAÇÃO – AD JUDICIA ET EXTRA</div>

  <p>
    <strong>{{client.nome_completo}}</strong>, {{client.nacionalidade}}, {{client.estado_civil}},
    {{client.profissao}}, portador(a) do {{client.documento_tipo}} nº {{client.documento_numero}},
    inscrito(a) no CPF sob nº {{client.cpf}}, residente e domiciliado(a) em
    {{client.endereco_completo}}, doravante denominado(a) <strong>OUTORGANTE</strong>,
    nomeia e constitui seu bastante procurador o(a) advogado(a)
    <strong>{{office.responsavel_nome}}</strong>, inscrito(a) na OAB/{{office.responsavel_oab_uf}}
    sob nº {{office.responsavel_oab}}, com escritório profissional em
    {{office.endereco_completo}}, {{office.cidade}}/{{office.estado}},
    doravante denominado(a) <strong>OUTORGADO(A)</strong>.
  </p>

  <p>
    O(A) OUTORGADO(A) recebe poderes gerais e especiais para, em nome do(a) OUTORGANTE,
    representá-lo(a) em quaisquer juízos, instâncias ou tribunais, em causas de natureza
    cível, criminal, trabalhista, previdenciária, administrativa, consumerista e demais
    áreas do Direito, podendo, para tanto:
  </p>

  <div class="powers-list">
    <p><strong>a)</strong> propor ações, apresentar defesas, reconvenções, recursos e contrarrazões;</p>
    <p><strong>b)</strong> firmar acordos, receber, dar quitação, transigir, renunciar a direitos disponíveis, firmar termos de compromisso e declarações;</p>
    <p><strong>c)</strong> requerer certidões, vista e extração de cópias de autos físicos e eletrônicos;</p>
    <p><strong>d)</strong> substabelecer, com ou sem reservas de iguais poderes;</p>
    <p><strong>e)</strong> praticar todos os demais atos necessários ao fiel cumprimento deste mandato, com a cláusula <em>"ad judicia et extra"</em>, inclusive com poderes especiais para firmar acordos e receber valores.</p>
  </div>

  <p>
    Os poderes aqui conferidos vigoram até expressa revogação por parte do(a) OUTORGANTE.
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
WHERE code = 'PROC';

-- Reabilita o trigger
ALTER TABLE document_templates ENABLE TRIGGER trg_block_default_templates;