// supabase/functions/_shared/auth.ts
// Módulo de autenticação e autorização para Edge Functions
// NUNCA confiar em headers manipuláveis (x-user-id, etc.)

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { AppRole, hasRequiredRole, normalizeAppRole } from "./role-contract.ts";

// ============================================
// Types
// ============================================
export interface AuthenticatedUser {
  uid: string;
  email?: string;
}

export interface OfficeMembership {
  office_id: string;
  role: AppRole;
  is_active: boolean;
}

export interface AuthResult {
  ok: true;
  user: AuthenticatedUser;
  membership: OfficeMembership;
  authClient: SupabaseClient;
  adminClient: SupabaseClient;
}

export interface AuthError {
  ok: false;
  status: number;
  error: string;
  code: string;
  trace_id: string;
}

// ============================================
// Roles permitidas por ação
// ============================================
const ACTION_MIN_ROLES: Record<string, Exclude<AppRole, null>[]> = {
  "billing:generate": ["OWNER", "ADMIN", "MEMBER"],
  "billing:approve": ["OWNER", "ADMIN"],
  "billing:config_write": ["OWNER", "ADMIN"],
  "billing:plan_write": ["OWNER", "ADMIN"],
  // Ações Médicas P0
  "medical:analysis": ["OWNER", "ADMIN", "MEMBER"],
  "medical:prescribe": ["OWNER", "ADMIN", "MEMBER"],
  "medical:voice_command": ["OWNER", "ADMIN", "MEMBER"],
};

// ============================================
// Helpers
// ============================================
function jsonError(error: string, code: string, status: number, traceId?: string) {
  return {
    ok: false as const,
    status,
    error,
    code,
    trace_id: traceId || crypto.randomUUID(),
  };
}

/**
 * Valida se um paciente pertence a um escritório específico.
 * Bloqueio crítico de vazamento entre tenants.
 */
export async function verifyPatientAccess(
  supabase: SupabaseClient,
  officeId: string,
  patientId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("pacientes")
    .select("id")
    .eq("id", patientId)
    .eq("office_id", officeId)
    .maybeSingle();
  
  if (error || !data) return false;
  return true;
}

