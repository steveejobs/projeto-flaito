-- Atualizar template RECIBO global para seguir o padrão visual do Kit
UPDATE document_templates 
SET content = '<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recibo de Pagamento</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    @page {
      size: A4;
      margin: 20mm;
    }
    
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #1a1a1a;
      background: #fff;
      padding: 0;
    }
    
    .document-container {
      max-width: 210mm;
      margin: 0 auto;
      background: #fff;
    }
    
    /* Header com faixa dourada */
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #8B6914 0%, #B8860B 50%, #DAA520 100%);
      padding: 16px 24px;
      border-radius: 8px 8px 0 0;
      margin-bottom: 24px;
      box-shadow: 0 4px 12px rgba(139, 105, 20, 0.3);
    }
    
    .title-area {
      flex: 1;
    }
    
    .doc-title {
      font-size: 20pt;
      font-weight: bold;
      color: #fff;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
      letter-spacing: 2px;
    }
    
    .logo-area {
      flex-shrink: 0;
      margin-left: 20px;
    }
    
    .logo-container {
      background: rgba(255,255,255,0.95);
      padding: 8px 12px;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    
    .logo {
      max-height: 50px;
      max-width: 120px;
      object-fit: contain;
    }
    
    /* Seções de partes (Pagador/Recebedor) */
    .party-section {
      display: flex;
      align-items: flex-start;
      background: linear-gradient(135deg, #FFFEF5 0%, #FFF9E6 100%);
      border-left: 4px solid #DAA520;
      border-radius: 0 8px 8px 0;
      padding: 16px 20px;
      margin-bottom: 16px;
      box-shadow: 0 2px 8px rgba(218, 165, 32, 0.1);
    }
    
    .party-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #DAA520, #B8860B);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      margin-right: 16px;
      flex-shrink: 0;
      box-shadow: 0 2px 6px rgba(218, 165, 32, 0.3);
    }
    
    .party-content {
      flex: 1;
    }
    
    .party-label {
      font-size: 10pt;
      font-weight: bold;
      color: #8B6914;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 6px;
    }
    
    .party-info {
      font-size: 11pt;
      color: #2d2d2d;
      line-height: 1.5;
    }
    
    /* Seção de conteúdo */
    .content-section {
      background: #FAFAFA;
      border: 1px solid #E8E8E8;
      border-radius: 8px;
      padding: 20px 24px;
      margin-bottom: 20px;
    }
    
    .content-title {
      font-size: 11pt;
      font-weight: bold;
      color: #8B6914;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #DAA520;
    }
    
    .content-section p {
      margin-bottom: 10px;
      font-size: 12pt;
    }
    
    .content-section p:last-child {
      margin-bottom: 0;
    }
    
    .highlight-value {
      font-size: 14pt;
      font-weight: bold;
      color: #1a1a1a;
    }
    
    /* Declaração */
    .declaration-text {
      font-size: 12pt;
      line-height: 1.8;
      text-align: justify;
      margin: 24px 0;
      padding: 20px;
      background: #fff;
      border: 1px solid #E0E0E0;
      border-radius: 6px;
    }
    
    /* Seção de assinatura */
    .signature-section {
      margin-top: 40px;
      text-align: center;
      page-break-inside: avoid;
    }
    
    .signature-img {
      max-width: 200px;
      max-height: 80px;
      object-fit: contain;
      margin-bottom: 8px;
    }
    
    .signature-name {
      font-size: 12pt;
      font-weight: bold;
      color: #1a1a1a;
      margin-top: 8px;
    }
    
    /* Data e local */
    .date-location {
      text-align: right;
      font-size: 11pt;
      color: #444;
      margin-top: 30px;
      font-style: italic;
    }
    
    /* Rodapé Lexos */
    .lexos-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 9pt;
      color: #888;
      padding: 10px;
      border-top: 1px solid #E0E0E0;
      background: #fff;
    }
    
    @media print {
      body { padding: 0; }
      .document-container { max-width: none; }
      .lexos-footer {
        position: fixed;
        bottom: 10mm;
      }
    }
  </style>
