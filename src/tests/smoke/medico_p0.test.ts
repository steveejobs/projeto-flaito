import { describe, it, expect } from 'vitest';
import medicalMock from '../mocks/medical_consultation.json';

describe('Médico P0: Jornada de Atendimento', () => {
  it('should process a medical consultation mock without critical data loss', () => {
    const { paciente, atendimento } = medicalMock;
    
    // Critério 1: Integridade do Paciente
    expect(paciente.id).toBeDefined();
    expect(paciente.nome).toContain('MARIA');
    expect(paciente.idade).toBe(65);
    
    // Critério 2: Integridade do Atendimento
    expect(atendimento.id).toBeDefined();
    expect(atendimento.queixa_principal).toBeDefined();
    expect(atendimento.transcricao_raw).toContain('dor intensa no joelho');
  });

  it('should have a well-structured IA summary for clinical support', () => {
    const { atendimento } = medicalMock;
    const { resumo_ia } = atendimento;
    
    // Critério 3: Estrutura da IA (Apoio à Decisão)
    expect(resumo_ia.diagnostico_provavel).toBeDefined();
    expect(resumo_ia.conduta_sugerida).toBeDefined();
    expect(resumo_ia.alertas.length).toBeGreaterThan(0);
    
    // Verificando conteúdo específico do mock de teste
    expect(resumo_ia.diagnostico_provavel).toContain('Osteoartrite');
  });

  it('should validate mandatory fields for EMR (Electronic Medical Record) persistence', () => {
    const { atendimento } = medicalMock;
    
    // Campos obrigatórios para persistência no Supabase (mock logic)
    const requiredFields = ['id', 'data', 'queixa_principal'];
    requiredFields.forEach(field => {
        expect(atendimento[field as keyof typeof atendimento]).toBeDefined();
    });
  });
});
