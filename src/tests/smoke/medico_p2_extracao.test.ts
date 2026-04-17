import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock global de import.meta.env para evitar erros no supabase client
(globalThis as any).import = {
  meta: {
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-key'
    }
  }
};
import { renderHook, waitFor } from '@testing-library/react';
import { usePatientExtraction } from '@/hooks/usePatientExtraction';
import { supabase } from '@/integrations/supabase/client';

// Mock do File.prototype.arrayBuffer pois JSDOM não implementa
if (!File.prototype.arrayBuffer) {
  File.prototype.arrayBuffer = function() {
    return Promise.resolve(new ArrayBuffer(0));
  };
}

// Mock do Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
    },
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
    functions: {
      invoke: vi.fn(),
    },
  },
}));

// Mock do toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock do conversor de PDF
vi.mock('@/nija/connectors/pdf/pdfToImage', () => ({
  convertPdfFirstPageToImage: vi.fn(() => Promise.resolve({ success: true, imageBase64: 'base64data' })),
}));

describe('Médico P2: Pipeline M4 (Extração de Documento)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should orchestrate the full extraction flow from upload to normalization', async () => {
    // 1. Setup Mocks
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
    });

    (supabase.from as any).mockImplementation((table: string) => {
      const mockChain = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      if (table === 'office_members') {
        mockChain.maybeSingle = vi.fn().mockResolvedValue({ data: { office_id: 'office-456' } });
      } else if (table === 'patient_documents') {
        mockChain.single = vi.fn().mockResolvedValue({ data: { id: 'doc-789' }, error: null });
      } else if (table === 'offices') {
        mockChain.single = vi.fn().mockResolvedValue({ 
          data: { name: 'Office Test', legal_name: 'Office Test LTDA', cnpj: '00.000.000/0001-00' }, 
          error: null 
        });
      } else if (table === 'office_units') {
        mockChain.select = vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null })
        });
      }

      return mockChain;
    });

    (supabase.storage.from as any).mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: 'path/to/file' }, error: null }),
    });

    (supabase.functions.invoke as any).mockResolvedValue({
      data: {
        success: true,
        extraction_id: 'ext-abc',
        version: 2,
        document_type: 'RG',
        normalized: {
          name: { value: 'JOÃO DA SILVA', confidence: 0.98 },
          cpf: { value: '123.456.789-00', confidence: 0.99 },
          birth_date: { value: '1990-05-15', confidence: 0.95 }
        },
        confidence_json: { global: 0.97 }
      },
      error: null,
    });

    // 2. Execute Hook
    const { result } = renderHook(() => usePatientExtraction());
    const file = new File(['dummy content'], 'documento.pdf', { type: 'application/pdf' });

    let extractionResult: any;
    await waitFor(async () => {
      extractionResult = await result.current.uploadAndExtract(file);
    }, { timeout: 10000 });

    // 3. Assertions
    expect(extractionResult).not.toBeNull();
    expect(extractionResult.documentId).toBe('doc-789');
    expect(extractionResult.extraction.document_type).toBe('RG');
    expect(extractionResult.extraction.fields.name.value).toBe('JOÃO DA SILVA');
    expect(extractionResult.extraction.version).toBe(2);

    // Verificar se chamou as etapas corretas
    expect(supabase.storage.from).toHaveBeenCalledWith('patient-documents');
    expect(supabase.functions.invoke).toHaveBeenCalledWith('patient-intake-processor', expect.objectContaining({
      body: expect.objectContaining({
        action: 'PROCESS_DOCUMENT',
        document_id: 'doc-789'
      })
    }));
  });

  it('should handle extraction failure gracefully', async () => {
    (supabase.auth.getSession as any).mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
    });

    (supabase.from as any).mockImplementation(() => ({
      select: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: { office_id: 'off' } }) }) }) }) }),
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 'doc' } }) }) }),
    }));

    (supabase.storage.from as any).mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
    });

    (supabase.functions.invoke as any).mockResolvedValue({
      data: null,
      error: { message: 'Timeout na IA' },
    });

    const { result } = renderHook(() => usePatientExtraction());
    const file = new File([''], 'test.png', { type: 'image/png' });

    const extractionResult = await result.current.uploadAndExtract(file);
    expect(extractionResult).toBeNull();
  });
});
