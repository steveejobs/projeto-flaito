import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import Agenda from '@/modules/legal/Agenda';

// Mocks de hooks e contextos
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    session: { user: { id: 'test-user' } },
    loading: false,
    signOut: vi.fn(),
  }),
}));

// Mock do Toast
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock do Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'user-123' } }, error: null })),
    },
    from: vi.fn((table) => ({
      select: vi.fn(() => ({
          eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                  single: vi.fn(() => Promise.resolve({ 
                      data: table === 'office_members' ? { office_id: 'off-123' } : null, 
                      error: null 
                  }))
              }))
          }))
      }))
    })),
    rpc: vi.fn((name) => {
      if (name === 'get_agenda_week_bundle') {
        return Promise.resolve({
          data: {
            office_id: 'off-123',
            items: [
              {
                id: 'dead-1',
                title: 'Prazo: Contestação XPTO',
                kind: 'PRAZO',
                status: 'PENDENTE',
                local_date: '2026-04-15',
                local_time: '23:59',
                priority: 'HIGH',
                case_title: 'Caso Exemplo A',
              },
              {
                id: 'meet-1',
                title: 'Audiência de Instrução',
                kind: 'AUDIENCIA',
                status: 'CONCLUIDO',
                local_date: '2026-04-12',
                local_time: '14:00',
                priority: 'URGENT',
              }
            ],
            assignees: [],
            conflicts: [],
            days: []
          },
          error: null
        });
      }
      return Promise.resolve({ data: null, error: null });
    }),
  },
}));

describe('Jurídico P2: Gestão de Prazos (Agenda)', () => {
  it('should render the legal agenda with deadlines and status', async () => {
    render(
      <MemoryRouter>
        <Agenda />
      </MemoryRouter>
    );

    // Aguarda carregar
    await waitFor(() => {
      expect(screen.queryByText('Carregando agenda...')).toBeNull();
    });

    // Validar presença de itens mockados
    expect(screen.getByText('Prazo: Contestação XPTO')).toBeDefined();
    expect(screen.getByText('Audiência de Instrução')).toBeDefined();

    // Validar badges de status
    expect(screen.getByText('Pendente')).toBeDefined();
    expect(screen.getByText('Concluído')).toBeDefined();
  });

  it('should show case title associated with the deadline', async () => {
    render(
      <MemoryRouter>
        <Agenda />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Caso Exemplo A')).toBeDefined();
    });
  });
});
