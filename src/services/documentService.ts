import { supabase } from "@/integrations/supabase/client";

export interface DocumentVariable {
    key: string;
    label: string;
    type: 'text' | 'long_text' | 'number' | 'date' | 'currency' | 'boolean' | 'enum';
    source_type: 'system' | 'manual' | 'ai' | 'office_custom';
    required: boolean;
    category: string;
    help_text?: string;
    vertical: 'LEGAL' | 'MEDICAL' | 'BOTH';
}

export interface TemplateVersion {
    id: string;
    template_id: string;
    version_number: number;
    content_html: string;
    status: 'draft' | 'published' | 'archived';
    change_log?: string;
    published_at?: string;
    created_at: string;
}

export const documentService = {
    /**
     * Busca o catálogo de variáveis disponíveis para o escritório e vertical
     */
    async getVariableCatalog(officeId: string | null, vertical: 'LEGAL' | 'MEDICAL' | 'BOTH' = 'BOTH'): Promise<DocumentVariable[]> {
        let query = supabase
            .from('document_variables')
            .select('*')
            .eq('is_active', true);

        if (officeId) {
            query = query.or(`office_id.is.null,office_id.eq.${officeId}`);
        } else {
            query = query.is('office_id', null);
        }

        const { data, error } = await query;
        if (error) throw error;

        return (data as DocumentVariable[]).filter(v => 
            v.vertical === 'BOTH' || v.vertical === vertical
        );
    },

    /**
     * Cria uma nova versão (draft) para um template
     */
    async createDraftVersion(templateId: string, content: string, changeLog?: string) {
        const { data: user } = await supabase.auth.getUser();
        
        const { data, error } = await supabase
            .from('document_template_versions')
            .insert({
                template_id: templateId,
                content_html: content,
                status: 'draft',
                change_log: changeLog,
                created_by: user.user?.id
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Publica uma versão específica, arquivando a anterior
     */
    async publishVersion(templateId: string, versionId: string) {
        // 1. Arquivar versões publicadas anteriormente
        await supabase
            .from('document_template_versions')
            .update({ status: 'archived' })
            .eq('template_id', templateId)
            .eq('status', 'published');

        // 2. Marcar nova versão como publicada
        const { error: pubError } = await supabase
            .from('document_template_versions')
            .update({ 
                status: 'published',
                published_at: new Date().toISOString()
            })
            .eq('id', versionId);

        if (pubError) throw pubError;

        // 3. Atualizar ponteiro no template principal
        const { error: templateError } = await supabase
            .from('document_templates')
            .update({ active_version_id: versionId })
            .eq('id', templateId);

        if (templateError) throw templateError;
    },

    /**
     * Resolve variáveis de sistema para um cliente e processo (Sintaxe Canônica)
     */
    async resolveSystemVariables(officeId: string, clientId?: string, caseId?: string): Promise<Record<string, string>> {
        const results: Record<string, string> = {};

        // 1. Dados do Escritório (office.*)
        const { data: office } = await supabase.from('offices').select('*').eq('id', officeId).single();
        if (office) {
            results['office.name'] = office.name;
            results['office.phone'] = office.phone || '';
            results['office.email'] = office.email || '';
            results['office.address'] = office.address || '';
        }

        // 2. Dados do Cliente (client.*)
        if (clientId) {
            const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).single();
            if (client) {
                results['client.full_name'] = client.full_name;
                results['client.cpf'] = client.cpf || '';
                results['client.email'] = client.email || '';
                results['client.phone'] = client.phone || '';
            }
        }

        // 3. Dados do Processo (case.*)
        if (caseId) {
            const { data: caseData } = await supabase.from('cases').select('*').eq('id', caseId).single();
            if (caseData) {
                results['case.cnj_number'] = caseData.cnj_number || '';
                results['case.title'] = caseData.title || '';
            }
        }

        // 4. Dados do Usuário Logado (user.*)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            results['user.name'] = profile?.full_name || user.email?.split('@')[0] || '';
            results['user.email'] = user.email || '';
        }

        return results;
    },

    /**
     * Renderiza o conteúdo do template usando a RPC do Postgres
     */
    async renderTemplate(contentHtml: string, data: Record<string, any>): Promise<string> {
        const { data: rendered, error } = await supabase.rpc('render_template_preview_raw', {
            p_content: contentHtml,
            p_data: data
        });

        if (error) throw error;
        return rendered;
    }
};
