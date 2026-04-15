import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Database, Tag, Search } from 'lucide-react';

interface DynamicVariable {
    id: string;
    name: string;
    label: string;
    context_type: string;
    source_type: string;
    is_required: boolean;
    description: string;
}

export const VariableCatalog: React.FC = () => {
    const [variables, setVariables] = useState<DynamicVariable[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'ALL' | 'GLOBAL' | 'MEDICAL' | 'LEGAL' | 'AGENDA'>('ALL');

    useEffect(() => {
        loadVariables();
    }, []);

    const loadVariables = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('dynamic_variables')
            .select('*')
            .eq('is_active', true)
            .order('context_type');
            
        if (!error && data) {
            setVariables(data);
        }
        setLoading(false);
    };

    const filteredVariables = variables.filter(v => {
        if (activeTab !== 'ALL' && v.context_type !== activeTab) return false;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            return v.name.toLowerCase().includes(term) || v.label.toLowerCase().includes(term);
        }
        return true;
    });

    const getContextColor = (type: string) => {
        switch(type) {
            case 'GLOBAL': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            case 'MEDICAL': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
            case 'LEGAL': return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
            case 'AGENDA': return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
            default: return 'bg-white/10 text-white/60 border-white/20';
        }
    };

    return (
        <div className="w-full bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
                        <Database className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">Catálogo de Variáveis</h2>
                        <p className="text-white/40 text-sm">Consulte as variáveis dinâmicas disponíveis para injeção</p>
                    </div>
                </div>

                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input 
                        type="text" 
                        placeholder="Buscar por nome ou label..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                    />
                </div>
            </div>

            <div className="flex space-x-2 border-b border-white/10 mb-6 overflow-x-auto custom-scrollbar pb-2">
                {['ALL', 'GLOBAL', 'MEDICAL', 'LEGAL', 'AGENDA'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all shrink-0 ${
                            activeTab === tab 
                                ? 'bg-white text-black shadow-lg' 
                                : 'text-white/60 hover:bg-white/5 hover:text-white'
                        }`}
                    >
                        {tab === 'ALL' ? 'Todas' : tab}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="animate-pulse space-y-4">
                    {[1,2,3].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl w-full" />)}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredVariables.map((v) => (
                        <div key={v.id} className="group bg-white/5 border border-white/10 rounded-xl p-4 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all duration-300">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2 mb-2">
                                    <Tag className="w-4 h-4 text-white/40" />
                                    <code className="text-purple-300 font-mono font-bold">{"{{" + v.name + "}}"}</code>
                                </div>
                                <span className={`text-[10px] px-2 py-1 uppercase font-bold tracking-wider rounded-md border ${getContextColor(v.context_type)}`}>
                                    {v.context_type}
                                </span>
                            </div>
                            
                            <h4 className="text-white text-sm font-semibold mt-2">{v.label}</h4>
                            <p className="text-white/50 text-xs mt-1 leading-relaxed">{v.description}</p>
                            
                            <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                                <span className="text-white/40 font-mono">Fonte: {v.source_type}</span>
                                {v.is_required && (
                                    <span className="text-red-400 bg-red-400/10 px-2 py-0.5 rounded flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                                        Opcional: Falso
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {filteredVariables.length === 0 && (
                        <div className="col-span-full py-12 text-center border-2 border-dashed border-white/10 rounded-2xl">
                            <Settings className="w-8 h-8 text-white/20 mx-auto mb-3" />
                            <p className="text-white/40">Nenhuma variável encontrada no catálogo.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
