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
    .clausula-texto { text-indent: 2em; }
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
    <p class="clausula-texto"><strong>CONTRATADO:</strong> <span id="officeResponsavel"></span>, advogado(a) inscrito(a) na OAB/<span id="oabUf1"></span> sob nº <span id="oabNum1"></span>, com escritório profissional em <span id="officeEndereco"></span>.</p>
  </div>

  <div class="clausula">
    <p class="clausula-texto">Têm entre si justo e contratado o que segue, que mutuamente aceitam e outorgam:</p>
  </div>

  <!-- CLÁUSULA 1 -->
  <div class="clausula">
    <p class="clausula-titulo">CLÁUSULA 1ª – DO OBJETO</p>
    <p class="clausula-texto">O presente contrato tem por objeto a prestação de serviços advocatícios pelo CONTRATADO em favor do CONTRATANTE, relacionados ao seguinte: <span id="kitObjeto">[objeto do contrato]</span>.</p>
    <p class="clausula-texto">Incluem-se no objeto os atos necessários à tutela do direito do CONTRATANTE, compreendendo peticionamentos, acompanhamento processual, audiências, requerimentos, protocolos, respostas e demais atos técnicos pertinentes.</p>
  </div>

  <!-- CLÁUSULA 2 -->
  <div class="clausula">
    <p class="clausula-titulo">CLÁUSULA 2ª – DOS HONORÁRIOS CONTRATUAIS</p>
    <div class="honorarios-highlight">
      <p><strong>Honorários ajustados:</strong> <span id="kitHonorarios"></span></p>
      <p><strong>Forma de pagamento:</strong> <span id="kitPagamento"></span></p>
    </div>
    <p class="clausula-texto">Os honorários pactuados remuneram a atividade profissional do CONTRATADO, nos termos da Lei nº 8.906/94 (Estatuto da Advocacia), e não se confundem com custas processuais, despesas, emolumentos e demais gastos necessários ao andamento do feito.</p>
    <div id="honorariosSucessoWrap" style="display:none;">
      <p class="clausula-texto"><strong>Honorários de êxito:</strong> <span id="kitHonorariosSucesso"></span></p>
    </div>
  </div>

  <!-- CLÁUSULA 3 -->
  <div class="clausula">
    <p class="clausula-titulo">CLÁUSULA 3ª – DAS DESPESAS E CUSTAS</p>
    <p class="clausula-texto">Todas as custas processuais, taxas, emolumentos, diligências, deslocamentos, cópias, autenticações, despesas com correspondências, bem como quaisquer despesas necessárias ao cumprimento do objeto deste contrato, correrão por conta exclusiva do CONTRATANTE, mediante prévio aviso e comprovação quando possível.</p>
  </div>

  <!-- CLÁUSULA 4 -->
  <div class="clausula">
    <p class="clausula-titulo">CLÁUSULA 4ª – DOS DEVERES DAS PARTES</p>
    <p class="clausula-texto">O CONTRATANTE compromete-se a fornecer informações verdadeiras e completas, bem como toda documentação necessária, sob pena de prejudicar a atuação técnica do CONTRATADO.</p>
    <p class="clausula-texto">O CONTRATADO compromete-se a atuar com zelo, diligência e técnica, mantendo o CONTRATANTE informado sobre o andamento relevante, dentro das possibilidades e prazos.</p>
  </div>

  <!-- CLÁUSULA 5 -->
  <div class="clausula">
    <p class="clausula-titulo">CLÁUSULA 5ª – DA RESCISÃO</p>
    <p class="clausula-texto">O presente contrato poderá ser rescindido a qualquer tempo por qualquer das partes, mediante comunicação por escrito.</p>
    <p class="clausula-texto">Na hipótese de rescisão pelo CONTRATANTE sem justa causa, ou por inadimplemento das obrigações assumidas, permanecem devidos os honorários proporcionais ao trabalho desenvolvido, além das despesas já realizadas.</p>
  </div>

  <!-- CLÁUSULA 6 -->
  <div class="clausula">
    <p class="clausula-titulo">CLÁUSULA 6ª – DO FORO</p>
    <p class="clausula-texto">Para dirimir quaisquer controvérsias oriundas do presente contrato, as partes elegem o foro da Comarca de <span id="foroLocal"></span>, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p>
  </div>

  <div class="clausula">
    <p class="clausula-texto" id="localData"></p>
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

  // Content
  document.getElementById("clientIdent").textContent = clientIdent;
  document.getElementById("officeResponsavel").textContent = s(o.responsavel_nome);
  document.getElementById("oabUf1").textContent = s(o.responsavel_oab_uf);
  document.getElementById("oabNum1").textContent = s(o.responsavel_oab);
  document.getElementById("officeEndereco").textContent = s(o.endereco_completo);

  // Clauses
  document.getElementById("kitObjeto").textContent = s(k.objeto) || "[a ser definido]";
  document.getElementById("kitHonorarios").textContent = s(k.honorarios_descricao) || "[valor a definir]";
  document.getElementById("kitPagamento").textContent = s(k.pagamento_descricao) || "[forma a definir]";
  
  var sucessoWrap = document.getElementById("honorariosSucessoWrap");
  if (k.honorarios_sucesso_descricao) {
    sucessoWrap.style.display = "block";
    document.getElementById("kitHonorariosSucesso").textContent = s(k.honorarios_sucesso_descricao);
  }

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