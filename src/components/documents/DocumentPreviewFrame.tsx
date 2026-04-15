import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface DocumentPreviewFrameProps {
  htmlContent: string;
  loading?: boolean;
  className?: string;
}

/**
 * Isolated Document Preview Frame
 * Uses an iframe with srcdoc to ensure total CSS isolation between the app and the document.
 */
export const DocumentPreviewFrame: React.FC<DocumentPreviewFrameProps> = ({
  htmlContent,
  loading = false,
  className = '',
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Sync content to iframe
  useEffect(() => {
    if (iframeRef.current && htmlContent) {
      const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
        setIframeLoaded(true);
      }
    }
  }, [htmlContent]);

  return (
    <div className={`relative w-full aspect-[1/1.414] bg-muted/30 rounded-lg overflow-hidden border shadow-sm ${className}`}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      
      {!htmlContent && !loading && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground font-medium">
          Nenhum conteúdo para visualizar
        </div>
      )}

      <iframe
        ref={iframeRef}
        title="Document Preview"
        className={`w-full h-full border-0 transition-opacity duration-300 ${iframeLoaded && !loading ? 'opacity-100' : 'opacity-0'}`}
        sandbox="allow-same-origin"
      />
    </div>
  );
};
