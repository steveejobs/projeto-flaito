/**
 * Motor de Templates Flaito - Core Resolver
 * Responsável por processar a sintaxe {{variable.key}}
 */

export interface TemplateData {
  client?: any;
  case?: any;
  office?: any;
  user?: any;
  custom?: Record<string, any>;
}

export class TemplateEngine {
  private static regex = /\{\{\{?\s*([a-zA-Z0-9_.]+)\s*\}?\}\}/g;

  /**
   * Resolve um texto com variáveis usando os dados fornecidos.
   */
  static resolve(content: string, data: TemplateData): string {
    if (!content) return "";

    return content.replace(this.regex, (match, path) => {
      // Clean up path from braces if match was triple or had spaces
      const cleanPath = path.trim();
      const value = this.getValueByPath(data, cleanPath);
      
      if (value === undefined || value === null) {
        return `[Pendente: ${cleanPath}]`; // Placeholder visual para campos vazios
      }

      return this.formatValue(value, cleanPath);
    });
  }

  /**
   * Navega no objeto de dados (ex: 'client.full_name' -> data.client.full_name)
   */
  private static getValueByPath(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }

  /**
   * Formata valores baseado no tipo ou nome da variável
   */
  private static formatValue(value: any, path: string): string {
    // 1. Formatação de Datas
    if (value instanceof Date || (typeof value === 'string' && (path.includes('date') || path.includes('data')))) {
      try {
        const date = new Date(value);
        return date.toLocaleDateString('pt-BR');
      } catch { return value; }
    }

    // 2. Formatação de Moeda (ex: honorários, valor_causa)
    if (typeof value === 'number' && (path.includes('valor') || path.includes('price') || path.includes('currency'))) {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    }

    // 3. Fallback para string simples
    return String(value);
  }

  /**
   * Extrai todas as variáveis únicas presentes em um texto
   */
  static extractVariables(content: string): string[] {
    const matches = content.matchAll(this.regex);
    const keys = new Set<string>();
    for (const match of matches) {
      keys.add(match[1].trim());
    }
    return Array.from(keys);
  }
}

/** Convenience alias for simple key-value template rendering */
export type TemplateVariables = Record<string, string | number | undefined>;

export function renderTemplate(content: string, variables: TemplateVariables): string {
  return TemplateEngine.resolve(content, { custom: variables });
}