// ============================================
// Core: Authenticate + Authorize (Zero Trust Edition)
// ============================================
export async function authenticateAndAuthorize(
  req: Request,
  action?: string,
  providedOfficeId?: string 
): Promise<AuthResult | AuthError> {
  const traceId = crypto.randomUUID();

  // 1. Extract JWT
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonError("Token não fornecido", "AUTH_MISSING", 401, traceId);
  }

  const jwt = authHeader.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const authRes = await authClient.auth.getUser();
  const user = authRes.data?.user;
  const authError = authRes.error;

  if (authError || !user) {
    return jsonError("Token inválido", "AUTH_INVALID", 401, traceId);
  }

  // 2. Resolve Office ID server-side (NÃO CONFIAR NO REQUEST)
  const memRes = await authClient
    .from("office_members")
    .select("office_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const qData = memRes?.data;
  const memError = memRes?.error;

  if (memError || !qData) {
    return jsonError("Vínculo com escritório não localizado ou inativo", "NO_OFFICE_CONTEXT", 403, traceId);
  }

  const membership = {
    office_id: qData.office_id,
    role: normalizeAppRole(qData.role),
    is_active: qData.is_active
  };

  if (providedOfficeId && providedOfficeId !== membership.office_id) {
    return jsonError("Inconsistência de contexto detectada", "TENANT_MISMATCH", 403, traceId);
  }

  // 3. Check Role (opcional se action estiver presente)
  if (action) {
    const requiredRoles = ACTION_MIN_ROLES[action];
    if (!requiredRoles || !hasRequiredRole(membership.role, requiredRoles)) {
      return jsonError("Permissão insuficiente", "INSUFFICIENT_ROLE", 403, traceId);
    }
  }

  const adminClient = createClient(supabaseUrl, Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  return {
    ok: true,
    user: { uid: user.id, email: user.email },
    membership: {
      office_id: membership.office_id,
      role: membership.role,
      is_active: membership.is_active,
    },
    authClient,
    adminClient,
  };
}

/**
 * Helper avançado para autorização baseada em recursos (Zero Trust).
 * Resolve o office_id do recurso (caso, cliente, etc.) e valida membership.
 */
export async function requireResourceAccess(
  req: Request,
  params: {
    resourceType: 'cases' | 'clients' | 'pacientes' | 'documents' | 'office' | 'charge_approvals' | 'medical_safety_audits' | 'medical_agent_analyses';
    resourceId?: string;
    minRole?: 'OWNER' | 'ADMIN' | 'MEMBER';
  }
): Promise<(AuthResult & { response?: never }) | (AuthError & { response: Response })> {
  const auth = await authenticateAndAuthorize(req);
  
  if (!auth.ok) {
    return { 
        ...auth, 
        response: new Response(JSON.stringify(auth), { 
            status: auth.status, 
            headers: { "Content-Type": "application/json" } 
        }) 
    };
  }

  // Se o recurso for 'office', já validamos no authenticateAndAuthorize
  if (params.resourceType === 'office') {
    if (params.minRole && !hasRequiredRole(auth.membership.role, [params.minRole])) {
      const err = jsonError("Permissão de cargo insuficiente", "INSUFFICIENT_ROLE", 403);
      return { 
          ...err, 
          response: new Response(JSON.stringify(err), { status: 403, headers: { "Content-Type": "application/json" } }) 
      };
    }
    return auth;
  }

  // Resolver office_id do recurso
  if (!params.resourceId) {
    const err = jsonError("ID do recurso não fornecido", "RESOURCE_ID_MISSING", 400);
    return { ...err, response: new Response(JSON.stringify(err), { status: 400, headers: { "Content-Type": "application/json" } }) };
  }

  const resRes = await auth.adminClient
    .from(params.resourceType)
    .select("office_id")
    .eq("id", params.resourceId)
    .maybeSingle();

  const resource = resRes?.data;
  const resError = resRes?.error;

  if (resError || !resource) {
    const err = jsonError(`Recurso (${params.resourceType}) não encontrado ou inacessível.`, "RESOURCE_NOT_FOUND", 404);
    return { ...err, response: new Response(JSON.stringify(err), { status: 404, headers: { "Content-Type": "application/json" } }) };
  }

  // Validar se o recurso pertence ao escritório do usuário
  if (resource.office_id !== auth.membership.office_id) {
    const err = jsonError("Acesso negado: Recurso pertence a outro tenant.", "CROSS_TENANT_ACCESS", 403);
    return { ...err, response: new Response(JSON.stringify(err), { status: 403, headers: { "Content-Type": "application/json" } }) };
  }

  // Validar role mínima se solicitada
  if (params.minRole && !hasRequiredRole(auth.membership.role, [params.minRole])) {
    const err = jsonError("Permissão de cargo insuficiente para acessar este recurso", "INSUFFICIENT_ROLE", 403);
    return { ...err, response: new Response(JSON.stringify(err), { status: 403, headers: { "Content-Type": "application/json" } }) };
  }

  return auth;
}

/**
 * Helper para autorização básica de membership e role (sem recurso específico).
 * Útil para operações gerais do escritório ou quando o recurso ainda não foi criado.
 */
export async function requireOfficeMembership(
  req: Request,
  action?: string
): Promise<(AuthResult & { response?: never }) | (AuthError & { response: Response })> {
  const auth = await authenticateAndAuthorize(req, action);
  
  if (!auth.ok) {
    return { 
        ...auth, 
        response: new Response(JSON.stringify(auth), { 
            status: auth.status, 
            headers: { "Content-Type": "application/json" } 
        }) 
    };
  }

  return auth;
}

// ============================================
// Audit logger (Unified Schema)
// ============================================
export async function logAuditEvent(
  supabase: SupabaseClient,
  params: {
    event_type: string;
    actor_user_id: string;
    office_id: string;
    patient_id?: string;
    resource_type: string;
    resource_id?: string;
    action: string;
    status?: "SUCCESS" | "DENIED" | "ERROR" | "BLOCKED_SAFETY";
    metadata_json?: Record<string, unknown>;
  }
): Promise<void> {
  try {
    await supabase.from("audit_logs").insert({
      event_type: params.event_type,
      actor_user_id: params.actor_user_id,
      office_id: params.office_id,
      patient_id: params.patient_id || null,
      resource_type: params.resource_type,
      resource_id: params.resource_id || null,
      action: params.action,
      timestamp: new Date().toISOString(),
      metadata_json: {
          ...params.metadata_json,
          status: params.status || 'SUCCESS'
      }
    });
  } catch (e) {
    console.error("[audit] Failed to write log:", e);
  }
}
