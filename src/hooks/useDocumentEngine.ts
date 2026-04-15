import { useState, useCallback } from 'react';
import { renderDocument } from '@/lib/document-engine';
import { DocumentContextSnapshot } from '@/types/institutional';

interface RenderOptions {
  addSignatureBlock?: string;
}

/**
 * useDocumentEngine
 * Hook to interface between React and the Pure Document Engine.
 */
export const useDocumentEngine = () => {
  const [isRenderLoading, setIsRenderLoading] = useState(false);
  const [renderedHtml, setRenderedHtml] = useState<string>('');

  const generateDocument = useCallback(async (
    context: DocumentContextSnapshot,
    content: string,
    options?: RenderOptions
  ) => {
    setIsRenderLoading(true);
    try {
      const html = await renderDocument(context, content, options);
      setRenderedHtml(html);
      return html;
    } catch (error) {
      console.error('Failed to render document:', error);
      throw error;
    } finally {
      setIsRenderLoading(false);
    }
  }, []);

  const clearPreview = useCallback(() => {
    setRenderedHtml('');
  }, []);

  return {
    generateDocument,
    renderedHtml,
    isRenderLoading,
    clearPreview
  };
};
