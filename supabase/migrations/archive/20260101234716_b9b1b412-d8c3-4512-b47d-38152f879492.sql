-- Atualiza o template global CONTRATO com cláusulas completas do PDF
UPDATE document_templates
SET content = '<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>{{titulo_documento}}</title>
  <style>
    @page { size: A4; margin: 20mm 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: "Times New Roman", Times, serif; 
      font-size: 12pt; 
      line-height: 1.6; 
      color: #1a1a1a;
      background: #fff;
    }
    .header-bar {
      background: linear-gradient(135deg, #b8860b 0%, #daa520 50%, #b8860b 100%);
      padding: 20px 30px;
      margin-bottom: 30px;
      display: flex;
      align-items: center;
      gap: 20px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .header-logo { max-height: 70px; max-width: 120px; }
    .header-info { color: #1a1a1a; flex: 1; }
    .header-info h1 { font-size: 16pt; font-weight: bold; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 1px; }
    .header-info p { font-size: 9pt; margin: 2px 0; }
    .document-title {
      text-align: center;
      font-size: 14pt;
      font-weight: bold;
      text-transform: uppercase;
      margin: 30px 0;
      letter-spacing: 2px;
      border-bottom: 2px solid #b8860b;
      padding-bottom: 10px;
    }
    .parties-section {
      margin: 25px 0;
      padding: 15px 20px;
      background: #fafafa;
      border-left: 4px solid #b8860b;
    }
    .party { margin-bottom: 15px; }
    .party:last-child { margin-bottom: 0; }
    .party-label { font-weight: bold; text-transform: uppercase; font-size: 10pt; color: #b8860b; margin-bottom: 5px; }
    .party-data { text-align: justify; }
    .content { margin: 30px 0; text-align: justify; }
    .clause { margin-bottom: 20px; }
    .clause-title { font-weight: bold; text-transform: uppercase; margin-bottom: 8px; }
    .clause-text { text-align: justify; text-indent: 2em; }
    .clause-text p { margin-bottom: 10px; }
    .sub-item { margin-left: 2em; margin-bottom: 5px; }
    .signature-section {
      margin-top: 50px;
      text-align: center;
    }
    .signature-line {
      display: inline-block;
      width: 45%;
      margin: 30px 2%;
      vertical-align: top;
    }
    .signature-img { max-height: 60px; margin-bottom: 5px; }
    .signature-line hr { border: none; border-top: 1px solid #333; margin-bottom: 5px; }
    .signature-name { font-weight: bold; font-size: 11pt; }
    .signature-role { font-size: 10pt; color: #555; }
    .footer {
      margin-top: 40px;
      text-align: center;
      font-size: 9pt;
      color: #666;
      border-top: 1px solid #ddd;
      padding-top: 15px;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .header-bar { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  {{#if office.logo_url}}
  <div class="header-bar">
    <img src="{{office.logo_url}}" alt="Logo" class="header-logo" />
    <div class="header-info">
      <h1>{{office.name}}</h1>
      {{#if office.address}}<p>{{office.address}}</p>{{/if}}
      {{#if office.cnpj}}<p>CNPJ: {{office.cnpj}}</p>{{/if}}
      {{#if office.oab_number}}<p>OAB: {{office.oab_number}}{{#if office.oab_state}}/{{office.oab_state}}{{/if}}</p>{{/if}}
      {{#if office.phone}}<p>Tel: {{office.phone}}</p>{{/if}}
      {{#if office.email}}<p>{{office.email}}</p>{{/if}}
    </div>
  </div>
  {{else}}
  <div class="header-bar">
    <div class="header-info">
      <h1>{{office.name}}</h1>
      {{#if office.address}}<p>{{office.address}}</p>{{/if}}
      {{#if office.cnpj}}<p>CNPJ: {{office.cnpj}}</p>{{/if}}
      {{#if office.oab_number}}<p>OAB: {{office.oab_number}}{{#if office.oab_state}}/{{office.oab_state}}{{/if}}</p>{{/if}}
      {{#if office.phone}}<p>Tel: {{office.phone}}</p>{{/if}}
      {{#if office.email}}<p>{{office.email}}</p>{{/if}}
    </div>
  </div>
  {{/if}}

  <div class="document-title">CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS</div>

  <div class="parties-section">
    <div class="party">
      <div class="party-label">Contratante</div>
      <div class="party-data">{{{client.identificacao_cliente}}}</div>
    </div>
    <div class="party">
      <div class="party-label">Contratado</div>
      <div class="party-data">{{{office.identificacao_escritorio}}}</div>
    </div>
  </div>

  <div class="content">
    <p>As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de Prestação de Serviços Advocatícios, que se regerá pelas cláusulas seguintes e pelas condições descritas no presente.</p>

    <div class="clause">
      <div class="clause-title">CLÁUSULA PRIMEIRA – DO OBJETO</div>
      <div class="clause-text">
        <p>O presente contrato tem como objeto a prestação de serviços advocatícios pelo(a) CONTRATADO(A), consistentes em {{kit.objeto_contrato}}.</p>
        <p><strong>Parágrafo Primeiro:</strong> Os serviços ora contratados não incluem:</p>
        <p class="sub-item">a) Recursos aos Tribunais Superiores, Recursos Extraordinários e Especiais, exceto se expressamente pactuado;</p>
        <p class="sub-item">b) Ações autônomas, cautelares ou incidentais não previstas neste instrumento;</p>
        <p class="sub-item">c) Defesa em reconvenção, denunciação da lide, chamamento ao processo ou outras formas de intervenção de terceiros;</p>
        <p class="sub-item">d) Ações de cumprimento de sentença ou execução, salvo quando expressamente contratadas;</p>
        <p class="sub-item">e) Qualquer outra demanda não especificada no objeto deste contrato.</p>
        <p><strong>Parágrafo Segundo:</strong> Os serviços adicionais acima mencionados, se necessários, serão objeto de contratação específica mediante novo instrumento contratual.</p>
      </div>
    </div>

    <div class="clause">
      <div class="clause-title">CLÁUSULA SEGUNDA – DA NATUREZA DA OBRIGAÇÃO</div>
      <div class="clause-text">
        <p>A obrigação assumida pelo(a) CONTRATADO(A) é de meio, não de resultado. O(A) CONTRATADO(A) compromete-se a empregar todo zelo, diligência e conhecimento técnico necessários para a defesa dos interesses do(a) CONTRATANTE, sem, contudo, garantir êxito na demanda, haja vista depender de decisão judicial.</p>
      </div>
    </div>

    <div class="clause">
      <div class="clause-title">CLÁUSULA TERCEIRA – DOS HONORÁRIOS ADVOCATÍCIOS CONTRATUAIS</div>
      <div class="clause-text">
        <p>Pela prestação dos serviços advocatícios descritos na Cláusula Primeira, o(a) CONTRATANTE pagará ao(à) CONTRATADO(A) os seguintes honorários:</p>
        {{{honorarios_descricao_completa}}}
        <p><strong>Parágrafo Primeiro:</strong> Os honorários contratuais são devidos independentemente do resultado da demanda, por se tratarem de contraprestação pelos serviços efetivamente prestados.</p>
        <p><strong>Parágrafo Segundo:</strong> Em caso de acordo judicial ou extrajudicial, os honorários serão calculados sobre o valor total do acordo, aplicando-se o percentual pactuado nesta cláusula.</p>
        {{#if parcelas_datas_vencimento}}
        <p><strong>Parágrafo Terceiro:</strong> As parcelas deverão ser pagas nas seguintes datas: {{{parcelas_datas_vencimento}}}.</p>
        {{/if}}
      </div>
    </div>

    <div class="clause">
      <div class="clause-title">CLÁUSULA QUARTA – DOS HONORÁRIOS DE SUCUMBÊNCIA</div>
      <div class="clause-text">
        <p>Conforme disposto no artigo 23 da Lei nº 8.906/94 (Estatuto da Advocacia e da OAB), os honorários de sucumbência pertencem ao advogado, constituindo direito autônomo do patrono.</p>
        <p><strong>Parágrafo Único:</strong> Os honorários de sucumbência eventualmente fixados em favor do(a) CONTRATADO(A) não se confundem com os honorários contratuais estabelecidos neste instrumento, sendo ambos devidos de forma independente.</p>
      </div>
    </div>

    <div class="clause">
      <div class="clause-title">CLÁUSULA QUINTA – AUTORIZAÇÃO PARA LEVANTAMENTO DE VALORES</div>
      <div class="clause-text">
        <p>O(A) CONTRATANTE autoriza expressamente o(a) CONTRATADO(A) a levantar valores decorrentes de alvarás judiciais, RPVs (Requisições de Pequeno Valor) ou precatórios, deduzindo os honorários advocatícios contratuais antes do repasse do saldo remanescente ao(à) CONTRATANTE.</p>
        <p><strong>Parágrafo Único:</strong> O(A) CONTRATADO(A) deverá prestar contas ao(à) CONTRATANTE no prazo de 10 (dez) dias úteis após o levantamento, discriminando os valores recebidos, os honorários deduzidos e o saldo repassado.</p>
      </div>
    </div>

    <div class="clause">
      <div class="clause-title">CLÁUSULA SEXTA – DAS DESPESAS E CUSTAS</div>
      <div class="clause-text">
        <p>São de responsabilidade do(a) CONTRATANTE todas as despesas necessárias ao andamento do processo, incluindo, mas não se limitando a:</p>
        <p class="sub-item">a) Custas judiciais e taxas cartorárias;</p>
        <p class="sub-item">b) Emolumentos e taxas de diligências;</p>
        <p class="sub-item">c) Honorários periciais;</p>
        <p class="sub-item">d) Despesas com deslocamento para audiências fora da comarca;</p>
        <p class="sub-item">e) Cópias, autenticações e reconhecimentos de firma;</p>
        <p class="sub-item">f) Despesas postais e de comunicação.</p>
        <p><strong>Parágrafo Único:</strong> As despesas acima serão antecipadas pelo(a) CONTRATANTE mediante solicitação do(a) CONTRATADO(A), ou reembolsadas quando adiantadas por este(a).</p>
      </div>
    </div>

    <div class="clause">
      <div class="clause-title">CLÁUSULA SÉTIMA – DA INADIMPLÊNCIA</div>
      <div class="clause-text">
        <p>O atraso no pagamento de qualquer parcela dos honorários ou despesas acarretará:</p>
        <p class="sub-item">a) Multa de 10% (dez por cento) sobre o valor devido;</p>
        <p class="sub-item">b) Juros de mora de 1% (um por cento) ao mês;</p>
        <p class="sub-item">c) Correção monetária pelo INPC/IBGE ou índice que vier a substituí-lo.</p>
        <p><strong>Parágrafo Primeiro:</strong> O atraso superior a 30 (trinta) dias autoriza o(a) CONTRATADO(A) a suspender a prestação dos serviços advocatícios, sem prejuízo da cobrança dos valores devidos.</p>
        <p><strong>Parágrafo Segundo:</strong> A inadimplência de qualquer parcela acarretará o vencimento antecipado das demais, tornando-se exigível a totalidade do saldo devedor.</p>
      </div>
    </div>

    <div class="clause">
      <div class="clause-title">CLÁUSULA OITAVA – DA RESCISÃO</div>
      <div class="clause-text">
        <p>O presente contrato poderá ser rescindido por qualquer das partes, mediante comunicação expressa e por escrito, com antecedência mínima de 15 (quinze) dias.</p>
        <p><strong>Parágrafo Primeiro:</strong> Em caso de rescisão por iniciativa do(a) CONTRATANTE, serão devidos os honorários proporcionais aos serviços já prestados, calculados sobre o valor total do contrato.</p>
        <p><strong>Parágrafo Segundo:</strong> A rescisão não exime o(a) CONTRATANTE do pagamento das parcelas vencidas e não pagas, bem como das despesas já realizadas.</p>
        <p><strong>Parágrafo Terceiro:</strong> O(A) CONTRATADO(A) poderá renunciar ao mandato nas hipóteses previstas no Código de Ética e Disciplina da OAB, cientificando o(a) CONTRATANTE com antecedência mínima de 10 (dez) dias.</p>
      </div>
    </div>

    <div class="clause">
      <div class="clause-title">CLÁUSULA NONA – DA CONFIDENCIALIDADE</div>
      <div class="clause-text">
        <p>O(A) CONTRATADO(A) compromete-se a manter sigilo absoluto sobre todas as informações obtidas em razão do presente contrato, conforme disposto no artigo 7º, inciso II, da Lei nº 8.906/94, que garante ao advogado o sigilo profissional.</p>
        <p><strong>Parágrafo Único:</strong> O dever de sigilo permanece mesmo após a extinção do presente contrato por qualquer motivo.</p>
      </div>
    </div>

    <div class="clause">
      <div class="clause-title">CLÁUSULA DÉCIMA – DO TÍTULO EXECUTIVO</div>
      <div class="clause-text">
        <p>O presente instrumento constitui título executivo extrajudicial, nos termos do artigo 784, inciso XII, do Código de Processo Civil, podendo ser executado judicialmente em caso de inadimplemento de quaisquer de suas cláusulas.</p>
      </div>
    </div>

    <div class="clause">
      <div class="clause-title">CLÁUSULA DÉCIMA PRIMEIRA – DO FORO</div>
      <div class="clause-text">
        <p>As partes elegem o foro da Comarca de {{office.comarca}}, Estado de {{office.estado}}, para dirimir quaisquer dúvidas ou litígios decorrentes do presente contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p>
      </div>
    </div>

    <p style="margin-top: 30px;">E por estarem assim justas e contratadas, as partes assinam o presente instrumento em 02 (duas) vias de igual teor e forma, na presença de duas testemunhas.</p>

    <p style="text-align: center; margin-top: 30px;"><strong>{{document_location}}, {{document_date}}</strong></p>
  </div>

  <div class="signature-section">
    <div class="signature-line">
      <hr />
      <div class="signature-name">{{client.full_name}}</div>
      <div class="signature-role">CONTRATANTE</div>
      {{#if client.cpf}}<div class="signature-role">CPF: {{client.cpf}}</div>{{/if}}
    </div>
    <div class="signature-line">
      {{#if office.signature_url}}<img src="{{office.signature_url}}" alt="Assinatura" class="signature-img" />{{/if}}
      <hr />
      <div class="signature-name">{{office.responsible_lawyer}}</div>
      <div class="signature-role">CONTRATADO(A)</div>
      {{#if office.oab_number}}<div class="signature-role">OAB: {{office.oab_number}}{{#if office.oab_state}}/{{office.oab_state}}{{/if}}</div>{{/if}}
    </div>
  </div>

  <div class="footer">
    <p>Documento gerado em {{generated_at}}</p>
  </div>
</body>
</html>',
updated_at = NOW()
WHERE code = 'CONTRATO' AND office_id IS NULL AND is_active = true;

-- Sincroniza o template do escritório com o global atualizado
UPDATE document_templates
SET content = (
  SELECT content FROM document_templates 
  WHERE code = 'CONTRATO' AND office_id IS NULL AND is_active = true
  LIMIT 1
),
updated_at = NOW()
WHERE id = '570895c2-5ba9-4fd2-a212-82febcc6e2f9';