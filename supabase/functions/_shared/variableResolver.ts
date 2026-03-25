export interface DynamicVariable {
    id: string;
    name: string;
    label: string;
    context_type: string;
    source_type: string;
    source_table: string | null;
    source_field: string | null;
    is_required: boolean;
    is_active: boolean;
}

export interface RootContext {
    client_id?: string | null;
    office_id?: string | null;
    case_id?: string | null;
    appointment_id?: string | null;
    report_id?: string | null;
}

/**
 * Resolves a template string by replacing `{{variable_name}}` with actual DB data.
 */
export async function resolveVariables(
    supabase: any,
    content: string,
    rootContext: RootContext,
    legacyVariables?: any
): Promise<string> {
    if (!content) return "";

    // 1. Identify variables requested in the template
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = Array.from(content.matchAll(regex));
    const requestedVars = matches.map(m => m[1].trim());

    if (requestedVars.length === 0) return content;

    // 2. Load variable metadata from DB
    const { data: dbVars, error } = await supabase
        .from('dynamic_variables')
        .select('*')
        .in('name', requestedVars)
        .eq('is_active', true);

    if (error || !dbVars) {
        console.error("Error fetching variables:", error);
    }
    
    const varMap: Record<string, DynamicVariable> = {};
    (dbVars || []).forEach((v: DynamicVariable) => {
        varMap[v.name] = v;
    });

    // 3. Resolve Values
    const resolvedValues: Record<string, string | null> = {};

    for (const varName of requestedVars) {
        const metadata = varMap[varName];
        
        let value: string | null = null;

        if (metadata) {
            if (metadata.source_type === 'TABLE_FIELD' && metadata.source_table && metadata.source_field) {
                // Table resolution mapping logic based on Root Context
                if (metadata.source_table === 'clients' && rootContext.client_id) {
                    const { data } = await supabase.from('clients').select(metadata.source_field).eq('id', rootContext.client_id).maybeSingle();
                    if (data) {
                       value = String(data[metadata.source_field] || '');
                    }
                } else if (metadata.source_table === 'pacientes' && rootContext.client_id) {
                    const { data } = await supabase.from('pacientes').select(metadata.source_field).eq('client_id', rootContext.client_id).maybeSingle();
                    if (data) {
                       value = String(data[metadata.source_field] || '');
                    }
                } else if (metadata.source_table === 'offices' && rootContext.office_id) {
                    const { data } = await supabase.from('offices').select(metadata.source_field).eq('id', rootContext.office_id).maybeSingle();
                    if (data) value = String(data[metadata.source_field] || '');
                } else if (metadata.source_table === 'agenda_medica' && rootContext.appointment_id) {
                    const { data } = await supabase.from('agenda_medica').select(metadata.source_field).eq('id', rootContext.appointment_id).maybeSingle();
                    if (data) {
                        const rawVal = data[metadata.source_field];
                        // Auto-format dates
                        if (metadata.source_field === 'data_hora') {
                            if (varName === 'appointment_date') value = new Date(rawVal).toLocaleDateString('pt-BR');
                            else if (varName === 'appointment_time') value = new Date(rawVal).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                            else value = String(rawVal);
                        } else {
                            value = String(rawVal || '');
                        }
                    }
                } else if (metadata.source_table === 'cases' && rootContext.case_id) {
                    const { data } = await supabase.from('cases').select(metadata.source_field).eq('id', rootContext.case_id).maybeSingle();
                    if (data) value = String(data[metadata.source_field] || '');
                } else if (metadata.source_table === 'medical_reports' && rootContext.report_id) {
                    const { data } = await supabase.from('medical_reports').select(metadata.source_field).eq('id', rootContext.report_id).maybeSingle();
                    if (data) value = String(data[metadata.source_field] || '');
                }
            } else if (metadata.source_type === 'COMPUTED') {
                if (varName === 'protocol_link' && rootContext.report_id) {
                    value = `https://flaito.com.br/protocol/${rootContext.report_id}`; // Generic fallback
                }
            }
        }

        // Fallback to legacy injection
        if ((value === undefined || value === null || value === "") && legacyVariables && legacyVariables[varName]) {
            value = legacyVariables[varName];
        }

        // Store resolved (or null) value
        resolvedValues[varName] = value;

        if (metadata?.is_required && !value) {
            console.warn(`[Variables] Missing required variable: ${varName}`);
        }
    }

    // 4. Replace
    return content.replace(regex, (match, key) => {
        const trimmedKey = key.trim();
        const val = resolvedValues[trimmedKey];

        if (val !== undefined && val !== null && val !== "") {
            return val;
        }

        // D. RESOLUTION FLOW: "Variáveis não encontradas ou VAZIAS ignoram fallbacks e, de forma absoluta, removem o placeholder"
        return ''; 
    });
}
