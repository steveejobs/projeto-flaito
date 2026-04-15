/**
 * Centralized Status Enums for Flaito System
 * Use these to ensure consistency between DB, Scheduler, and Workers.
 */

// 1. Agenda Médica (Clinical Appointments)
// Source: 20260228211600_create_medical_core_tables.sql
export const AppointmentStatus = {
    AGENDADO: 'agendado',
    ESPERA: 'espera',
    ATENDIMENTO: 'em_atendimento',
    FINALIZADO: 'finalizado',
    CANCELADO: 'cancelado',
    FALTA: 'falta'
} as const;

// 2. Medical Reports & Iridology Analyses
// Source: 20260302002700_create_iridology_tables.sql
export const ReportStatus = {
    DRAFT: 'draft',
    FINALIZED: 'finalized',
    SIGNED: 'signed'
} as const;

// 3. Notifications Queue (notificacoes_fila)
// Source: 20260317400000_qa_fix_patch.sql
export const QueueStatus = {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    SENT: 'SENT',
    FAILED: 'FAILED',
    RETRYING: 'RETRYING',
    CANCELLED: 'CANCELLED',
    FAILED_PERMANENT: 'FAILED_PERMANENT'
} as const;

// 4. Message Logs
// Source: 20260318200000_message_logs_and_timeline_v2.sql
export const MessageLogStatus = {
    SENT: 'sent',
    FAILED: 'failed'
} as const;

// 5. Messaging Contexts
export enum MessagingContext {
    LEGAL = 'LEGAL',
    MEDICAL = 'MEDICAL',
    GLOBAL = 'GLOBAL'
}
