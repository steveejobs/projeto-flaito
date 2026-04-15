import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
    Search, 
    MapPin, 
    Phone, 
    Mail, 
    Building2, 
    Link as LinkIcon,
    Shield,
    Gavel,
    Navigation2
} from "lucide-react";
import { useDelegaciaLookup } from "@/hooks/useDelegaciaLookup";
import { supabase } from "@/integrations/supabase/client";

const ContatosJudiciarioPage = () => {
    const { delegacias, loading: loadingDel, searchDelegacias } = useDelegaciaLookup();
    const [contatos, setContatos] = useState<any[]>([]);
    const [loadingCont, setLoadingCont] = useState(false);
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState<'TRIBUNAIS' | 'DELEGACIAS'>('TRIBUNAIS');

    const fetchTribunais = async (term = "") => {
        setLoadingCont(true);
        try {
            let query = supabase.from('contatos_judiciario').select('*');
            if (term) {
                query = query.or(`nome_vara.ilike.%${term}%,tribunal.ilike.%${term}%,cidade.ilike.%${term}%`);
            }
            const { data, error } = await query.limit(50);
            if (error) throw error;
            setContatos(data || []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingCont(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'TRIBUNAIS') fetchTribunais(search);
        else searchDelegacias({ cidade: search });
    }, [activeTab]);

    const handleSearch = () => {
        if (activeTab === 'TRIBUNAIS') fetchTribunais(search);
        else searchDelegacias({ cidade: search });
    };

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight">Contatos do Judiciário</h1>
                <p className="text-slate-500 font-medium">Guia unificado de tribunais, varas e delegacias.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-center">
                <Card className="p-1 flex bg-slate-100 rounded-xl border-none w-fit">
                    <Button 
                        variant={activeTab === 'TRIBUNAIS' ? 'secondary' : 'ghost'} 
                        className={`h-9 px-6 rounded-lg font-bold text-xs transition-all ${activeTab === 'TRIBUNAIS' ? 'shadow-sm text-blue-600 bg-white hover:bg-white' : 'text-slate-500'}`}
                        onClick={() => setActiveTab('TRIBUNAIS')}
                    >
                        <Gavel className="w-3.5 h-3.5 mr-2" />
                        Tribunais e Varas
                    </Button>
                    <Button 
                        variant={activeTab === 'DELEGACIAS' ? 'secondary' : 'ghost'} 
                        className={`h-9 px-6 rounded-lg font-bold text-xs transition-all ${activeTab === 'DELEGACIAS' ? 'shadow-sm text-blue-600 bg-white hover:bg-white' : 'text-slate-500'}`}
                        onClick={() => setActiveTab('DELEGACIAS')}
                    >
                        <Shield className="w-3.5 h-3.5 mr-2" />
                        Delegacias
                    </Button>
                </Card>

                <div className="relative flex-1 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <Input 
                        placeholder={activeTab === 'TRIBUNAIS' ? "Ex: 1ª Vara Cível, TJSP, São Paulo..." : "Buscar por cidade ou nome da delegacia..."}
                        className="pl-10 h-11 bg-white border-slate-200 rounded-xl focus-visible:ring-blue-500 shadow-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(loadingCont || loadingDel) ? (
                    Array(6).fill(0).map((_, i) => (
                        <Card key={i} className="h-40 animate-pulse bg-slate-50 border-slate-100 rounded-2xl" />
                    ))
                ) : (activeTab === 'TRIBUNAIS' ? contatos : delegacias).map((item) => (
                    <Card key={item.id} className="p-5 bg-white border-slate-200/60 shadow-sm hover:shadow-md hover:border-blue-200 transition-all rounded-2xl">
                        <div className="flex items-start justify-between mb-3">
                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                {activeTab === 'TRIBUNAIS' ? <Building2 className="w-5 h-5 text-blue-600" /> : <Shield className="w-5 h-5 text-emerald-600" />}
                            </div>
                            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter bg-slate-50 text-slate-500 border-slate-200">
                                {item.tipo || 'GERAL'}
                            </Badge>
                        </div>

                        <h3 className="text-base font-extrabold text-slate-700 leading-tight mb-2">
                            {activeTab === 'TRIBUNAIS' ? item.nome_vara : item.nome}
                        </h3>
                        
                        {activeTab === 'TRIBUNAIS' && item.tribunal && (
                            <p className="text-xs font-bold text-blue-600 mb-4">{item.tribunal}</p>
                        )}

                        <div className="space-y-2.5 mt-4">
                            <div className="flex items-center gap-2.5 text-xs text-slate-500 font-medium">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="line-clamp-1">{item.endereco}, {item.cidade} - {item.estado}</span>
                            </div>
                            {item.telefone && (
                                <div className="flex items-center gap-2.5 text-xs text-slate-500 font-medium hover:text-blue-600 cursor-pointer transition-colors">
                                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    {item.telefone}
                                </div>
                            )}
                            {item.email && (
                                <div className="flex items-center gap-2.5 text-xs text-slate-500 font-medium hover:text-blue-600 cursor-pointer transition-colors">
                                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span className="line-clamp-1">{item.email}</span>
                                </div>
                            )}
                        </div>

                        <div className="mt-5 flex gap-2">
                            <Button variant="ghost" className="flex-1 h-8 text-[10px] font-bold text-blue-600 hover:bg-blue-50 rounded-lg">
                                <Navigation2 className="w-3 h-3 mr-1.5" /> GPS
                            </Button>
                            <Button variant="ghost" className="flex-1 h-8 text-[10px] font-bold text-slate-500 hover:bg-slate-50 rounded-lg">
                                <LinkIcon className="w-3 h-3 mr-1.5" /> Copiar Info
                            </Button>
                        </div>
                    </Card>
                ))}

                {((activeTab === 'TRIBUNAIS' ? contatos : delegacias).length === 0 && !loadingCont && !loadingDel) && (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 text-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                        <Search className="w-8 h-8 text-slate-300 mb-3" />
                        <h3 className="text-lg font-bold text-slate-600">Nenhum contato encontrado</h3>
                        <p className="text-sm text-slate-400 mt-1">Tente buscar por outra cidade ou termo.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ContatosJudiciarioPage;
