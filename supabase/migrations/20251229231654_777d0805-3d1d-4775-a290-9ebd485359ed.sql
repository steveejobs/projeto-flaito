-- Atualiza template PROC do escritorio para usar qualificacao completa com telefone e email
UPDATE document_templates
SET content = '<!-- Cabecalho Institucional Premium -->
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
<!-- Fim Cabecalho Institucional -->

<div style="font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.8;">
  <h2 style="text-align:center; margin: 0 0 20px 0; font-size: 14pt; letter-spacing: 2px;">PROCURACAO AD JUDICIA ET EXTRA</h2>

  <p style="text-align: justify;"><strong>OUTORGANTE:</strong> {{client.identificacao_cliente}}</p>

  <p style="text-align: justify;"><strong>OUTORGADO:</strong> {{office.responsavel_nome}}, advogado(a) inscrito(a) na OAB/{{office.responsavel_oab_uf}} sob no {{office.responsavel_oab}}, com escritorio profissional em {{office.endereco_completo}}.</p>

  <p style="text-align: justify;"><strong>PODERES:</strong> Pelo presente instrumento particular de procuracao, o(a) OUTORGANTE nomeia e constitui seu(sua) bastante procurador(a) o(a) OUTORGADO(A) acima qualificado(a), a quem confere amplos poderes para o foro em geral, com a clausula "ad judicia et extra", podendo propor contra quem de direito as acoes competentes e defende-lo(a) nas contrarias, seguindo umas e outras, ate final decisao, usando os recursos legais e acompanhando-os, conferindo-lhe, ainda, poderes especiais para confessar, reconhecer a procedencia do pedido, transigir, desistir, renunciar ao direito sobre que se funda a acao, receber, dar quitacao e firmar compromisso, podendo agir em conjunto ou separadamente, substabelecer esta com ou sem reserva de iguais poderes, dando tudo por bom, firme e valioso.</p>

  <p style="margin-top: 30px;"><strong>Local e data:</strong> {{office.cidade}}/{{office.estado}}, {{date.extenso}}</p>

  <div style="margin-top: 50px; text-align: center;">
    {{#if client.signature_base64}}<img src="{{client.signature_base64}}" alt="Assinatura" style="max-height: 60px; display: block; margin: 0 auto 8px;" />{{/if}}
    <p style="border-top: 1px solid #333; width: 300px; margin: 0 auto; padding-top: 8px;"><strong>{{client.nome}}</strong><br/><span style="font-size: 10pt;">CPF: {{client.cpf}}</span></p>
  </div>
</div>',
    updated_at = NOW()
WHERE id = '69b9f986-a4a0-4c39-b0a1-772df2730ced';

-- Atualiza templates DECL do escritorio para usar qualificacao completa
UPDATE document_templates
SET content = (SELECT content FROM document_templates WHERE code = 'DECL' AND office_id IS NULL AND is_active = true LIMIT 1),
    updated_at = NOW()
WHERE code = 'DECL' 
  AND office_id = '13196431-0967-407c-ba93-8cadce4a51e1'
  AND is_active = true;