import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
    analyzeHistoricalGovernancePatterns, 
    computeRiskSnapshot 
} from '../_shared/medical-intelligence.ts';

// ─────────────────────────────────────────────────────────────────
// MOCKS & STUBS
// ─────────────────────────────────────────────────────────────────

const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ error: null }),
} as any;

describe('Medical Intelligence V5: Analysis Logic', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('Deve detectar "high_friction" quando há muitas revogações manuais', async () => {
        // Mock de Auditorias (10 auditorias, 6 com intervenção)
        const mockAudits = Array(10).fill({ id: 'a', blocked: true, downgraded: false });
        // Mock de Revogações (4 revogações, > 30% das intervenções)
        const mockRevocations = Array(4).fill({ id: 'r' });

        mockSupabase.from.mockImplementation((table: string) => {
            if (table === 'medical_safety_audits') return { 
                select: () => ({ eq: () => ({ gte: () => Promise.resolve({ data: mockAudits }) }) }) 
            };
            if (table === 'medical_risk_states') return { 
                select: () => ({ eq: () => ({ not: () => ({ gte: () => Promise.resolve({ data: mockRevocations }) }) }) }) 
            };
            return mockSupabase;
        });

        const insights = await analyzeHistoricalGovernancePatterns(mockSupabase, 'off-1');
        const friction = insights.find(i => i.type === 'high_friction');
        
        expect(friction).toBeDefined();
        expect(friction?.title).toContain('Alta Fricção');
    });

    it('Deve calcular tendência "worsening" se incidentes estão aumentando', async () => {
        // Snapshot de Incidentes
        // Atual: 5 incidentes
        // Anterior: 1 incidente
        mockSupabase.from.mockImplementation((table: string) => {
            return {
                select: () => ({
                    eq: () => ({
                        gte: () => Promise.resolve({ count: 5 }), // Simula currentIncidents
                        lt: () => ({ gte: () => Promise.resolve({ count: 1 }) }) // Simula previousIncidents
                    })
                })
            };
        });

        const { trend } = await computeRiskSnapshot(mockSupabase, 'off-1');
        expect(trend).toBe('worsening');
    });

    it('Deve calcular tendência "improving" se incidentes estão diminuindo', async () => {
        // Atual: 1 incidentes
        // Anterior: 5 incidentes
        mockSupabase.from.mockImplementation((table: string) => {
            return {
                select: () => ({
                    eq: () => ({
                        gte: () => Promise.resolve({ count: 1 }),
                        lt: () => ({ gte: () => Promise.resolve({ count: 5 }) })
                    })
                })
            };
        });

        const { trend } = await computeRiskSnapshot(mockSupabase, 'off-1');
        expect(trend).toBe('improving');
    });

});
