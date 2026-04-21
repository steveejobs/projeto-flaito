-- Padroniza template DECL com o mesmo estilo institucional da PROC
UPDATE public.document_templates
SET content = '<!-- Cabeçalho Institucional Premium -->
<style>
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

<div style="font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.8; padding: 30px 40px;">
  <h2 style="text-align:center; margin: 0 0 30px 0; font-size: 14pt; letter-spacing: 2px; font-weight: bold;">
    DECLARAÇÃO DE HIPOSSUFICIÊNCIA ECONÔMICA
  </h2>

  <p style="text-align: justify; margin-bottom: 20px;">
    Eu, <strong>{{client.nome}}</strong>, brasileiro(a), {{client.estado_civil}}, portador(a) do RG nº {{client.rg}} e CPF nº {{client.cpf}}, residente e domiciliado(a) em {{client.endereco_completo}}, <strong>DECLARO</strong>, para os devidos fins de direito e sob as penas da lei, que <strong>não possuo condições financeiras de arcar com as custas processuais, despesas do processo e honorários advocatícios</strong> sem prejuízo do meu sustento próprio e de minha família.
  </p>

  <p style="text-align: justify; margin-bottom: 20px;">
    A presente declaração é firmada para fins de concessão dos benefícios da <strong>justiça gratuita</strong>, nos termos do <strong>art. 98 do Código de Processo Civil</strong>, ciente de que sua presunção de veracidade é relativa e poderá ser impugnada pela parte contrária ou pelo Juízo, caso existam elementos que a infirmem.
  </p>

  <p style="text-align: justify; margin-bottom: 20px;">
    Declaro, ainda, estar plenamente ciente de que a prestação de informações falsas ou a omissão de dados relevantes configura crime de <strong>falsidade ideológica</strong>, previsto no <strong>art. 299 do Código Penal</strong>, sujeitando-me às sanções penais cabíveis.
  </p>

  <p style="margin-top: 40px;">
    <strong>Local e data:</strong> {{office.cidade}}/{{office.estado}}, {{date.extenso}}
  </p>

  <div style="margin-top: 60px; text-align: center;">
    {{#if client.signature_base64}}<img src="{{client.signature_base64}}" alt="Assinatura" style="max-height: 60px; display: block; margin: 0 auto 8px;" />{{/if}}
    <p style="border-top: 1px solid #333; width: 320px; margin: 0 auto; padding-top: 8px;">
      <strong>{{client.nome}}</strong><br/>
      <span style="font-size: 10pt;">CPF: {{client.cpf}}</span>
    </p>
  </div>
</div>',
    updated_at = now()
WHERE code = 'DECL';