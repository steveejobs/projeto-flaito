import { useState, useEffect } from 'react';
import { DocumentContextSnapshot, DocumentTemplateId } from '@/types/institutional';
import { renderDocument } from '@/lib/document-engine';

const MOCK_CONTENT = `
  <h1>Contrato de Prestação de Serviços Judiciais</h1>
  <p>Pelo presente instrumento particular, as partes acima identificadas ajustam entre si o que segue...</p>
  <h2>1. Do Objeto</h2>
  <p>O objeto do presente contrato é a prestação de serviços de assessoria e consultoria jurídica na área de Direito Digital...</p>
  <h2>2. Dos Honorários</h2>
  <p>Pelos serviços prestados, o CONTRATANTE pagará ao CONTRATADO o valor de R$ 5.000,00 (cinco mil reais)...</p>
  <p>Este documento serve como exemplo da aplicação prática da identidade visual escolhida para o seu escritório.</p>
`;

export function useDocumentPreview(initialContext: DocumentContextSnapshot) {
  const [context, setContext] = useState<DocumentContextSnapshot>(initialContext);
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function updatePreview() {
      setIsLoading(true);
      try {
        const html = await renderDocument(context, MOCK_CONTENT);
        setRenderedHtml(html);
      } catch (err) {
        console.error('Failed to render preview:', err);
      } finally {
        setIsLoading(false);
      }
    }
    updatePreview();
  }, [context]);

  const updateTemplate = (templateId: DocumentTemplateId) => {
    setContext(prev => ({
      ...prev,
      templateMetadata: {
        ...prev.templateMetadata!,
        id: templateId
      }
    }));
  };

  const updateColors = (primary: string, secondary: string, accent: string) => {
    setContext(prev => ({
      ...prev,
      office: {
        ...prev.office,
        branding: {
          ...prev.office.branding,
          colors: { primary, secondary, accent }
        }
      }
    }));
  };

  return {
    renderedHtml,
    isLoading,
    updateTemplate,
    updateColors,
    context
  };
}
