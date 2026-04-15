export interface GovernanceRecommendation {
  id: string;
  office_id: string | null;
  patient_id: string | null;
  category: string;
  description: string;
  impact_level: string;
  status: string;
  is_automated: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface RiskSnapshot {
  id: string;
  office_id: string | null;
  snapshot_date: string;
  total_incidents: number | null;
  high_risk_score: number | null;
  critical_alerts: number | null;
  compliance_percentage: number | null;
  created_at: string | null;
}

export interface StrategicInsight {
  id: string;
  office_id: string | null;
  insight_type: "PRODUCT" | "ENGINEERING" | "OPERATIONS" | "COST" | "RISK";
  scope: "GLOBAL" | "OFFICE" | "PATIENT";
  scope_id: string | null;
  feature: string | null;
  summary: string;
  reasoning: string | null;
  recommended_action: string;
  priority_level: "low" | "medium" | "high" | "critical";
  decision_type: string;
  confidence_score: number;
  deviation_pct: number | null;
  time_window_start: string;
  time_window_end: string;
  comparison_window_start: string | null;
  comparison_window_end: string | null;
  metadata: Record<string, any> | null;
  created_at: string | null;
}

export interface GovernanceAlert {
  id: string;
  office_id: string | null;
  incident_id: string | null;
  alert_type: string;
  message: string;
  severity: string;
  is_resolved: boolean | null;
  created_at: string | null;
  medical_governance_incidents?: {
    title: string;
    incident_category: string;
  } | null;
}

export interface RiskState {
  id: string;
  office_id: string | null;
  patient_id: string | null;
  risk_level: string;
  risk_factors: any | null;
  last_updated: string | null;
}

export interface GovernanceIncident {
  id: string;
  office_id: string | null;
  title: string;
  description: string | null;
  incident_category: string;
  severity_level: string;
  status: string;
  created_at: string | null;
}

export interface SafetyAudit {
  id: string;
  office_id: string | null;
  user_id: string | null;
  function_slug: string;
  requested_capability: string;
  effective_capability: string;
  audience: string;
  user_role: string | null;
  action_taken: string | null;
  is_blocked: boolean | null;
  reasoning: string | null;
  created_at: string | null;
}
