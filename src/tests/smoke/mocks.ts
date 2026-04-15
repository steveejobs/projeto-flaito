import { vi } from 'vitest';

// Mock do Supabase
export const mockSupabase = {
  auth: {
    getSession: vi.fn(() => Promise.resolve({ data: { session: { user: { id: 'test-user' } } }, error: null })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(() => Promise.resolve({ data: { full_name: 'Dr. Teste' }, error: null })),
        eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
        })),
        select: vi.fn(() => ({
            head: true,
            count: 'exact',
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
      select: vi.fn(() => ({
          head: true,
          count: 'exact',
          maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null }))
      }))
    })),
  })),
};

// Mock do AuthContext
export const mockAuthContext = {
  user: { id: 'test-user', email: 'test@example.com' },
  session: { user: { id: 'test-user' } },
  loading: false,
  signOut: vi.fn(),
};

// Mock do OfficeSession
export const mockOfficeSession = {
  officeId: 'off-123',
  loading: false,
  error: null,
  retry: vi.fn(),
  reset: vi.fn(),
};

// Mock do Router
export const mockNavigate = vi.fn();
export const mockLocation = { pathname: '/dashboard', search: '' };
