-- Padronizar formatação do CONTRATO com a PROCURAÇÃO (template do escritório)
UPDATE document_templates
SET content = '<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>{{titulo_documento}}</title>
  <style>
    @page { size: A4; margin: 30mm 20mm 20mm 30mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    body { margin: 0; padding: 20px; background: #fff; }
    .office-header {
      background: linear-gradient(135deg, #C9A227 0%, #8B7355 100%);
      padding: 20px 30px;
      margin-bottom: 30px;
      display: flex;
      align-items: center;
      gap: 20px;
      min-height: 100px;
      max-height: 200px;
      overflow: hidden;
      border-bottom: 3px solid #8B7355;
    }
    .office-logo { max-height: 80px; max-width: 120px; object-fit: contain; }
    .office-info { color: #fff; flex: 1; }
    .office-name { font-size: 18px; font-weight: bold; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px; }
    .office-details { font-size: 11px; margin: 0; line-height: 1.6; opacity: 0.95; }
    .office-footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #C9A227;
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .signature-img { max-height: 60px; max-width: 200px; object-fit: contain; }
    .lawyer-info { font-size: 11px; color: #333; }
  </style>
</head>
<body>
  <div class="office-header">
    {{#if office.logo_url}}
    <img src="{{office.logo_url}}" alt="Logo" class="office-logo"/>
    {{/if}}
    <div class="office-info">
      <p class="office-name">{{office.name}}</p>
      <p class="office-details">
        {{office.address}}<br/>
        {{#if office.cnpj}}CNPJ: {{office.cnpj}} | {{/if}}
        {{#if office.oab_number}}OAB: {{office.oab_number}}/{{office.oab_state}}{{/if}}<br/>
        {{#if office.phone}}Tel: {{office.phone}} | {{/if}}
        {{#if office.email}}{{office.email}}{{/if}}
      </p>
    </div>
  </div>

  <div style="font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.8;">
    <h2 style="text-align:center; margin: 0 0 20px 0; font-size: 14pt; letter-spacing: 2px;">
      CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS
    </h2>

    <p style="text-align: justify;">
      Pelo presente instrumento particular, de um lado <strong>{{office.name}}</strong>, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº {{office.cnpj}}, com sede em {{office.address}}, doravante denominado <strong>CONTRATADO</strong>, e de outro lado <strong>{{client.full_name}}</strong>, {{client.documento_label}} nº {{client.documento_numero}}, residente e domiciliado em {{client.address_full}}, doravante denominado <strong>CONTRATANTE</strong>, têm entre si justo e contratado o seguinte:
    </p>

    <p style="text-align: justify;">
      <strong>1. DO OBJETO</strong><br/>
      O presente contrato tem por objeto a prestação de serviços advocatícios pelo CONTRATADO ao CONTRATANTE, consistentes em {{case.title}}, incluindo acompanhamento processual, elaboração de peças, participação em audiências e demais atos necessários à defesa dos interesses do CONTRATANTE.
    </p>

    <p style="text-align: justify;">
      <strong>2. DOS HONORÁRIOS</strong><br/>
      Pelos serviços prestados, o CONTRATANTE pagará ao CONTRATADO os seguintes honorários:
    </p>

    <div style="margin: 15px 0 15px 20px; padding: 15px; border-left: 3px solid #C9A227; background: #fafafa;">
      <p style="margin: 0 0 8px 0; text-align: justify;">
        <strong>Tipo de Remuneração:</strong> {{kit.tipo_remuneracao}}
      </p>
      {{#if kit.valor_fixo_honorarios}}
      <p style="margin: 0 0 8px 0; text-align: justify;">
        <strong>Valor Total:</strong> R$ {{kit.valor_fixo_honorarios}} ({{kit.valor_fixo_honorarios_extenso}})
      </p>
      {{/if}}
      {{#if kit.percentual_honorarios}}
      <p style="margin: 0 0 8px 0; text-align: justify;">
        <strong>Percentual sobre êxito:</strong> {{kit.percentual_honorarios}}%
      </p>
      {{/if}}
      {{#if kit.valor_entrada}}
      <p style="margin: 0 0 8px 0; text-align: justify;">
        <strong>Entrada:</strong> R$ {{kit.valor_entrada}} ({{kit.valor_entrada_extenso}})
      </p>
      {{/if}}
      {{#if kit.numero_parcelas}}
      <p style="margin: 0 0 8px 0; text-align: justify;">
        <strong>Parcelamento:</strong> {{kit.numero_parcelas}}x de R$ {{kit.valor_parcela}} ({{kit.valor_parcela_extenso}})
      </p>
      {{/if}}
      {{#if kit.parcelas_datas_vencimento}}
      <p style="margin: 0 0 8px 0; text-align: justify;">
        <strong>Datas de Vencimento:</strong> {{kit.parcelas_datas_vencimento}}
      </p>
      {{/if}}
      <p style="margin: 0; text-align: justify;">
        <strong>Forma de Pagamento:</strong> {{kit.metodo_pagamento}}{{#if kit.chave_pix}} - Chave PIX: {{kit.chave_pix}}{{/if}}
      </p>
    </div>

    <p style="text-align: justify;">
      <strong>3. DO INADIMPLEMENTO</strong><br/>
      {{clausula_inadimplemento}}
    </p>

    <p style="text-align: justify;">
      <strong>4. DAS OBRIGAÇÕES DO CONTRATADO</strong><br/>
      O CONTRATADO se compromete a: a) manter o CONTRATANTE informado sobre o andamento do processo; b) comparecer às audiências designadas; c) elaborar as peças processuais necessárias; d) atuar com zelo, diligência e ética profissional.
    </p>

    <p style="text-align: justify;">
      <strong>5. DAS OBRIGAÇÕES DO CONTRATANTE</strong><br/>
      O CONTRATANTE se compromete a: a) fornecer todos os documentos e informações necessárias; b) efetuar o pagamento dos honorários na forma pactuada; c) comparecer quando solicitado; d) manter seus dados cadastrais atualizados.
    </p>

    <p style="text-align: justify;">
      <strong>6. DA RESCISÃO</strong><br/>
      O presente contrato poderá ser rescindido por qualquer das partes, mediante comunicação por escrito com antecedência mínima de 15 (quinze) dias, ressalvado o direito do CONTRATADO aos honorários proporcionais ao trabalho já realizado.
    </p>

    <p style="text-align: justify;">
      <strong>7. DO FORO</strong><br/>
      Fica eleito o foro da Comarca de {{office.city}}/{{office.state}} para dirimir quaisquer dúvidas oriundas do presente contrato.
    </p>

    <p style="text-align: center; margin-top: 30px;">
      {{office.city}}, {{data_extenso}}
    </p>

    <div style="display: flex; justify-content: space-between; margin-top: 60px;">
      <div style="text-align: center; width: 45%;">
        <div style="border-top: 1px solid #333; padding-top: 8px;">
          <strong>{{office.name}}</strong><br/>
          <span style="font-size: 10pt;">CONTRATADO</span>
        </div>
      </div>
      <div style="text-align: center; width: 45%;">
        <div style="border-top: 1px solid #333; padding-top: 8px;">
          <strong>{{client.full_name}}</strong><br/>
          <span style="font-size: 10pt;">{{client.documento_label}}: {{client.documento_numero}}</span><br/>
          <span style="font-size: 10pt;">CONTRATANTE</span>
        </div>
      </div>
    </div>

    <div class="office-footer">
      {{#if office.signature_url}}
      <img src="{{office.signature_url}}" alt="Assinatura" class="signature-img"/>
      {{/if}}
      <div class="lawyer-info">
        <strong>{{office.responsible_lawyer}}</strong><br/>
        OAB/{{office.oab_state}} {{office.oab_number}}
      </div>
    </div>
  </div>
</body>
</html>',
    updated_at = now()
WHERE id = '570895c2-5ba9-4fd2-a212-82febcc6e2f9';