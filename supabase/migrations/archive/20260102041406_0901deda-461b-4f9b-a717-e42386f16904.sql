-- Corrigir fundo transparente no template DECL
UPDATE document_templates
SET content = '<!-- Cabecalho Minimalista Executivo -->
<style>
  .document-wrapper {
    background-color: #ffffff;
    padding: 40px;
    min-height: 100vh;
  }
  .office-header-minimal {
    display: flex;
    align-items: center;
    gap: 25px;
    padding: 20px 0;
    border-bottom: 1px solid #888;
    margin-bottom: 30px;
    background-color: #ffffff;
  }
  .office-header-minimal .office-logo {
    max-height: {{office.logo_max_height}};
    max-width: {{office.logo_max_width}};
    object-fit: contain;
  }
  .office-header-minimal .office-info {
    flex: 1;
    color: #333;
    text-align: left;
  }
  .office-header-minimal .office-name {
    font-size: 16pt;
    font-weight: bold;
    letter-spacing: 2px;
    margin-bottom: 8px;
    text-transform: uppercase;
    color: #1a1a1a;
  }
  .office-header-minimal .office-details {
    font-size: 10pt;
    line-height: 1.7;
    color: #555;
  }
  .document-body {
    background-color: #ffffff;
    font-family: Arial, sans-serif;
    font-size: 12pt;
    line-height: 1.8;
  }
</style>

<div class="document-wrapper">
  <div class="office-header-minimal">
    {{#if office.logo_signed_url}}<img src="{{office.logo_signed_url}}" class="office-logo" alt="Logo" />{{/if}}
    <div class="office-info">
      {{#if office.nome_escritorio}}<div class="office-name">{{office.nome_escritorio}}</div>{{/if}}
      <div class="office-details">
        {{#if office.endereco_completo}}📍 {{office.endereco_completo}}{{/if}}
        {{#if office.responsavel_oab}} | OAB {{office.responsavel_oab}}{{#if office.responsavel_oab_uf}}/{{office.responsavel_oab_uf}}{{/if}}{{/if}}
        <br/>
        {{#if office.telefone}}📞 {{office.telefone}}{{/if}}
        {{#if office.email}} | ✉️ {{office.email}}{{/if}}
      </div>
    </div>
  </div>

  <div class="document-body">
    <h2 style="text-align:center; margin: 0 0 20px 0; font-size: 14pt; letter-spacing: 2px;">
      DECLARAÇÃO DE HIPOSSUFICIÊNCIA ECONÔMICA
    </h2>

    <p style="text-align: justify;">
      Eu, <strong>{{client.nome}}</strong>, brasileiro(a), {{client.estado_civil}}, portador(a) do RG nº {{client.rg}} e CPF nº {{client.cpf}}, residente e domiciliado(a) em {{client.endereco_completo}}, <strong>DECLARO</strong>, para os devidos fins de direito e sob as penas da lei, que <strong>não possuo condições financeiras de arcar com as custas processuais, despesas do processo e honorários advocatícios</strong> sem prejuízo do meu sustento próprio e de minha família.
    </p>

    <p style="text-align: justify;">
      A presente declaração é firmada para fins de concessão dos benefícios da <strong>justiça gratuita</strong>, nos termos do <strong>art. 98 do Código de Processo Civil</strong>, ciente de que sua presunção de veracidade é relativa e poderá ser impugnada pela parte contrária ou pelo Juízo, caso existam elementos que a infirmem.
    </p>

    <p style="text-align: justify;">
      Declaro, ainda, estar plenamente ciente de que a prestação de informações falsas ou a omissão de dados relevantes configura crime de <strong>falsidade ideológica</strong>, previsto no <strong>art. 299 do Código Penal</strong>, sujeitando-me às sanções penais cabíveis.
    </p>

    <p style="margin-top: 30px;">
      <strong>Local e data:</strong> {{office.cidade}}/{{office.estado}}, {{date.extenso}}
    </p>

    <div style="margin-top: 50px; text-align: center;">
      {{#if client.signature_base64}}<img src="{{client.signature_base64}}" alt="Assinatura" style="max-height: 60px; display: block; margin: 0 auto 8px;" />{{/if}}
      <p style="border-top: 1px solid #333; width: 320px; margin: 0 auto; padding-top: 8px;">
        <strong>{{client.nome}}</strong><br/>
        <span style="font-size: 10pt;">CPF: {{client.cpf}}</span>
      </p>
    </div>
  </div>
</div>
'
WHERE code = 'DECL' 
  AND is_active = true;