import { describe, it, expect } from 'vitest';
import { 
  normalizeEscavadorProcess, 
  renderEscavadorProcessMarkdown,
  NormalizedEscavadorProcess
} from '../../../supabase/functions/_shared/escavador-transformer';
import rawProcessMock from './../mocks/escavador_process.json';

describe('Jurídico P2: Pipeline J4 (Markdown Rendering)', () => {
  const normalized = normalizeEscavadorProcess(rawProcessMock) as NormalizedEscavadorProcess;

  it('should render STANDARD markdown with critical legal sections', () => {
    const md = renderEscavadorProcessMarkdown({
      ...normalized,
      metadata: { normalizedAt: new Date().toISOString(), tokenOptimizationProfile: 'STANDARD' }
    });

    // Validar seções fundamentais
    expect(md).toContain('# Processo:');
    expect(md).toContain('## Identificação');
    expect(md).toContain('## Partes');
    expect(md).toContain('## Movimentações (STANDARD)');
    expect(md).toContain('## Resumo Operacional');
    
    // Validar dados específicos do mock
    expect(md).toContain('5001234-56.2023.8.27.0001');
    expect(md).toContain('TJTO');
  });

  it('should respect MINIMAL profile by omitting details', () => {
    const mdMinimal = renderEscavadorProcessMarkdown({
      ...normalized,
      metadata: { normalizedAt: new Date().toISOString(), tokenOptimizationProfile: 'MINIMAL' }
    });

    const mdDetailed = renderEscavadorProcessMarkdown({
      ...normalized,
      metadata: { normalizedAt: new Date().toISOString(), tokenOptimizationProfile: 'DETAILED' }
    });

    // O minimal deve ser significativamente menor
    expect(mdMinimal.length).toBeLessThan(mdDetailed.length);
    
    // Minimal deve ocultar a seção explícita de Advogados (conforme lógica no render)
    expect(mdMinimal).not.toContain('## Advogados');
  });

  it('should include "⭐" for relevant movements', () => {
    const md = renderEscavadorProcessMarkdown({
      ...normalized,
      metadata: { normalizedAt: new Date().toISOString(), tokenOptimizationProfile: 'DETAILED' }
    });

    // O mock contém uma movimentação com "SENTENÇA" que o transformador deve marcar como relevante
    expect(md).toContain('⭐');
    expect(md).toContain('SENTENÇA');
  });

  it('should show the correct total count of movements in summary', () => {
    const md = renderEscavadorProcessMarkdown({
      ...normalized,
      metadata: { normalizedAt: new Date().toISOString(), tokenOptimizationProfile: 'STANDARD' }
    });

    expect(md).toContain('**Total de Movimentações:** 2');
  });
});
