import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { FileText, Plus, Copy, Check, X, Loader2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KIT_LAYOUT_TEMPLATE_HTML } from '@/lib/templates/kitLayoutTemplate';
const DOC_TYPES = ['BASE', 'PROCURAÇÃO', 'CONTRATO', 'DECLARAÇÃO'] as const;
type DocType = typeof DOC_TYPES[number];

interface Template {
  id: string;
  name: string;
  category: string;
  content: string;
  is_active: boolean;
  office_id: string | null;
  created_at: string;
  updated_at: string;
}

const BASE_TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>{{titulo_documento}}</title>
  <style>
    @page { size: A4; margin: 2.5cm; }
    body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.8; color: #1a1a1a; }
    .header { text-align: center; margin-bottom: 3cm; }
    .header .logo { max-height: 80px; margin-bottom: 1cm; background: #ffffff; padding: 8px 12px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15); }
    .header .office-name { font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; }
    .header .office-info { font-size: 10pt; color: #555; margin-top: 0.5cm; }
    .title { text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin: 2cm 0; letter-spacing: 1px; }
    .content { text-align: justify; text-indent: 2cm; }
    .content p { margin-bottom: 0.8cm; }
    .signature-block { margin-top: 3cm; text-align: center; }
    .signature-line { border-top: 1px solid #333; width: 60%; margin: 0 auto; padding-top: 0.3cm; }
    .signature-name { font-weight: bold; margin-top: 0.2cm; }
    .signature-info { font-size: 10pt; color: #555; }
    .footer { position: fixed; bottom: 1cm; left: 0; right: 0; text-align: center; font-size: 9pt; color: #777; }
    .date-location { text-align: right; margin: 2cm 0; }
  </style>
</head>
<body>
  <div class="header">
    {{#if logo_url}}<img src="{{logo_url}}" class="logo" alt="Logo">{{/if}}
    <div class="office-name">{{nome_escritorio}}</div>
    <div class="office-info">
      {{endereco_escritorio}}<br>
      Tel: {{telefone_escritorio}} | {{email_escritorio}}
    </div>
  </div>

  <div class="title">{{titulo_documento}}</div>

  <div class="content">
    {{{conteudo_principal}}}
  </div>

  <div class="date-location">
    {{cidade}}, {{data_extenso}}
  </div>

  <div class="signature-block">
    <div class="signature-line">
      <div class="signature-name">{{nome_advogado}}</div>
      <div class="signature-info">OAB/{{oab_uf}} {{oab_numero}}</div>
    </div>
  </div>

  <div class="footer">
    Documento gerado em {{data_geracao}} pelo Sistema LEXOS
  </div>
</body>
</html>`;

// Dados base comuns para todos os previews (com notação de ponto para compatibilidade)
const PREVIEW_DATA_BASE: Record<string, string> = {
  // Dados do cliente
  'client.full_name': 'Maria da Silva Santos',
  'client.nationality': 'brasileira',
  'client.marital_status': 'solteira',
  'client.profession': 'empresária',
  'client.cpf': '123.456.789-00',
  'client.rg': '1234567 SSP/TO',
  'client.email': 'maria.santos@email.com',
  'client.endereco': 'Rua das Flores, 123, Centro, Palmas/TO',
  // Dados do escritório
  'office.nome': 'Moreira & Associados Advogados',
  'office.responsavel_nome': 'Dr. João Moreira',
  'office.responsavel_oab': '12345',
  'office.responsavel_oab_uf': 'TO',
  'office.endereco_completo': 'Av. JK, 456, Sala 10, Centro, Palmas/TO, CEP 77001-000',
  'office.cidade': 'Palmas',
  'office.estado': 'TO',
  'office.email': 'contato@moreiradv.com.br',
  'office.telefone': '(63) 3333-4444',
  'office.cnpj': '12.345.678/0001-90',
  // Dados de data
  'date.extenso': '29 de dezembro de 2025',
  'date.curta': '29/12/2025',
  // Legado (compatibilidade com templates antigos)
  logo_url: '',
  nome_escritorio: 'Moreira & Associados Advogados',
  cliente_nome: 'Maria da Silva Santos',
  label_documento_cliente: 'CPF',
  cliente_documento: '123.456.789-00',
  cliente_endereco: 'Rua das Flores, 123, Centro, Palmas/TO',
  advogado_nome: 'Dr. João Moreira',
  advogado_oab: 'OAB/TO 12345',
  escritorio_endereco: 'Av. JK, 456, Sala 10, Palmas/TO',
  escritorio_email: 'contato@moreiradv.com.br',
  escritorio_telefone: '(63) 3333-4444',
  cidade: 'Palmas',
  data_extenso: '29 de dezembro de 2025',
  assinatura_url: '',
  nome_assinante: 'Maria da Silva Santos',
};

// Dados específicos por tipo de documento (apenas conteúdo do corpo, sem partes - já estão no template base)
const PREVIEW_DATA_PROCURACAO: Record<string, string> = {
  titulo_documento: 'PROCURAÇÃO',
  label_parte_1: 'OUTORGANTE',
  label_parte_2: 'OUTORGADO',
  label_assinatura: 'OUTORGANTE',
  conteudo_principal: `<p>Pelo presente instrumento particular de mandato, o(a) OUTORGANTE nomeia e constitui seu(sua) bastante procurador(a) o(a) OUTORGADO(a), conferindo-lhe poderes para o foro em geral, com a cláusula <em>ad judicia et extra</em>, para representar o(a) OUTORGANTE perante quaisquer órgãos do Poder Judiciário, repartições públicas federais, estaduais e municipais, autarquias, fundações, empresas públicas, sociedades de economia mista, instituições financeiras, cartórios, pessoas físicas ou jurídicas de direito público ou privado, em geral.</p>
<p>Para tanto, poderá o(a) OUTORGADO(a) praticar todos os atos necessários ao fiel cumprimento deste mandato, inclusive propor ações, contestar, recorrer, acompanhar processos em qualquer instância ou tribunal, apresentar defesas, requerimentos, manifestações, firmar compromissos, acordos judiciais ou extrajudiciais, transigir, desistir, receber e dar quitação, levantar valores, requerer alvarás, assinar declarações, contratos, termos e documentos, bem como substabelecer, com ou sem reserva de poderes.</p>
<p>O presente mandato é outorgado por prazo indeterminado, podendo ser revogado a qualquer tempo, na forma da lei.</p>`,
};

const PREVIEW_DATA_DECLARACAO: Record<string, string> = {
  titulo_documento: 'DECLARAÇÃO DE HIPOSSUFICIÊNCIA',
  label_parte_1: 'DECLARANTE',
  label_parte_2: '',
  label_assinatura: 'DECLARANTE',
  conteudo_principal: `<p><strong>DECLARO</strong>, sob as penas da lei, para fins de obtenção dos benefícios da Justiça Gratuita, nos termos da Lei nº 1.060/50, que não possuo condições financeiras de arcar com as custas processuais e honorários advocatícios, sem prejuízo do próprio sustento e de minha família.</p>
<p>Declaro ainda que esta declaração é a expressão da verdade e que assumo inteira responsabilidade pelas informações aqui prestadas.</p>`,
};

const PREVIEW_DATA_CONTRATO: Record<string, string> = {
  titulo_documento: 'CONTRATO DE HONORÁRIOS ADVOCATÍCIOS',
  label_parte_1: 'CONTRATANTE',
  label_parte_2: 'CONTRATADO',
  label_assinatura: 'CONTRATANTE',
  conteudo_principal: `<p><strong>CLÁUSULA PRIMEIRA - DO OBJETO:</strong> O presente contrato tem por objeto a prestação de serviços advocatícios pelo CONTRATADO ao CONTRATANTE, consistente na defesa de seus interesses na ação judicial a ser proposta ou já em andamento.</p>
<p><strong>CLÁUSULA SEGUNDA - DOS HONORÁRIOS:</strong> Pelos serviços prestados, o CONTRATANTE pagará ao CONTRATADO o valor de R$ 3.000,00 (três mil reais), a título de honorários contratuais, a ser pago da seguinte forma: 50% na assinatura deste contrato e 50% no prazo de 30 dias.</p>
<p><strong>CLÁUSULA TERCEIRA - DAS DESPESAS:</strong> As despesas processuais, tais como custas, emolumentos, perícias, diligências e outras, correrão por conta do CONTRATANTE.</p>
<p><strong>CLÁUSULA QUARTA - DA VIGÊNCIA:</strong> O presente contrato terá vigência até a conclusão definitiva dos serviços contratados, podendo ser rescindido por qualquer das partes mediante notificação prévia de 30 dias.</p>`,
};

function getPreviewData(category: string): Record<string, string> {
  const base = { ...PREVIEW_DATA_BASE };
  
  if (category === 'DECLARAÇÃO') {
    return { ...base, ...PREVIEW_DATA_DECLARACAO };
  }
  if (category === 'CONTRATO') {
    return { ...base, ...PREVIEW_DATA_CONTRATO };
  }
  // Default: PROCURAÇÃO ou BASE
  return { ...base, ...PREVIEW_DATA_PROCURACAO };
}

function renderTemplate(html: string, data: Record<string, string>): string {
  let result = html;
  // Substituir placeholders triplos {{{...}}} primeiro (HTML) - suporta notação com ponto
  result = result.replace(/\{\{\{([\w.]+)\}\}\}/g, (_, key) => data[key] || '');
  // Substituir condicionais {{#if ...}}...{{/if}}
  result = result.replace(/\{\{#if ([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, content) => {
    return data[key] ? content : '';
  });
  // Substituir placeholders duplos {{...}} - suporta notação com ponto
  result = result.replace(/\{\{([\w.]+)\}\}/g, (_, key) => data[key] || '');
  return result;
}

export default function AdminModelos() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', category: 'BASE' as DocType, content: '' });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  // Get office_id from office_members table
  const { data: officeData, isLoading: isLoadingOffice } = useQuery({
    queryKey: ['user-office', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('office_members')
        .select('office_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const officeId = officeData?.office_id || null;

  // Fetch templates (only active ones)
  const { data: templates = [], isLoading: isLoadingTemplates } = useQuery({
    queryKey: ['admin-modelos', officeId],
    queryFn: async () => {
      if (!officeId) return [];
      const { data, error } = await supabase
        .from('document_templates')
        .select('*')
        .eq('office_id', officeId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as Template[];
    },
    enabled: !!officeId,
  });

  const isLoading = isLoadingOffice || isLoadingTemplates;

  // Seed base template if not exists (verifica no banco incluindo inativos)
  useEffect(() => {
    const seedBaseTemplate = async () => {
      if (!officeId || isLoading) return;
      
      // Verificar diretamente no banco se existe template BASE (ativo OU inativo)
      const { data: existingBase } = await supabase
        .from('document_templates')
        .select('id')
        .eq('office_id', officeId)
        .eq('category', 'BASE')
        .limit(1);
      
      // Só cria se não existir nenhum (ativo ou inativo)
      if (!existingBase || existingBase.length === 0) {
        const { error } = await supabase.from('document_templates').insert({
          office_id: officeId,
          name: 'Template Base Premium Extra',
          category: 'BASE',
          content: BASE_TEMPLATE_HTML,
          is_active: true,
        });
        if (!error) {
          queryClient.invalidateQueries({ queryKey: ['admin-modelos', officeId] });
          toast.success('Template Base Premium Extra criado automaticamente');
        }
      }
    };
    seedBaseTemplate();
  }, [officeId, isLoading, queryClient]);

  // Select template for editing - only fill form when selecting an existing template
  useEffect(() => {
    if (!selectedId) return;
    const t = templates.find(t => t.id === selectedId);
    if (t) {
      setForm({
        name: t.name,
        category: t.category as DocType,
        content: t.content,
      });
    }
  }, [selectedId]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!officeId) throw new Error('Escritório não encontrado');
      if (!form.name.trim()) throw new Error('Nome é obrigatório');
      
      if (selectedId) {
        const { error } = await supabase
          .from('document_templates')
          .update({ name: form.name, category: form.category, content: form.content, updated_at: new Date().toISOString() })
          .eq('id', selectedId)
          .eq('office_id', officeId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('document_templates')
          .insert({ office_id: officeId, name: form.name, category: form.category, content: form.content, is_active: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-modelos', officeId] });
      toast.success(selectedId ? 'Template atualizado' : 'Template criado');
      if (!selectedId) setForm({ name: '', category: 'BASE', content: '' });
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao salvar'),
  });

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId || !officeId) throw new Error('Selecione um template');
      const template = templates.find(t => t.id === selectedId);
      if (!template) throw new Error('Template não encontrado');
      
      const { error } = await supabase.from('document_templates').insert({
        office_id: officeId,
        name: `${template.name} (Cópia)`,
        category: template.category,
        content: template.content,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-modelos', officeId] });
      toast.success('Template duplicado');
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao duplicar'),
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId || !officeId) throw new Error('Selecione um template');
      const template = templates.find(t => t.id === selectedId);
      if (!template) throw new Error('Template não encontrado');
      
      const { error } = await supabase
        .from('document_templates')
        .update({ is_active: !template.is_active, updated_at: new Date().toISOString() })
        .eq('id', selectedId)
        .eq('office_id', officeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-modelos', officeId] });
      toast.success('Status alterado');
    },
    onError: (err: any) => toast.error(err.message || 'Erro ao alterar status'),
  });

  const selectedTemplate = templates.find(t => t.id === selectedId);
  const isFormDirty = selectedId 
    ? (form.name !== selectedTemplate?.name || form.category !== selectedTemplate?.category || form.content !== selectedTemplate?.content)
    : (form.name.trim() !== '' || form.content.trim() !== '');

  // Show message if user is not linked to any office
  if (!isLoadingOffice && !officeId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Usuário não vinculado a nenhum escritório.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Modelos (Admin)</h1>
          <p className="text-sm text-muted-foreground">Gerencie os templates HTML do escritório e personalize as variáveis.</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => { setSelectedId(null); setForm({ name: '', category: 'BASE', content: '' }); }}
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Lista de Templates */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Templates</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum template encontrado
              </div>
            ) : (
              <div className="divide-y divide-border">
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors',
                      selectedId === t.id && 'bg-primary/10'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <FileText className={cn('h-4 w-4 mt-0.5 shrink-0', t.is_active ? 'text-primary' : 'text-muted-foreground')} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{t.name}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>{t.category}</span>
                          {!t.is_active && <span className="text-destructive">(Inativo)</span>}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Editor */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {selectedId ? 'Editar Template' : 'Novo Template'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nome do template"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Tipo</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as DocType }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Dicionário de Variáveis (Guia Rápida) */}
            <div className="p-3 bg-muted/30 border rounded-md mb-4 text-xs space-y-2">
              <h4 className="font-semibold text-foreground mb-1">Dicionário de Variáveis</h4>
              <p className="text-muted-foreground mb-2">Clique na variável para copiar. Use chaves duplas <code className="bg-muted px-1 rounded">{"{{"}variavel{"}}"}</code> ou triplas <code className="bg-muted px-1 rounded">{"{{{"}variavel{"}}}"}</code> para HTML.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <strong className="text-muted-foreground block mb-1">Cliente</strong>
                  <div className="flex flex-wrap gap-1">
                    {['client.full_name', 'client.cpf', 'client.cnpj', 'client.qualificacao_cliente', 'client.address', 'client.signature_base64'].map(v => (
                       <button key={v} type="button" onClick={() => { navigator.clipboard.writeText(`{{${v}}}`); toast.success('Copiado!'); }} className="bg-accent text-accent-foreground px-1.5 py-0.5 rounded text-[10px] hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">{v}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <strong className="text-muted-foreground block mb-1">Escritório & Advogado</strong>
                  <div className="flex flex-wrap gap-1">
                    {['office.name', 'office.cnpj', 'office.signature_signed_url', 'advogados.qualificacao_completa', 'advogados.lista_resumida'].map(v => (
                       <button key={v} type="button" onClick={() => { navigator.clipboard.writeText(`{{${v}}}`); toast.success('Copiado!'); }} className="bg-accent text-accent-foreground px-1.5 py-0.5 rounded text-[10px] hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">{v}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <strong className="text-muted-foreground block mb-1">Contrato (Financeiro)</strong>
                  <div className="flex flex-wrap gap-1">
                    {['valor_fixo_honorarios', 'valor_fixo_honorarios_extenso', 'metodo_pagamento_label', 'forma_pagamento', 'parcelas_datas_vencimento', 'chave_pix', 'valor_entrada', 'valor_parcela'].map(v => (
                       <button key={v} type="button" onClick={() => { navigator.clipboard.writeText(`{{${v}}}`); toast.success('Copiado!'); }} className="bg-accent text-accent-foreground px-1.5 py-0.5 rounded text-[10px] hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">{v}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <strong className="text-muted-foreground block mb-1">Sistema & Datas</strong>
                  <div className="flex flex-wrap gap-1">
                    {['data_atual_extenso', 'conteudo_principal', 'titulo_documento'].map(v => (
                       <button key={v} type="button" onClick={() => { navigator.clipboard.writeText(`{{${v}}}`); toast.success('Copiado!'); }} className="bg-accent text-accent-foreground px-1.5 py-0.5 rounded text-[10px] hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">{v}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="content">HTML do Template</Label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      try {
                        const html = form.content || KIT_LAYOUT_TEMPLATE_HTML;
                        const previewData = getPreviewData(form.category);
                        const rendered = renderTemplate(html, previewData);
                        setPreviewHtml(rendered);
                        setPreviewOpen(true);
                      } catch (err) {
                        toast.error('Erro ao renderizar template');
                        console.error('Render error:', err);
                      }
                    }}
                    disabled={!form.content && !KIT_LAYOUT_TEMPLATE_HTML}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Pré-visualizar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(form.content);
                        toast.success('HTML copiado!');
                      } catch {
                        const textarea = document.createElement('textarea');
                        textarea.value = form.content;
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textarea);
                        toast.success('HTML copiado!');
                      }
                    }}
                    disabled={!form.content}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copiar
                  </Button>
                </div>
              </div>
              <textarea
                id="content"
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Cole o HTML do template aqui..."
                className="w-full min-h-[400px] font-mono text-xs p-3 border border-input bg-background rounded-md resize-y"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button 
                onClick={() => saveMutation.mutate()} 
                disabled={saveMutation.isPending || !isFormDirty}
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
              
              {selectedId && (
                <>
                  <Button 
                    variant="outline" 
                    onClick={() => duplicateMutation.mutate()} 
                    disabled={duplicateMutation.isPending}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Duplicar
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => toggleActiveMutation.mutate()} 
                    disabled={toggleActiveMutation.isPending}
                  >
                    {selectedTemplate?.is_active ? (
                      <>
                        <X className="h-4 w-4 mr-2" />
                        Desativar
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Ativar
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Pré-visualização do Template</DialogTitle>
            <DialogDescription>Visualize como o documento será renderizado com dados de exemplo.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-white rounded border">
            <iframe
              srcDoc={previewHtml}
              title="Preview"
              className="w-full h-[70vh] border-0"
              sandbox="allow-same-origin"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
