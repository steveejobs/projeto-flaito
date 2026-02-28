UPDATE document_templates 
SET content = '<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
@page {
  size: A4;
  margin: 30mm 20mm 20mm 30mm;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: Arial, sans-serif;
  font-size: 12pt;
  line-height: 1.6;
  color: #000;
  background: #fff;
}

.document {
  max-width: 170mm;
  margin: 0 auto;
  padding: 0;
}

/* Cabeçalho Institucional Premium */
.office-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px 25px;
  background: linear-gradient(135deg, #8B6914 0%, #B8860B 50%, #DAA520 100%);
  border-radius: 8px;
  margin-bottom: 30px;
  box-shadow: 0 4px 12px rgba(184, 134, 11, 0.3);
}
.office-header .office-logo { max-height: 60px; max-width: 150px; object-fit: contain; }
.office-header .office-info { flex: 1; color: #fff; text-align: right; }
.office-header .office-name { font-size: 16pt; font-weight: bold; letter-spacing: 1px; margin-bottom: 5px; text-transform: uppercase; }
.office-header .office-details { font-size: 9pt; line-height: 1.6; opacity: 0.95; }

/* Título */
h2 {
  text-align: center;
  font-size: 14pt;
  font-weight: bold;
  margin: 0 0 24px 0;
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Parágrafos */
p {
  text-align: justify;
  margin-bottom: 12px;
}

/* Listas */
ul {
  margin: 12px 0 12px 24px;
}

ul li {
  margin-bottom: 6px;
}

/* Bloco de Assinaturas */
.signatures-block {
  margin-top: 40px;
  page-break-inside: avoid;
}

.signatures-table {
  width: 100%;
  border-collapse: collapse;
}

.signatures-table td {
  width: 50%;
  text-align: center;
  vertical-align: top;
  padding: 10px 20px;
}

.signature-line {
  border-top: 1px solid #000;
  padding-top: 8px;
  margin-top: 60px;
}

.signature-name {
  font-weight: bold;
  margin-bottom: 4px;
}

.signature-doc {
  font-size: 10pt;
  margin-bottom: 2px;
}

.signature-role {
  font-size: 10pt;
  text-transform: uppercase;
}

.signature-img {
  max-height: 60px;
  display: block;
  margin: 0 auto 8px;
}

@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .office-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
</head>
<body>
<div class="document">

<!-- Cabeçalho Institucional Premium -->
<div class="office-header">
  {{#if office.logo_signed_url}}<img src="{{office.logo_signed_url}}" class="office-logo" alt="Logo" />{{/if}}
  <div class="office-info">
    {{#if office.nome_escritorio}}<div class="office-name">{{office.nome_escritorio}}</div>{{/if}}
    <div class="office-details">
      {{#if office.endereco_completo}}{{office.endereco_completo}}<br/>{{/if}}
      {{#if office.cnpj}}CNPJ: {{office.cnpj}}{{#if office.responsavel_oab}} | {{/if}}{{/if}}{{#if office.responsavel_oab}}OAB {{office.responsavel_oab}}{{#if office.responsavel_oab_uf}}/{{office.responsavel_oab_uf}}{{/if}}{{/if}}
      {{#if office.telefone}}<br/>Tel: {{office.telefone}}{{/if}}{{#if office.email}}{{#if office.telefone}} | {{/if}}{{office.email}}{{/if}}
    </div>
  </div>
</div>

<h2>Contrato de Prestação de Serviços Advocatícios</h2>

<p><strong>CONTRATANTE:</strong> {{client.identificacao_cliente}}</p>

<p><strong>CONTRATADO:</strong> {{office.nome_escritorio}}, inscrito no CNPJ sob o nº {{office.cnpj}}, com sede à {{office.endereco_completo}}, representado por {{office.responsavel_nome}}, OAB/{{office.responsavel_oab_uf}} nº {{office.responsavel_oab}}.</p>

<p><strong>1. OBJETO:</strong> O(A) CONTRATANTE constitui o(a) CONTRATADO(A) para prestar serviços advocatícios consistentes em: {{kit.objeto_contrato}}</p>

<p><strong>2. HONORÁRIOS:</strong></p>
<ul>
  {{#if kit.tipo_remuneracao}}<li><strong>Modalidade:</strong> {{kit.tipo_remuneracao}}</li>{{/if}}
  {{#if kit.percentual_honorarios}}<li><strong>Percentual sobre êxito:</strong> {{kit.percentual_honorarios}}%</li>{{/if}}
  {{#if kit.valor_fixo_honorarios}}<li><strong>Valor fixo:</strong> {{kit.valor_fixo_honorarios}} ({{kit.valor_fixo_honorarios_extenso}})</li>{{/if}}
  {{#if kit.forma_pagamento}}<li><strong>Forma de pagamento:</strong> {{kit.forma_pagamento}}</li>{{/if}}
  {{#if kit.valor_entrada}}<li><strong>Entrada:</strong> {{kit.valor_entrada}} ({{kit.valor_entrada_extenso}})</li>{{/if}}
  {{#if kit.numero_parcelas}}<li><strong>Parcelamento:</strong> {{kit.numero_parcelas}} parcelas de {{kit.valor_parcela}} ({{kit.valor_parcela_extenso}})</li>{{/if}}
  {{#if kit.parcelas_datas_vencimento}}<li><strong>Vencimentos:</strong> {{kit.parcelas_datas_vencimento}}</li>{{/if}}
  {{#if kit.metodo_pagamento}}<li><strong>Método de pagamento:</strong> {{kit.metodo_pagamento}}</li>{{/if}}
  {{#if kit.pix_chave}}<li><strong>Chave PIX:</strong> {{kit.pix_chave}}</li>{{/if}}
</ul>

<p><strong>3. DESPESAS:</strong> Custas judiciais, emolumentos, taxas, diligências e demais despesas necessárias ao andamento do serviço correrão por conta do(a) CONTRATANTE, mediante prévia ciência e aprovação.</p>

<p><strong>4. INADIMPLEMENTO:</strong> {{kit.clausula_inadimplemento}}</p>

<p><strong>5. VIGÊNCIA E RESCISÃO:</strong> Este contrato vigora até a conclusão definitiva do serviço contratado, podendo ser rescindido por qualquer das partes nas hipóteses previstas em lei, preservados os honorários proporcionais ao trabalho realizado e os honorários de sucumbência, quando cabíveis.</p>

<p><strong>6. SIGILO:</strong> O(A) CONTRATADO(A) compromete-se a manter sigilo absoluto sobre todas as informações e documentos recebidos do(a) CONTRATANTE, em conformidade com o Código de Ética e Disciplina da OAB.</p>

<p><strong>7. FORO:</strong> Fica eleito o foro da Comarca de {{office.cidade}}/{{office.estado}} para dirimir quaisquer controvérsias oriundas deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p>

<p style="margin-top: 24px;"><strong>Local e data:</strong> {{office.cidade}}/{{office.estado}}, {{date.extenso}}.</p>

<!-- Bloco de Assinaturas -->
<div class="signatures-block">
  <table class="signatures-table">
    <tr>
      <td>
        {{#if client.signature_base64}}<img src="{{client.signature_base64}}" alt="Assinatura" class="signature-img" />{{/if}}
        <div class="signature-line">
          <div class="signature-name">{{client.nome}}</div>
          <div class="signature-doc">{{client.documento_label}}: {{client.documento_numero}}</div>
          <div class="signature-role">Contratante</div>
        </div>
      </td>
      <td>
        {{#if office.signature_signed_url}}<img src="{{office.signature_signed_url}}" alt="Assinatura" class="signature-img" />{{/if}}
        <div class="signature-line">
          <div class="signature-name">{{office.responsavel_nome}}</div>
          <div class="signature-doc">OAB/{{office.responsavel_oab_uf}} {{office.responsavel_oab}}</div>
          <div class="signature-role">Contratado</div>
        </div>
      </td>
    </tr>
  </table>
</div>

</div>
</body>
</html>',
updated_at = now()
WHERE code = 'CONTRATO' AND office_id IS NULL;