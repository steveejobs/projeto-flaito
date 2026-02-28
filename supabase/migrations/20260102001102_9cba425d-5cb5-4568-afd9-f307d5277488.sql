-- Atualizar template CONTRATO global (7fe9b601-5c16-4a7f-a30f-5c6a42b4ff7d) com Cláusula 3 enriquecida
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

<div style="font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.65;">

  <h2 style="text-align:center; margin: 0 0 18px 0;">
    CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS
  </h2>

  <p>
    <strong>CONTRATANTE:</strong> {{client.identificacao_cliente}}
  </p>

  <p>
    <strong>CONTRATADO:</strong> {{office.nome_escritorio}}, inscrito no
    CNPJ {{office.cnpj}}, com sede profissional em {{office.endereco_completo}},
    neste ato representado por {{office.responsavel_nome}}, advogado(a),
    inscrito(a) na OAB/{{office.responsavel_oab_uf}} sob nº {{office.responsavel_oab}}.
  </p>

  <p>
    As partes acima qualificadas celebram o presente
    <strong>Contrato de Prestação de Serviços Advocatícios</strong>,
    que se regerá pelas cláusulas abaixo, em conformidade com a
    Lei nº 8.906/94 (Estatuto da Advocacia), o Código de Ética e Disciplina
    da OAB, o Código Civil e demais normas aplicáveis.
  </p>

  <p>
    <strong>1. DO OBJETO</strong><br/>
    O presente contrato tem por objeto a prestação de serviços advocatícios
    pelo CONTRATADO ao(à) CONTRATANTE, consistentes na análise, orientação,
    consultoria, atuação judicial e/ou extrajudicial necessária à defesa
    de seus interesses, dentro dos limites técnicos, éticos, legais e
    estratégicos definidos pelo profissional, conforme o mandato outorgado.
  </p>

  <p>
    Fica expressamente pactuado que o presente contrato não abrange serviços
    não relacionados diretamente ao objeto contratado, tais como recursos
    extraordinários, ações autônomas, incidentes processuais complexos,
    execuções em autos apartados ou procedimentos administrativos especiais,
    salvo ajuste expresso e específico.
  </p>

  <p>
    <strong>2. DA NATUREZA DA OBRIGAÇÃO</strong><br/>
    O(a) CONTRATANTE declara ciência inequívoca de que a atividade advocatícia
    constitui obrigação de meio, e não de resultado, inexistindo qualquer
    garantia quanto ao êxito da demanda ou ao entendimento do juízo.
  </p>

  <p>
    <strong>3. DOS HONORÁRIOS ADVOCATÍCIOS CONTRATUAIS</strong><br/>
    Pelos serviços prestados, o(a) CONTRATANTE pagará ao CONTRATADO
    os honorários advocatícios ajustados da seguinte forma:
  </p>

  <p style="margin-left: 20px;">
    <strong>a) Modalidade de Remuneração:</strong> {{kit.tipo_remuneracao}}<br/>
    {{#if kit.percentual_honorarios}}<strong>b) Percentual sobre Êxito:</strong> {{kit.percentual_honorarios}}% do proveito econômico obtido<br/>{{/if}}
    {{#if kit.valor_fixo_honorarios}}<strong>c) Honorários Contratuais Fixos:</strong> R$ {{kit.valor_fixo_honorarios}} ({{kit.valor_fixo_honorarios_extenso}}){{/if}}
  </p>

  <p>
    <strong>d) Condições de Pagamento:</strong>
  </p>

  <ul style="margin-top: 8px; margin-left: 20px;">
    {{#if kit.valor_entrada}}<li><strong>Entrada:</strong> R$ {{kit.valor_entrada}} ({{kit.valor_entrada_extenso}})</li>{{/if}}
    {{#if kit.numero_parcelas}}<li><strong>Parcelamento:</strong> {{kit.numero_parcelas}}x de R$ {{kit.valor_parcela}} ({{kit.valor_parcela_extenso}})</li>{{/if}}
    {{#if kit.parcelas_datas_vencimento}}<li><strong>Vencimentos:</strong> {{kit.parcelas_datas_vencimento}}</li>{{/if}}
    <li><strong>Método de Pagamento:</strong> {{kit.metodo_pagamento_label}}</li>
    {{#if kit.chave_pix}}<li><strong>Chave PIX:</strong> {{kit.chave_pix}}</li>{{/if}}
  </ul>

  <p>
    Os honorários contratados são devidos independentemente do resultado
    final da demanda, salvo quando expressamente ajustados sob a modalidade
    exclusiva de êxito.
  </p>

  <p>
    <strong>4. DOS HONORÁRIOS DE SUCUMBÊNCIA</strong><br/>
    Os honorários de sucumbência eventualmente fixados pelo juízo pertencem
    exclusivamente ao CONTRATADO, nos termos do artigo 23 da Lei nº 8.906/94,
    não se compensando nem se confundindo com os honorários contratuais.
  </p>

  <p>
    <strong>5. AUTORIZAÇÃO PARA LEVANTAMENTO DE VALORES</strong><br/>
    O(a) CONTRATANTE autoriza expressamente o CONTRATADO a receber, levantar,
    dar quitação e reter valores decorrentes de alvarás, RPV, precatórios
    ou acordos, até o limite dos honorários contratuais e sucumbenciais
    devidos, comprometendo-se a prestar contas na forma da lei.
  </p>

  <p>
    <strong>6. DAS DESPESAS E CUSTAS</strong><br/>
    Todas as despesas necessárias à condução do caso, incluindo custas
    processuais, taxas, emolumentos, diligências, deslocamentos, cópias,
    autenticações e despesas extraordinárias, correrão por conta do(a)
    CONTRATANTE, não estando incluídas nos honorários.
  </p>

  <p>
    <strong>7. DA INADIMPLÊNCIA</strong><br/>
    {{kit.clausula_inadimplemento}}
  </p>

  <p>
    <strong>8. DA RESCISÃO</strong><br/>
    O presente contrato poderá ser rescindido por qualquer das partes,
    a qualquer tempo, mediante comunicação expressa, assegurado ao
    CONTRATADO o recebimento dos honorários proporcionais aos serviços
    já prestados, bem como daqueles decorrentes de êxito, quando aplicável.
  </p>

  <p>
    <strong>9. DA CONFIDENCIALIDADE</strong><br/>
    As partes comprometem-se a manter sigilo absoluto sobre todas as
    informações, documentos e estratégias relacionadas ao presente contrato,
    mesmo após o seu encerramento.
  </p>

  <p>
    <strong>10. DO TÍTULO EXECUTIVO</strong><br/>
    O presente contrato constitui título executivo extrajudicial, nos
    termos do artigo 784, inciso XII, do Código de Processo Civil.
  </p>

  <p>
    <strong>11. DO FORO</strong><br/>
    Para dirimir quaisquer controvérsias oriundas deste contrato, as partes
    elegem o foro da Comarca de {{office.cidade}}/{{office.estado}}, com
    renúncia expressa a qualquer outro, por mais privilegiado que seja.
  </p>

  <p>
    <strong>Local e data:</strong>
    {{office.cidade}}/{{office.estado}}, {{date.extenso}}.
  </p>

  <table style="width:100%; margin-top: 40px;">
    <tr>
      <td style="text-align:center; vertical-align:bottom; padding: 10px;">
        {{#if client.signature_base64}}<img src="{{client.signature_base64}}" alt="Assinatura Cliente" style="max-height:60px; display:block; margin:0 auto 8px;" />{{/if}}
        <p style="margin: 0;">__________________________________________</p>
        <p style="margin: 4px 0 0 0;"><strong>{{client.nome}}</strong></p>
        <p style="margin: 2px 0 0 0; font-size: 10pt;">CONTRATANTE</p>
      </td>
      <td style="text-align:center; vertical-align:bottom; padding: 10px;">
        {{#if office.signature_signed_url}}<img src="{{office.signature_signed_url}}" alt="Assinatura Advogado" style="max-height:60px; display:block; margin:0 auto 8px;" />{{/if}}
        <p style="margin: 0;">__________________________________________</p>
        <p style="margin: 4px 0 0 0;"><strong>{{office.responsavel_nome}}</strong></p>
        <p style="margin: 2px 0 0 0; font-size: 10pt;">OAB/{{office.responsavel_oab_uf}} {{office.responsavel_oab}}</p>
        <p style="margin: 2px 0 0 0; font-size: 10pt;">CONTRATADO</p>
      </td>
    </tr>
  </table>

</div>',
updated_at = NOW()
WHERE id = '7fe9b601-5c16-4a7f-a30f-5c6a42b4ff7d';

-- Sincronizar template do escritório (570895c2-5ba9-4fd2-a212-82febcc6e2f9) com o global
UPDATE document_templates
SET content = (SELECT content FROM document_templates WHERE id = '7fe9b601-5c16-4a7f-a30f-5c6a42b4ff7d'),
    updated_at = NOW()
WHERE id = '570895c2-5ba9-4fd2-a212-82febcc6e2f9';