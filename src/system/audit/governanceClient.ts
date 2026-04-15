/**
 * Governance Client
 * Cliente para operações de governança e auditoria
 */

import { supabase } from '@/integrations/supabase/client';
import { buildFrontendManifest } from './manifest';
import type { Json } from '@/integrations/supabase/types';

// Edge functions list (manual para início)
const EDGE_MANIFEST = [
  { name: 'lexos-governance-run', public: false },
  { name: 'lexos-rebuild-engine', public: false },
  { name: 'lexos-export-kit', public: false },
  { name: 'lexos-audit-snapshot', public: false },
  { name: 'lexos-chat-assistant', public: false },
  { name: 'lexos-generate-document', public: false },
  { name: 'lexos-render-document', public: false },
  { name: 'lexos-extract-text', public: false },
  { name: 'nija-full-analysis', public: false },
  { name: 'nija-extract-image', public: false },
  { name: 'nija-generate-petition', public: false },
  { name: 'nija-prescricao', public: false },
  { name: 'nija-strategy-compare', public: false },
  { name: 'public-client-registration', public: true },
  { name: 'gcal_sync_events', public: false },
  { name: 'cep-proxy', public: true },
];

export interface AuditSnapshot {
  id: string;
  created_at: string;
  created_by: string;
  status: string;
  report_md: string;
  meta: Json;
  risk: Json;
}

export interface DbSnapshot {
  tables: Array<{ name: string; rls_enabled: boolean; rls_forced: boolean; kind: string }>;
  policies: Array<{ table: string; name: string; cmd: string; permissive: string }>;
  functions: Array<{ name: string; args: string; security_definer: boolean; config: string[] | null }>;
  grants: Array<{ routine: string; grantee: string; privilege: string }>;
  generated_at: string;
}

export interface MatrixAccess {
  matrix: Array<{ table: string; rls_enabled: boolean; policies: Array<{ name: string; cmd: string; roles: string[] }> | null }>;
  roles: string[];
  generated_at: string;
}

export interface HealthData {
  kpis: {
    clients_count: number;
    cases_count: number;
    documents_count: number;
    members_count: number;
  };
  recent_errors: Array<{ kind: string; payload: unknown; created_at: string }>;
  generated_at: string;
}

export interface PolicySimulationResult {
  simulated_role: string;
  user_id: string | null;
  case_id: string | null;
  tables: Array<{
    table: string;
    rls_enabled: boolean;
    select: string;
    insert: string;
    update: string;
    delete: string;
    policies_count: number;
  }>;
  functions: Array<{ function: string; grantee: string; can_execute: boolean }>;
  routes: Array<{ path: string; min_role: string; allowed: boolean }>;
  generated_at: string;
}

export interface ExportKit {
  rebuild_plan_md: string;
  schema_sql: string;
  rls_sql: string;
  functions_sql: string;
  manifests_json: string;
  diagrams_md: string;
}

export interface RebuildJob {
  job_id: string;
  mode: string;
  status: string;
  rebuild_plan_md: string;
  schema_sql: string;
  rls_sql: string;
  functions_sql: string;
}

/**
 * Run full governance audit
 */
export async function runFullAudit(officeId: string): Promise<{
  snapshot_id: string;
  created_at: string;
  risk_summary: Record<string, number>;
  counts: { tables: number; policies: number; functions: number };
  report_md: string;
}> {
  const frontendManifest = buildFrontendManifest();
  
  const { data, error } = await supabase.functions.invoke('lexos-governance-run', {
    body: {
      office_id: officeId,
      frontend_manifest: frontendManifest,
      edge_manifest: EDGE_MANIFEST,
    },
  });

  if (error) throw new Error(error.message);
  return data as {
    snapshot_id: string;
    created_at: string;
    risk_summary: Record<string, number>;
    counts: { tables: number; policies: number; functions: number };
    report_md: string;
  };
}

/**
 * Get latest audit snapshots
 */
