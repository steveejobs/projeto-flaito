-- Desabilita temporariamente o trigger de bloqueio
ALTER TABLE document_templates DISABLE TRIGGER trg_block_default_templates;

-- Atualiza template PROC (Procuração) global
UPDATE document_templates
SET content = '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 2.5cm; }
    body { 
      font-family: "Times New Roman", Times, serif; 
      font-size: 12pt; 
      line-height: 1.8; 
      color: #1a1a1a;
      text-align: justify;
    }
    .header { 
      text-align: center; 
      margin-bottom: 30px; 
      border-bottom: 2px solid #333;
      padding-bottom: 15px;
    }
    .header-logo { max-height: 80px; margin-bottom: 10px; }
    .header-office { font-size: 14pt; font-weight: bold; margin-bottom: 5px; }
    .header-info { font-size: 10pt; color: #444; line-height: 1.4; }
    .title { 
      font-size: 14pt; 
      font-weight: bold; 
      text-align: center; 
      margin: 30px 0;
      text-transform: uppercase;
    }
    .content { text-indent: 2em; margin-bottom: 1.2em; }
    .signature-section { margin-top: 60px; }
    .signature-block { 
      display: flex; 
      flex-direction: column; 
      align-items: center;
      margin-top: 40px;
    }
    .signature-line { 
      border-top: 1px solid #333; 
      width: 300px; 
      margin-top: 60px;
      padding-top: 5px;
      text-align: center;
    }
    .signature-image { max-width: 250px; max-height: 100px; }
    .footer { 
      margin-top: 40px; 
      text-align: center; 
      font-size: 10pt; 
      color: #666;
      border-top: 1px solid #ccc;
      padding-top: 10px;
    }
    .fallback-text { color: #999; font-style: italic; }
  </style>
</head>
<body>
  <div class="header">
    {{#if office.logo_signed_url}}<img src="{{office.logo_signed_url}}" class="header-logo" alt="Logo">{{/if}}
    <div class="header-office">{{office.nome_escritorio}}</div>
    <div class="header-info">
      {{#if office.endereco_completo}}{{office.endereco_completo}}<br>{{/if}}
      {{#if office.cnpj}}CNPJ: {{office.cnpj}}<br>{{/if}}
      {{#if office.responsavel_oab}}OAB/{{office.responsavel_oab_uf}}: {{office.responsavel_oab}}<br>{{/if}}
      {{#if office.telefone}}Tel: {{office.telefone}}{{/if}}{{#if office.email}} • {{office.email}}{{/if}}
    </div>
  </div>

  <div class="title">PROCURAÇÃO AD JUDICIA ET EXTRA</div>

  <p class="content">
    {{client.identificacao_cliente}}
  </p>

  <p class="content">
    Pelo presente instrumento particular de mandato, nomeia e constitui seu bastante procurador(a) 
    <strong>{{office.responsavel_nome}}</strong>, inscrito(a) na OAB/{{office.responsavel_oab_uf}} sob o nº {{office.responsavel_oab}}, 
    com escritório profissional situado à {{office.endereco_completo}}, para o fim específico de 
    {{#if kit.objeto_contrato}}{{kit.objeto_contrato}}{{else}}<span class="fallback-text">[objeto do mandato a definir]</span>{{/if}}, 
    conferindo-lhe poderes da cláusula "ad judicia et extra", em qualquer Juízo, Instância ou Tribunal, 
    podendo propor ações, contestar, transigir, desistir, receber e dar quitação, 
    firmar compromissos, substabelecer com ou sem reserva de poderes, 
    e praticar todos os atos necessários ao fiel cumprimento do presente mandato.
  </p>

  <div class="signature-section">
    <p style="text-align: center;">
      {{#if office.cidade}}{{office.cidade}}/{{office.estado}}{{else}}[Cidade]{{/if}}, {{data_extenso}}.
    </p>
    
    <div class="signature-block">
      {{#if client.signature_base64}}
        <img src="{{client.signature_base64}}" class="signature-image" alt="Assinatura">
      {{else}}
        <div class="signature-line"></div>
      {{/if}}
      <div style="margin-top: 5px;"><strong>{{client.nome_completo}}</strong></div>
      <div style="font-size: 10pt;">{{#if client.cpf}}CPF: {{client.cpf}}{{else}}{{#if client.cnpj}}CNPJ: {{client.cnpj}}{{/if}}{{/if}}</div>
    </div>
  </div>

  <div class="footer">
    {{office.nome_escritorio}}{{#if office.responsavel_nome}} • {{office.responsavel_nome}}{{/if}}{{#if office.responsavel_oab}} – OAB/{{office.responsavel_oab_uf}} {{office.responsavel_oab}}{{/if}}
  </div>
</body>
</html>',
    updated_at = now()
WHERE code = 'PROC' AND office_id IS NULL;

-- Atualiza template DECL (Declaração) global
UPDATE document_templates
SET content = '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 2.5cm; }
    body { 
      font-family: "Times New Roman", Times, serif; 
      font-size: 12pt; 
      line-height: 1.8; 
      color: #1a1a1a;
      text-align: justify;
    }
    .header { 
      text-align: center; 
      margin-bottom: 30px; 
      border-bottom: 2px solid #333;
      padding-bottom: 15px;
    }
    .header-logo { max-height: 80px; margin-bottom: 10px; }
    .header-office { font-size: 14pt; font-weight: bold; margin-bottom: 5px; }
    .header-info { font-size: 10pt; color: #444; line-height: 1.4; }
    .title { 
      font-size: 14pt; 
      font-weight: bold; 
      text-align: center; 
      margin: 30px 0;
      text-transform: uppercase;
    }
    .content { text-indent: 2em; margin-bottom: 1.2em; }
    .signature-section { margin-top: 60px; }
    .signature-block { 
      display: flex; 
      flex-direction: column; 
      align-items: center;
      margin-top: 40px;
    }
    .signature-line { 
      border-top: 1px solid #333; 
      width: 300px; 
      margin-top: 60px;
      padding-top: 5px;
      text-align: center;
    }
    .signature-image { max-width: 250px; max-height: 100px; }
    .footer { 
      margin-top: 40px; 
      text-align: center; 
      font-size: 10pt; 
      color: #666;
      border-top: 1px solid #ccc;
      padding-top: 10px;
    }
    .fallback-text { color: #999; font-style: italic; }
  </style>
</head>
<body>
  <div class="header">
    {{#if office.logo_signed_url}}<img src="{{office.logo_signed_url}}" class="header-logo" alt="Logo">{{/if}}
    <div class="header-office">{{office.nome_escritorio}}</div>
    <div class="header-info">
      {{#if office.endereco_completo}}{{office.endereco_completo}}<br>{{/if}}
      {{#if office.cnpj}}CNPJ: {{office.cnpj}}<br>{{/if}}
      {{#if office.responsavel_oab}}OAB/{{office.responsavel_oab_uf}}: {{office.responsavel_oab}}<br>{{/if}}
      {{#if office.telefone}}Tel: {{office.telefone}}{{/if}}{{#if office.email}} • {{office.email}}{{/if}}
    </div>
  </div>

  <div class="title">DECLARAÇÃO DE HIPOSSUFICIÊNCIA</div>

  <p class="content">
    {{client.identificacao_cliente}}
  </p>

  <p class="content">
    <strong>DECLARA</strong>, para os devidos fins de direito, sob as penas da lei, que não possui condições financeiras de arcar 
    com as custas processuais e honorários advocatícios sem prejuízo do próprio sustento e de sua família, nos termos do 
    art. 98 e seguintes do Código de Processo Civil e art. 5º, LXXIV, da Constituição Federal.
  </p>

  <p class="content">
    Declara ainda que as informações aqui prestadas são verdadeiras, assumindo integral responsabilidade 
    civil e criminal pelo seu conteúdo.
  </p>

  <div class="signature-section">
    <p style="text-align: center;">
      {{#if office.cidade}}{{office.cidade}}/{{office.estado}}{{else}}[Cidade]{{/if}}, {{data_extenso}}.
    </p>
    
    <div class="signature-block">
      {{#if client.signature_base64}}
        <img src="{{client.signature_base64}}" class="signature-image" alt="Assinatura">
      {{else}}
        <div class="signature-line"></div>
      {{/if}}
      <div style="margin-top: 5px;"><strong>{{client.nome_completo}}</strong></div>
      <div style="font-size: 10pt;">{{#if client.cpf}}CPF: {{client.cpf}}{{else}}{{#if client.cnpj}}CNPJ: {{client.cnpj}}{{/if}}{{/if}}</div>
    </div>
  </div>

  <div class="footer">
    {{office.nome_escritorio}}{{#if office.responsavel_nome}} • {{office.responsavel_nome}}{{/if}}{{#if office.responsavel_oab}} – OAB/{{office.responsavel_oab_uf}} {{office.responsavel_oab}}{{/if}}
  </div>
</body>
</html>',
    updated_at = now()
WHERE code = 'DECL' AND office_id IS NULL;

-- Atualiza template CONTRATO global com correções de variáveis
UPDATE document_templates
SET content = '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { size: A4; margin: 2.5cm; }
    body { 
      font-family: "Times New Roman", Times, serif; 
      font-size: 12pt; 
      line-height: 1.8; 
      color: #1a1a1a;
      text-align: justify;
    }
    .header { 
      text-align: center; 
      margin-bottom: 30px; 
      border-bottom: 2px solid #333;
      padding-bottom: 15px;
    }
    .header-logo { max-height: 80px; margin-bottom: 10px; }
    .header-office { font-size: 14pt; font-weight: bold; margin-bottom: 5px; }
    .header-info { font-size: 10pt; color: #444; line-height: 1.4; }
    .title { 
      font-size: 14pt; 
      font-weight: bold; 
      text-align: center; 
      margin: 30px 0;
      text-transform: uppercase;
    }
    .content { text-indent: 2em; margin-bottom: 1.2em; }
    .clause-title { font-weight: bold; margin-top: 20px; margin-bottom: 10px; }
    .signature-section { margin-top: 60px; }
    .dual-signature { 
      display: flex; 
      justify-content: space-between; 
      margin-top: 50px;
      gap: 40px;
    }
    .signature-block { 
      display: flex; 
      flex-direction: column; 
      align-items: center;
      flex: 1;
    }
    .signature-line { 
      border-top: 1px solid #333; 
      width: 250px; 
      margin-top: 60px;
      padding-top: 5px;
      text-align: center;
    }
    .signature-image { max-width: 250px; max-height: 100px; }
    .footer { 
      margin-top: 40px; 
      text-align: center; 
      font-size: 10pt; 
      color: #666;
      border-top: 1px solid #ccc;
      padding-top: 10px;
    }
    .fallback-text { color: #999; font-style: italic; }
  </style>
</head>
<body>
  <div class="header">
    {{#if office.logo_signed_url}}<img src="{{office.logo_signed_url}}" class="header-logo" alt="Logo">{{/if}}
    <div class="header-office">{{office.nome_escritorio}}</div>
    <div class="header-info">
      {{#if office.endereco_completo}}{{office.endereco_completo}}<br>{{/if}}
      {{#if office.cnpj}}CNPJ: {{office.cnpj}}<br>{{/if}}
      {{#if office.responsavel_oab}}OAB/{{office.responsavel_oab_uf}}: {{office.responsavel_oab}}<br>{{/if}}
      {{#if office.telefone}}Tel: {{office.telefone}}{{/if}}{{#if office.email}} • {{office.email}}{{/if}}
    </div>
  </div>

  <div class="title">CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS</div>

  <p class="content">
    Pelo presente instrumento particular de contrato de prestação de serviços advocatícios, de um lado:
  </p>

  <p class="content">
    <strong>CONTRATANTE:</strong> {{client.identificacao_cliente}}
  </p>

  <p class="content">
    <strong>CONTRATADO:</strong> <strong>{{office.nome_escritorio}}</strong>{{#if office.cnpj}}, inscrito no CNPJ sob o nº {{office.cnpj}}{{/if}}, 
    com sede à {{office.endereco_completo}}, neste ato representado por <strong>{{office.responsavel_nome}}</strong>, 
    inscrito(a) na OAB/{{office.responsavel_oab_uf}} sob o nº {{office.responsavel_oab}}.
  </p>

  <p class="content">
    As partes acima identificadas têm entre si, justo e contratado, o presente instrumento de prestação de serviços advocatícios, 
    que se regerá pelas cláusulas e condições seguintes:
  </p>

  <p class="clause-title">CLÁUSULA PRIMEIRA – DO OBJETO</p>
  <p class="content">
    O presente contrato tem por objeto a prestação de serviços advocatícios consistentes em 
    {{#if kit.objeto_contrato}}{{kit.objeto_contrato}}{{else}}<span class="fallback-text">[descrever o objeto da atuação]</span>{{/if}}.
  </p>

  <p class="clause-title">CLÁUSULA SEGUNDA – DOS HONORÁRIOS</p>
  <p class="content">
    {{#if kit.tipo_remuneracao}}
      {{#if (eq kit.tipo_remuneracao "percentual")}}
        Pelos serviços prestados, o CONTRATANTE pagará ao CONTRATADO honorários advocatícios no percentual de 
        {{#if honorarios_percentual}}{{honorarios_percentual}}%{{else}}<span class="fallback-text">[__]%</span>{{/if}} 
        sobre o proveito econômico obtido na demanda.
      {{else}}
        Pelos serviços prestados, o CONTRATANTE pagará ao CONTRATADO honorários advocatícios no valor de 
        {{#if honorarios_valor_extenso}}R$ {{honorarios_valor_extenso}}{{else}}<span class="fallback-text">R$ [valor a definir]</span>{{/if}}.
      {{/if}}
    {{else}}
      Pelos serviços prestados, o CONTRATANTE pagará ao CONTRATADO honorários advocatícios conforme acordado entre as partes.
    {{/if}}
  </p>

  <p class="clause-title">CLÁUSULA TERCEIRA – DA FORMA DE PAGAMENTO</p>
  <p class="content">
    {{#if honorarios_forma_pagamento}}{{honorarios_forma_pagamento}}{{else}}O pagamento será realizado conforme acordado entre as partes.{{/if}}
  </p>

  <p class="clause-title">CLÁUSULA QUARTA – DAS DESPESAS</p>
  <p class="content">
    As despesas processuais, custas, emolumentos, taxas, honorários periciais e demais gastos necessários ao 
    andamento do processo correrão por conta do CONTRATANTE, devendo ser provisionadas e pagas diretamente 
    ou reembolsadas mediante comprovação.
  </p>

  <p class="clause-title">CLÁUSULA QUINTA – DO FORO</p>
  <p class="content">
    As partes elegem o foro da comarca de 
    {{#if kit.foro_eleito}}{{kit.foro_eleito}}{{else}}{{#if office.cidade}}{{office.cidade}}/{{office.estado}}{{else}}<span class="fallback-text">[cidade/estado]</span>{{/if}}{{/if}} 
    para dirimir quaisquer dúvidas oriundas do presente contrato.
  </p>

  {{#if kit.observacoes}}
  <p class="clause-title">CLÁUSULA SEXTA – DISPOSIÇÕES ESPECIAIS</p>
  <p class="content">{{kit.observacoes}}</p>
  {{/if}}

  <p class="content" style="margin-top: 30px;">
    E por estarem assim justos e contratados, assinam o presente instrumento em duas vias de igual teor e forma.
  </p>

  <div class="signature-section">
    <p style="text-align: center;">
      {{#if office.cidade}}{{office.cidade}}/{{office.estado}}{{else}}[Cidade]{{/if}}, {{data_extenso}}.
    </p>
    
    <div class="dual-signature">
      <div class="signature-block">
        {{#if client.signature_base64}}
          <img src="{{client.signature_base64}}" class="signature-image" alt="Assinatura Contratante">
        {{else}}
          <div class="signature-line"></div>
        {{/if}}
        <div style="margin-top: 5px;"><strong>{{client.nome_completo}}</strong></div>
        <div style="font-size: 10pt;">CONTRATANTE</div>
      </div>
      
      <div class="signature-block">
        {{#if office.signature_signed_url}}
          <img src="{{office.signature_signed_url}}" class="signature-image" alt="Assinatura Contratado">
        {{else}}
          <div class="signature-line"></div>
        {{/if}}
        <div style="margin-top: 5px;"><strong>{{office.responsavel_nome}}</strong></div>
        <div style="font-size: 10pt;">CONTRATADO – OAB/{{office.responsavel_oab_uf}} {{office.responsavel_oab}}</div>
      </div>
    </div>
  </div>

  <div class="footer">
    {{office.nome_escritorio}}{{#if office.responsavel_nome}} • {{office.responsavel_nome}}{{/if}}{{#if office.responsavel_oab}} – OAB/{{office.responsavel_oab_uf}} {{office.responsavel_oab}}{{/if}}
  </div>
</body>
</html>',
    updated_at = now()
WHERE code = 'CONTRATO' AND office_id IS NULL;

-- Reabilita o trigger
ALTER TABLE document_templates ENABLE TRIGGER trg_block_default_templates;