
export type ResourceStatus = 'unknown' | 'missing' | 'ready' | 'error';

export interface ResourceState<T> {
  status: ResourceStatus;
  data: T | null;
  error?: string | null;
}

export interface SystemCapabilities {
  hasAuth: boolean;
  hasProfile: boolean;
  hasOffice: boolean;
  hasInstitutionalConfig: boolean;
  isOnboardingCompleted: boolean;
  activeModule: 'LEGAL' | 'MEDICAL' | 'GENERAL';
}

export interface AuthInitializationState {
  auth: ResourceStatus;
  profile: ResourceStatus;
  office: ResourceStatus;
  config: ResourceStatus;
  onboarding: ResourceStatus;
  isStabilized: boolean;
}
