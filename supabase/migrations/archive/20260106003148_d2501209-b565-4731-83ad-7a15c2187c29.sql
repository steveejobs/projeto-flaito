
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
      body {
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
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

    .office-logo {
      max-height: 80px;
      max-width: 220px;
      object-fit: contain;
    }

    .office-info { flex: 1; color: #fff; text-align: right; }
    .office-name {
      font-size: 16pt;
      font-weight: bold;
      letter-spacing: 1px;
      margin-bottom: 5px;
      text-transform: uppercase;
    }
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

    .content {
      padding: 0 10px;
      text-align: justify;
    }

    .clausula { margin-bottom: 18px; }
    .clausula-titulo {
      font-weight: bold;
      margin-bottom: 8px;
      text-transform: uppercase;
      page-break-after: avoid;
    }
    .clausula-texto { text-indent: 2em; margin: 0 0 8px 0; }

    .honorarios-highlight {
      background: linear-gradient(135deg, #fffbe6 0%, #fff9db 100%);
      border-left: 4px solid #C9A227;
      padding: 15px 20px;
      margin: 12px 0;
      border-radius: 0 8px 8px 0;
      page-break-inside: avoid;
    }
    .honorarios-highlight p { text-indent: 0; margin: 0 0 8px 0; }

    .signature-section {
      margin-top: 30px;
      page-break-inside: avoid;
      page-break-before: avoid;
    }
    .signature-block {
      display: inline-block;
      width: 45%;
      text-align: center;
      vertical-align: top;
      margin-top: 30px;
    }

    .signature-img {
      max-height: 100px;
      display: block;
      margin: 0 auto 8px;
    }

    .office-signature-img {
      max-height: 90px;
      max-width: 240px;
      object-fit: contain;
      display: block;
      margin: 0 auto 8px;
    }

    .signature-line {
      border-top: 1px solid #333;
      margin-top: 60px;
      padding-top: 8px;
    }

    .witnesses {
      margin-top: 26px;
      page-break-inside: avoid;
    }
    .witness-row {
      display: flex;
      gap: 30px;
      justify-content: space-between;
      margin-top: 16px;
    }
    .witness {
      width: 48%;
      text-align: center;
    }
    .witness .line {
      border-top: 1px solid #333;
      margin-top: 40px;
      padding-top: 8px;
    }

    .hidden { display: none !important; }
    .nowrap { white-space: nowrap; }
  </style>
</head>

<body>
  <div class="page">

    <div class="office-header">
      <img id="officeLogo" class="office-logo hidden" alt="Logo" />
      <div class="office-info">
        <div id="officeName" class="office-name hidden"></div>
        <div class="office-details">
          <div id="officeAddress" class="hidden"></div>
          <div id="officeCnpjOabLine" class="hidden">
            <span class="nowrap">CNPJ: <span id="officeCnpj"></span></span>
            <span id="officeCnpjOabSep" class="hidden"> | </span>
            <span id="officeOab" class="hidden"></span>
          </div>
          <div id="officePhoneEmailLine" class="hidden">
            <span id="officePhoneWrap" class="hidden">Tel.: <span id="officePhone"></span></span>
            <span id="officePhoneEmailSep" class="hidden"> | </span>
            <span id="officeEmailWrap" class="hidden"><span id="officeEmail"></span></span>
          </div>
        </div>
      </div>
    </div>

    <h1 class="document-title">CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS</h1>

    <div class="content">

      <p class="clausula-texto">
        Pelo presente instrumento particular, as partes abaixo identificadas:
      </p>

      <p class="clausula-texto">
        <strong>CONTRATANTE:</strong> <span id="clientFullIdent"></span>
      </p>

      <p class="clausula-texto">
        <strong>CONTRATADO:</strong> <span id="officeRespName"></span>, advogado(a) inscrito(a) na
        OAB/<span id="officeRespOabUf"></span> sob nº <span id="officeRespOabNum"></span>,
        com escritório profissional em <span id="officeRespAddress"></span>.
      </p>

      <p class="clausula-texto">
        Têm entre si justo e contratado o que segue, que mutuamente aceitam e outorgam:
      </p>

      <!-- Cláusula 1 - Objeto -->
      <div class="clausula">
        <div class="clausula-titulo">CLÁUSULA 1ª – DO OBJETO</div>
        <p class="clausula-texto">
          O presente contrato tem por objeto a prestação de serviços advocatícios pelo CONTRATADO em favor do CONTRATANTE, relacionados ao seguinte:
          <strong id="kitObjeto">acompanhamento e representação jurídica nas demandas do cliente</strong>.
        </p>
        <p class="clausula-texto">
          Incluem-se no objeto os atos necessários à tutela do direito do CONTRATANTE, compreendendo peticionamentos, acompanhamento processual,
          audiências, requerimentos, protocolos, respostas e demais atos técnicos pertinentes.
        </p>
      </div>

      <!-- Cláusula 2 - Honorários -->
      <div class="clausula">
        <div class="clausula-titulo">CLÁUSULA 2ª – DOS HONORÁRIOS CONTRATUAIS</div>

        <div class="honorarios-highlight">
          <p><strong>Honorários ajustados:</strong> <span id="kitHonorariosDescricao">conforme acordo entre as partes</span></p>
          <p><strong>Forma de pagamento:</strong> <span id="kitPagamentoDescricao">conforme acordo entre as partes</span></p>
        </div>

        <p class="clausula-texto">
          Os honorários pactuados remuneram a atividade profissional do CONTRATADO, nos termos da Lei nº 8.906/94 (Estatuto da Advocacia),
          e não se confundem com custas processuais, despesas, emolumentos e demais gastos necessários ao andamento do feito.
        </p>

        <p id="honorariosSucessoWrap" class="clausula-texto hidden">
          <strong>Honorários de êxito:</strong> <span id="kitHonorariosSucessoDescricao"></span>
        </p>
      </div>

      <!-- Cláusula 3 - Despesas -->
      <div class="clausula">
        <div class="clausula-titulo">CLÁUSULA 3ª – DAS DESPESAS E CUSTAS</div>
        <p class="clausula-texto">
          Todas as custas processuais, taxas, emolumentos, diligências, deslocamentos, cópias, autenticações, despesas com correspondências,
          bem como quaisquer despesas necessárias ao cumprimento do objeto deste contrato, correrão por conta exclusiva do CONTRATANTE,
          mediante prévio aviso e comprovação quando possível.
        </p>
      </div>

      <!-- Cláusula 4 - Deveres -->
      <div class="clausula">
        <div class="clausula-titulo">CLÁUSULA 4ª – DOS DEVERES DAS PARTES</div>
        <p class="clausula-texto">
          O CONTRATANTE compromete-se a fornecer informações verdadeiras e completas, bem como toda documentação necessária, sob pena de
          prejudicar a atuação técnica do CONTRATADO.
        </p>
        <p class="clausula-texto">
          O CONTRATADO compromete-se a atuar com zelo, diligência e técnica, mantendo o CONTRATANTE informado sobre o andamento relevante,
          dentro das possibilidades e prazos.
        </p>
      </div>

      <!-- Cláusula 5 - Rescisão -->
      <div class="clausula">
        <div class="clausula-titulo">CLÁUSULA 5ª – DA RESCISÃO</div>
        <p class="clausula-texto">
          O presente contrato poderá ser rescindido a qualquer tempo por qualquer das partes, mediante comunicação por escrito.
        </p>
        <p class="clausula-texto">
          Na hipótese de rescisão pelo CONTRATANTE sem justa causa, ou por inadimplemento das obrigações assumidas, permanecem devidos
          os honorários proporcionais ao trabalho desenvolvido, além das despesas já realizadas.
        </p>
      </div>

      <!-- Cláusula 6 - Foro -->
      <div class="clausula">
        <div class="clausula-titulo">CLÁUSULA 6ª – DO FORO</div>
        <p class="clausula-texto">
          Para dirimir quaisquer controvérsias oriundas do presente contrato, as partes elegem o foro da Comarca de
          <span id="foroCidade"></span>/<span id="foroEstado"></span>, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
        </p>
      </div>

      <p style="text-align:center;margin-top:26px;">
        <span id="placeDate"></span>
      </p>

      <!-- Assinaturas -->
      <div class="signature-section">
        <div class="signature-block">
          <img id="clientSignature" class="signature-img hidden" alt="Assinatura do Contratante" />
          <div class="signature-line">
            <strong id="clientName"></strong><br/>
            <span style="font-size: 10pt;">CPF: <span id="clientCpf"></span></span><br/>
            CONTRATANTE
          </div>
        </div>

        <div class="signature-block">
          <img id="officeSignature" class="office-signature-img hidden" alt="Assinatura do Contratado" />
          <div class="signature-line">
            <strong id="officeRespNameSign"></strong><br/>
            <span style="font-size: 10pt;" id="officeRespOabSign"></span><br/>
            CONTRATADO
          </div>
        </div>
      </div>

      <!-- Testemunhas -->
      <div class="witnesses">
        <p style="text-align:center;font-weight:bold;">TESTEMUNHAS</p>
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

  </div>

  <script>
    window.__KIT_DATA__ = window.__KIT_DATA__ || { office: {}, client: {}, date: {}, contract: {} };

    (function () {
      const d = window.__KIT_DATA__ || {};
      const office = d.office || {};
      const client = d.client || {};
      const date = d.date || {};
      const contract = d.contract || {};

      const $ = (id) => document.getElementById(id);
      const show = (el) => el && el.classList.remove("hidden");
      const hide = (el) => el && el.classList.add("hidden");
      const setText = (el, value) => { if (el) el.textContent = (value ?? "").toString().trim(); };
      const has = (v) => !!(v && String(v).trim().length);

      // Logo
      const logoEl = $("officeLogo");
      if (logoEl && has(office.logo_signed_url)) {
        logoEl.src = office.logo_signed_url;
        logoEl.onerror = () => hide(logoEl);
        const mh = Number(office.logo_max_height) || 80;
        const mw = Number(office.logo_max_width) || 220;
        logoEl.style.maxHeight = mh + "px";
        logoEl.style.maxWidth = mw + "px";
        show(logoEl);
      } else {
        hide(logoEl);
      }

      // Nome escritório
      const officeNameEl = $("officeName");
      if (has(office.nome_escritorio)) { setText(officeNameEl, office.nome_escritorio); show(officeNameEl); }
      else hide(officeNameEl);

      // Endereço
      const officeAddressEl = $("officeAddress");
      if (has(office.endereco_completo)) { setText(officeAddressEl, office.endereco_completo); show(officeAddressEl); }
      else hide(officeAddressEl);

      // CNPJ/OAB header
      const cnpjLine = $("officeCnpjOabLine");
      const cnpjEl = $("officeCnpj");
      const oabEl = $("officeOab");
      const sepCnpjOab = $("officeCnpjOabSep");

      const hasCnpj = has(office.cnpj);
      const hasOab = has(office.responsavel_oab) || has(office.responsavel_oab_uf);

      if (hasCnpj) setText(cnpjEl, office.cnpj);

      if (hasOab) {
        const uf = has(office.responsavel_oab_uf) ? "/" + office.responsavel_oab_uf : "";
        setText(oabEl, "OAB " + (office.responsavel_oab || "") + uf);
        show(oabEl);
      } else {
        hide(oabEl);
      }

      if (hasCnpj || hasOab) {
        if (hasCnpj && hasOab) show(sepCnpjOab); else hide(sepCnpjOab);
        show(cnpjLine);
      } else {
        hide(cnpjLine);
      }

      // Telefone/Email
      const phoneEmailLine = $("officePhoneEmailLine");
      const phoneWrap = $("officePhoneWrap");
      const phoneEl = $("officePhone");
      const emailWrap = $("officeEmailWrap");
      const emailEl = $("officeEmail");
      const sepPhoneEmail = $("officePhoneEmailSep");

      const hasPhone = has(office.telefone);
      const hasEmail = has(office.email);

      if (hasPhone) { setText(phoneEl, office.telefone); show(phoneWrap); } else hide(phoneWrap);
      if (hasEmail) { setText(emailEl, office.email); show(emailWrap); } else hide(emailWrap);

      if (hasPhone || hasEmail) {
        if (hasPhone && hasEmail) show(sepPhoneEmail); else hide(sepPhoneEmail);
        show(phoneEmailLine);
      } else {
        hide(phoneEmailLine);
      }

      // Identificação completa do cliente (usando identificacao_cliente que já vem formatada)
      setText($("clientFullIdent"), client.identificacao_cliente || client.full_name || "");
      setText($("clientName"), client.full_name || "");
      setText($("clientCpf"), client.cpf || client.cnpj || "");

      // Contratado (responsável do escritório)
      setText($("officeRespName"), office.responsavel_nome || "");
      setText($("officeRespNameSign"), office.responsavel_nome || "");
      setText($("officeRespOabUf"), office.responsavel_oab_uf || "UF");
      setText($("officeRespOabNum"), office.responsavel_oab || "—");
      setText($("officeRespOabSign"), "OAB/" + (office.responsavel_oab_uf || "") + " " + (office.responsavel_oab || ""));
      setText($("officeRespAddress"), office.endereco_completo || "");

      // Contract terms
      if (has(contract.objeto)) setText($("kitObjeto"), contract.objeto);
      if (has(contract.honorarios_descricao)) setText($("kitHonorariosDescricao"), contract.honorarios_descricao);
      if (has(contract.pagamento_descricao)) setText($("kitPagamentoDescricao"), contract.pagamento_descricao);

      const honorariosSucessoWrap = $("honorariosSucessoWrap");
      if (has(contract.honorarios_sucesso_descricao)) {
        setText($("kitHonorariosSucessoDescricao"), contract.honorarios_sucesso_descricao);
        show(honorariosSucessoWrap);
      } else {
        hide(honorariosSucessoWrap);
      }

      // Foro
      const cidade = office.cidade || "";
      const estado = office.estado || "";
      setText($("foroCidade"), cidade || "_____");
      setText($("foroEstado"), estado || "__");

      // Local e data
      const ext = date.extenso || "";
      const place = [cidade, estado].filter(has).join("/");
      const placeDate = (place ? (place + ", ") : "") + (ext || "");
      setText($("placeDate"), placeDate.trim() || "________________________________________");

      // Assinatura do cliente
      const signEl = $("clientSignature");
      if (signEl && has(client.signature_base64)) {
        signEl.src = client.signature_base64;
        signEl.onerror = () => hide(signEl);
        show(signEl);
      } else {
        hide(signEl);
      }

      // Assinatura do escritório
      const officeSignEl = $("officeSignature");
      if (officeSignEl && has(office.signature_signed_url)) {
        officeSignEl.src = office.signature_signed_url;
        officeSignEl.onerror = () => hide(officeSignEl);
        const smh = Number(office.signature_max_height) || 90;
        const smw = Number(office.signature_max_width) || 240;
        officeSignEl.style.maxHeight = smh + "px";
        officeSignEl.style.maxWidth = smw + "px";
        show(officeSignEl);
      } else {
        hide(officeSignEl);
      }
    })();
  </script>
</body>
</html>'
WHERE code = 'CONTRATO' AND office_id IS NOT NULL;
