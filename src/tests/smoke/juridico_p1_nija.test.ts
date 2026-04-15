import { describe, it, expect } from 'vitest';
import { extractEprocDataPure } from '@/nija/connectors/eproc/detector';
import fs from 'fs';
import path from 'path';

describe('Jurídico P1: Auditoria NIJA (EPROC)', () => {
  const eprocText = fs.readFileSync(path.resolve(__dirname, '../mocks/eproc_sample.txt'), 'utf-8');

  it('should detect the correct CNJ from EPROC sample', () => {
    const result = extractEprocDataPure(eprocText);
    expect(result.capa.numeroCnj).toBe('5001234-56.2023.8.27.0001');
  });

  it('should reconstruct the event timeline with correct metadata', () => {
    const result = extractEprocDataPure(eprocText);
    
    // Critério 1: Total de eventos detectados
    expect(result.eventos.length).toBeGreaterThanOrEqual(2);
    
    // Critério 2: Detalhes do Evento 1 (Sentença)
    const event1 = result.eventos.find(e => e.numeroEvento === 1);
    expect(event1).toBeDefined();
    expect(event1?.tipoEvento).toContain('SENTENCA_1');
    expect(event1?.data).toBe('10/02/2023');
    
    // Critério 3: Detalhes do Evento 2 (Petição)
    const event2 = result.eventos.find(e => e.numeroEvento === 2);
    expect(event2).toBeDefined();
    expect(event2?.tipoEvento).toContain('PETICAO_INICIAL');
  });

  it('should assess extraction quality as HIGH for the sample', () => {
    const result = extractEprocDataPure(eprocText);
    expect(result.meta.extractionQuality).toBe('ALTA');
  });
});
