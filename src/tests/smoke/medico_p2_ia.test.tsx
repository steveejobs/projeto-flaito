import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import DecifradorCasosPage from '@/modules/medicina/ia/DecifradorCasosPage';

// Mock Global de scrollIntoView para JSDOM
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mocks de hooks e contextos
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    session: { user: { id: 'test-user' } },
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock('@/hooks/useOfficeRole', () => ({
  useOfficeRole: () => ({
    role: 'MEDICO',
    module: 'MEDICAL',
    loading: false,
  }),
}));

// Mock do Supabase Functions
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn((name, options) => {
        if (name === 'medical-agent-analysis') {
          return Promise.resolve({
            data: {
              resultado: {
                type: 'differential',
                content: 'Analisei os sintomas e identifiquei possíveis diagnósticos:',
                data: [
                  { 
                    condicao: 'Enxaqueca com Aura', 
                    prob: 'Alta', 
                    descricao: 'Padrão recorrente de cefaleia unilateral pulsátil.' 
                  },
                  { 
                    condicao: 'Cefaleia Tensional', 
                    prob: 'Moderada', 
                    descricao: 'Dor em aperto, geralmente bilateral.' 
                  }
                ]
              }
            },
            error: null
          });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    },
  },
}));

describe('Médico P2: Apoio à Decisão (IA)', () => {
  it('should render the clinical decoder page and initial message', () => {
    render(
      <MemoryRouter>
        <DecifradorCasosPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Decifrador de Casos/)).toBeDefined();
    expect(screen.getByText(/Assistente de Inteligência Clínica/)).toBeDefined();
  });

  it('should process a user symptoms message and show differential diagnosis', async () => {
    render(
      <MemoryRouter>
        <DecifradorCasosPage />
      </MemoryRouter>
    );

    const textarea = screen.getByPlaceholderText(/Descreva o caso clínico/);
    fireEvent.change(textarea, { target: { value: 'Paciente com cefaleia intensa e fotofobia.' } });
    
    // Selecionar o botão de envio pela classe específica do componente
    const buttons = screen.getAllByRole('button');
    const sendBtn = buttons.find(b => b.className.includes('from-indigo-600'));
    
    if (sendBtn) {
        fireEvent.click(sendBtn);
    } else {
        throw new Error('Botão de envio não encontrado no DOM');
    }

    // Aguardar a resposta da IA
    await waitFor(() => {
      expect(screen.getByText('Enxaqueca com Aura')).toBeDefined();
    }, { timeout: 3000 });

    // Validar os badges de probabilidade
    expect(screen.getByText('Probabilidade: Alta')).toBeDefined();
    expect(screen.getByText('Probabilidade: Moderada')).toBeDefined();
    expect(screen.getByText(/Padrão recorrente/)).toBeDefined();
  });
});
