import { useState } from "react";
import { Plus, X, Search, FileText, Pill, FileDown, Printer, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Mock Data
import { useAuth } from "@/contexts/AuthContext";

interface PrescricaoCtaProps {
    prescricoes: any[];
    setPrescricoes: (prescricoes: any[]) => void;
    pacienteNome?: string;
    medicalSettings?: any;
    profissionalNome?: string;
}

export default function PrescricaoCta({ 
    prescricoes, 
    setPrescricoes, 
    pacienteNome = "Paciente", 
    medicalSettings,
    profissionalNome = "Médico"
}: PrescricaoCtaProps) {
    const { user } = useAuth();
    const [busca, setBusca] = useState("");
    const [isReviewed, setIsReviewed] = useState(false);

    const hasItemsPendingReview = prescricoes.some(p => p.requires_medical_review && !p.review_confirmed_at);

    const removerMedicamento = (id: string) => {
        setPrescricoes(prescricoes.filter(p => p.id !== id));
    };

    const handleConfirmReview = () => {
        if (!user) return;
        
        const updated = prescricoes.map(p => ({
            ...p,
            review_confirmed_at: new Date().toISOString(),
            reviewed_by_user_id: user.id
        }));
        setPrescricoes(updated);
        setIsReviewed(true);
        toast.success("Prescrição revisada e validada clinicamente.");
    };

    const handleImprimir = () => {
        if (prescricoes.length === 0) {
            toast.error("Nenhum medicamento prescrito.");
            return;
        }
        if (hasItemsPendingReview) {
            toast.error("Ação bloqueada: É necessário revisar e validar a prescrição antes de imprimir.");
            return;
        }
        window.print();
    }

    const handleGerarPDF = () => {
        if (prescricoes.length === 0) {
            toast.error("Nenhum medicamento prescrito.");
            return;
        }
        if (hasItemsPendingReview) {
            toast.error("Ação bloqueada: É necessário revisar e validar a prescrição antes de gerar o PDF.");
            return;
        }
        toast.info("Selecione 'Salvar como PDF' na opção de destino da impressora.");
        setTimeout(() => window.print(), 500);
    }

    return (
        <>
        <div className="flex flex-col xl:flex-row gap-6 print:hidden">

            {/* Esquerda: Construtor de Prescrição */}
            <div className="flex-1 space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Buscar medicamento padrão..."
                        className="pl-9 h-11 font-medium bg-white"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                    />
                </div>

                {/* Painel de Prescrições Adicionadas */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm min-h-[300px] flex flex-col">
                    <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <Pill className="w-4 h-4 text-teal-600" />
                            Medicamentos Prescritos ({prescricoes.length})
                        </span>
                        <Badge variant="outline" className="bg-white">{new Date().toLocaleDateString('pt-BR')}</Badge>
                    </div>

                    <ScrollArea className="flex-1 max-h-[400px]">
                        {prescricoes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-12 text-center h-full opacity-60">
                                <FileText className="w-12 h-12 text-slate-300 mb-3" />
                                <p className="font-bold text-slate-500">Nenhum medicamento</p>
                                <p className="text-sm text-slate-400 max-w-[250px] mt-1">Busque um medicamento ou use a IA para gerar sugestões terapêuticas.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {prescricoes.map((item, index) => (
                                    <div key={item.id} className="p-4 flex justify-between items-start group hover:bg-slate-50/50 transition-colors">
                                        <div className="flex gap-3">
                                            <div className="font-bold text-slate-300 text-sm w-4 pt-0.5">{index + 1}.</div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                                    {item.nome}
                                                    {item.requires_medical_review && !item.review_confirmed_at && (
                                                        <Badge variant="destructive" className="text-[10px] h-4 px-1 animate-pulse">Requer Revisão</Badge>
                                                    )}
                                                </h4>
                                                <p className="text-sm text-slate-500 font-medium mt-1 leading-relaxed max-w-[90%]">{item.posologia}</p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => removerMedicamento(item.id)}
                                            className="text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-full shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>

                    {hasItemsPendingReview && (
                        <div className="p-4 bg-rose-50 border-t border-rose-100 space-y-3">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                                <p className="text-xs text-rose-700 font-bold leading-tight">
                                    Esta prescrição contém itens sugeridos por IA ou aguardando validação técnica.
                                    Confirme que você revisou o conteúdo antes de prosseguir.
                                </p>
                            </div>
                            <Button 
                                size="sm" 
                                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold h-9 gap-2"
                                onClick={handleConfirmReview}
                            >
                                <CheckCircle2 className="w-4 h-4" /> Validar Clinicamente e Liberar
                            </Button>
                        </div>
                    )}

                    <div className="p-4 bg-slate-50/50 border-t border-slate-100 grid grid-cols-2 gap-3">
                        <Button 
                            variant="outline" 
                            className="font-bold gap-2 text-slate-700 bg-white" 
                            onClick={handleImprimir}
                            disabled={hasItemsPendingReview}
                        >
                            <Printer className="w-4 h-4" /> Imprimir
                        </Button>
                        <Button 
                            className="font-bold gap-2 bg-teal-600 hover:bg-teal-700 text-white" 
                            onClick={handleGerarPDF}
                            disabled={hasItemsPendingReview}
                        >
                            <FileDown className="w-4 h-4" /> Gerar PDF (Assinado)
                        </Button>
                    </div>
                </div>
            </div>

            {/* Direita: Avisos de Segurança e Contexto */}
            <div className="w-full xl:w-[320px] shrink-0 space-y-3">
                <Card className="p-4 bg-slate-900 border-none text-white overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-2 opacity-10">
                        <Shield className="w-16 h-16" />
                    </div>
                    <h3 className="text-xs font-black uppercase text-teal-400 tracking-widest mb-2">Protocolo P0 Security</h3>
                    <p className="text-[11px] leading-relaxed text-slate-300 font-medium">
                        Kits estáticos foram removidos por segurança clínica. 
                        Toda prescrição automatizada agora exige validação manual do profissional responsável.
                    </p>
                </Card>
                
                <div className="pt-2 text-center">
                    <p className="text-[10px] text-muted-foreground font-bold px-4">
                        Assinado digitalmente como {user?.user_metadata?.name || profissionalNome}
                    </p>
                </div>
            </div>

        </div>

        {/* Layout de Impressão (Oculto na tela, visível apenas na impressão) */}
        <div className="hidden print:block p-8 bg-white text-black min-h-screen">
            {/* Cabeçalho */}
            {medicalSettings?.doc_header ? (
                <div 
                    className="mb-8 border-b-2 border-slate-800 pb-4 text-center whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: medicalSettings.doc_header }} 
                />
            ) : (
                <div className="mb-8 border-b-2 border-slate-800 pb-6 text-center">
                    <h1 className="text-2xl font-black uppercase tracking-widest">{profissionalNome}</h1>
                    <p className="text-sm font-bold text-slate-600">RECEITUÁRIO MÉDICO</p>
                </div>
            )}

            {/* Informações do Paciente */}
            <div className="mb-10 text-lg">
                <p><strong>Paciente:</strong> {pacienteNome}</p>
                <p><strong>Data:</strong> {new Date().toLocaleDateString('pt-BR')}</p>
            </div>

            {/* Lista de Medicamentos */}
            <div className="space-y-8 min-h-[400px]">
                {prescricoes.map((item, index) => (
                    <div key={item.id} className="text-lg">
                        <div className="flex items-baseline gap-2 mb-1">
                            <span className="font-bold">{index + 1}.</span>
                            <h4 className="font-bold uppercase">{item.nome}</h4>
                        </div>
                        <p className="pl-6 text-base leading-relaxed">{item.posologia}</p>
                    </div>
                ))}
            </div>

            {/* Assinatura */}
            <div className="mt-20 pt-10 flex flex-col items-center justify-center text-center">
                <div className="w-64 border-t border-black mb-2"></div>
                <p className="font-bold uppercase">{profissionalNome}</p>
                {medicalSettings?.crm && <p className="text-sm">CRM: {medicalSettings.crm} {medicalSettings.crm_uf ? `- ${medicalSettings.crm_uf}` : ''}</p>}
            </div>

            {/* Rodapé */}
            {medicalSettings?.doc_footer && (
                <div 
                    className="mt-16 pt-4 border-t border-slate-300 text-center text-sm text-slate-500 whitespace-pre-wrap absolute bottom-8 left-0 right-0"
                    dangerouslySetInnerHTML={{ __html: medicalSettings.doc_footer }} 
                />
            )}
        </div>
        </>
    );
}
