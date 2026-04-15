import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import DOMPurify from 'dompurify';

export default function DocumentPrint() {
  const { id } = useParams<{ id: string }>();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDocument() {
      if (!id) {
        setError('ID do documento não fornecido');
        setLoading(false);
        return;
      }

      try {
        // Use generated_docs_legacy which has title and content columns
        const { data: genDoc, error: genError } = await supabase
          .from('generated_docs_legacy')
          .select('content, title')
          .eq('id', id)
          .is('deleted_at', null)
          .maybeSingle();

        if (genDoc?.content) {
          setContent(genDoc.content);
          document.title = genDoc.title || 'Documento';
        } else {
          setError('Documento não encontrado');
        }
      } catch (err: any) {
        console.error('Erro ao carregar documento:', err);
        setError('Erro ao carregar documento');
      } finally {
        setLoading(false);
      }
    }

    loadDocument();
  }, [id]);

  // Auto print when content is loaded
  useEffect(() => {
    if (content && !loading) {
      // Small delay to ensure rendering is complete
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [content, loading]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <p>Carregando documento...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontFamily: 'system-ui, sans-serif',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <p style={{ color: '#ef4444' }}>{error}</p>
        <button
          onClick={() => window.close()}
          style={{
            padding: '8px 16px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Fechar
        </button>
      </div>
    );
  }

  // Render the HTML content directly (no wrapper layout)
  return (
    <div
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content || '') }}
      style={{
        background: 'white',
        minHeight: '100vh'
      }}
    />
  );
}
