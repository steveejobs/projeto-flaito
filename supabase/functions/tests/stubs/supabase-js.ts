// supabase/functions/tests/stubs/supabase-js.ts
import { vi } from 'vitest';

export const mockClient: any = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  single: vi.fn(),
  insert: vi.fn(),
};

// Configura o encadeamento fluente manualmente
mockClient.from.mockReturnValue(mockClient);
mockClient.select.mockReturnValue(mockClient);
mockClient.eq.mockReturnValue(mockClient);
mockClient.insert.mockReturnValue(mockClient);

export const createClient = vi.fn(() => mockClient);
