/**
 * Motor de Templates Flaito
 * Responsável por substituir variáveis {{nome_variavel}} por valores reais.
 */

export type TemplateContext = 'GENERAL' | 'MEDICAL' | 'LEGAL' | 'AGENDA';

export interface TemplateVariables {
    // Global
    client_name?: string; // Legacy
    'client.name'?: string;
    'client.phone'?: string;
    'client.cpf'?: string;
    'office.name'?: string;
    
    // Medical
    'appointment.date'?: string;
    'appointment.time'?: string;
    'professional.name'?: string;
    'protocol.link'?: string;
    'report.type'?: string;
    'patient.name'?: string;
    
    // Legal
    'case.number'?: string;
    'case.court'?: string;
    'case.opponent'?: string;
    'deadline.date'?: string;
    'legal.action_type'?: string;

    // Generic support for dynamic items
    [key: string]: string | undefined;
}

export const renderTemplate = (content: string, variables: TemplateVariables): string => {
    if (!content) return "";
    
    return content.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
        const trimmedKey = key.trim();
        const value = variables[trimmedKey];
        
        // Fallback para variável não encontrada ou vazia
        if (value === undefined || value === null || value === "") {
            return ``; // NO LEAKS
        }
        
        return value;
    });
};

export const getAvailableVariables = (context: TemplateContext): string[] => {
    const common = ['client.name', 'client.phone', 'client.cpf', 'office.name'];
    
    switch (context) {
        case 'MEDICAL':
            return [...common, 'professional.name', 'protocol.link', 'report.type', 'patient.name'];
        case 'LEGAL':
            return [...common, 'case.number', 'case.court', 'case.opponent', 'deadline.date', 'legal.action_type'];
        case 'AGENDA':
            return [...common, 'appointment.date', 'appointment.time', 'professional.name'];
        default:
            return common;
    }
};
