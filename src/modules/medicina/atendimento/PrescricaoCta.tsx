import { useState } from "react";
import { Plus, X, Search, FileText, Pill, FileDown, Printer, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Mock Data
const KITS_PRESCRICAO = [
    {
        id: "kit-1",
        nome: "🩺 Combo Hipertensão Básica",
        medicamentos: [
            { id: "m1", nome: "Losartana Potássica 50mg", posologia: "Tomar 01 comprimido via oral 12/12h.", tipo: "uso continuo" },
            { id: "m2", nome: "Hidroclorotiazida 25mg", posologia: "Tomar 01 comprimido via oral pela manhã.", tipo: "uso continuo" }
        ]
    },
    {
        id: "kit-2",
        nome: "🤧 Combo IVAS (Gripe Forte)",
        medicamentos: [
            { id: "m3", nome: "Dipirona Monoidratada 1g", posologia: "Tomar 01 comprimido via oral 6/6h se dor ou febre.", tipo: "sintomatico" },
            { id: "m4", nome: "Loratadina 10mg", posologia: "Tomar 01 comprimido via oral 1x ao dia por 5 dias.", tipo: "sintomatico" },
            { id: "m5", nome: "Soro Fisiológico 0,9%", posologia: "Lavagem nasal 4x ao dia.", tipo: "geral" }
        ]
    },
    {
        id: "kit-3",
        nome: "💊 Dor Lombar / Miorrelaxante",
        medicamentos: [
            { id: "m6", nome: "Torsilax (Cafeína, Carisoprodol, Diclofenaco)", posologia: "Tomar 01 comprimido 12/12h por 3 dias após as refeições.", tipo: "sintomatico" },
            { id: "m7", nome: "Omeprazol 20mg", posologia: "Tomar 01 comprimido em jejum (Proteção Gástrica).", tipo: "uso continuo" }
        ]
    }
];

export default function PrescricaoCta() {
    const [prescricoes, setPrescricoes] = useState<any[]>([]);
    const [busca, setBusca] = useState("");

    const adicionarKit = (kit: any) => {
        // Evita duplicatas pelo ID do medicamento
        const novosMedicamentos = kit.medicamentos.filter(
            (med: any) => !prescricoes.some((p) => p.id === med.id)
        );

        if (novosMedicamentos.length === 0) {
            toast.info("Kit já adicionado à prescrição.");
            return;
        }

        setPrescricoes([...prescricoes, ...novosMedicamentos]);
        toast.success(`Kit "${kit.nome}" (1-Clique) adicionado com sucesso!`);
    };

    const removerMedicamento = (id: string) => {
        setPrescricoes(prescricoes.filter(p => p.id !== id));
    };

    const handleImprimir = () => {
        if (prescricoes.length === 0) {
            toast.error("Nenhum medicamento prescrito.");
            return;
        }
        toast.success("Enviando prescrição para impressora padrão...");
    }

    const handleGerarPDF = () => {
        if (prescricoes.length === 0) {
            toast.error("Nenhum medicamento prescrito.");
            return;
        }
        toast.success("Gerando PDF da Receita Médica com assinatura digital...");
    }

    return (
        <div className="flex flex-col xl:flex-row gap-6">

            {/* Esquerda: Construtor de Prescrição */}
            <div className="flex-1 space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Buscar medicamento padrão (Ainda em mock)..."
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
                                <p className="text-sm text-slate-400 max-w-[250px] mt-1">Busque um medicamento ou clique em um Kit rápido ao lado para prescrever em 1-clique.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {prescricoes.map((item, index) => (
                                    <div key={item.id} className="p-4 flex justify-between items-start group hover:bg-slate-50/50 transition-colors">
                                        <div className="flex gap-3">
                                            <div className="font-bold text-slate-300 text-sm w-4 pt-0.5">{index + 1}.</div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm">{item.nome}</h4>
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

                    <div className="p-4 bg-slate-50/50 border-t border-slate-100 grid grid-cols-2 gap-3">
                        <Button variant="outline" className="font-bold gap-2 text-slate-700 bg-white" onClick={handleImprimir}>
                            <Printer className="w-4 h-4" /> Imprimir
                        </Button>
                        <Button className="font-bold gap-2 bg-teal-600 hover:bg-teal-700 text-white" onClick={handleGerarPDF}>
                            <FileDown className="w-4 h-4" /> Gerar PDF (Assinado)
                        </Button>
                    </div>
                </div>
            </div>

            {/* Direita: Kits Rápidos ("1-Clique") */}
            <div className="w-full xl:w-[320px] shrink-0 space-y-3">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest pl-1 mb-2">Prescrição Mágica (1-Clique)</h3>

                {KITS_PRESCRICAO.map((kit) => (
                    <Card
                        key={kit.id}
                        className="p-3 border border-slate-200 hover:border-teal-300 hover:shadow-md cursor-pointer transition-all bg-white group relative overflow-hidden"
                        onClick={() => adicionarKit(kit)}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-teal-500/0 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10 flex justify-between items-center">
                            <h4 className="font-bold text-slate-700 text-sm">{kit.nome}</h4>
                            <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-1 rounded-md group-hover:bg-teal-100 group-hover:text-teal-700 transition-colors">
                                {kit.medicamentos.length} itens
                            </span>
                        </div>
                        <div className="relative z-10 mt-2 text-xs font-medium text-slate-400 line-clamp-1">
                            {kit.medicamentos.map(m => m.nome.split(" ")[0]).join(", ")}
                        </div>
                    </Card>
                ))}

                <div className="pt-2">
                    <Button variant="ghost" className="w-full text-xs font-bold text-teal-600 hover:text-teal-700 hover:bg-teal-50 border border-dashed border-teal-200 bg-teal-50/50 h-10 rounded-xl">
                        <Plus className="w-3.5 h-3.5 mr-1" /> Criar Novo Kit Personalizado
                    </Button>
                </div>
            </div>

        </div>
    );
}