</head>
<body>
  <div class="document-container">
    <!-- Header com faixa dourada -->
    <div class="header-bar">
      <div class="title-area">
        <span class="doc-title">RECIBO DE PAGAMENTO</span>
      </div>
      <div class="logo-area">
        <div class="logo-container">
          <img class="logo" src="{{logo_url}}" alt="Logo" onerror="this.style.display=''none''" />
        </div>
      </div>
    </div>

    <!-- PAGADOR (Cliente) -->
    <div class="party-section">
      <div class="party-icon">👤</div>
      <div class="party-content">
        <div class="party-label">Pagador</div>
        <div class="party-info">{{{cliente.qualificacao_completa}}}</div>
      </div>
    </div>

    <!-- RECEBEDOR (Escritório) -->
    <div class="party-section">
      <div class="party-icon">🏛️</div>
      <div class="party-content">
        <div class="party-label">Recebedor</div>
        <div class="party-info">{{{escritorio.qualificacao_completa}}}</div>
      </div>
    </div>

    <!-- Dados do Pagamento -->
    <div class="content-section">
      <div class="content-title">Dados do Pagamento</div>
      <p><strong>Valor:</strong> <span class="highlight-value">R$ {{valor}}</span> ({{valor_extenso}})</p>
      <p><strong>Data do pagamento:</strong> {{data_pagamento_formatada}}</p>
      <p><strong>Forma de pagamento:</strong> {{metodo_pagamento}}</p>
      {{#if parcela_info}}<p><strong>Parcela:</strong> {{parcela_info}}</p>{{/if}}
      {{#if descricao_pagamento}}<p><strong>Referente a:</strong> {{descricao_pagamento}}</p>{{/if}}
    </div>

    <!-- Declaração -->
    <div class="declaration-text">
      Declaro, para os devidos fins, que recebi a quantia acima especificada, 
      dando plena e total quitação {{#if parcela_info}}desta parcela{{else}}do valor{{/if}}, 
      nada mais havendo a reclamar quanto ao pagamento ora efetuado.
    </div>

    <!-- Data e Local -->
    <div class="date-location">
      {{cidade_escritorio}}, {{data_extenso}}
    </div>

    <!-- Assinatura -->
    <div class="signature-section">
      {{#if assinatura_escritorio_url}}
      <img class="signature-img" src="{{assinatura_escritorio_url}}" alt="Assinatura" />
      {{/if}}
      <div class="signature-name">{{escritorio.nome_fantasia}}</div>
    </div>
  </div>

  <!-- Rodapé Lexos -->
  <div class="lexos-footer">
    Gerado por Lexos - Sistema de Gestão para Escritórios de Advocacia
  </div>
</body>
</html>',
updated_at = now()
WHERE code = 'RECIBO' AND office_id IS NULL;

-- Atualizar também templates RECIBO específicos de escritórios
UPDATE document_templates 
SET content = '<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recibo de Pagamento</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    @page {
      size: A4;
      margin: 20mm;
    }
    
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #1a1a1a;
      background: #fff;
      padding: 0;
    }
    
    .document-container {
      max-width: 210mm;
      margin: 0 auto;
      background: #fff;
    }
    
    /* Header com faixa dourada */
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #8B6914 0%, #B8860B 50%, #DAA520 100%);
      padding: 16px 24px;
      border-radius: 8px 8px 0 0;
      margin-bottom: 24px;
      box-shadow: 0 4px 12px rgba(139, 105, 20, 0.3);
    }
    
    .title-area {
      flex: 1;
    }
    
    .doc-title {
      font-size: 20pt;
      font-weight: bold;
      color: #fff;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
      letter-spacing: 2px;
    }
    
    .logo-area {
      flex-shrink: 0;
      margin-left: 20px;
    }
    
    .logo-container {
      background: rgba(255,255,255,0.95);
      padding: 8px 12px;
      border-radius: 6px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    
    .logo {
      max-height: 50px;
      max-width: 120px;
      object-fit: contain;
    }
    
    /* Seções de partes (Pagador/Recebedor) */
    .party-section {
      display: flex;
      align-items: flex-start;
      background: linear-gradient(135deg, #FFFEF5 0%, #FFF9E6 100%);
      border-left: 4px solid #DAA520;
      border-radius: 0 8px 8px 0;
      padding: 16px 20px;
      margin-bottom: 16px;
      box-shadow: 0 2px 8px rgba(218, 165, 32, 0.1);
    }
    
    .party-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #DAA520, #B8860B);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      margin-right: 16px;
      flex-shrink: 0;
      box-shadow: 0 2px 6px rgba(218, 165, 32, 0.3);
    }
    
    .party-content {
      flex: 1;
    }
    
    .party-label {
      font-size: 10pt;
      font-weight: bold;
      color: #8B6914;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 6px;
    }
    
    .party-info {
      font-size: 11pt;
      color: #2d2d2d;
      line-height: 1.5;
    }
    
    /* Seção de conteúdo */
    .content-section {
      background: #FAFAFA;
      border: 1px solid #E8E8E8;
      border-radius: 8px;
      padding: 20px 24px;
      margin-bottom: 20px;
    }
    
    .content-title {
      font-size: 11pt;
      font-weight: bold;
      color: #8B6914;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #DAA520;
    }
    
    .content-section p {
      margin-bottom: 10px;
      font-size: 12pt;
    }
    
    .content-section p:last-child {
      margin-bottom: 0;
    }
    
    .highlight-value {
      font-size: 14pt;
      font-weight: bold;
      color: #1a1a1a;
    }
    
    /* Declaração */
    .declaration-text {
      font-size: 12pt;
      line-height: 1.8;
      text-align: justify;
      margin: 24px 0;
      padding: 20px;
      background: #fff;
      border: 1px solid #E0E0E0;
      border-radius: 6px;
    }
    
    /* Seção de assinatura */
    .signature-section {
      margin-top: 40px;
      text-align: center;
      page-break-inside: avoid;
    }
    
    .signature-img {
      max-width: 200px;
      max-height: 80px;
      object-fit: contain;
      margin-bottom: 8px;
    }
    
    .signature-name {
      font-size: 12pt;
      font-weight: bold;
      color: #1a1a1a;
      margin-top: 8px;
    }
    
    /* Data e local */
    .date-location {
      text-align: right;
      font-size: 11pt;
      color: #444;
      margin-top: 30px;
      font-style: italic;
    }
    
    /* Rodapé Lexos */
    .lexos-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      text-align: center;
      font-size: 9pt;
      color: #888;
      padding: 10px;
      border-top: 1px solid #E0E0E0;
      background: #fff;
    }
    
    @media print {
      body { padding: 0; }
      .document-container { max-width: none; }
      .lexos-footer {
        position: fixed;
        bottom: 10mm;
      }
    }
  </style>
</head>
<body>
  <div class="document-container">
    <!-- Header com faixa dourada -->
    <div class="header-bar">
      <div class="title-area">
        <span class="doc-title">RECIBO DE PAGAMENTO</span>
      </div>
      <div class="logo-area">
        <div class="logo-container">
          <img class="logo" src="{{logo_url}}" alt="Logo" onerror="this.style.display=''none''" />
        </div>
      </div>
    </div>

    <!-- PAGADOR (Cliente) -->
    <div class="party-section">
      <div class="party-icon">👤</div>
      <div class="party-content">
        <div class="party-label">Pagador</div>
        <div class="party-info">{{{cliente.qualificacao_completa}}}</div>
      </div>
    </div>

    <!-- RECEBEDOR (Escritório) -->
    <div class="party-section">
      <div class="party-icon">🏛️</div>
      <div class="party-content">
        <div class="party-label">Recebedor</div>
        <div class="party-info">{{{escritorio.qualificacao_completa}}}</div>
      </div>
    </div>

    <!-- Dados do Pagamento -->
    <div class="content-section">
      <div class="content-title">Dados do Pagamento</div>
      <p><strong>Valor:</strong> <span class="highlight-value">R$ {{valor}}</span> ({{valor_extenso}})</p>
      <p><strong>Data do pagamento:</strong> {{data_pagamento_formatada}}</p>
      <p><strong>Forma de pagamento:</strong> {{metodo_pagamento}}</p>
      {{#if parcela_info}}<p><strong>Parcela:</strong> {{parcela_info}}</p>{{/if}}
      {{#if descricao_pagamento}}<p><strong>Referente a:</strong> {{descricao_pagamento}}</p>{{/if}}
    </div>

    <!-- Declaração -->
    <div class="declaration-text">
      Declaro, para os devidos fins, que recebi a quantia acima especificada, 
      dando plena e total quitação {{#if parcela_info}}desta parcela{{else}}do valor{{/if}}, 
      nada mais havendo a reclamar quanto ao pagamento ora efetuado.
    </div>

    <!-- Data e Local -->
    <div class="date-location">
      {{cidade_escritorio}}, {{data_extenso}}
    </div>

    <!-- Assinatura -->
    <div class="signature-section">
      {{#if assinatura_escritorio_url}}
      <img class="signature-img" src="{{assinatura_escritorio_url}}" alt="Assinatura" />
      {{/if}}
      <div class="signature-name">{{escritorio.nome_fantasia}}</div>
    </div>
  </div>

  <!-- Rodapé Lexos -->
  <div class="lexos-footer">
    Gerado por Lexos - Sistema de Gestão para Escritórios de Advocacia
  </div>
</body>
</html>',
updated_at = now()
WHERE code = 'RECIBO' AND office_id IS NOT NULL;