export async function getLatestSnapshots(officeId: string, limit = 20): Promise<AuditSnapshot[]> {
  const { data, error } = await supabase
    .from('audit_snapshots')
    .select('id, created_at, created_by, status, report_md, meta, risk')
    .eq('office_id', officeId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data || []) as AuditSnapshot[];
}

/**
 * Get database snapshot via RPC
 */
export async function getDbSnapshot(officeId: string): Promise<DbSnapshot> {
  const { data, error } = await (supabase.rpc as any)('lexos_audit_db_snapshot', {
    p_office_id: officeId,
  });

  if (error) throw new Error(error.message);
  return data as unknown as DbSnapshot;
}

/**
 * Get access matrix via RPC
 */
export async function getMatrix(officeId: string): Promise<MatrixAccess> {
  const { data, error } = await (supabase.rpc as any)('lexos_audit_matrix_access', {
    p_office_id: officeId,
  });

  if (error) throw new Error(error.message);
  return data as unknown as MatrixAccess;
}

/**
 * Get health data via RPC
 */
export async function getHealth(officeId: string): Promise<HealthData> {
  const { data, error } = await (supabase.rpc as any)('lexos_audit_health', {
    p_office_id: officeId,
  });

  if (error) throw new Error(error.message);
  return data as unknown as HealthData;
}

/**
 * Simulate policy access
 */
export async function simulatePolicy(
  officeId: string,
  role: string,
  userId?: string,
  caseId?: string
): Promise<PolicySimulationResult> {
  const { data, error } = await (supabase.rpc as any)('lexos_policy_simulate', {
    p_office_id: officeId,
    p_role: role,
    p_user_id: userId || null,
    p_case_id: caseId || null,
  });

  if (error) throw new Error(error.message);
  return data as unknown as PolicySimulationResult;
}

/**
 * Promote release (OWNER only)
 */
export async function promoteRelease(
  officeId: string,
  snapshotId: string,
  target: string = 'PROD'
): Promise<{ success: boolean; promoted_at: string; target: string; snapshot_id: string }> {
  const { data, error } = await (supabase.rpc as any)('lexos_promote_release', {
    p_office_id: officeId,
    p_snapshot_id: snapshotId,
    p_target: target,
  });

  if (error) throw new Error(error.message);
  return data as unknown as { success: boolean; promoted_at: string; target: string; snapshot_id: string };
}

/**
 * Export kit via edge function
 */
export async function exportKit(officeId: string, snapshotId: string): Promise<ExportKit> {
  const { data, error } = await supabase.functions.invoke('lexos-export-kit', {
    body: { office_id: officeId, snapshot_id: snapshotId },
  });

  if (error) throw new Error(error.message);
  return data as ExportKit;
}

/**
 * Create rebuild job via edge function
 */
export async function createRebuildJob(
  officeId: string,
  auditSnapshotId: string,
  frontendSnapshotId: string | null,
  mode: 'PLAN' | 'APPLY_SAFE' | 'EXPORT'
): Promise<RebuildJob> {
  const { data, error } = await supabase.functions.invoke('lexos-rebuild-engine', {
    body: {
      office_id: officeId,
      audit_snapshot_id: auditSnapshotId,
      frontend_snapshot_id: frontendSnapshotId,
      mode,
    },
  });

  if (error) throw new Error(error.message);
  return data as RebuildJob;
}

/**
 * Log telemetry
 */
export async function logTelemetry(
  officeId: string,
  kind: 'UI_ERROR' | 'RPC_ERROR' | 'EDGE_CALL' | 'PERF',
  payload: Json,
  route?: string,
  durationMs?: number
): Promise<string> {
  const { data, error } = await (supabase.rpc as any)('lexos_telemetry_log', {
    p_office_id: officeId,
    p_kind: kind,
    p_payload: payload,
    p_route: route || null,
    p_duration_ms: durationMs || null,
  });

  if (error) throw new Error(error.message);
  return data as unknown as string;
}

