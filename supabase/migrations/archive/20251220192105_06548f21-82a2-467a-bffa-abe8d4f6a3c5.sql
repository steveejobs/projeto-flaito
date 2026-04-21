-- Temporarily disable the trigger to allow updating default templates
ALTER TABLE document_templates DISABLE TRIGGER trg_block_default_templates;

-- Update all default templates with the new institutional header HTML structure
UPDATE document_templates 
SET content = '<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <style>
    body {
      font-family: "Times New Roman", serif;
      font-size: 14px;
      line-height: 1.5;
      color: #000;
      padding: 40px;
    }

    .header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 2px solid #000;
      padding-bottom: 20px;
    }

    .header img.logo {
      max-width: 180px;
      margin-bottom: 10px;
    }

    .office-info {
      font-size: 12px;
      text-align: center;
      color: #444;
      margin-top: 8px;
    }

    .title {
      text-align: center;
      font-size: 18px;
      margin-top: 30px;
      margin-bottom: 30px;
      font-weight: bold;
      text-transform: uppercase;
    }

    .content {
      text-align: justify;
      white-space: pre-wrap;
    }

    .signature-block {
      margin-top: 50px;
      text-align: left;
    }

    .signature-block img {
      width: 220px;
      margin-bottom: -10px;
    }

    .signature-name {
      font-weight: bold;
      margin-top: 5px;
    }
  </style>
</head>

<body>

  <div class="header">
    {{#if office.logo_signed_url}}
      <img class="logo" src="{{office.logo_signed_url}}" alt="Logo do Escritório" />
    {{/if}}

    <div class="office-info">
      <strong>{{office.nome_escritorio}}</strong><br />
      {{office.endereco_completo}} – {{office.cidade}}/{{office.estado}}<br />
      CNPJ: {{office.cnpj}} • OAB: {{office.responsavel_oab}}/{{office.responsavel_oab_uf}}<br />
      Tel: {{office.telefone}} • E-mail: {{office.email}}
    </div>
  </div>

  <div class="title">
    {{document_title}}
  </div>

  <div class="content">
    {{document_body}}
  </div>

  <div class="signature-block">
    {{#if office.signature_signed_url}}
      <img src="{{office.signature_signed_url}}" alt="Assinatura Digital" />
    {{/if}}

    <div class="signature-name">
      {{office.responsavel_nome}}<br />
      OAB {{office.responsavel_oab}}/{{office.responsavel_oab_uf}}
    </div>
  </div>

</body>
</html>',
updated_at = now()
WHERE is_default = true;

-- Re-enable the trigger
ALTER TABLE document_templates ENABLE TRIGGER trg_block_default_templates;