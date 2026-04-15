import { DocumentContextSnapshot } from '@/types/institutional';
import { getTemplateStyles } from './styles';
import { HeaderFactory, FooterFactory } from './factories/HeaderFooterFactories';
import { WatermarkOverlay } from './sections/WatermarkOverlay';

/**
 * Main function to render a professional document to HTML.
 * @param context The institutional snapshot and branding data.
 * @param content The HTML content of the document (body).
 * @param options Additional options for rendering.
 */
export async function renderDocument(
  context: DocumentContextSnapshot,
  content: string,
  options: { addSignatureBlock?: string } = {}
): Promise<string> {
  const { branding } = context.office;
  const templateId = context.templateMetadata?.id || 'clean_white';
  
  // 1. Generate Styles
  const styles = getTemplateStyles(templateId, branding.colors, branding.watermark);
  
  // 2. Build Structural Components
  const header = HeaderFactory(context);
  const footer = FooterFactory(context);
  
  // Use specific watermark image if enabled, otherwise ignore or fallback
  const watermarkUrl = branding.watermark.imageUrl || branding.logoPrimaryUrl;
  const watermark = WatermarkOverlay(watermarkUrl);

  // 3. Assemble Final HTML
  return `
    <!DOCTYPE html>
    <html lang="pt-br">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Documento - Flaito</title>
      <meta name="document-snapshot" content='${JSON.stringify({
        template: templateId,
        version: context.templateMetadata?.version || 1,
        resolvedAt: context.resolvedAt,
        office: context.office.name,
        branding: context.office.branding.colors
      })}'>
      ${styles}
    </head>
    <body data-template="${templateId}">
      <div class="document-wrapper" id="document-content">
        ${context.office.branding.watermark.enabled ? watermark : ''}
        
        <header>
          ${header}
        </header>

        <main style="position: relative; z-index: 1;">
          ${content}
          
          ${options.addSignatureBlock ? options.addSignatureBlock : ''}
        </main>

        <footer>
          ${footer}
        </footer>
      </div>

      <!-- Institutional Audit Snapshot -->
      <script type="application/json" id="flaito-document-metadata">
        ${JSON.stringify(context, null, 2)}
      </script>
    </body>
    </html>
  `;
}
