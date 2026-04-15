import { ProfessionalSettings } from '@/types/institutional';

/**
 * Renders a professional signature block for one or more signatories.
 */
export function SignatureBlock(professional: ProfessionalSettings | ProfessionalSettings[], clientName?: string) {
  const professionals = Array.isArray(professional) ? professional : [professional];

  return `
    <div class="signature-section" style="display: flex; justify-content: center; width: 100%; gap: 80px; flex-wrap: wrap; margin-top: 50px; page-break-inside: avoid;">
      ${professionals.map(p => {
        const signature = p.signatures?.find(s => s.signatureUrl);
        const stamp = p.signatures?.find(s => s.stampUrl);
        
        return `
          <div class="signature-block" style="flex: 0 1 280px; display: flex; flex-direction: column; align-items: center;">
            <div style="height: 100px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: -15px;">
              ${signature ? `<img src="${signature.signatureUrl}" style="max-height: 100px; max-width: 220px;" />` : ''}
              ${stamp ? `<img src="${stamp.stampUrl}" style="max-height: 80px; opacity: 0.8; margin-left: -40px; position: relative; z-index: -1;" />` : ''}
            </div>
            
            <div class="signature-line" style="border-top: 1px solid #000; margin-top: 10px; padding-top: 8px; text-align: center; width: 100%; font-weight: 500;">
              ${p.name.toUpperCase()}
            </div>
            
            <div class="professional-id" style="font-size: 8.5pt; font-weight: 400; color: #666; text-align: center; line-height: 1.4;">
              ${p.roleTitle || ''}<br/>
              ${p.identType}: ${p.identNumber}/${p.identUf}
            </div>
          </div>
        `;
      }).join('')}

      ${clientName ? `
        <div class="signature-block" style="flex: 0 1 280px; display: flex; flex-direction: column; align-items: center;">
          <div style="height: 100px;"></div>
          <div class="signature-line" style="border-top: 1px solid #000; margin-top: 10px; padding-top: 8px; text-align: center; width: 100%; font-weight: 500;">
            ${clientName.toUpperCase()}
          </div>
          <div style="font-size: 8.5pt; font-weight: 400; color: #666; text-align: center;">Cliente / Paciente</div>
        </div>
        ` : ''}
    </div>
  `;
}
