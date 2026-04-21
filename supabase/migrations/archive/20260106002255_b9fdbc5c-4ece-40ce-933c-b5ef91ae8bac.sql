-- Update DECL template to use JavaScript DOM approach like PROC
UPDATE document_templates
SET content = '<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Declaração de Hipossuficiência Econômica</title>

  <style>
    @page { size: A4; margin: 18mm 18mm 22mm 18mm; }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      background: #fff;
      font-size: 12pt;
      line-height: 1.8;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }

    img { max-width: 100%; height: auto; }
    img[src=""], img:not([src]) { display: none !important; }

    .page { padding: 0; }

    .office-header {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 18px 22px;
      background: linear-gradient(135deg, #C9A227 0%, #E8D48A 50%, #C9A227 100%);
      border-bottom: 3px solid #8B7355;
      min-height: 90px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .office-logo {
      max-height: 64px;
      max-width: 220px;
      object-fit: contain;
      flex: 0 0 auto;
    }

    .office-info { flex: 1; color: #fff; text-align: right; }
    .office-name {
      font-size: 16pt;
      font-weight: bold;
      letter-spacing: 1px;
      margin: 0 0 6px 0;
      text-transform: uppercase;
      text-shadow: 0 1px 0 rgba(0,0,0,.25);
    }
    .office-details { font-size: 9pt; line-height: 1.6; opacity: 0.95; }

    h2.title {
      text-align: center;
      margin: 18px 0;
      font-size: 14pt;
      letter-spacing: 2px;
      page-break-after: avoid;
      break-after: avoid;
    }

    p {
      font-size: 12pt;
      line-height: 1.8;
      text-align: justify;
      margin: 0 0 12px 0;
    }

    .content { padding: 0 0 18px 0; }

    .signature-block {
      margin-top: 42px;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .signature-img {
      max-height: 100px;
      display: block;
      margin: 0 auto 8px;
    }

    .signature-line {
      border-top: 1px solid #333;
      width: 320px;
      margin: 0 auto;
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

    <div class="content">
      <h2 class="title">DECLARAÇÃO DE HIPOSSUFICIÊNCIA ECONÔMICA</h2>

      <p>
        Eu, <strong id="clientNameInline"></strong>, <span id="clientIdent"></span>, 
        <strong>DECLARO</strong>, para os devidos fins de direito e sob as penas da lei,
        que <strong>não possuo condições financeiras de arcar com as custas processuais, despesas do processo e honorários advocatícios</strong>
        sem prejuízo do meu sustento próprio e de minha família.
      </p>

      <p>
        A presente declaração é firmada para fins de concessão dos benefícios da <strong>justiça gratuita</strong>, nos termos do
        <strong>art. 98 do Código de Processo Civil</strong>, ciente de que poderá ser objeto de verificação e impugnação, caso existam elementos
        que a infirmem.
      </p>

      <p>
        Declaro, ainda, estar plenamente ciente de que a prestação de informações falsas ou a omissão de dados relevantes configura crime de
        <strong>falsidade ideológica</strong>, previsto no <strong>art. 299 do Código Penal</strong>, sujeitando-me às sanções penais cabíveis.
      </p>

      <p style="margin-top: 18px;">
        <strong>Local e data:</strong> <span id="placeDate"></span>
      </p>

      <div class="signature-block">
        <img id="clientSignature" class="signature-img hidden" alt="Assinatura" />

        <div class="signature-line">
          <strong id="clientName"></strong><br/>
          <span style="font-size: 10pt;">CPF: <span id="clientCpf"></span></span>
        </div>
      </div>
    </div>

  </div>

  <script>
    window.__KIT_DATA__ = window.__KIT_DATA__ || { office: {}, client: {}, date: {} };

    (function () {
      const d = window.__KIT_DATA__ || {};
      const office = d.office || {};
      const client = d.client || {};
      const date = d.date || {};

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
        const mh = Number(office.logo_max_height) || 64;
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

      // CNPJ/OAB
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

      // Cliente - nome inline e identificação
      setText($("clientNameInline"), client.full_name || "");
      setText($("clientIdent"), client.identificacao_cliente || "");
      setText($("clientName"), client.full_name || "");
      setText($("clientCpf"), client.cpf || "");

      // Local e data
      const cidade = office.cidade || "";
      const estado = office.estado || "";
      const ext = date.extenso || "";
      const place = [cidade, estado].filter(has).join("/");
      const placeDate = (place ? (place + ", ") : "") + (ext || "");
      setText($("placeDate"), placeDate.trim() || "________________________________________");

      // Assinatura
      const signEl = $("clientSignature");
      if (signEl && has(client.signature_base64)) {
        signEl.src = client.signature_base64;
        signEl.onerror = () => hide(signEl);
        show(signEl);
      } else {
        hide(signEl);
      }
    })();
  </script>
</body>
</html>'
WHERE code = 'DECL' AND office_id IS NOT NULL;