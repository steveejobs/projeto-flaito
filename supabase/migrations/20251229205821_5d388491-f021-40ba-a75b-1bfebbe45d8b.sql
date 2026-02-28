-- Atualiza template PROC para incluir assinatura do cliente
UPDATE document_templates 
SET content = '<!-- Cabeçalho Institucional Premium -->
<style>
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
</style>

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
<!-- Fim Cabeçalho Institucional -->

<div style="font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6;">

  <h2 style="text-align:center; margin: 0 0 16px 0;">PROCURAÇÃO</h2>

  <p>
    <strong>OUTORGANTE:</strong>
    {{client.full_name}}, {{client.nationality}}, {{client.marital_status}},
    {{client.profession}}, portador(a) do CPF nº {{client.cpf}},
    RG nº {{client.rg}}.
  </p>

  <p>
    <strong>OUTORGADO:</strong>
    {{office.responsavel_nome}}, advogado(a), inscrito(a) na OAB/{{office.responsavel_oab_uf}}
    sob o nº {{office.responsavel_oab}}, com escritório profissional em
    {{office.endereco_completo}}.
  </p>

  <p>
    Pelo presente instrumento particular de mandato, o(a) OUTORGANTE
    nomeia e constitui seu(sua) bastante procurador(a) o(a) OUTORGADO(a),
    conferindo-lhe poderes para o foro em geral, com a cláusula
    <em>ad judicia et extra</em>, para representar o(a) OUTORGANTE perante
    quaisquer órgãos do Poder Judiciário, repartições públicas federais,
    estaduais e municipais, autarquias, fundações, empresas públicas,
    sociedades de economia mista, instituições financeiras, cartórios,
    pessoas físicas ou jurídicas de direito público ou privado, em geral.
  </p>

  <p>
    Para tanto, poderá o(a) OUTORGADO(a) praticar todos os atos necessários
    ao fiel cumprimento deste mandato, inclusive propor ações, contestar,
    recorrer, acompanhar processos em qualquer instância ou tribunal,
    apresentar defesas, requerimentos, manifestações, firmar compromissos,
    acordos judiciais ou extrajudiciais, transigir, desistir, receber e dar
    quitação, levantar valores, requerer alvarás, assinar declarações,
    contratos, termos e documentos, bem como substabelecer, com ou sem
    reserva de poderes.
  </p>

  <p>
    O presente mandato é outorgado por prazo indeterminado, podendo ser
    revogado a qualquer tempo, na forma da lei.
  </p>

  <p>
    <strong>Local e data:</strong>
    {{office.cidade}}/{{office.estado}}, {{date.extenso}}.
  </p>

  <br/>

  <div style="text-align:center; margin-top: 36px;">
    {{#if client.signature_base64}}<img src="{{client.signature_base64}}" alt="Assinatura" style="max-height:60px; display:block; margin:0 auto 8px;" />{{/if}}
    <p style="margin: 0;">__________________________________________</p>
    <p style="margin: 4px 0 0 0;"><strong>{{client.full_name}}</strong></p>
  </div>

</div>'
WHERE id = '69b9f986-a4a0-4c39-b0a1-772df2730ced';

-- Atualiza template DECL para incluir assinatura do cliente
UPDATE document_templates 
SET content = '<!-- Cabeçalho Institucional Premium -->
<style>
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
</style>

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
<!-- Fim Cabeçalho Institucional -->

<div style="font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6;">

  <h2 style="text-align:center; margin: 0 0 16px 0;">
    DECLARAÇÃO DE HIPOSSUFICIÊNCIA ECONÔMICA
  </h2>

  <p>
    Eu, <strong>{{client.full_name}}</strong>, {{client.nationality}},
    {{client.marital_status}}, {{client.profession}}, portador(a) do
    CPF nº {{client.cpf}} e RG nº {{client.rg}}, declaro, para os devidos
    fins de direito, sob as penas da lei, que não possuo condições financeiras
    de arcar com as custas processuais, despesas judiciais e honorários
    advocatícios sem prejuízo do meu sustento próprio e/ou de minha família.
  </p>

  <p>
    A presente declaração é firmada nos termos do artigo 99, §3º, do
    Código de Processo Civil, sendo expressão da verdade quanto à minha
    atual situação econômica.
  </p>

  <p>
    Declaro, ainda, estar ciente de que a concessão do benefício da
    justiça gratuita poderá ser revista a qualquer tempo, caso seja
    comprovada a inexistência dos requisitos legais, bem como de que
    responderei civil, administrativa e criminalmente caso preste
    informações falsas ou omita dados relevantes.
  </p>

  <p>
    Autorizo, se necessário, a verificação de minha situação econômica
    pelos meios legalmente admitidos, inclusive mediante requisição de
    informações a órgãos públicos e instituições financeiras.
  </p>

  <p>
    <strong>Local e data:</strong>
    {{office.cidade}}/{{office.estado}}, {{date.extenso}}.
  </p>

  <br/>

  <div style="text-align:center; margin-top: 36px;">
    {{#if client.signature_base64}}<img src="{{client.signature_base64}}" alt="Assinatura" style="max-height:60px; display:block; margin:0 auto 8px;" />{{/if}}
    <p style="margin: 0;">__________________________________________</p>
    <p style="margin: 4px 0 0 0;"><strong>{{client.full_name}}</strong></p>
  </div>

</div>'
WHERE id = '9d32ef3f-67a1-4d19-b312-88aa69d82e62';