export type DocumentTemplateId = 'clean_white' | 'simple_watermark' | 'premium_elegant' | 'modern_executive';

export interface WatermarkConfig {
  enabled: boolean;
  imageUrl?: string;
  opacity: number;
  position: 'center' | 'diagonal';
  size: 'sm' | 'md' | 'lg';
}

export interface BrandingColors {
  primary: string;
  secondary: string;
  accent: string;
}

export interface InstitutionalBranding {
  logoPrimaryUrl?: string;
  logoSecondaryUrl?: string;
  primaryColor?: string; // Mantido para compatibilidade legado
  colors: BrandingColors; 
  watermark: WatermarkConfig;
  documentStyle: {
    legal: DocumentTemplateId;
    medical: DocumentTemplateId;
  };
  institutionalNotes?: string;
}

export interface InstitutionalUnit {
  id: string;
  name: string;
  unitType: 'CLINICA' | 'ESCRITORIO' | 'UNIDADE_MOVEL' | 'OUTRO';
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string;
  email?: string;
}

export interface ProfessionalSignature {
  role: string;
  label: string;
  signatureUrl?: string;
  rubricUrl?: string;
  stampUrl?: string;
}

export interface ProfessionalSettings {
  name: string;
  identType: 'OAB' | 'CRM';
  identNumber: string;
  identUf: string;
  roleTitle?: string;
  signatures: ProfessionalSignature[];
  medical?: {
    rqe?: string;
    specialty?: string;
  };
  legal?: {
    specialtyArea?: string;
  };
}

export interface DocumentContextSnapshot {
  office: {
    name: string;
    legalName: string;
    cnpj?: string;
    branding: InstitutionalBranding;
  };
  unit?: InstitutionalUnit;
  professional: ProfessionalSettings;
  templateMetadata?: {
    id: DocumentTemplateId;
    version: number;
    resolvedAt: string;
  };
  resolvedAt: string;
  version: string;
}
