-- Atualiza template PROC com formatação ABNT-like e cabeçalho melhorado
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
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
  line-height: 1.5;
  color: #000;
  background: #fff;
}

.document {
  max-width: 170mm;
  margin: 0 auto;
  padding: 0;
}

/* Cabeçalho institucional discreto */
.office-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #8B6914 0%, #B8860B 50%, #DAA520 100%);
  border-radius: 4px;
  margin-bottom: 24px;
}

.office-header .office-logo {
  max-height: 45px;
  max-width: 100px;
  object-fit: contain;
  background: #fff;
  padding: 4px 8px;
  border-radius: 4px;
}

.office-header .office-info {
  flex: 1;
  color: #fff;
  text-align: right;
}

.office-header .office-name {
  font-size: 11pt;
  font-weight: bold;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.office-header .office-details {
  font-size: 8pt;
  line-height: 1.4;
  opacity: 0.95;
}

/* Título centralizado ABNT */
h1 {
  text-align: center;
  font-size: 14pt;
  font-weight: bold;
  text-transform: uppercase;
  margin-bottom: 24px;
  letter-spacing: 1px;
}

/* Parágrafos ABNT: justificado com recuo */
p {
  text-align: justify;
  text-indent: 1.25cm;
  margin-bottom: 12pt;
}

p.no-indent {
  text-indent: 0;
}

/* Assinatura */
.signature-block {
  margin-top: 48px;
  text-align: center;
}

.signature-line {
  width: 280px;
  border-bottom: 1px solid #000;
  margin: 0 auto 8px;
  padding-top: 60px;
}

.signature-img {
  max-height: 50px;
  max-width: 200px;
  display: block;
  margin: 0 auto 4px;
}

.signature-name {
  font-weight: bold;
  font-size: 11pt;
}

.signature-cpf {
  font-size: 10pt;
  color: #333;
}

@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
</head>
<body>
<div class="document">

<div class="office-header">
  {{#if office.logo_signed_url}}<img src="{{office.logo_signed_url}}" class="office-logo" alt="Logo" />{{/if}}
  <div class="office-info">
    {{#if office.nome_escritorio}}<div class="office-name">{{office.nome_escritorio}}</div>{{/if}}
    <div class="office-details">
      {{#if office.endereco_completo}}{{office.endereco_completo}}{{/if}}
      {{#if office.responsavel_oab}}<br/>OAB/{{office.responsavel_oab_uf}} {{office.responsavel_oab}}{{/if}}
      {{#if office.telefone}}<br/>{{office.telefone}}{{/if}}{{#if office.email}} | {{office.email}}{{/if}}
    </div>
  </div>
</div>

<h1>Procuração Ad Judicia et Extra</h1>

<p class="no-indent"><strong>OUTORGANTE:</strong> {{client.full_name}}, {{client.nationality}}, {{client.marital_status}}, {{client.profession}}, portador(a) do RG nº {{client.rg}}{{#if client.rg_issuer}} ({{client.rg_issuer}}){{/if}} e inscrito(a) no CPF sob o nº {{client.cpf}}, residente e domiciliado(a) em {{client.endereco_completo}}.</p>

<p class="no-indent"><strong>OUTORGADO(A):</strong> {{office.responsavel_nome}}, advogado(a), inscrito(a) na OAB/{{office.responsavel_oab_uf}} sob o nº {{office.responsavel_oab}}, com escritório profissional situado em {{office.endereco_completo}}, onde recebe intimações e notificações.</p>

<p><strong>PODERES:</strong> Pelo presente instrumento particular de procuração, o(a) OUTORGANTE nomeia e constitui seu(sua) bastante procurador(a) o(a) OUTORGADO(A) acima qualificado(a), a quem confere amplos poderes para o foro em geral, com a cláusula <em>ad judicia et extra</em>, podendo representá-lo(a) perante quaisquer juízos, instâncias e tribunais, órgãos da administração pública direta e indireta, autarquias, fundações, cartórios, pessoas físicas e jurídicas.</p>

<p>Poderá, ainda, propor ações, contestar, reconvir, recorrer, desistir, transigir, firmar acordos judiciais e extrajudiciais, receber e dar quitação, levantar valores e alvarás, renunciar ao direito sobre que se funda a ação, reconhecer a procedência do pedido, prestar e receber declarações, requerer diligências, juntar e retirar documentos, substabelecer com ou sem reserva de poderes, e praticar todos os demais atos necessários ao fiel cumprimento deste mandato.</p>

<p class="no-indent" style="margin-top: 24px;"><strong>Local e data:</strong> {{office.cidade}}/{{office.estado}}, {{date.extenso}}.</p>

<div class="signature-block">
  {{#if client.signature_base64}}<img src="{{client.signature_base64}}" class="signature-img" alt="Assinatura" />{{/if}}
  <div class="signature-line"></div>
  <div class="signature-name">{{client.full_name}}</div>
  <div class="signature-cpf">CPF: {{client.cpf}}</div>
</div>

</div>
</body>
</html>',
    updated_at = now()
WHERE code = 'PROC' AND office_id IS NOT NULL;

-- Atualiza template DECL com formatação ABNT-like
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
  font-family: "Times New Roman", Times, serif;
  font-size: 12pt;
  line-height: 1.5;
  color: #000;
  background: #fff;
}

.document {
  max-width: 170mm;
  margin: 0 auto;
  padding: 0;
}

/* Cabeçalho institucional discreto */
.office-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #8B6914 0%, #B8860B 50%, #DAA520 100%);
  border-radius: 4px;
  margin-bottom: 24px;
}

.office-header .office-logo {
  max-height: 45px;
  max-width: 100px;
  object-fit: contain;
  background: #fff;
  padding: 4px 8px;
  border-radius: 4px;
}

.office-header .office-info {
  flex: 1;
  color: #fff;
  text-align: right;
}

.office-header .office-name {
  font-size: 11pt;
  font-weight: bold;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.office-header .office-details {
  font-size: 8pt;
  line-height: 1.4;
  opacity: 0.95;
}

h1 {
  text-align: center;
  font-size: 14pt;
  font-weight: bold;
  text-transform: uppercase;
  margin-bottom: 24px;
  letter-spacing: 1px;
}

p {
  text-align: justify;
  text-indent: 1.25cm;
  margin-bottom: 12pt;
}

p.no-indent {
  text-indent: 0;
}

.signature-block {
  margin-top: 48px;
  text-align: center;
}

.signature-line {
  width: 280px;
  border-bottom: 1px solid #000;
  margin: 0 auto 8px;
  padding-top: 60px;
}

.signature-img {
  max-height: 50px;
  max-width: 200px;
  display: block;
  margin: 0 auto 4px;
}

.signature-name {
  font-weight: bold;
  font-size: 11pt;
}

.signature-cpf {
  font-size: 10pt;
  color: #333;
}

@media print {
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
</style>
</head>
<body>
<div class="document">

<div class="office-header">
  {{#if office.logo_signed_url}}<img src="{{office.logo_signed_url}}" class="office-logo" alt="Logo" />{{/if}}
  <div class="office-info">
    {{#if office.nome_escritorio}}<div class="office-name">{{office.nome_escritorio}}</div>{{/if}}
    <div class="office-details">
      {{#if office.endereco_completo}}{{office.endereco_completo}}{{/if}}
      {{#if office.responsavel_oab}}<br/>OAB/{{office.responsavel_oab_uf}} {{office.responsavel_oab}}{{/if}}
      {{#if office.telefone}}<br/>{{office.telefone}}{{/if}}{{#if office.email}} | {{office.email}}{{/if}}
    </div>
  </div>
</div>

<h1>Declaração de Hipossuficiência Econômica</h1>

<p class="no-indent">Eu, <strong>{{client.full_name}}</strong>, {{client.nationality}}, {{client.marital_status}}, {{client.profession}}, portador(a) do RG nº {{client.rg}}{{#if client.rg_issuer}} ({{client.rg_issuer}}){{/if}} e inscrito(a) no CPF sob o nº {{client.cpf}}, residente e domiciliado(a) em {{client.endereco_completo}}, <strong>DECLARO</strong>, sob as penas da lei, para os devidos fins e efeitos legais, que não disponho de recursos financeiros suficientes para arcar com as custas processuais e honorários advocatícios sem prejuízo do sustento próprio e de minha família.</p>

<p>A presente declaração é firmada nos termos do art. 99, §3º, do Código de Processo Civil (Lei nº 13.105/2015), constituindo prova bastante para a concessão do benefício da gratuidade de justiça, na forma da lei.</p>

<p>Declaro, ainda, estar ciente de que a falsidade desta declaração configura crime previsto no art. 299 do Código Penal, sujeitando-me às penalidades legais cabíveis, além da obrigação de ressarcir os valores correspondentes às custas e despesas processuais.</p>

<p>Comprometo-me a informar imediatamente ao Juízo eventual alteração de minha condição econômico-financeira que possa acarretar a perda do benefício ora requerido.</p>

<p class="no-indent" style="margin-top: 24px;"><strong>Local e data:</strong> {{office.cidade}}/{{office.estado}}, {{date.extenso}}.</p>

<div class="signature-block">
  {{#if client.signature_base64}}<img src="{{client.signature_base64}}" class="signature-img" alt="Assinatura" />{{/if}}
  <div class="signature-line"></div>
  <div class="signature-name">{{client.full_name}}</div>
  <div class="signature-cpf">CPF: {{client.cpf}}</div>
</div>

</div>
</body>
</html>',
    updated_at = now()
WHERE code = 'DECL' AND office_id IS NOT NULL;