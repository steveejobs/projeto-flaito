import { supabase } from "@/integrations/supabase/client";
import { TemplateEngine, TemplateData } from "@/utils/templateEngine";

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  vertical: 'LEGAL' | 'MEDICAL' | 'BOTH';
  current_version: number;
  is_system: boolean;
}

export interface TemplateVersion {
  template_id: string;
  version: number;
  content: string;
  change_log?: string;
}

export const templateService = {
  /**
   * Busca templates disponíveis para o escritório (incluindo sistema)
   */
  async listTemplates(officeId: string, vertical: string) {
    const { data, error } = await supabase
      .from('document_templates')
      .select('*')
      .or(`office_id.is.null,office_id.eq.${officeId}`)
      .eq('vertical', vertical === 'MEDICAL' ? 'MEDICAL' : 'LEGAL');

    if (error) throw error;
    return data as Template[];
  },

  /**
   * Obtém a versão mais recente de um template
   */
  async getLatestVersion(templateId: string) {
    const { data, error } = await supabase
      .from('template_versions')
      .select('*')
      .eq('template_id', templateId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Gera um novo documento e salva o snapshot
   */
  async generateAndSave(params: {
    templateId: string;
    officeId: string;
    clientId: string;
    caseId?: string;
    data: TemplateData;
    vertical: 'LEGAL' | 'MEDICAL';
  }) {
    // 1. Pegar conteúdo do template
    const version = await this.getLatestVersion(params.templateId);
    if (!version) throw new Error("Template sem versões publicadas.");

    // 2. Processar substituições
    const finalContent = TemplateEngine.resolve(version.content, params.data);
    const usedVariables = TemplateEngine.extractVariables(version.content);

    // 3. Persistir documento gerado
    const { data: doc, error } = await supabase
      .from('generated_documents')
      .insert({
        template_id: params.templateId,
        template_version: version.version,
        office_id: params.officeId,
        client_id: params.clientId,
        case_id: params.caseId,
        vertical: params.vertical,
        content: finalContent,
        used_variables: usedVariables, // Salva quais chaves foram usadas
        generation_mode: 'system'
      })
      .select()
      .single();

    if (error) throw error;
    return doc;
  }
};
