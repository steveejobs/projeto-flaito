-- Atualiza template DECL para usar qualificação completa com telefone e email
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

<div style="font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.8;">
  <h2 style="text-align:center; margin: 0 0 20px 0; font-size: 14pt; letter-spacing: 2px;">DECLARAÇÃO DE HIPOSSUFICIÊNCIA</h2>

  <p style="text-align: justify;"><strong>DECLARANTE:</strong> {{client.identificacao_cliente}}</p>

  <p style="text-align: justify;">Declaro, para os devidos fins de direito, sob as penas da Lei, que não possuo condições financeiras de arcar com as custas processuais e honorários advocatícios, sem prejuízo do sustento próprio e de minha família.</p>

  <p style="text-align: justify;">Declaro ainda estar ciente de que a falsidade desta declaração configura crime de falsidade ideológica, previsto no artigo 299 do Código Penal, e sujeita o declarante às penas de reclusão de um a cinco anos e multa, se o documento é público, e reclusão de um a três anos e multa, se o documento é particular.</p>

  <p style="text-align: justify;">Por ser expressão da verdade, firmo a presente declaração.</p>

  <p style="margin-top: 30px;"><strong>Local e data:</strong> {{office.cidade}}/{{office.estado}}, {{date.extenso}}</p>

  <div style="margin-top: 50px; text-align: center;">
    {{#if client.signature_base64}}<img src="{{client.signature_base64}}" alt="Assinatura" style="max-height: 60px; display: block; margin: 0 auto 8px;" />{{/if}}
    <p style="border-top: 1px solid #333; width: 300px; margin: 0 auto; padding-top: 8px;"><strong>{{client.nome}}</strong><br/><span style="font-size: 10pt;">CPF: {{client.cpf}}</span></p>
  </div>
</div>',
    updated_at = NOW()
WHERE code = 'DECL' AND office_id IS NULL;

-- Atualiza template PROC para garantir layout consistente com DECL
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

<div style="font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.8;">
  <h2 style="text-align:center; margin: 0 0 20px 0; font-size: 14pt; letter-spacing: 2px;">PROCURAÇÃO AD JUDICIA ET EXTRA</h2>

  <p style="text-align: justify;"><strong>OUTORGANTE:</strong> {{client.identificacao_cliente}}</p>

  <p style="text-align: justify;"><strong>OUTORGADO:</strong> {{office.responsavel_nome}}, advogado(a) inscrito(a) na OAB/{{office.responsavel_oab_uf}} sob nº {{office.responsavel_oab}}, com escritório profissional em {{office.endereco_completo}}.</p>

  <p style="text-align: justify;"><strong>PODERES:</strong> Pelo presente instrumento particular de procuração, o(a) OUTORGANTE nomeia e constitui seu(sua) bastante procurador(a) o(a) OUTORGADO(A) acima qualificado(a), a quem confere amplos poderes para o foro em geral, com a cláusula "ad judicia et extra", podendo propor contra quem de direito as ações competentes e defendê-lo(a) nas contrárias, seguindo umas e outras, até final decisão, usando os recursos legais e acompanhando-os, conferindo-lhe, ainda, poderes especiais para confessar, reconhecer a procedência do pedido, transigir, desistir, renunciar ao direito sobre que se funda a ação, receber, dar quitação e firmar compromisso, podendo agir em conjunto ou separadamente, substabelecer esta com ou sem reserva de iguais poderes, dando tudo por bom, firme e valioso.</p>

  <p style="margin-top: 30px;"><strong>Local e data:</strong> {{office.cidade}}/{{office.estado}}, {{date.extenso}}</p>

  <div style="margin-top: 50px; text-align: center;">
    {{#if client.signature_base64}}<img src="{{client.signature_base64}}" alt="Assinatura" style="max-height: 60px; display: block; margin: 0 auto 8px;" />{{/if}}
    <p style="border-top: 1px solid #333; width: 300px; margin: 0 auto; padding-top: 8px;"><strong>{{client.nome}}</strong><br/><span style="font-size: 10pt;">CPF: {{client.cpf}}</span></p>
  </div>
</div>',
    updated_at = NOW()
WHERE code = 'PROC' AND office_id IS NULL;