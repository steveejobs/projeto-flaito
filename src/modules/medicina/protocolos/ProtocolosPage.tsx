import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    BookOpen,
    Search,
    Filter,
    ChevronRight,
    ExternalLink,
    Beaker,
    Shield,
    Leaf,
    Apple,
    Activity,
    FileText,
} from "lucide-react";

interface Protocolo {
    id: string;
    titulo: string;
    condicao: string;
    categoria: 'nutricao' | 'integrativa' | 'neurologia' | 'geral';
    nivel_evidencia: 'A' | 'B' | 'C' | 'D';
    descricao: string;
    conteudo: string[];
    referencias: { titulo: string; autores: string; ano: number; doi?: string }[];
}

const MOCK_PROTOCOLOS: Protocolo[] = [
    {
        id: '1',
        titulo: 'Protocolo de Suplementação para Fadiga Crônica',
        condicao: 'Síndrome de Fadiga Crônica',
        categoria: 'nutricao',
        nivel_evidencia: 'B',
        descricao: 'Protocolo nutricional baseado em evidências para manejo de fadiga crônica com foco em micronutrientes e suporte mitocondrial.',
        conteudo: [
            'Magnésio Quelato 300-400mg/dia (preferencialmente à noite)',
            'Coenzima Q10 200-300mg/dia (suporte mitocondrial)',
            'Vitamina D3 2000-4000 UI/dia (ajustar conforme 25-OH sérico)',
            'Complexo B metilado (B12 metilcobalamina 1000mcg + Folato 5-MTHF 400mcg)',
            'Ômega-3 EPA/DHA 2g/dia (modulação inflamatória)',
            'Avaliar ferro sérico + ferritina antes de suplementar',
        ],
        referencias: [
            { titulo: 'Vitamins and Minerals for Energy, Fatigue and Cognition', autores: 'Tardy et al.', ano: 2020, doi: '10.3390/nu12010228' },
            { titulo: 'Coenzyme Q10 supplementation in chronic fatigue syndrome', autores: 'Castro-Marrero et al.', ano: 2015, doi: '10.1016/j.clnu.2014.03.007' },
        ],
    },
    {
        id: '2',
        titulo: 'Adaptógenos para Estresse e Ansiedade',
        condicao: 'Estresse Crônico / Ansiedade',
        categoria: 'integrativa',
        nivel_evidencia: 'B',
        descricao: 'Protocolo fitoterápico com adaptógenos para modulação do eixo HPA e manejo de estresse e ansiedade.',
        conteudo: [
            'Ashwagandha (Withania somnifera) — 300-600mg/dia extrato padronizado KSM-66',
            'Rhodiola rosea — 200-400mg/dia extrato padronizado (3% rosavinas)',
            'L-Teanina 200mg/dia (suporte GABAérgico)',
            'Magnésio Taurato 200mg/dia (efeito ansiolítico)',
            'Considerar protocolo MBSR 8 semanas (meditação mindfulness)',
        ],
        referencias: [
            { titulo: 'Ashwagandha root extract: safety and efficacy', autores: 'Chandrasekhar et al.', ano: 2012, doi: '10.4103/0253-7176.106022' },
            { titulo: 'Rhodiola rosea for stress management', autores: 'Anghelescu et al.', ano: 2018, doi: '10.1016/j.phymed.2018.07.080' },
        ],
    },
    {
        id: '3',
        titulo: 'Avaliação Neuropsicológica — Déficit de Atenção Adulto',
        condicao: 'TDAH Adulto / Déficit Atencional',
        categoria: 'neurologia',
        nivel_evidencia: 'A',
        descricao: 'Protocolo de investigação neuropsicológica para queixas de desatenção e disfunção executiva em adultos.',
        conteudo: [
            'Triagem inicial com ASRS v1.1 (WHO Adult ADHD Self-Report Scale)',
            'Avaliação neuropsicológica completa: atenção, memória de trabalho, funções executivas',
            'MoCA (Montreal Cognitive Assessment) para screening cognitivo',
            'Descartar: hipotireoidismo, anemia ferropriva, apneia do sono, depressão',
            'Exames: TSH, Ferritina, Vitamina D, B12, Hemograma',
            'Considerar polissonografia se queixas de sono relevantes',
        ],
        referencias: [
            { titulo: 'ADHD in Adults: Diagnosis and Management', autores: 'Kooij et al.', ano: 2019, doi: '10.1007/s00406-018-0947-2' },
        ],
    },
    {
        id: '4',
        titulo: 'Protocolo Anti-Inflamatório Nutricional',
        condicao: 'Inflamação Crônica Subclínica',
        categoria: 'nutricao',
        nivel_evidencia: 'B',
        descricao: 'Abordagem nutricional para redução de marcadores inflamatórios e modulação da resposta imunológica.',
        conteudo: [
            'Dieta anti-inflamatória: aumento de vegetais crucíferos, frutas vermelhas, peixes gordurosos',
            'Eliminação: açúcares refinados, óleos vegetais industrializados, ultraprocessados',
            'Cúrcuma (curcumina) 500-1000mg/dia com piperina',
            'Ômega-3 EPA/DHA 2-3g/dia',
            'Probióticos multi-cepas (mín. 10 bilhões UFC)',
            'Vitamina D3 manter > 40ng/mL',
        ],
        referencias: [
            { titulo: 'Anti-Inflammatory Effects of Curcumin', autores: 'Hewlings & Kalman', ano: 2017, doi: '10.3390/foods6100092' },
        ],
    },
    {
        id: '5',
        titulo: 'Acupuntura para Cefaleia Tensional',
        condicao: 'Cefaleia Tensional Crônica',
        categoria: 'integrativa',
        nivel_evidencia: 'A',
        descricao: 'Protocolo de acupuntura baseado em evidências para manejo de cefaleia tensional episódica e crônica.',
        conteudo: [
            'Sessões semanais de acupuntura (protocolo cervicogênico)',
            'Pontos principais: GB20, GB21, LI4, LV3, GV20, Taiyang',
            'Ciclo: 8-12 sessões, com reavaliação a cada 4',
            'Associar: alongamento cervical diário 2x/dia',
            'Orientação ergonômica para uso de computador',
            'Considerar dry needling em pontos-gatilho',
        ],
        referencias: [
            { titulo: 'Acupuncture for tension-type headache', autores: 'Linde et al.', ano: 2016, doi: '10.1002/14651858.CD007587.pub2' },
        ],
    },
];

const categoriaConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    nutricao: { label: 'Nutrição', icon: Apple, color: 'text-orange-400' },
    integrativa: { label: 'Med. Integrativa', icon: Leaf, color: 'text-green-400' },
    neurologia: { label: 'Neurologia', icon: Activity, color: 'text-purple-400' },
    geral: { label: 'Geral', icon: Beaker, color: 'text-blue-400' },
};

const evidenceColors: Record<string, string> = {
    A: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    B: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    C: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    D: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const evidenceLabels: Record<string, string> = {
    A: 'Forte — Meta-análises / RCTs',
    B: 'Moderada — Estudos controlados',
    C: 'Fraca — Séries de casos',
    D: 'Muito Fraca — Opinião de especialistas',
};

const ProtocolosPage = () => {
    const [search, setSearch] = useState('');
    const [categoriaFilter, setCategoriaFilter] = useState('todos');
    const [evidenciaFilter, setEvidenciaFilter] = useState('todos');
    const [selected, setSelected] = useState<Protocolo | null>(null);

    const filtered = MOCK_PROTOCOLOS.filter((p) => {
        const matchSearch =
            p.titulo.toLowerCase().includes(search.toLowerCase()) ||
            p.condicao.toLowerCase().includes(search.toLowerCase());
        const matchCategoria = categoriaFilter === 'todos' || p.categoria === categoriaFilter;
        const matchEvidencia = evidenciaFilter === 'todos' || p.nivel_evidencia === evidenciaFilter;
        return matchSearch && matchCategoria && matchEvidencia;
    });

    return (
        <div className="p-6 max-w-screen-2xl mx-auto space-y-8 animate-in fade-in duration-700">
            {/* Header */}
            <header className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
                    Biblioteca de Protocolos
                </h1>
                <p className="text-muted-foreground">
                    Protocolos clínicos inteligentes com classificação por condição, nível de evidência e referências bibliográficas.
                </p>
            </header>

            {/* Disclaimer */}
            <Card className="p-4 border-amber-500/20 bg-amber-500/5">
                <div className="flex gap-3">
                    <Shield className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-amber-400">Protocolos Assistivos</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Os protocolos são referências baseadas em evidências científicas. Devem ser adaptados individualmente pelo profissional de saúde conforme o quadro clínico de cada paciente.
                        </p>
                    </div>
                </div>
            </Card>

            {/* Filters */}
            <Card className="bento-card p-4">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nome ou condição clínica..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
                        <SelectTrigger className="w-full md:w-[200px]">
                            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                            <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todas Categorias</SelectItem>
                            <SelectItem value="nutricao">🍎 Nutrição</SelectItem>
                            <SelectItem value="integrativa">🌿 Med. Integrativa</SelectItem>
                            <SelectItem value="neurologia">🧠 Neurologia</SelectItem>
                            <SelectItem value="geral">🔬 Geral</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={evidenciaFilter} onValueChange={setEvidenciaFilter}>
                        <SelectTrigger className="w-full md:w-[200px]">
                            <SelectValue placeholder="Evidência" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos Níveis</SelectItem>
                            <SelectItem value="A">Nível A (Forte)</SelectItem>
                            <SelectItem value="B">Nível B (Moderada)</SelectItem>
                            <SelectItem value="C">Nível C (Fraca)</SelectItem>
                            <SelectItem value="D">Nível D (Muito Fraca)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </Card>

            {/* Evidence Legend */}
            <div className="flex flex-wrap gap-3">
                {Object.entries(evidenceLabels).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2">
                        <Badge variant="outline" className={`${evidenceColors[key]} text-xs`}>
                            {key}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                ))}
            </div>

            {/* Protocols Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.map((proto) => {
                    const cat = categoriaConfig[proto.categoria];
                    const CatIcon = cat.icon;
                    return (
                        <Card
                            key={proto.id}
                            className="bento-card p-5 cursor-pointer hover:border-white/20 transition-all group"
                            onClick={() => setSelected(proto)}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className={`p-2 rounded-lg bg-white/5`}>
                                        <CatIcon className={`h-4 w-4 ${cat.color}`} />
                                    </div>
                                    <Badge variant="outline" className="text-xs bg-white/5">
                                        {cat.label}
                                    </Badge>
                                </div>
                                <Badge variant="outline" className={`${evidenceColors[proto.nivel_evidencia]} text-xs`}>
                                    Nível {proto.nivel_evidencia}
                                </Badge>
                            </div>
                            <h3 className="font-semibold text-foreground text-sm mb-1 group-hover:text-blue-400 transition-colors">
                                {proto.titulo}
                            </h3>
                            <p className="text-xs text-muted-foreground mb-3">{proto.condicao}</p>
                            <p className="text-xs text-muted-foreground/80 line-clamp-2">{proto.descricao}</p>
                            <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <BookOpen className="h-3 w-3" />
                                    {proto.referencias.length} referência{proto.referencias.length !== 1 ? 's' : ''}
                                </span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </Card>
                    );
                })}
            </div>

            {filtered.length === 0 && (
                <Card className="bento-card p-12 text-center">
                    <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
                    <p className="text-lg font-medium text-muted-foreground">Nenhum protocolo encontrado</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">Tente ajustar os filtros de busca.</p>
                </Card>
            )}

            {/* Protocol Detail Dialog */}
            <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    {selected && (
                        <>
                            <DialogHeader>
                                <div className="flex items-center gap-3 mb-2">
                                    <Badge variant="outline" className="text-xs bg-white/5">
                                        {categoriaConfig[selected.categoria].label}
                                    </Badge>
                                    <Badge variant="outline" className={evidenceColors[selected.nivel_evidencia]}>
                                        Nível {selected.nivel_evidencia}
                                    </Badge>
                                </div>
                                <DialogTitle className="text-xl font-bold">{selected.titulo}</DialogTitle>
                                <p className="text-sm text-muted-foreground mt-1">{selected.condicao}</p>
                            </DialogHeader>

                            <div className="space-y-6 mt-4">
                                <div>
                                    <p className="text-sm text-foreground leading-relaxed">{selected.descricao}</p>
                                </div>

                                <div>
                                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-blue-400" />
                                        Protocolo
                                    </h4>
                                    <div className="space-y-2">
                                        {selected.conteudo.map((item, i) => (
                                            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                                                <span className="text-xs font-mono text-blue-400 mt-0.5 shrink-0">{i + 1}.</span>
                                                <p className="text-sm text-foreground">{item}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                        <BookOpen className="h-4 w-4 text-emerald-400" />
                                        Referências Bibliográficas
                                    </h4>
                                    <div className="space-y-3">
                                        {selected.referencias.map((ref, i) => (
                                            <div key={i} className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                                                <p className="text-sm font-medium text-foreground">{ref.titulo}</p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {ref.autores} ({ref.ano})
                                                </p>
                                                {ref.doi && (
                                                    <a
                                                        href={`https://doi.org/${ref.doi}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-blue-400 hover:underline flex items-center gap-1 mt-1"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <ExternalLink className="h-3 w-3" />
                                                        DOI: {ref.doi}
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ProtocolosPage;
