import { describe, it, expect } from 'vitest';
import { normalizeEscavadorProcess } from '@shared/escavador-transformer';
import escavadorMock from '../mocks/escavador_process.json';

describe('Jurídico P0: Captação & Vínculo', () => {
  it('should normalize Escavador process without undefined critical fields', () => {
    const result = normalizeEscavadorProcess(escavadorMock as any);
    
    // Critério 1: Sem undefined em campos obrigatórios
    expect(result.identification.numeroProcesso).toBe(escavadorMock.numero_cnj);
    expect(result.identification.tribunal).toBe(escavadorMock.tribunal.sigla);
    expect(result.parties.poloAtivo).toBeDefined();
    expect(result.parties.poloPassivo).toBeDefined();
    
    // Critério 2: Estrutura de partes íntegra
    expect(result.parties.poloAtivo.length).toBeGreaterThan(0);
    expect(result.parties.poloAtivo[0].nome).toBe((escavadorMock as any).envolvidos[0].nome);
  });

  it('should identify lawyer links correctly via heuristics', () => {
    // Simulando um processo onde o advogado do escritório está presente
    const result = normalizeEscavadorProcess(escavadorMock as any);
    
    // No mock, temos "DR. ADVOGADO EXEMPLO"
    expect(result.lawyers.some(l => l.nome === 'DR. ADVOGADO EXEMPLO')).toBe(true);
  });

  it('should produce a valid summary for persistent storage', () => {
    const result = normalizeEscavadorProcess(escavadorMock as any);
    expect(result.summary.totalMovements).toBeGreaterThan(0);
    expect(result.summary.lastMovementDate).toBeDefined();
  });
});
