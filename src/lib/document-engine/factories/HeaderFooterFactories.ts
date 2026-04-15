import { DocumentContextSnapshot } from '@/types/institutional';

export function HeaderFactory(context: DocumentContextSnapshot) {
  const { office, unit, templateMetadata } = context;
  const templateId = templateMetadata?.id || 'clean_white';
  const logo = office.branding.logoPrimaryUrl;
  const officeName = office.name;
  const unitInfo = unit 
    ? [unit.name, [unit.city, unit.state].filter(Boolean).join('/')].filter(Boolean).join(' • ') 
    : '';

  if (templateId === 'clean_white') return '';

  const logoHtml = logo 
    ? `<img src="${logo}" style="max-height: 65px; max-width: 250px; object-fit: contain;" alt="Logo" />`
    : `<div style="font-weight: 800; font-size: 20pt; letter-spacing: -0.02em; color: ${office.branding.colors.primary}">${officeName}</div>`;

  if (templateId === 'premium_elegant') {
    return `
      <div class="top-band"></div>
      <div class="premium-header">
        <div class="header-left">
          ${logoHtml}
        </div>
        <div class="header-right" style="text-align: right; font-size: 8.5pt; color: #555; max-width: 300px;">
          <div style="font-weight: 700; color: #1a1a1a; margin-bottom: 2px;">${office.legalName}</div>
          ${office.cnpj ? `<div>CNPJ: ${office.cnpj}</div>` : ''}
          ${unit ? `
            ${unit.address ? `<div>${unit.address}</div>` : ''}
            ${[unit.city, unit.state].filter(Boolean).length > 0 ? `<div>${[unit.city, unit.state].filter(Boolean).join(' – ')}</div>` : ''}
          ` : ''}
          ${unit?.phone ? `<div>Tel: ${unit.phone}</div>` : ''}
        </div>
      </div>
    `;
  }

  if (templateId === 'modern_executive') {
    return `
      <div class="modern-header">
        <div class="modern-section" style="flex: 1; margin-right: 40px;">
           <div style="font-size: 15pt; font-weight: 800; color: ${office.branding.colors.primary}; line-height: 1.1;">${officeName}</div>
           <div style="font-size: 9pt; color: #64748b; margin-top: 5px; font-weight: 500;">${unitInfo}</div>
        </div>
        <div class="header-logo" style="flex-shrink: 0;">
          ${logo ? `<img src="${logo}" style="max-height: 55px; max-width: 200px; object-fit: contain;" />` : ''}
        </div>
      </div>
    `;
  }

  // default / simple_watermark
  return `
    <div style="text-align: center; margin-bottom: 50px; border-bottom: 0.5pt solid #eee; padding-bottom: 25px;">
      <div style="margin-bottom: 12px;">${logoHtml}</div>
      ${unitInfo ? `<div style="font-size: 9pt; color: #666; font-weight: 500;">${unitInfo}</div>` : ''}
    </div>
  `;
}

export function FooterFactory(context: DocumentContextSnapshot) {
  const { office, unit, templateMetadata } = context;
  const templateId = templateMetadata?.id || 'clean_white';

  if (templateId === 'clean_white') return '';

  return `
    <div class="document-footer">
      <div style="display: flex; justify-content: space-between; align-items: flex-end;">
        <div style="text-align: left; flex: 1;">
          <div style="font-weight: 600;">${office.legalName}</div>
          ${unit ? `<div>${[unit.address, [unit.city, unit.state].filter(Boolean).join('/')].filter(Boolean).join(' • ')}</div>` : ''}
        </div>
        <div style="text-align: right; flex: 1; opacity: 0.7; font-size: 7pt;">
          <div>ID: ${templateMetadata?.id} | v${templateMetadata?.version || '1.0'}</div>
          <div>Gerado em: ${new Date().toLocaleDateString('pt-BR')} • Flaito Document Engine</div>
        </div>
      </div>
    </div>
  `;
}
