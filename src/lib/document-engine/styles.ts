import { BrandingColors, DocumentTemplateId, WatermarkConfig } from '@/types/institutional';
import { TYPOGRAPHY, DOCUMENT_LAYOUT } from './constants';

export function getTemplateStyles(
  templateId: DocumentTemplateId,
  colors: BrandingColors,
  watermark: WatermarkConfig
): string {
  const typo = TYPOGRAPHY[templateId] || TYPOGRAPHY.clean_white;

  return `
    <style>
      @media print {
        @page {
          margin: ${DOCUMENT_LAYOUT.margin};
          size: ${DOCUMENT_LAYOUT.format};
        }
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .page-break-avoid { page-break-inside: avoid !important; }
        .page-break-before { page-break-before: always !important; }
        .no-print { display: none !important; }
      }

      * { box-sizing: border-box; }

      body {
        font-family: ${typo.body};
        font-size: ${typo.fontSize};
        line-height: 1.5;
        color: #1a1a1a;
        margin: 0;
        padding: 0;
        background: white;
      }

      .document-wrapper {
        position: relative;
        min-height: ${DOCUMENT_LAYOUT.minHeight};
        width: ${DOCUMENT_LAYOUT.width};
        margin: 0 auto;
        padding: ${DOCUMENT_LAYOUT.margin};
        background: white;
        overflow: hidden;
      }

      h1, h2, h3 {
        font-family: ${typo.header};
        color: ${colors.primary};
        margin-top: 2em;
        margin-bottom: 0.8em;
        line-height: 1.2;
      }

      h1 { 
        font-size: ${typo.titleSize}; 
        font-weight: 700; 
        text-align: center; 
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      h2 { 
        font-size: ${typo.subtitleSize}; 
        font-weight: 600; 
        border-bottom: 1px solid ${colors.secondary}44; 
        padding-bottom: 4px; 
      }

      p { 
        margin-bottom: 1.2em; 
        text-align: justify; 
        text-justify: inter-word;
      }

      /* --- TEMPLATE: PREMIUM ELEGANT --- */
      body[data-template="premium_elegant"] {
        background: #fdfdfd;
      }
      body[data-template="premium_elegant"] .top-band {
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 4mm;
        background: ${colors.primary};
      }
      body[data-template="premium_elegant"] .premium-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1.5pt double ${colors.primary};
        padding-bottom: 15px;
        margin-bottom: 40px;
        margin-top: 10px;
      }
      body[data-template="premium_elegant"] h1, 
      body[data-template="premium_elegant"] h2 {
        font-family: ${TYPOGRAPHY.premium_elegant.header};
      }

      /* --- TEMPLATE: MODERN EXECUTIVE --- */
      body[data-template="modern_executive"] .modern-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 50px;
      }
      body[data-template="modern_executive"] .modern-section {
        background: #f1f5f9;
        border-radius: 4px;
        padding: 25px;
        border-left: 6px solid ${colors.accent};
        margin-bottom: 30px;
      }

      /* --- TEMPLATE: CLEAN WHITE --- */
      body[data-template="clean_white"] .document-wrapper {
        padding: 25mm 25mm;
      }

      /* --- TEMPLATE: SIMPLE WATERMARK --- */
      body[data-template="simple_watermark"] .document-wrapper {
        background: linear-gradient(to bottom, transparent 95%, ${colors.primary}08 5%);
      }

      /* Watermark Overlay */
      .watermark {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) ${watermark.position === 'diagonal' ? 'rotate(-45deg)' : ''};
        width: 60%;
        max-width: 500px;
        opacity: ${watermark.opacity};
        pointer-events: none;
        z-index: 0;
        filter: grayscale(100%);
      }

      /* Footers & Signatures */
      .document-footer {
        position: absolute;
        bottom: 15mm;
        left: ${DOCUMENT_LAYOUT.margin};
        right: ${DOCUMENT_LAYOUT.margin};
        font-size: 8pt;
        color: #666;
        text-align: center;
        border-top: 0.5pt solid #ddd;
        padding-top: 10px;
      }

      .signature-section {
        margin-top: 80px;
        page-break-inside: avoid;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 40px;
      }

      .signature-block {
        text-align: center;
        min-width: 250px;
      }

      .signature-line {
        border-top: 1px solid #000;
        margin-top: 40px;
        padding-top: 8px;
        font-weight: 600;
        font-size: 10pt;
      }

      .professional-id {
        font-size: 8pt;
        color: #444;
        margin-top: 2px;
      }
    </style>
  `;
}
