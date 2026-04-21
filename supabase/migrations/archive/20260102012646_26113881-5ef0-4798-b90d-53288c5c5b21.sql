-- Atualiza o template CONTRATO com as 4 correções:
-- 1. Qualificação completa das partes (PF e PJ) usando identificacao_cliente
-- 2. CSS da assinatura do advogado menor (60px)
-- 3. Cronograma de pagamento em HTML (triple braces)
-- 4. CSS para evitar assinatura sozinha em página

UPDATE document_templates
SET content = '<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Contrato de Honorários Advocatícios</title>
  <style>
    @page { size: A4; margin: 30mm 20mm 20mm 30mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.8; color: #222; }
    .office-header {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 20px 25px;
      background: linear-gradient(135deg, #C9A227 0%, #E8D48A 50%, #C9A227 100%);
      border-bottom: 3px solid #8B7355;
      min-height: 100px;
      max-height: 200px;
      overflow: hidden;
    }
    .office-header .office-logo { max-height: {{office.logo_max_height}}; max-width: {{office.logo_max_width}}; object-fit: contain; }
    .office-header .office-info { flex: 1; color: #fff; text-align: right; }
    .office-header .office-name { font-size: 16pt; font-weight: bold; letter-spacing: 1px; margin-bottom: 5px; text-transform: uppercase; }
    .office-header .office-details { font-size: 9pt; line-height: 1.6; opacity: 0.95; }
    .document-title { text-align: center; font-size: 14pt; font-weight: bold; margin: 30px 0 25px; text-transform: uppercase; letter-spacing: 1px; }
    .content { padding: 0 10px; text-align: justify; }
    .clausula { margin-bottom: 20px; }
    .clausula-titulo { font-weight: bold; margin-bottom: 8px; text-transform: uppercase; }
    .clausula-texto { text-indent: 2em; }
    .honorarios-highlight {
      background: linear-gradient(135deg, #fffbe6 0%, #fff9db 100%);
      border-left: 4px solid #C9A227;
      padding: 15px 20px;
      margin: 15px 0;
      border-radius: 0 8px 8px 0;
    }
    .signature-section { margin-top: 30px; page-break-inside: avoid; page-break-before: avoid; }
    .clausula:last-of-type { page-break-after: avoid; }
    .signature-block { display: inline-block; width: 45%; text-align: center; vertical-align: top; margin-top: 30px; }
    .signature-line { border-top: 1px solid #333; margin-top: 60px; padding-top: 8px; }
    .signature-img { max-height: 60px; display: block; margin: 0 auto 8px; }
    .office-signature-img { max-height: 60px; max-width: 150px; object-fit: contain; display: block; margin: 0 auto 8px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>

<div class="office-header">
  {{#if office.logo_signed_url}}
    <img src="{{office.logo_signed_url}}" class="office-logo" alt="Logo" />
  {{/if}}
  <div class="office-info">
    {{#if office.nome_escritorio}}
      <div class="office-name">{{office.nome_escritorio}}</div>
    {{/if}}
    <div class="office-details">
      {{#if office.endereco_completo}}{{office.endereco_completo}}<br/>{{/if}}
      {{#if office.cnpj}}CNPJ: {{office.cnpj}}{{#if office.responsavel_oab}} | {{/if}}{{/if}}
      {{#if office.responsavel_oab}}OAB {{office.responsavel_oab}}{{#if office.responsavel_oab_uf}}/{{office.responsavel_oab_uf}}{{/if}}{{/if}}
      {{#if office.telefone}}<br/>Tel: {{office.telefone}}{{/if}}
      {{#if office.email}}{{#if office.telefone}} | {{/if}}{{office.email}}{{/if}}
    </div>
  </div>
</div>

<h1 class="document-title">Contrato de Prestação de Serviços Advocatícios</h1>

<div class="content">

<div class="clausula">
  <p class="clausula-texto">
    Pelo presente instrumento particular, de um lado {{{client.identificacao_cliente}}}, doravante denominado(a) <strong>CONTRATANTE</strong>, e de outro lado <strong>{{office.nome_escritorio}}</strong>, inscrito no CNPJ sob o nº <strong>{{office.cnpj}}</strong>, com sede em <strong>{{office.endereco_completo}}</strong>, representado por <strong>{{office.responsavel_nome}}</strong>, inscrito na OAB/{{office.responsavel_oab_uf}} sob o nº <strong>{{office.responsavel_oab}}</strong>, doravante denominado <strong>CONTRATADO</strong>, têm entre si justo e contratado o que segue:
  </p>
</div>

<div class="clausula">
  <p class="clausula-titulo">Cláusula Primeira – Do Objeto</p>
  <p class="clausula-texto">
    O presente contrato tem por objeto a prestação de serviços advocatícios pelo CONTRATADO ao CONTRATANTE, consistentes em consultoria, assessoria jurídica e/ou patrocínio judicial ou extrajudicial em demandas relacionadas à matéria acordada entre as partes.
  </p>
</div>

<div class="clausula">
  <p class="clausula-titulo">Cláusula Segunda – Das Obrigações do Contratado</p>
  <p class="clausula-texto">
    O CONTRATADO obriga-se a: (a) prestar os serviços advocatícios com zelo, diligência e ética profissional; (b) manter o CONTRATANTE informado sobre o andamento dos trabalhos; (c) guardar sigilo sobre todas as informações recebidas em razão do contrato; (d) comparecer às audiências e praticar os atos processuais necessários.
  </p>
</div>

<div class="clausula">
  <p class="clausula-titulo">Cláusula Terceira – Das Obrigações do Contratante</p>
  <p class="clausula-texto">
    O CONTRATANTE obriga-se a: (a) fornecer todos os documentos e informações necessários à prestação dos serviços; (b) efetuar o pagamento dos honorários na forma e prazos estipulados; (c) comparecer quando convocado para audiências ou reuniões; (d) comunicar ao CONTRATADO qualquer alteração de endereço ou dados de contato.
  </p>
</div>

<div class="clausula">
  <p class="clausula-titulo">Cláusula Quarta – Dos Honorários</p>
  <div class="honorarios-highlight">
    <p class="clausula-texto">
      A título de honorários advocatícios, o CONTRATANTE pagará ao CONTRATADO o valor de <strong>{{honorarios_descricao_completa}}</strong>, {{forma_pagamento_descricao}}.
    </p>
    {{#if parcelas_datas_vencimento}}
    <p class="clausula-texto" style="margin-top: 10px;"><strong>Cronograma de pagamento:</strong></p>
    {{{parcelas_datas_vencimento}}}
    {{/if}}
    {{#if metodo_pagamento_descricao}}
    <p class="clausula-texto" style="margin-top: 10px;">{{metodo_pagamento_descricao}}.</p>
    {{/if}}
    {{#if percentual_exito_clausula}}
    <p class="clausula-texto" style="margin-top: 10px;">{{percentual_exito_clausula}}.</p>
    {{/if}}
  </div>
</div>

<div class="clausula">
  <p class="clausula-titulo">Cláusula Quinta – Do Inadimplemento</p>
  <p class="clausula-texto">
    {{clausula_inadimplemento}}
  </p>
</div>

<div class="clausula">
  <p class="clausula-titulo">Cláusula Sexta – Da Vigência</p>
  <p class="clausula-texto">
    O presente contrato vigorará pelo tempo necessário à conclusão dos serviços contratados, podendo ser rescindido por qualquer das partes mediante comunicação escrita com antecedência mínima de 30 (trinta) dias, ressalvado o pagamento dos honorários proporcionais aos serviços já prestados.
  </p>
</div>

<div class="clausula">
  <p class="clausula-titulo">Cláusula Sétima – Do Foro</p>
  <p class="clausula-texto">
    Fica eleito o foro da Comarca de {{office.cidade}}/{{office.estado}} para dirimir quaisquer dúvidas ou controvérsias oriundas do presente contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
  </p>
</div>

<div class="clausula">
  <p class="clausula-titulo">Cláusula Oitava – Das Disposições Gerais</p>
  <p class="clausula-texto">
    As partes declaram que leram e concordam com todas as cláusulas deste contrato, firmando-o em duas vias de igual teor e forma, na presença de duas testemunhas.
  </p>
</div>

<p style="text-align: center; margin-top: 40px;">
  {{office.cidade}}/{{office.estado}}, {{data_extenso}}.
</p>

<div class="signature-section" style="text-align: center;">
  <div class="signature-block">
    {{#if client.signature_base64}}
      <img src="{{client.signature_base64}}" class="signature-img" alt="Assinatura do Contratante" />
    {{/if}}
    <div class="signature-line">
      <strong>{{client.full_name}}</strong><br/>
      {{client.documento_label}}: {{client.documento_numero}}<br/>
      CONTRATANTE
    </div>
  </div>

  <div class="signature-block">
    {{#if office.signature_signed_url}}
      <img src="{{office.signature_signed_url}}" class="office-signature-img" alt="Assinatura do Advogado" />
    {{/if}}
    <div class="signature-line">
      <strong>{{office.responsavel_nome}}</strong><br/>
      OAB/{{office.responsavel_oab_uf}} {{office.responsavel_oab}}<br/>
      CONTRATADO
    </div>
  </div>
</div>

</div>
</body>
</html>'
WHERE id = '570895c2-5ba9-4fd2-a212-82febcc6e2f9';