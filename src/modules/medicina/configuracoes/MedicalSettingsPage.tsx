import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOfficeRole } from "@/hooks/useOfficeRole";
import { useAuth } from "@/contexts/AuthContext";
import {
    Brain, Sparkles, Key, Save, Loader2, Eye, Activity, Info, Settings, User, FileText, FileSignature, Keyboard, Plus, Trash2, Upload, PenTool
} from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';

export default function MedicalSettingsPage() {
    const { officeId, loading: roleLoading } = useOfficeRole();
    const { user, loading: authLoading } = useAuth();
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSavingAi, setIsSavingAi] = useState(false);
    const [isSavingGeneral, setIsSavingGeneral] = useState(false);
    
    const [aiConfigId, setAiConfigId] = useState<string | null>(null);
    const [generalConfigId, setGeneralConfigId] = useState<string | null>(null);

    // AI States
    const [provider, setProvider] = useState('openai');
    const [apiKey, setApiKey] = useState('');
    const [promptIridology, setPromptIridology] = useState('');
    const [promptClinical, setPromptClinical] = useState('');
    const [promptDecoder, setPromptDecoder] = useState('');

    // General States
    const [crm, setCrm] = useState('');
    const [crmUf, setCrmUf] = useState('');
    const [titlePrefix, setTitlePrefix] = useState('');
    const [fullNameOverride, setFullNameOverride] = useState('');
    const [professionalLicenseDisplay, setProfessionalLicenseDisplay] = useState('');
    const [specialty, setSpecialty] = useState('');
    const [appointmentDuration, setAppointmentDuration] = useState('30');
    const [docHeader, setDocHeader] = useState('');
    const [docFooter, setDocFooter] = useState('');
    const [signatureMode, setSignatureMode] = useState<any>('uploaded_image');
    const [signatureAssetPath, setSignatureAssetPath] = useState<string | null>(null);
    const [signatureVersion, setSignatureVersion] = useState<string | null>(null);
    const [isUploadingSignature, setIsUploadingSignature] = useState(false);

    // Snippets States
    const [snippets, setSnippets] = useState<any[]>([]);
    const [newSnippetShortcut, setNewSnippetShortcut] = useState('');
    const [newSnippetContent, setNewSnippetContent] = useState('');
    const [isSavingSnippet, setIsSavingSnippet] = useState(false);

    const defaultIridologyPrompt = `Você é um Iridologista Master e Médico Integrativo. Você receberá imagens de alta resolução do Olho Direito e/ou Esquerdo do paciente, junto com suas notas clínicas (se houver). Seu objetivo é realizar uma leitura detalhada da íris:
1. Identificar padrões na Banda do Sistema Nervoso Autônomo (BSNA).
2. Analisar a zona pupilar, colarite, estroma e anéis de tensão.
3. Identificar sinais iridológicos (lacunas, criptas, raios solares, manchas, anéis nervosos).
4. Correlacionar as zonas afetadas (usando o mapa topográfico de Bernard Jensen) com os órgãos correspondentes.
5. Apontar possíveis alertas críticos e avaliar os sistemas do corpo.
6. Gerar um Índice de Vitalidade de 0 a 100%.

Retorne EXATAMENTE APENAS um JSON válido estruturado assim (nada de Markdown ou explicações antes ou depois):
{
  "summary": "Resumo clínico...",
  "vitalityIndex": 85,
  "criticalAlerts": [{"title": "Fígado", "description": "Sobrecarga estromal", "severity": "moderate"}],
  "findings": [{"zone": 2, "name": "Vesícula", "type": "Mancha psórica", "eye": "right", "severity": "moderate", "description": "Mancha alaranjada..."}],
  "systems": [{"name": "Digestório", "status": "attention", "details": "Deficiência gástrica..."}],
  "anamnesisQuestions": ["O paciente tem gastrite?", "Bebe muita água?"],
  "references": ["Bernard Jensen - Science and Practice of Iridology"]
}`;

    const defaultClinicalPrompt = `Atue como um Motor de Apoio Multidisciplinar focado em Nutrição, Medicina Integrativa e Neurologia. Analise o caso fornecido.
Forneça as informações estruturadas neste JSON:
{
  "estrutura": "Resumo clínico...",
  "hipoteses": ["Hipótese 1", "Hipótese 2"],
  "nutricao": { "avaliacao": "...", "hipoteses": [], "protocolos": [], "referencias": [] },
  "integrativa": { "terapias": [{"nome": "Acupuntura", "descricao": "...", "evidencia": "B"}], "referencias": [] },
  "neurologia": { "avaliacao": "...", "correlacoes": [], "investigacao": [], "referencias": [] }
}`;

    const defaultDecoderPrompt = `Você é o Decifrador de Casos. Atenda como um residente chefe hiper-inteligente, focando em:
1. Diagnóstico diferencial.
2. Interações medicamentosas graves.
Escreva um JSON que será lido pelo chat de UI.
Se detectar sintomas para diagnóstico, use: { "type": "differential", "data": [ { "condicao": "Linfoma", "prob": "Alta", "descricao": "..." } ] }
Se detectar risco de medicamentos, use: { "type": "interaction", "data": [ { "drogaA": "Fluoxetina", "drogaB": "Tramadol", "gravidade": "Alta", "risco": "Síndrome Serotoninérgica" } ] }
Se for um chat conversacional normal, use: { "type": "text", "content": "Sua resposta formatada..." }`;

    useEffect(() => {
        if (roleLoading || authLoading) return;
        
        if (!user) {
            setIsLoading(false);
            return;
        }
        
        const loadConfig = async () => {
            setIsLoading(true);
            try {
                // Load AI Config
                const { data: aiData } = await (supabase.from('ai_config' as any) as any).select('*').eq('user_id', user.id).maybeSingle();
                if (aiData) {
                    setAiConfigId(aiData.id);
                    setProvider(aiData.provider || 'openai');
                    setApiKey(aiData.api_key || '');
                    setPromptIridology(aiData.prompt_iridology || defaultIridologyPrompt);
                    setPromptClinical(aiData.prompt_clinical_analysis || defaultClinicalPrompt);
                    setPromptDecoder(aiData.prompt_case_decoder || defaultDecoderPrompt);
                } else {
                    setPromptIridology(defaultIridologyPrompt);
                    setPromptClinical(defaultClinicalPrompt);
                    setPromptDecoder(defaultDecoderPrompt);
                }

                // Load General Medical Settings
                const { data: generalData, error } = await (supabase.from('user_medical_settings' as any) as any).select('*').eq('user_id', user.id).maybeSingle();
                if (generalData) {
                    setGeneralConfigId(generalData.id);
                    setCrm(generalData.crm || '');
                    setCrmUf(generalData.crm_uf || '');
                    setTitlePrefix(generalData.title_prefix || '');
                    setFullNameOverride(generalData.full_name_override || '');
                    setProfessionalLicenseDisplay(generalData.professional_license_display || '');
                    setSpecialty(generalData.specialty || '');
                    setAppointmentDuration(generalData.appointment_duration?.toString() || '30');
                    setDocHeader(generalData.doc_header || '');
                    setDocFooter(generalData.doc_footer || '');
                    setSignatureMode(generalData.signature_mode || 'uploaded_image');
                    setSignatureAssetPath(generalData.signature_asset_path || null);
                    setSignatureVersion(generalData.signature_version || null);
                } else if (error && error.code !== 'PGRST116') {
                    console.error("Erro ao carregar configurações gerais:", error);
                }

            } catch (error) {
                console.error("Erro geral no carregamento de configurações:", error);
                toast.error("Falha ao carregar configurações.");
            } finally {
                setIsLoading(false);
            }
        };

        const loadSnippets = async () => {
            try {
                const { data, error } = await (supabase
                    .from('user_medical_snippets' as any) as any)
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });
                
                if (data) setSnippets(data);
                if (error && error.code !== 'PGRST116') {
                    console.error("Erro carregando snippets:", error);
                }
            } catch (err) {
                console.error("Erro carregando snippets:", err);
            }
        };

        loadConfig();
        loadSnippets();
    }, [user, roleLoading, authLoading]);

    const handleSaveAi = async () => {
        if (!user) return;
        setIsSavingAi(true);
        try {
            const payload = {
                user_id: user.id,
                office_id: officeId || null,
                provider,
                api_key: apiKey,
                prompt_iridology: promptIridology,
                prompt_clinical_analysis: promptClinical,
                prompt_case_decoder: promptDecoder
            };

            let reqError;
            if (aiConfigId) {
                const { error } = await (supabase.from('ai_config' as any) as any).update(payload).eq('id', aiConfigId);
                reqError = error;
            } else {
                const { data, error } = await (supabase.from('ai_config' as any) as any).insert([payload]).select().single();
                if (data) setAiConfigId(data.id);
                reqError = error;
            }

            if (reqError) throw reqError;
            toast.success("Configurações de IA salvas com sucesso!");
        } catch (error: any) {
            toast.error("Erro ao salvar IA: " + error.message);
        } finally {
            setIsSavingAi(false);
        }
    };

    const handleUploadSignature = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setIsUploadingSignature(true);
        try {
            const fileExt = file.name.split('.').pop();
            const filePath = `${user.id}/signature_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await (supabase.storage
                .from('signatures') as any)
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Atualiza o banco com o novo path
            const newVersion = crypto.randomUUID();
            const { error: updateError } = await (supabase.from('user_medical_settings' as any) as any).update({
                signature_asset_path: filePath,
                signature_version: newVersion,
                signature_uploaded_at: new Date().toISOString()
            }).eq('user_id', user.id);

            if (updateError) throw updateError;

            setSignatureAssetPath(filePath);
            setSignatureVersion(newVersion);
            toast.success("Assinatura digital atualizada!");
        } catch (error: any) {
            toast.error("Erro ao subir assinatura: " + error.message);
        } finally {
            setIsUploadingSignature(false);
        }
    };

    const handleSaveGeneral = async () => {
        if (!user) return;
        setIsSavingGeneral(true);
        try {
            const payload = {
                user_id: user.id,
                office_id: officeId || null,
                crm,
                crm_uf: crmUf,
                title_prefix: titlePrefix,
                full_name_override: fullNameOverride,
                professional_license_display: professionalLicenseDisplay,
                specialty,
                appointment_duration: parseInt(appointmentDuration) || 30,
                doc_header: docHeader,
                doc_footer: docFooter,
                signature_mode: signatureMode
            };

            let reqError;
            if (generalConfigId) {
                const { error } = await (supabase.from('user_medical_settings' as any) as any).update(payload).eq('id', generalConfigId);
                reqError = error;
            } else {
                const { data, error } = await (supabase.from('user_medical_settings' as any) as any).insert([payload]).select().single();
                if (data) setGeneralConfigId(data.id);
                reqError = error;
            }

            if (reqError) throw reqError;
            toast.success("Configurações médicas salvas com sucesso!");
        } catch (error: any) {
            toast.error("Erro salvando configurações: " + error.message);
        } finally {
            setIsSavingGeneral(false);
        }
    };

    const handleAddSnippet = async () => {
        if (!user) return;
        if (!newSnippetShortcut || !newSnippetContent) {
            toast.error("Preencha o atalho e o conteúdo do snippet.");
            return;
        }

        // Garante que tenha barra
        let shortcut = newSnippetShortcut.trim();
        if (!shortcut.startsWith('/')) {
            shortcut = '/' + shortcut;
        }

        setIsSavingSnippet(true);
        try {
            const { data, error } = await (supabase
                .from('user_medical_snippets' as any) as any)
                .insert({
                    user_id: user.id,
                    shortcut: shortcut,
                    content: newSnippetContent
                })
                .select()
                .single();

            if (error) throw error;
            
            setSnippets([data, ...snippets]);
            setNewSnippetShortcut('');
            setNewSnippetContent('');
            toast.success("Atalho salvo com sucesso!");
        } catch (error: any) {
            toast.error("Erro ao salvar o atalho: " + error.message);
        } finally {
            setIsSavingSnippet(false);
        }
    };

    const handleDeleteSnippet = async (id: string) => {
        try {
            const { error } = await (supabase
                .from('user_medical_snippets' as any) as any)
                .delete()
                .eq('id', id);

            if (error) throw error;
            
            setSnippets(snippets.filter(s => s.id !== id));
            toast.success("Atalho removido com sucesso!");
        } catch (error: any) {
            toast.error("Erro ao remover o atalho: " + error.message);
        }
    };

    const handleResetPrompt = (type: 'iridology' | 'clinical' | 'decoder') => {
        if (type === 'iridology') setPromptIridology(defaultIridologyPrompt);
        if (type === 'clinical') setPromptClinical(defaultClinicalPrompt);
        if (type === 'decoder') setPromptDecoder(defaultDecoderPrompt);
        toast.info("Prompt restaurado ao padrão do sistema Flaito.");
    };

    if (roleLoading || authLoading || isLoading) {
        return <div className="p-10 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-teal-500" /></div>;
    }

    if (!user) {
        return <div className="p-10 text-center text-muted-foreground">Você precisa estar logado para configurar a plataforma.</div>;
    }

    return (
        <div className="p-6 max-w-screen-xl mx-auto space-y-6 animate-in fade-in duration-700">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-teal-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-3">
                        <Settings className="h-8 w-8 text-teal-500" />
                        Configurações Médicas
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm max-w-2xl">
                        Ajuste as preferências de prontuário, receitas, agenda e comportamento da Inteligência Artificial em seus atendimentos.
                    </p>
                </div>
            </header>

            <Tabs defaultValue="profile" className="w-full">
                <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-2 rounded-t-xl">
                    <TabsList className="bg-transparent gap-2 h-10 w-full justify-start overflow-x-auto">
                        <TabsTrigger value="profile" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 shadow-sm gap-2">
                            <User className="h-4 w-4 text-emerald-500" /> Perfil & Agenda
                        </TabsTrigger>
                        <TabsTrigger value="docs" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 shadow-sm gap-2">
                            <FileSignature className="h-4 w-4 text-amber-500" /> Cabeçalhos de Documentos
                        </TabsTrigger>
                        <TabsTrigger value="snippets" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 shadow-sm gap-2">
                            <Keyboard className="h-4 w-4 text-violet-500" /> Atalhos de Texto (Snippets)
                        </TabsTrigger>
                        <TabsTrigger value="ai" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 shadow-sm gap-2">
                            <Brain className="h-4 w-4 text-indigo-500" /> Inteligência Artificial
                        </TabsTrigger>
                    </TabsList>
                </div>

                <div className="p-6 bg-card border border-t-0 rounded-b-xl border-slate-200 dark:border-slate-800 shadow-sm">
                    {/* ABA: PERFIL & AGENDA */}
                    <TabsContent value="profile" className="mt-0 space-y-6 outline-none">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-slate-500" />
                                    Identificação Profissional
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Prefixo de Título</Label>
                                        <Select value={titlePrefix} onValueChange={setTitlePrefix}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Escolha..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Dr.">Dr.</SelectItem>
                                                <SelectItem value="Dra.">Dra.</SelectItem>
                                                <SelectItem value="Prof.">Prof.</SelectItem>
                                                <SelectItem value="Enf.">Enf.</SelectItem>
                                                <SelectItem value="">Nenhum</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Nome Completo (Conforme CRM)</Label>
                                        <Input value={fullNameOverride} onChange={e => setFullNameOverride(e.target.value)} placeholder="Nome Oficial p/ Laudos" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>CRM / Registro</Label>
                                        <Input value={crm} onChange={e => setCrm(e.target.value)} placeholder="000000" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>UF do Registro</Label>
                                        <Input value={crmUf} onChange={e => setCrmUf(e.target.value.toUpperCase())} placeholder="SP" maxLength={2} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Exibição Profissional (Label Completa)</Label>
                                    <Input value={professionalLicenseDisplay} onChange={e => setProfessionalLicenseDisplay(e.target.value)} placeholder="Ex: CRM/SP 123.456" />
                                    <p className="text-[10px] text-muted-foreground">Como aparecerá no carimbo (ex: CRM/SP 000.000).</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Especialidade Principal</Label>
                                    <Input value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="Ex: Clínica Integrativa" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <FileSignature className="h-4 w-4 text-emerald-500" />
                                    Assinatura Digital (Oficialização)
                                </h3>
                                
                                <Card className="p-4 bg-slate-50 dark:bg-slate-950 border-dashed border-2 border-slate-200 dark:border-slate-800">
                                    <div className="flex flex-col items-center justify-center space-y-3">
                                        {signatureAssetPath ? (
                                            <div className="text-center space-y-2">
                                                <div className="bg-white p-2 rounded shadow-sm inline-block">
                                                    <p className="text-[10px] text-muted-foreground mb-1">Prévia da Assinatura:</p>
                                                    <div className="h-20 w-40 bg-slate-100 flex items-center justify-center rounded border border-slate-200 overflow-hidden">
                                                        {/* No frontend real, aqui geraria uma signed URL, simplificando com Icon para o teste */}
                                                        <img src={`https://placehold.co/200x100?text=Assinatura+Digital`} alt="Assinatura" className="max-h-full h-auto" />
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">● Verificada em {new Date().toLocaleDateString()}</p>
                                            </div>
                                        ) : (
                                            <div className="text-center py-4">
                                                <Activity className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                                                <p className="text-xs text-muted-foreground">Nenhuma assinatura carregada.</p>
                                            </div>
                                        )}
                                        
                                        <div className="flex gap-2">
                                            <label className="cursor-pointer">
                                                <input type="file" accept="image/*" className="hidden" onChange={handleUploadSignature} disabled={isUploadingSignature} />
                                                <Button variant="outline" size="sm" className="text-xs" asChild>
                                                    <span>{isUploadingSignature ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />} Upload Assinatura</span>
                                                </Button>
                                            </label>
                                            <Button variant="outline" size="sm" className="text-xs" disabled>
                                                <PenTool className="h-3 w-3 mr-1" /> Desenhar
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-slate-500" />
                                    Preferências de Agenda
                                </h3>
                                <div className="space-y-2">
                                    <Label>Duração Padrão do Atendimento (minutos)</Label>
                                    <Select value={appointmentDuration} onValueChange={setAppointmentDuration}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="15">15 minutos</SelectItem>
                                            <SelectItem value="30">30 minutos</SelectItem>
                                            <SelectItem value="45">45 minutos</SelectItem>
                                            <SelectItem value="60">1 hora</SelectItem>
                                            <SelectItem value="90">1 hora e 30 minutos</SelectItem>
                                            <SelectItem value="120">2 horas</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">Tempo sugerido na criação de um novo agendamento.</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end border-t pt-4">
                            <Button onClick={handleSaveGeneral} disabled={isSavingGeneral} className="bg-teal-600 hover:bg-teal-700">
                                {isSavingGeneral ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                Salvar Perfil e Agenda
                            </Button>
                        </div>
                    </TabsContent>

                    {/* ABA: DOCUMENTOS */}
                    <TabsContent value="docs" className="mt-0 space-y-6 outline-none">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label>Cabeçalho dos Documentos (Receitas, Exames, Atestados)</Label>
                                <Textarea 
                                    className="min-h-[120px]" 
                                    value={docHeader}
                                    onChange={e => setDocHeader(e.target.value)}
                                    placeholder="Ex: Clínica Flaito Saúde Integrativa&#10;Dr(a). Nome Sobrenome - CRM/SP 000000&#10;Rua das Amoras, 123" 
                                />
                                <p className="text-xs text-muted-foreground">Aparecerá no topo ao imprimir ou gerar PDF de documentos da aba do paciente.</p>
                            </div>

                            <div className="space-y-2">
                                <Label>Rodapé dos Documentos</Label>
                                <Textarea 
                                    className="min-h-[80px]" 
                                    value={docFooter}
                                    onChange={e => setDocFooter(e.target.value)}
                                    placeholder="Ex: Telefone: (11) 9999-9999 | Instagram: @clinica" 
                                />
                                <p className="text-xs text-muted-foreground">Aparecerá no fim das páginas emitidas.</p>
                            </div>
                        </div>
                        <div className="flex justify-end border-t pt-4">
                            <Button onClick={handleSaveGeneral} disabled={isSavingGeneral} className="bg-amber-600 hover:bg-amber-700">
                                {isSavingGeneral ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                Salvar Documentos
                            </Button>
                        </div>
                    </TabsContent>

                {/* ABA: SNIPPETS */}
                    <TabsContent value="snippets" className="mt-0 space-y-6 outline-none">
                        <div className="space-y-6">
                            <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800/50 p-4 rounded-xl flex gap-3 text-sm text-violet-800 dark:text-violet-200">
                                <Info className="h-5 w-5 shrink-0" />
                                <p>Crie atalhos rápidos para textos que você digita com frequência (ex: exames físicos padrões, condutas específicas). <strong>No PEP, digite o atalho (ex: /normal) + Espaço para expandir o texto automaticamente.</strong></p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                {/* Formulário de Novo Snippet */}
                                <div className="md:col-span-1 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900 shadow-sm space-y-4 h-fit sticky top-20">
                                    <h3 className="font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100 mb-4">
                                        <Plus className="h-4 w-4 text-violet-500" /> Novo Atalho
                                    </h3>
                                    
                                    <div className="space-y-2">
                                        <Label>Comando de Atalho</Label>
                                        <Input 
                                            value={newSnippetShortcut} 
                                            onChange={e => setNewSnippetShortcut(e.target.value)} 
                                            placeholder="Ex: /normal" 
                                            className="font-mono text-sm"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Texto Expansível</Label>
                                        <Textarea 
                                            value={newSnippetContent} 
                                            onChange={e => setNewSnippetContent(e.target.value)} 
                                            placeholder="Texto que será colado quando o atalho for digitado..." 
                                            className="min-h-[150px] resize-y text-sm leading-relaxed"
                                        />
                                    </div>
                                    
                                    <Button 
                                        onClick={handleAddSnippet} 
                                        disabled={isSavingSnippet || !newSnippetShortcut || !newSnippetContent} 
                                        className="w-full bg-violet-600 hover:bg-violet-700"
                                    >
                                        {isSavingSnippet ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                        Salvar Atalho
                                    </Button>
                                </div>

                                {/* Lista de Snippets */}
                                <div className="md:col-span-3 space-y-4">
                                    <h3 className="font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                                        Seus Atalhos ({snippets.length})
                                    </h3>
                                    
                                    {snippets.length === 0 ? (
                                        <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center text-slate-500">
                                            Nenhum atalho cadastrado. Crie seu primeiro modelo ao lado.
                                        </div>
                                    ) : (
                                        <div className="grid gap-4">
                                            {snippets.map(snippet => (
                                                <div key={snippet.id} className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl p-4 hover:border-violet-300 transition-colors group relative shadow-sm flex flex-col gap-2">
                                                    <div className="flex justify-between items-start">
                                                        <span className="font-mono font-bold bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300 px-2 py-1 rounded text-sm">
                                                            {snippet.shortcut}
                                                        </span>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                                            onClick={() => handleDeleteSnippet(snippet.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap leading-relaxed mt-1 line-clamp-3">
                                                        {snippet.content}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* ABA: IA */}
                    <TabsContent value="ai" className="mt-0 space-y-6 outline-none">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            
                            {/* Lateral Esquerda - Provedor  */}
                            <div className="lg:col-span-1 space-y-6">
                                <Card className="p-6 space-y-5 bg-white shadow-sm border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                                    <h3 className="font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                                        <Key className="h-4 w-4 text-emerald-500" />
                                        Provedor de IA e Chave API
                                    </h3>

                                    <div className="space-y-2">
                                        <Label>Modelo LLM (Vision)</Label>
                                        <Select value={provider} onValueChange={setProvider}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Escolha a IA..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="openai">OpenAI (GPT-4o Multimodal)</SelectItem>
                                                <SelectItem value="anthropic">Anthropic (Claude 3.5 Sonnet)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-slate-500">
                                            Para a <b>Iridologia</b> funcionar perfeitamente, o modelo exigido 
                                            deve ter leitura visual afiada. GPT-4o ou Claude 3.5.
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Chave Secreta da API (API Key)</Label>
                                        <Input 
                                            type="password" 
                                            value={apiKey} 
                                            onChange={(e) => setApiKey(e.target.value)}
                                            placeholder="sk-..." 
                                            className="font-mono text-sm"
                                        />
                                        <p className="text-xs text-rose-500">Nunca compartilhe sua chave publica. Essa chave rodará segura nas Edge Functions do Flaito Serverless.</p>
                                    </div>
                                </Card>

                                <Card className="p-6 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900/50 space-y-4">
                                    <h4 className="font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-2 text-sm">
                                        <Info className="h-4 w-4" /> Dicas de Prompting Master
                                    </h4>
                                    <ul className="text-sm text-indigo-900/80 dark:text-indigo-200/80 space-y-2 list-disc pl-4">
                                        <li>O Prompt gerencia a "persona" da LLM. Altere caso note conservadorismo na IA.</li>
                                        <li>Nas IAs de laudo formatado, evite retirar o layout JSON de retorno para não quebrar a UI da aplicação.</li>
                                        <li>Você pode adicionar no prompt: "Prefira sempre tratamentos ayurvédicos se não houver emergência.", isso mudará toda a conduta recomendada nos módulos.</li>
                                    </ul>
                                </Card>
                            </div>

                            {/* Lateral Direita - Prompts */}
                            <div className="lg:col-span-2">
                                <Card className="border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                                    <Tabs defaultValue="iridology" className="w-full">
                                        <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-2">
                                            <TabsList className="bg-transparent gap-2 h-10 w-full overflow-x-auto justify-start">
                                                <TabsTrigger value="iridology" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 shadow-sm gap-2">
                                                    <Eye className="h-4 w-4 text-emerald-500" /> Iridologia
                                                </TabsTrigger>
                                                <TabsTrigger value="clinical" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 shadow-sm gap-2">
                                                    <Activity className="h-4 w-4 text-blue-500" /> Clínica Integral
                                                </TabsTrigger>
                                                <TabsTrigger value="decoder" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 shadow-sm gap-2">
                                                    <Sparkles className="h-4 w-4 text-indigo-500" /> Decifrador Casos
                                                </TabsTrigger>
                                            </TabsList>
                                        </div>

                                        <TabsContent value="iridology" className="p-0 m-0 border-none outline-none">
                                            <div className="p-6 space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">System Prompt: Agente de Iridologia</h3>
                                                    <Button variant="outline" size="sm" onClick={() => handleResetPrompt('iridology')} className="text-xs h-8">Restaurar Padrão</Button>
                                                </div>
                                                <Textarea 
                                                    className="font-mono text-sm leading-relaxed min-h-[400px] bg-slate-50 dark:bg-slate-950 p-4 border-slate-200 dark:border-slate-800 resize-y"
                                                    value={promptIridology}
                                                    onChange={(e) => setPromptIridology(e.target.value)}
                                                />
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="clinical" className="p-0 m-0 border-none outline-none">
                                            <div className="p-6 space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">System Prompt: Agente de Análise Clínica</h3>
                                                    <Button variant="outline" size="sm" onClick={() => handleResetPrompt('clinical')} className="text-xs h-8">Restaurar Padrão</Button>
                                                </div>
                                                <Textarea 
                                                    className="font-mono text-sm leading-relaxed min-h-[400px] bg-slate-50 dark:bg-slate-950 p-4 border-slate-200 dark:border-slate-800 resize-y"
                                                    value={promptClinical}
                                                    onChange={(e) => setPromptClinical(e.target.value)}
                                                />
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="decoder" className="p-0 m-0 border-none outline-none">
                                            <div className="p-6 space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">System Prompt: Decifrador de Casos (Chatbot)</h3>
                                                    <Button variant="outline" size="sm" onClick={() => handleResetPrompt('decoder')} className="text-xs h-8">Restaurar Padrão</Button>
                                                </div>
                                                <Textarea 
                                                    className="font-mono text-sm leading-relaxed min-h-[400px] bg-slate-50 dark:bg-slate-950 p-4 border-slate-200 dark:border-slate-800 resize-y"
                                                    value={promptDecoder}
                                                    onChange={(e) => setPromptDecoder(e.target.value)}
                                                />
                                            </div>
                                        </TabsContent>
                                    </Tabs>
                                </Card>
                            </div>

                        </div>
                        <div className="flex justify-end border-t pt-4">
                            <Button onClick={handleSaveAi} disabled={isSavingAi} className="bg-indigo-600 hover:bg-indigo-700">
                                {isSavingAi ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                Salvar Configurações de IA
                            </Button>
                        </div>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    );
}
