// src/lib/templates/kitLayoutTemplate.ts
// Template HTML padrão para documentos do kit (Procuração, Declaração, Contrato)
// Layout baseado no design de referência com faixa dourada e ícones

export const KIT_LAYOUT_TEMPLATE_HTML = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{titulo_documento}}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #1a1a1a;
      background: #fff;
    }
    
    .document-container {
      max-width: 210mm;
      margin: 0 auto;
      padding: 20px;
      background: #fff;
    }
    
    /* Header com faixa decorativa */
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: linear-gradient(135deg, #8B6914 0%, #B8860B 50%, #DAA520 100%);
      padding: 15px 25px;
      border-radius: 8px;
      margin-bottom: 30px;
      box-shadow: 0 4px 12px rgba(184, 134, 11, 0.3);
    }
    
    .title-area {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    
    .doc-title {
      font-size: 24pt;
      font-weight: bold;
      color: #fff;
      text-transform: uppercase;
      letter-spacing: 2px;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
    }
    
    .dots {
      color: #fff;
      font-size: 10pt;
      opacity: 0.8;
      letter-spacing: 3px;
    }
    
    .logo-area {
      text-align: right;
    }
    
    .logo-container {
      display: inline-block;
      background: #ffffff;
      padding: 8px 12px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }
    
    .logo {
      max-height: 60px;
      max-width: 140px;
      object-fit: contain;
      display: block;
    }
    
    .office-name {
      color: #fff;
      font-size: 10pt;
      margin-top: 8px;
      font-weight: 500;
    }
    
    /* Seções de partes (OUTORGANTE/OUTORGADOS) */
    .party-section {
      display: flex;
      gap: 20px;
      margin-bottom: 25px;
      padding: 20px;
      background: #fafafa;
      border-left: 4px solid #DAA520;
      border-radius: 0 8px 8px 0;
    }
    
    .party-icon {
      width: 50px;
      height: 50px;
      background: linear-gradient(135deg, #DAA520, #B8860B);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      color: #fff;
      flex-shrink: 0;
    }
    
    .party-content {
      flex: 1;
    }
    
    .party-label {
      font-size: 14pt;
      font-weight: bold;
      color: #8B6914;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .party-data p {
      margin-bottom: 5px;
      font-size: 11pt;
    }
    
    .party-data strong {
      color: #666;
      font-weight: 600;
    }
    
    /* Seção de conteúdo principal */
    .content-section {
      display: flex;
      gap: 20px;
      margin: 30px 0;
      padding: 25px;
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
    }
    
    .content-icon {
      width: 40px;
      height: 40px;
      background: #DAA520;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      color: #fff;
      flex-shrink: 0;
    }
    
    .content-text {
      flex: 1;
      text-align: justify;
      font-size: 12pt;
      line-height: 1.8;
    }
    
    .content-text p {
      margin-bottom: 15px;
      text-indent: 2em;
    }
    
    /* Seção de data */
    .date-section {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 30px 0;
      justify-content: center;
    }
    
    .calendar-icon {
      font-size: 18px;
      color: #DAA520;
    }
    
    .date-text {
      font-size: 12pt;
      color: #333;
    }
    
    /* Seção de assinatura */
    .signature-section {
      margin-top: 50px;
      text-align: center;
      position: relative;
    }
    
    .signature-box {
      width: 300px;
      height: 100px;
      border: 2px dashed #ccc;
      border-radius: 8px;
      margin: 0 auto 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fafafa;
    }
    
    .signature-img {
      max-width: 280px;
      max-height: 80px;
      object-fit: contain;
    }
    
    .signature-label {
      font-size: 11pt;
      font-weight: bold;
      color: #8B6914;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 10px;
    }
    
    .signature-name {
      font-size: 11pt;
      color: #333;
      margin-top: 5px;
    }
    
    .pen-decoration {
      position: absolute;
      right: 50px;
      bottom: 0;
      font-size: 40px;
      opacity: 0.3;
      transform: rotate(-30deg);
    }
    
    /* Rodapé do escritório */
    .footer-section {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      font-size: 9pt;
      color: #666;
    }
    
    .footer-section p {
      margin-bottom: 3px;
    }
    
    /* Rodapé Lexos - não editável */
    .lexos-footer {
      text-align: center;
      font-size: 8pt;
      color: #888;
      padding: 15px 0;
      border-top: 1px solid #e5e5e5;
      margin-top: 30px;
    }
    
    /* Utilitários */
    .text-center { text-align: center; }
    .text-justify { text-align: justify; }
    .mt-20 { margin-top: 20px; }
    .mb-20 { margin-bottom: 20px; }
    
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .document-container {
        padding: 0;
      }
      .lexos-footer {
        position: fixed;
        bottom: 5mm;
        left: 20mm;
        right: 20mm;
      }
    }
  </style>
</head>
<body>
  <div class="document-container">
    
    <!-- Header com faixa decorativa -->
    <div class="header-bar">
      <div class="title-area">
        <span class="doc-title">{{titulo_documento}}</span>
        <span class="dots">● ● ●</span>
      </div>
      <div class="logo-area">
        {{#if logo_url}}
        <div class="logo-container">
          <img src="{{logo_url}}" alt="Logo" class="logo" />
        </div>
        {{/if}}
        <div class="office-name">{{nome_escritorio}}</div>
      </div>
    </div>
    
    <!-- Seção OUTORGANTE (Cliente) -->
    <div class="party-section">
      <div class="party-icon">👤</div>
      <div class="party-content">
        <div class="party-label">{{label_parte_1}}</div>
        <div class="party-data">
          <p><strong>Nome:</strong> {{cliente_nome}}</p>
          <p><strong>{{label_documento_cliente}}:</strong> {{cliente_documento}}</p>
          <p><strong>Endereço:</strong> {{cliente_endereco}}</p>
          <p><strong>E-mail:</strong> {{cliente_email}}</p>
        </div>
      </div>
    </div>
    
    <!-- Seção OUTORGADOS (Advogado) -->
    <div class="party-section">
      <div class="party-icon">👤</div>
      <div class="party-content">
        <div class="party-label">{{label_parte_2}}</div>
        <div class="party-data">
          <p><strong>Nome:</strong> {{advogado_nome}}</p>
          <p><strong>OAB:</strong> {{advogado_oab}}</p>
          <p><strong>Endereço:</strong> {{escritorio_endereco}}</p>
          <p><strong>E-mail:</strong> {{escritorio_email}}</p>
        </div>
      </div>
    </div>
    
    <!-- Conteúdo principal do documento -->
    <div class="content-section">
      <div class="content-icon">✓</div>
      <div class="content-text">
        {{{conteudo_principal}}}
      </div>
    </div>
    
    <!-- Data e local -->
    <div class="date-section">
      <span class="calendar-icon">📅</span>
      <span class="date-text">{{cidade}}, {{data_extenso}}.</span>
    </div>
    
    <!-- Área de assinatura -->
    <div class="signature-section">
      <div class="signature-box">
        {{#if assinatura_url}}
        <img src="{{assinatura_url}}" alt="Assinatura" class="signature-img" />
        {{/if}}
      </div>
      <div class="signature-label">{{label_assinatura}}</div>
      <div class="signature-name">{{nome_assinante}}</div>
      <span class="pen-decoration">✒️</span>
    </div>
    
    <!-- Rodapé do escritório -->
    <div class="footer-section">
      <p><strong>{{nome_escritorio}}</strong></p>
      <p>{{escritorio_endereco}}</p>
      <p>{{escritorio_telefone}} | {{escritorio_email}}</p>
      {{#if escritorio_cnpj}}<p>CNPJ: {{escritorio_cnpj}}</p>{{/if}}
    </div>
    
    <!-- Rodapé Lexos - não editável -->
    <div class="lexos-footer">
      Gerado por Lexos - Sistema de Gestão para Escritórios de Advocacia
    </div>
    
  </div>
</body>
</html>
`;

/**
 * Placeholders disponíveis no template:
 * 
 * Header:
 * - {{titulo_documento}} - Ex: PROCURAÇÃO, DECLARAÇÃO, CONTRATO
 * - {{logo_url}} - URL da logo do escritório
 * - {{nome_escritorio}} - Nome do escritório
 * 
 * Parte 1 (Cliente/Outorgante):
 * - {{label_parte_1}} - Ex: OUTORGANTE, DECLARANTE, CONTRATANTE
 * - {{cliente_nome}} - Nome completo
 * - {{label_documento_cliente}} - CPF ou CNPJ
 * - {{cliente_documento}} - Número formatado
 * - {{cliente_endereco}} - Endereço completo
 * - {{cliente_email}} - Email
 * 
 * Parte 2 (Advogado/Outorgado):
 * - {{label_parte_2}} - Ex: OUTORGADOS, (vazio), CONTRATADOS
 * - {{advogado_nome}} - Nome do advogado
 * - {{advogado_oab}} - OAB completa
 * - {{escritorio_endereco}} - Endereço do escritório
 * - {{escritorio_email}} - Email do escritório
 * 
 * Conteúdo:
 * - {{{conteudo_principal}}} - HTML com cláusulas (triple braces para HTML)
 * 
 * Data/Assinatura:
 * - {{cidade}} - Cidade
 * - {{data_extenso}} - Data por extenso
 * - {{assinatura_url}} - URL da imagem de assinatura
 * - {{label_assinatura}} - Ex: OUTORGANTE, DECLARANTE
 * - {{nome_assinante}} - Nome de quem assina
 * 
 * Rodapé:
 * - {{escritorio_telefone}} - Telefone
 * - {{escritorio_cnpj}} - CNPJ do escritório
 */

export default KIT_LAYOUT_TEMPLATE_HTML;
