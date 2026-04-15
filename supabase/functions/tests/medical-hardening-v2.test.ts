import { describe, it, expect, vi, beforeEach } from 'vitest';
import { capturedHandler } from './stubs/deno-std';
import { mockClient } from './stubs/supabase-js';

// ─────────────────────────────────────────────────────────────────
// CONFIGURAÇÃO DO AMBIENTE
// ─────────────────────────────────────────────────────────────────

if (typeof globalThis.Request === 'undefined') {
  const { Request, Response, Headers } = await import('node-fetch');
  globalThis.Request = Request as any;
  globalThis.Response = Response as any;
  globalThis.Headers = Headers as any;
}

const fetchSpy = vi.spyOn(globalThis, 'fetch');

const createMockReq = (body: any, headers?: Record<string, string>) => {
  return new Request('https://edge.flaito.com/function', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': 'Bearer valid-jwt',
      'origin': 'https://app.flaito.com',
      ...headers
    },
    body: JSON.stringify(body)
  });
};

const AGENT_FUNC_PATH = '../medical-agent-analysis/index.ts';
const IRIS_FUNC_PATH = '../medical-iris-analysis/index.ts';

// Helper para forçar recarregamento do módulo e capturar o handler fresco
const loadHandler = async (path: string) => {
    vi.resetModules();
    await import(path);
    return capturedHandler;
};

describe('Hardening Audit V2: Clinical Edge Functions (Stabilized V4)', () => {

  let lastTable = '';

  beforeEach(() => {
    vi.clearAllMocks();
    fetchSpy.mockClear();
    
    // Mock dinâmico para evitar exaustão de promessas
    mockClient.from.mockImplementation((table: string) => {
        lastTable = table;
        return mockClient;
    });

    // Configura os retornos padrão
    mockClient.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'u@f.com' } }, error: null });
    mockClient.maybeSingle.mockResolvedValue({ data: { office_id: 'o1', role: 'MEMBER', is_active: true }, error: null });
    
    mockClient.insert.mockReturnValue(mockClient);
    mockClient.select.mockReturnValue(mockClient);
    mockClient.eq.mockReturnValue(mockClient);
  });

  it('Cenário 1: Sem JWT -> deve retornar 401', async () => {
    const handler = await loadHandler(AGENT_FUNC_PATH);
    const req = createMockReq({ pacienteId: 'p1' }, { 'authorization': '' });
    
    mockClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: "Auth failed" } });
    
    const res = await handler!(req);
    expect(res.status).toBe(401);
  });

  it('Cenário 2: Agent Cross-tenant -> deve retornar 403', async () => {
    const handler = await loadHandler(AGENT_FUNC_PATH);
    const req = createMockReq({ pacienteId: 'p-other' });
    
    // Implementação dinâmica que simula o ataque cross-tenant
    mockClient.maybeSingle.mockImplementation(async () => {
        if (lastTable === 'office_members') {
            return { data: { office_id: 'office-a', role: 'MEMBER', is_active: true }, error: null };
        }
        if (lastTable === 'pacientes') {
            return { data: { office_id: 'office-b' }, error: null }; // Paciente pertence a outro escritório
        }
        return { data: null, error: null };
    });

    const res = await handler!(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('CROSS_TENANT_ACCESS');
  });

  it('Cenário 4: Payload Inválido -> 500 Erro Controlado', async () => {
    const handler = await loadHandler(AGENT_FUNC_PATH);
    const req = new Request('https://f.com', {
        method: 'POST',
        headers: { 'authorization': 'Bearer v' },
        body: 'invalid-json'
    });

    const res = await handler!(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain('Erro interno');
  });

  it('Cenário 5: Fluxo Válido -> Autorizado', async () => {
    const handler = await loadHandler(AGENT_FUNC_PATH);
    const req = createMockReq({ pacienteId: 'p-ok' });
    
    mockClient.maybeSingle.mockResolvedValue({ data: { office_id: 'office-a', role: 'MEMBER', is_active: true }, error: null });

    const res = await handler!(req);
    expect([401, 403]).not.toContain(res.status);
  });

  describe('Iris Parity Validation', () => {
    it('Cenário IRIS-1: Zero-Trust Cross-tenant -> 403', async () => {
        const handler = await loadHandler(IRIS_FUNC_PATH);
        const req = createMockReq({ pacienteId: 'p-other', rightEyeImage: 'base64...' });
        
        mockClient.maybeSingle.mockImplementation(async () => {
            if (lastTable === 'office_members') {
                return { data: { office_id: 'office-a', role: 'MEMBER', is_active: true }, error: null };
            }
            if (lastTable === 'pacientes') {
                return { data: { office_id: 'office-b' }, error: null };
            }
            return { data: null, error: null };
        });

        const res = await handler!(req);
        expect(res.status).toBe(403);
    });
  });

});
