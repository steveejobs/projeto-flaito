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
    patient_id?: string | null;
    office_id?: string | null;
    case_id?: string | null;
    appointment_id?: string | null;
    report_id?: string | null;
    task_id?: string | null;
    is_strict_mode?: boolean; // if true, throws error on missing required variables
}

/**
 * Resolves a template string by replacing `{{entity.field}}` with actual DB data.
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
    const requestedVars = Array.from(new Set(matches.map(m => m[1].trim())));

    if (requestedVars.length === 0) return content;

    // 2. Load variable metadata from DB
    // We fetch both the exact name AND potential legacy matches
    const { data: dbVars, error } = await supabase
        .from('dynamic_variables')
        .select('*')
        .in('name', requestedVars)
        .eq('is_active', true);

    if (error) {
        console.error("[variableResolver] Error fetching metadata:", error);
    }
    
    const varMap: Record<string, DynamicVariable> = {};
    (dbVars || []).forEach((v: DynamicVariable) => {
        varMap[v.name] = v;
    });

    // 3. Group by table to optimize queries
    const tableGroups: Record<string, { id: string | null | undefined, fields: Set<string>, vars: string[], overrideIdColumn?: string }> = {
        'clients': { id: rootContext.client_id, fields: new Set(), vars: [] },
        'pacientes': { id: rootContext.patient_id, fields: new Set(), vars: [] },
        'offices': { id: rootContext.office_id, fields: new Set(), vars: [] },
        'cases': { id: rootContext.case_id, fields: new Set(), vars: [] },
        'agenda_medica': { id: rootContext.appointment_id, fields: new Set(), vars: [] },
        'medical_reports': { id: rootContext.report_id, fields: new Set(), vars: [] },
        'case_deadlines': { id: rootContext.task_id, fields: new Set(), vars: [] }
    };

    // Safe fallback for pacientes if only client_id is provided
    if (!rootContext.patient_id && rootContext.client_id) {
        // Technically pacientes might not have client_id in all schemas, but we can attempt to match it if added, or fallback to client_id logic if the application links them.
        tableGroups['pacientes'].id = rootContext.client_id;
        tableGroups['pacientes'].overrideIdColumn = 'client_id';
    }

    const resolvedValues: Record<string, string | null> = {};

    for (const varName of requestedVars) {
        const metadata = varMap[varName];
        if (metadata && metadata.source_type === 'TABLE_FIELD' && metadata.source_table && metadata.source_field) {
            const group = tableGroups[metadata.source_table];
            if (group) {
                group.fields.add(metadata.source_field);
                group.vars.push(varName);
            }
        } else if (metadata && metadata.source_type === 'COMPUTED') {
            // Special Computed Logic
            if (varName === 'protocol.link' || varName === 'protocol_link') {
                resolvedValues[varName] = rootContext.report_id ? `https://flaito.com.br/protocol/${rootContext.report_id}` : null;
            }
        }
    }

    // 4. Batch queries by table
    for (const [tableName, group] of Object.entries(tableGroups)) {
        if (group.fields.size > 0 && group.id) {
            const fieldsToSelect = Array.from(group.fields).join(',');
            // Mapping context ID to column name
            let idColumn = group.overrideIdColumn || 'id';
            
            const { data, error: fetchErr } = await supabase
                .from(tableName)
                .select(fieldsToSelect)
                .eq(idColumn, group.id)
                .maybeSingle();

            if (fetchErr) {
                console.error(`[variableResolver] Error fetching from ${tableName}:`, fetchErr);
                continue;
            }

            if (data) {
                group.vars.forEach(varName => {
                    const field = varMap[varName].source_field!;
                    let val = data[field];

                    // Formatting logic
                    if (val !== null && val !== undefined) {
                        if (varName.includes('date') || field.includes('data') || field.includes('_at') || field === 'due_date') {
                           try {
                               val = new Date(val).toLocaleDateString('pt-BR');
                           } catch (e) { console.warn(`[variableResolver] Erro ao instanciar data para campo ${field}:`, e); }
                        } else if (varName.includes('time')) {
                            try {
                                val = new Date(val).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                            } catch (e) { console.warn(`[variableResolver] Erro na formatação de tempo para campo ${field}:`, e); }
                        }
                    }

                    resolvedValues[varName] = val !== null ? String(val) : null;
                });
            }
        }
    }

    // 5. Final Replacement with Fallbacks
    return content.replace(regex, (match, key) => {
        const trimmedKey = key.trim();
        
        // Dynamic legacy alias mapping
        let resolutionKey = trimmedKey;
        if (trimmedKey === 'client_name' || trimmedKey === 'cliente_nome') resolutionKey = 'client.name';
        if (trimmedKey === 'client_name_full') resolutionKey = 'client.name_full';
        if (trimmedKey === 'client_phone') resolutionKey = 'client.phone';
        if (trimmedKey === 'case_number' || trimmedKey === 'processo_numero') resolutionKey = 'case.number';
        if (trimmedKey === 'case.cnj_number') resolutionKey = 'case.number';
        if (trimmedKey === 'lawyer_name') resolutionKey = 'lawyer.name';
        if (trimmedKey === 'lawyer_oab') resolutionKey = 'lawyer.oab';
        if (trimmedKey === 'vara_juizo') resolutionKey = 'case.vara';
        if (trimmedKey === 'comarca') resolutionKey = 'case.city';

        let val = resolvedValues[resolutionKey];

        // Legacy/Manual injection check
        if ((val === undefined || val === null || val === "") && legacyVariables) {
            if (legacyVariables[trimmedKey]) val = legacyVariables[trimmedKey];
            if (legacyVariables[resolutionKey]) val = legacyVariables[resolutionKey];
        }

        if (val !== undefined && val !== null && val !== "") {
            return val;
        }

        const metadata = varMap[resolutionKey];

        if (metadata) {
            const strictMode = rootContext.is_strict_mode !== false; // Default to Strict!
            if (metadata.is_required && strictMode) {
                console.error(`[variableResolver] ERROR FATAL: Falta a variável obrigatória {{${trimmedKey}}}.`);
                throw new Error(`MISSING_REQUIRED_VARIABLE: A variável obrigatória '{{${trimmedKey}}}' não possui valor no banco de dados para este preenchimento. A geração do documento foi bloqueada preventivamente.`);
            }
            return strictMode ? `[ERRO: ${trimmedKey} NÃO ENCONTRADO]` : "—";
        }

        return ''; 
    });
}
