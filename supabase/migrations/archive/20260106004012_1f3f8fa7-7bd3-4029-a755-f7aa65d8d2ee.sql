UPDATE document_templates 
SET content = '<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Contrato de Prestação de Serviços Advocatícios</title>
  <style>
    @page { size: A4; margin: 30mm 20mm 20mm 30mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      margin: 0;
      font-family: "Times New Roman", Times, serif;
      font-size: 12pt;
      line-height: 1.8;
      color: #222;
      background: #fff;
    }
    @media screen { body { padding: 20px; } }
    @media print {
      body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    img { max-width: 100%; height: auto; }
    img[src=""], img:not([src]) { display: none !important; }

    .office-header {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 20px 25px;
      background: linear-gradient(135deg, #C9A227 0%, #E8D48A 50%, #C9A227 100%);
      border-bottom: 3px solid #8B7355;
      min-height: 100px;
      page-break-inside: avoid;
    }
    .office-logo { max-height: 80px; max-width: 220px; object-fit: contain; }
    .office-info { flex: 1; color: #fff; text-align: right; }
    .office-name { font-size: 16pt; font-weight: bold; letter-spacing: 1px; margin-bottom: 5px; text-transform: uppercase; }
    .office-details { font-size: 9pt; line-height: 1.6; opacity: 0.95; }

    .document-title {
      text-align: center;
      font-size: 14pt;
      font-weight: bold;
      margin: 30px 0 25px;
      text-transform: uppercase;
      letter-spacing: 1px;
      page-break-after: avoid;
    }

    .content { padding: 0 10px; text-align: justify; }
    .clausula { margin-bottom: 18px; }
    .clausula-titulo { font-weight: bold; margin-bottom: 8px; text-transform: uppercase; page-break-after: avoid; }
    .clausula-texto { text-indent: 2em; margin-bottom: 6px; }
    .subitem { margin-top: 6px; text-indent: 0; padding-left: 2em; }

    .honorarios-highlight {
      background: linear-gradient(135deg, #fffbe6 0%, #fff9db 100%);
      border-left: 4px solid #C9A227;
      padding: 15px 20px;
      margin: 12px 0;
      border-radius: 0 8px 8px 0;
      page-break-inside: avoid;
    }

    .signature-section { margin-top: 30px; page-break-inside: avoid; page-break-before: avoid; }
    .signature-block { display: inline-block; width: 45%; text-align: center; vertical-align: top; margin-top: 30px; }
    .signature-img { max-height: 100px; display: block; margin: 0 auto 8px; }
    .office-signature-img { max-height: 90px; max-width: 240px; object-fit: contain; display: block; margin: 0 auto 8px; }
    .signature-line { border-top: 1px solid #333; margin-top: 60px; padding-top: 8px; }

    .witnesses { margin-top: 26px; page-break-inside: avoid; }
    .witness-row { display: flex; gap: 30px; justify-content: space-between; margin-top: 16px; }
    .witness { width: 48%; text-align: center; }
    .witness .line { border-top: 1px solid #333; margin-top: 40px; padding-top: 8px; }
  </style>
</head>
<body>

<header class="office-header">
  <img id="officeLogo" class="office-logo" src="" alt="Logo" style="display:none;" />
  <div class="office-info">
    <div id="officeName" class="office-name"></div>
    <div id="officeDetails" class="office-details"></div>
  </div>
</header>

<h1 class="document-title">CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS</h1>

<div class="content">

  <div class="clausula">
    <p class="clausula-texto">Pelo presente instrumento particular, as partes abaixo identificadas:</p>
  </div>

  <div class="clausula">
    <p class="clausula-texto"><strong>CONTRATANTE:</strong> <span id="clientIdent"></span></p>
  </div>

  <div class="clausula">
    <p class="clausula-texto"><strong>CONTRATADO:</strong> <span id="officeNome"></span>, inscrito no CNPJ <span id="officeCnpj"></span>, com sede profissional em <span id="officeEndereco"></span>, neste ato representado por <span id="officeResponsavel"></span>, advogado(a), inscrito(a) na OAB/<span id="oabUf1"></span> sob nº <span id="oabNum1"></span>.</p>
  </div>

  <div class="clausula">
    <p class="clausula-texto">As partes acima qualificadas celebram o presente <strong>Contrato de Prestação de Serviços Advocatícios</strong>, que se regerá pelas cláusulas abaixo, em conformidade com a Lei nº 8.906/94 (Estatuto da Advocacia), o Código de Ética e Disciplina da OAB, o Código Civil e demais normas aplicáveis.</p>
  </div>

  <!-- CLÁUSULA 1 -->
  <div class="clausula">
    <p class="clausula-titulo">CLÁUSULA 1ª – DO OBJETO</p>
    <p class="clausula-texto">O presente contrato tem por objeto a prestação de serviços advocatícios pelo CONTRATADO ao(à) CONTRATANTE, consistentes na análise, orientação, consultoria, atuação judicial e/ou extrajudicial necessária à defesa de seus interesses, dentro dos limites técnicos, éticos, legais e estratégicos definidos pelo profissional, conforme o mandato outorgado.</p>
    <p class="clausula-texto">Fica expressamente pactuado que o presente contrato não abrange serviços não relacionados diretamente ao objeto contratado, tais como recursos extraordinários, ações autônomas, incidentes processuais complexos, execuções em autos apartados ou procedimentos administrativos especiais, salvo ajuste expresso e específico.</p>
  </div>

  <!-- CLÁUSULA 2 -->
  <div class="clausula">
    <p class="clausula-titulo">CLÁUSULA 2ª – DA NATUREZA DA OBRIGAÇÃO</p>
    <p class="clausula-texto">O(a) CONTRATANTE declara ciência inequívoca de que a atividade advocatícia constitui obrigação de meio, e não de resultado, inexistindo qualquer garantia quanto ao êxito da demanda ou ao entendimento do juízo.</p>
  </div>

  <!-- CLÁUSULA 3 -->
  <div class="clausula">
    <p class="clausula-titulo">CLÁUSULA 3ª – DOS HONORÁRIOS ADVOCATÍCIOS CONTRATUAIS</p>
    <p class="clausula-texto">Pelos serviços prestados, o(a) CONTRATANTE pagará ao CONTRATADO os honorários advocatícios ajustados da seguinte forma:</p>
    <div class="honorarios-highlight">
      <p><strong>a) Modalidade de Remuneração:</strong> <span id="kitTipoRemuneracao"></span></p>
      <p id="percentualHonorariosWrap" style="display:none;"><strong>b) Percentual sobre Êxito:</strong> <span id="kitPercentualHonorarios"></span>% do proveito econômico obtido</p>
      <p id="valorFixoWrap" style="display:none;"><strong>c) Honorários Contratuais Fixos:</strong> R$ <span id="kitValorFixo"></span> (<span id="kitValorFixoExtenso"></span>)</p>
      <p><strong>d) Condições de Pagamento:</strong></p>
      <p id="entradaWrap" style="display:none;" class="subitem">• <strong>Entrada:</strong> R$ <span id="kitEntrada"></span> (<span id="kitEntradaExtenso"></span>)</p>
      <p id="parcelasWrap" style="display:none;" class="subitem">• <strong>Parcelamento:</strong> <span id="kitParcelas"></span>x de R$ <span id="kitValorParcela"></span> (<span id="kitValorParcelaExtenso"></span>)</p>
      <p id="vencimentosWrap" style="display:none;" class="subitem">• <strong>Vencimentos:</strong> <span id="kitVencimentos"></span></p>
      <p class="subitem">• <strong>Método de Pagamento:</strong> <span id="kitMetodoPagamento"></span></p>
      <p id="pixWrap" style="display:none;" class="subitem">• <strong>Chave PIX:</strong> <span id="kitChavePix"></span></p>
    </div>
    <p class="clausula-texto">Os honorários contratados são devidos independentemente do resultado final da demanda, salvo quando expressamente ajustados sob a modalidade exclusiva de êxito.</p>
  </div>

  <!-- CLÁUSULA 4 -->
  <div class="clausula">
    <p class="clausula-titulo">CLÁUSULA 4ª – DOS HONORÁRIOS DE SUCUMBÊNCIA</p>
    <p class="clausula-texto">Os honorários de sucumbência eventualmente fixados pelo juízo pertencem exclusivamente ao CONTRATADO, nos termos do artigo 23 da Lei nº 8.906/94, não se compensando nem se confundindo com os honorários contratuais.</p>
  </div>

  <!-- CLÁUSULA 5 -->
  <div class="clausula">
    <p class="clausula-titulo">CLÁUSULA 5ª – AUTORIZAÇÃO PARA LEVANTAMENTO DE VALORES</p>
    <p class="clausula-texto">O(a) CONTRATANTE autoriza expressamente o CONTRATADO a receber, levantar, dar quitação e reter valores decorrentes de alvarás, RPV, precatórios ou acordos, até o limite dos honorários contratuais e sucumbenciais devidos, comprometendo-se a prestar contas na forma da lei.</p>
  </div>

  <!-- CLÁUSULA 6 -->
  <div class="clausula">
    <p class="clausula-titulo">CLÁUSULA 6ª – DAS DESPESAS E CUSTAS</p>
    <p class="clausula-texto">Todas as despesas necessárias à condução do caso, incluindo custas processuais, taxas, emolumentos, diligências, deslocamentos, cópias, autenticações e despesas extraordinárias, correrão por conta do(a) CONTRATANTE, não estando incluídas nos honorários.</p>
  </div>

  <!-- CLÁUSULA 7 -->
  <div class="clausula">
    <p class="clausula-titulo">CLÁUSULA 7ª – DA INADIMPLÊNCIA</p>
    <p class="clausula-texto" id="clausulaInadimplencia">O atraso no pagamento dos honorários ajustados sujeitará o(a) CONTRATANTE à multa de 2% (dois por cento) sobre o valor devido, acrescida de juros de mora de 1% (um por cento) ao mês, além de correção monetária pelo índice oficial vigente, sem prejuízo da cobrança judicial e da possibilidade de rescisão contratual com perda das vantagens pactuadas.</p>
  </div>

  <!-- CLÁUSULA 8 -->
  <div class="clausula">
    <p class="clausula-titulo">CLÁUSULA 8ª – DA RESCISÃO</p>
    <p class="clausula-texto">O presente contrato poderá ser rescindido por qualquer das partes, a qualquer tempo, mediante comunicação expressa, assegurado ao CONTRATADO o recebimento dos honorários proporcionais aos serviços já prestados, bem como daqueles decorrentes de êxito, quando aplicável.</p>
  </div>

  <!-- CLÁUSULA 9 -->
  <div class="clausula">
    <p class="clausula-titulo">CLÁUSULA 9ª – DA CONFIDENCIALIDADE</p>
    <p class="clausula-texto">As partes comprometem-se a manter sigilo absoluto sobre todas as informações, documentos e estratégias relacionadas ao presente contrato, mesmo após o seu encerramento.</p>
  </div>

  <!-- CLÁUSULA 10 -->
  <div class="clausula">
    <p class="clausula-titulo">CLÁUSULA 10ª – DO TÍTULO EXECUTIVO</p>
    <p class="clausula-texto">O presente contrato constitui título executivo extrajudicial, nos termos do artigo 784, inciso XII, do Código de Processo Civil.</p>
  </div>

  <!-- CLÁUSULA 11 -->
  <div class="clausula">
    <p class="clausula-titulo">CLÁUSULA 11ª – DO FORO</p>
    <p class="clausula-texto">Para dirimir quaisquer controvérsias oriundas deste contrato, as partes elegem o foro da Comarca de <span id="foroLocal"></span>, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p>
  </div>

  <div class="clausula">
    <p class="clausula-texto"><strong>Local e data:</strong> <span id="localData"></span></p>
  </div>

  <!-- ASSINATURAS -->
  <div class="signature-section">
    <div class="signature-block">
      <img id="clientSigImg" class="signature-img" src="" alt="Assinatura" style="display:none;" />
      <div class="signature-line">
        <strong id="clientName"></strong><br/>
        <span id="clientDoc"></span><br/>
        CONTRATANTE
      </div>
    </div>
    <div class="signature-block">
      <img id="officeSigImg" class="office-signature-img" src="" alt="Assinatura" style="display:none;" />
      <div class="signature-line">
        <strong id="officeResponsavelNome"></strong><br/>
        OAB/<span id="oabUf2"></span> <span id="oabNum2"></span><br/>
        CONTRATADO
      </div>
    </div>
  </div>

  <!-- TESTEMUNHAS -->
  <div class="witnesses">
    <p class="clausula-titulo">TESTEMUNHAS</p>
    <div class="witness-row">
      <div class="witness">
        <div class="line">Nome: ___________________________<br/>CPF: ___________________________</div>
      </div>
      <div class="witness">
        <div class="line">Nome: ___________________________<br/>CPF: ___________________________</div>
      </div>
    </div>
  </div>

</div>

<script>
(function(){
  var d = window.__KIT_DATA__ || {};
  var c = d.client || {};
  var o = d.office || {};
  var k = d.kit || {};
  var date = d.date || {};
  var s = function(v){ return (v == null || v === "") ? "" : String(v); };

  // Build client identification
  var isPJ = !!c.cnpj;
  var clientIdent = "";
  if (isPJ) {
    clientIdent = s(c.full_name) + ", pessoa jurídica de direito privado, inscrita no CNPJ sob nº " + s(c.cnpj) + ", com sede em " + s(c.endereco_completo || c.address) + (c.representante_nome ? ", neste ato representada por " + s(c.representante_nome) : "");
  } else {
    var parts = [];
    parts.push(s(c.full_name));
    if (c.nationality) parts.push(s(c.nationality));
    if (c.marital_status) parts.push(s(c.marital_status));
    if (c.profession) parts.push(s(c.profession));
    var docParts = [];
    if (c.rg) docParts.push("portador(a) do RG nº " + s(c.rg) + (c.rg_issuer ? "/" + s(c.rg_issuer) : ""));
    if (c.cpf) docParts.push("CPF nº " + s(c.cpf));
    if (docParts.length) parts.push(docParts.join(" e "));
    if (c.endereco_completo || c.address) parts.push("residente e domiciliado(a) em " + s(c.endereco_completo || c.address));
    clientIdent = parts.join(", ");
  }

  // Header
  var logo = document.getElementById("officeLogo");
  if (o.logo_signed_url) { logo.src = o.logo_signed_url; logo.style.display = "block"; }
  document.getElementById("officeName").textContent = s(o.nome_escritorio || o.name);
  var details = [];
  if (o.endereco_completo) details.push(o.endereco_completo);
  var line2 = [];
  if (o.cnpj) line2.push("CNPJ: " + o.cnpj);
  if (o.responsavel_oab) line2.push("OAB " + o.responsavel_oab + (o.responsavel_oab_uf ? "/" + o.responsavel_oab_uf : ""));
  if (line2.length) details.push(line2.join(" | "));
  var line3 = [];
  if (o.telefone || o.phone) line3.push("Tel: " + s(o.telefone || o.phone));
  if (o.email) line3.push(o.email);
  if (line3.length) details.push(line3.join(" | "));
  document.getElementById("officeDetails").innerHTML = details.join("<br/>");

  // Content - Parties
  document.getElementById("clientIdent").textContent = clientIdent;
  document.getElementById("officeNome").textContent = s(o.nome_escritorio || o.name);
  document.getElementById("officeCnpj").textContent = s(o.cnpj);
  document.getElementById("officeEndereco").textContent = s(o.endereco_completo);
  document.getElementById("officeResponsavel").textContent = s(o.responsavel_nome);
  document.getElementById("oabUf1").textContent = s(o.responsavel_oab_uf);
  document.getElementById("oabNum1").textContent = s(o.responsavel_oab);

  // Clause 3 - Fees
  document.getElementById("kitTipoRemuneracao").textContent = s(k.tipo_remuneracao) || "[a definir]";
  
  if (k.percentual_honorarios) {
    document.getElementById("percentualHonorariosWrap").style.display = "block";
    document.getElementById("kitPercentualHonorarios").textContent = s(k.percentual_honorarios);
  }
  if (k.valor_fixo_honorarios) {
    document.getElementById("valorFixoWrap").style.display = "block";
    document.getElementById("kitValorFixo").textContent = s(k.valor_fixo_honorarios);
    document.getElementById("kitValorFixoExtenso").textContent = s(k.valor_fixo_honorarios_extenso);
  }
  if (k.valor_entrada) {
    document.getElementById("entradaWrap").style.display = "block";
    document.getElementById("kitEntrada").textContent = s(k.valor_entrada);
    document.getElementById("kitEntradaExtenso").textContent = s(k.valor_entrada_extenso);
  }
  if (k.numero_parcelas) {
    document.getElementById("parcelasWrap").style.display = "block";
    document.getElementById("kitParcelas").textContent = s(k.numero_parcelas);
    document.getElementById("kitValorParcela").textContent = s(k.valor_parcela);
    document.getElementById("kitValorParcelaExtenso").textContent = s(k.valor_parcela_extenso);
  }
  if (k.parcelas_datas_vencimento) {
    document.getElementById("vencimentosWrap").style.display = "block";
    document.getElementById("kitVencimentos").textContent = s(k.parcelas_datas_vencimento);
  }
  document.getElementById("kitMetodoPagamento").textContent = s(k.metodo_pagamento_label) || "[a definir]";
  if (k.chave_pix) {
    document.getElementById("pixWrap").style.display = "block";
    document.getElementById("kitChavePix").textContent = s(k.chave_pix);
  }

  // Clause 7 - Custom default clause
  if (k.clausula_inadimplemento) {
    document.getElementById("clausulaInadimplencia").textContent = s(k.clausula_inadimplemento);
  }

  // Clause 11 - Forum
  var cidade = s(o.cidade || o.city);
  var estado = s(o.estado || o.state);
  var foro = cidade && estado ? cidade + "/" + estado : cidade || estado || "[Comarca]";
  document.getElementById("foroLocal").textContent = foro;
  document.getElementById("localData").textContent = foro + ", " + s(date.extenso || new Date().toLocaleDateString("pt-BR"));

  // Signatures
  var clientSig = document.getElementById("clientSigImg");
  if (c.signature_base64) {
    var sig = String(c.signature_base64);
    clientSig.src = sig.startsWith("data:") ? sig : "data:image/png;base64," + sig;
    clientSig.style.display = "block";
  }
  document.getElementById("clientName").textContent = s(c.full_name);
  document.getElementById("clientDoc").textContent = c.cpf ? "CPF: " + s(c.cpf) : (c.cnpj ? "CNPJ: " + s(c.cnpj) : "");

  var officeSig = document.getElementById("officeSigImg");
  if (o.signature_signed_url) { officeSig.src = o.signature_signed_url; officeSig.style.display = "block"; }
  document.getElementById("officeResponsavelNome").textContent = s(o.responsavel_nome);
  document.getElementById("oabUf2").textContent = s(o.responsavel_oab_uf);
  document.getElementById("oabNum2").textContent = s(o.responsavel_oab);
})();
</script>

</body>
</html>',
    updated_at = now()
WHERE code = 'CONTRATO' AND office_id IS NULL;