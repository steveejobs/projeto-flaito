import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { LegalSidebar } from '@/components/layout/LegalSidebar';
import { MedicalSidebar } from '@/components/layout/MedicalSidebar';

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
    role: 'ADMIN',
    module: 'LEGAL',
    loading: false,
  }),
}));

vi.mock('@/hooks/useOfficeSession', () => ({
  useOfficeSession: () => ({
    officeId: 'off-123',
    loading: false,
    error: null,
  }),
}));

vi.mock('@/contexts/OfficeBrandingContext', () => ({
  useOfficeBranding: () => ({
    branding: { nome_escritorio: 'Escritório de Teste' },
  }),
}));

vi.mock('@/contexts/DevPanelContext', () => ({
  useDevPanel: () => ({
    isOpen: false,
    toggle: vi.fn(),
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: null })),
          select: vi.fn(() => ({
              head: true,
              count: 'exact',
              eq: vi.fn(() => Promise.resolve({ count: 0 }))
          }))
        })),
      })),
    })),
  },
}));

// Mock completo do módulo de Sidebar para evitar erros de contexto
vi.mock('@/components/ui/sidebar', async (importOriginal) => {
  const React = await import('react');
  return {
    SidebarProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar-provider">{children}</div>,
    SidebarTrigger: () => <button>Toggle</button>,
    Sidebar: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar">{children}</div>,
    SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SidebarHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SidebarFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SidebarGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SidebarGroupContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SidebarMenu: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>,
    SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <li>{children}</li>,
    SidebarMenuButton: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
    useSidebar: () => ({
      state: 'expanded',
      open: true,
      setOpen: vi.fn(),
      openMobile: false,
      setOpenMobile: vi.fn(),
      isMobile: false,
      toggleSidebar: vi.fn(),
    }),
  };
});

// Wrapper para testes com Router
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    {children}
  </BrowserRouter>
);

describe('Shell Smoke Tests', () => {
  it('should render Legal Sidebar without crashing', () => {
    render(
      <TestWrapper>
        <LegalSidebar />
      </TestWrapper>
    );
    
    expect(screen.getByText('Lexos')).toBeDefined();
    expect(screen.getByText('Inteligência Legal')).toBeDefined();
    expect(screen.getByText('Painel')).toBeDefined();
  });

  it('should render Medical Sidebar without crashing', () => {
    render(
      <TestWrapper>
        <MedicalSidebar />
      </TestWrapper>
    );
    
    expect(screen.getByText('Flaito Health')).toBeDefined();
    expect(screen.getByText('Dashboard Clínico')).toBeDefined();
  });
});
