import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
    Search, 
    Plus, 
    FileText, 
    BookOpen, 
    Scale, 
    GraduationCap, 
    Filter,
    MoreVertical,
    Download,
    Trash2,
    Edit
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useOfficeSession } from "@/hooks/useOfficeSession";
import { useLegalBanco } from "@/hooks/useLegalBanco";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const BancoJuridicoPage = () => {
    const { user } = useAuth();
    const { officeId } = useOfficeSession(user?.id);
    const { documents, loading, fetchDocuments, deleteDocument } = useLegalBanco(officeId);
    const [search, setSearch] = useState("");
    const [filterTipo, setFilterTipo] = useState<string | null>(null);

    const handleSearch = () => {
        fetchDocuments({ search, tipo: filterTipo });
    };

    const getTipoIcon = (tipo: string) => {
        switch (tipo) {
            case 'PETICAO': return <FileText className="w-4 h-4 text-blue-500" />;
            case 'TESE': return <Scale className="w-4 h-4 text-emerald-500" />;
            case 'DOUTRINA': return <BookOpen className="w-4 h-4 text-amber-500" />;
            case 'SUMULA': return <GraduationCap className="w-4 h-4 text-violet-500" />;
            default: return <FileText className="w-4 h-4 text-slate-400" />;
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Banco Jurídico</h1>
                    <p className="text-slate-500 font-medium">Gestão de petições, teses e inteligência jurídica do escritório.</p>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm gap-2">
                    <Plus className="w-4 h-4" />
                    Novo Documento
                </Button>
            </div>

            <Card className="p-2 border-slate-200/60 shadow-sm bg-white/50 backdrop-blur-sm rounded-2xl">
                <div className="flex flex-col md:flex-row gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input 
                            placeholder="Buscar por título ou palavra-chave..." 
                            className="pl-10 h-10 bg-white border-slate-200 rounded-xl focus-visible:ring-blue-500"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            variant="outline" 
                            className={`rounded-xl h-10 gap-2 border-slate-200 ${filterTipo === 'PETICAO' ? 'bg-blue-50 border-blue-200 text-blue-600' : ''}`}
                            onClick={() => setFilterTipo(filterTipo === 'PETICAO' ? null : 'PETICAO')}
                        >
                            <FileText className="w-4 h-4" />
                            Petições
                        </Button>
                        <Button 
                            variant="outline" 
                            className={`rounded-xl h-10 gap-2 border-slate-200 ${filterTipo === 'TESE' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : ''}`}
                            onClick={() => setFilterTipo(filterTipo === 'TESE' ? null : 'TESE')}
                        >
                            <Scale className="w-4 h-4" />
                            Teses
                        </Button>
                        <Button variant="outline" className="rounded-xl h-10 gap-2 border-slate-200" onClick={handleSearch}>
                            <Filter className="w-4 h-4 text-slate-400" />
                            Filtrar
                        </Button>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    Array(6).fill(0).map((_, i) => (
                        <Card key={i} className="h-48 animate-pulse bg-slate-50 border-slate-100 rounded-2xl" />
                    ))
                ) : documents.length > 0 ? (
                    documents.map((doc) => (
                        <Card key={doc.id} className="group p-5 bg-white border-slate-200/60 shadow-sm hover:shadow-md hover:border-blue-200 transition-all rounded-2xl flex flex-col justify-between">
                            <div className="space-y-3">
                                <div className="flex items-start justify-between">
                                    <div className={`p-2 rounded-xl bg-slate-50 group-hover:bg-blue-50 transition-colors`}>
                                        {getTipoIcon(doc.tipo)}
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400">
                                                <MoreVertical className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-xl border-slate-200 shadow-xl">
                                            <DropdownMenuItem className="gap-2 font-medium cursor-pointer">
                                                <Edit className="w-4 h-4" /> Editar
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="gap-2 font-medium cursor-pointer">
                                                <Download className="w-4 h-4" /> Exportar
                                            </DropdownMenuItem>
                                            <DropdownMenuItem className="gap-2 font-medium text-red-600 cursor-pointer" onClick={() => deleteDocument(doc.id)}>
                                                <Trash2 className="w-4 h-4" /> Excluir
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <div>
                                    <Badge variant="outline" className="mb-2 text-[10px] font-bold uppercase tracking-wider bg-slate-50 text-slate-500 border-slate-200">
                                        {doc.area_direito || 'Geral'}
                                    </Badge>
                                    <h3 className="text-base font-extrabold text-slate-700 leading-tight group-hover:text-blue-600 transition-colors line-clamp-2">
                                        {doc.titulo}
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium line-clamp-2 mt-2">
                                        {doc.descricao || "Sem descrição disponível."}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                    Autor: {doc.autor || 'Sistema'}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">
                                    {format(new Date(doc.created_at), "dd MMM yyyy", { locale: ptBR })}
                                </span>
                            </div>
                        </Card>
                    ))
                ) : (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 text-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                        <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                            <BookOpen className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-600">Nenhum documento encontrado</h3>
                        <p className="text-sm text-slate-400 max-w-xs mt-1">Comece adicionando modelos de petições ou teses ao seu banco jurídico.</p>
                        <Button variant="outline" className="mt-6 rounded-xl border-slate-200 font-bold" onClick={() => fetchDocuments()}>
                            Limpar Filtros
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BancoJuridicoPage;
