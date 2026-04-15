import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
    Search, 
    Plus, 
    FileText, 
    Scale, 
    Filter,
    MoreVertical,
    Trash2,
    Edit,
    BookOpen,
    CheckCircle2,
    XCircle
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useOfficeSession } from "@/hooks/useOfficeSession";
import { useOfficeKnowledge, KnowledgeItem } from "@/hooks/useOfficeKnowledge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const OfficeKnowledgePage = () => {
    const { user } = useAuth();
    const { officeId } = useOfficeSession(user?.id);
    const { items, loading, fetchItems, saveItem, deleteItem } = useOfficeKnowledge(officeId);
    
    const [search, setSearch] = useState("");
    const [filterType, setFilterType] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Partial<KnowledgeItem> | null>(null);

    const handleSearch = () => {
        fetchItems({ search, type: filterType || undefined });
    };

    const handleNew = () => {
        setEditingItem({ type: 'piece', is_active: true, tags: [] });
        setIsModalOpen(true);
    };

    const handleEdit = (item: KnowledgeItem) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!editingItem?.title || !editingItem?.type) return;
        try {
            await saveItem(editingItem);
            setIsModalOpen(false);
        } catch (error) {
            // Error managed by hook
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'piece': return <FileText className="w-4 h-4 text-blue-500" />;
            case 'thesis': return <Scale className="w-4 h-4 text-emerald-500" />;
            default: return <BookOpen className="w-4 h-4 text-slate-400" />;
        }
    };

    const getTypeName = (type: string) => {
        return type === 'piece' ? 'Peça' : 'Tese';
    };

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight">Base de Conhecimento</h1>
                    <p className="text-slate-500 font-medium">Repositório estruturado de peças e teses do escritório.</p>
                </div>
                <Button 
                    onClick={handleNew}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Novo Item
                </Button>
            </div>

            {/* Filters */}
            <Card className="p-2 border-slate-200/60 shadow-sm bg-white/50 backdrop-blur-sm rounded-2xl">
                <div className="flex flex-col md:flex-row gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input 
                            placeholder="Buscar por título ou tags..." 
                            className="pl-10 h-10 bg-white border-slate-200 rounded-xl focus-visible:ring-blue-500"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            variant="outline" 
                            className={`rounded-xl h-10 gap-2 border-slate-200 ${filterType === 'piece' ? 'bg-blue-50 border-blue-200 text-blue-600' : ''}`}
                            onClick={() => {
                                const newType = filterType === 'piece' ? null : 'piece';
                                setFilterType(newType);
                                fetchItems({ search, type: newType || undefined });
                            }}
                        >
                            <FileText className="w-4 h-4" />
                            Peças
                        </Button>
                        <Button 
                            variant="outline" 
                            className={`rounded-xl h-10 gap-2 border-slate-200 ${filterType === 'thesis' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : ''}`}
                            onClick={() => {
                                const newType = filterType === 'thesis' ? null : 'thesis';
                                setFilterType(newType);
                                fetchItems({ search, type: newType || undefined });
                            }}
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

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    Array(6).fill(0).map((_, i) => (
                        <Card key={i} className="h-48 animate-pulse bg-slate-50 border-slate-100 rounded-2xl" />
                    ))
                ) : items.length > 0 ? (
                    items.map((item) => (
                        <Card key={item.id} className="group p-5 bg-white border-slate-200/60 shadow-sm hover:shadow-md hover:border-blue-200 transition-all rounded-2xl flex flex-col justify-between">
                            <div className="space-y-3">
                                <div className="flex items-start justify-between">
                                    <div className={`p-2 rounded-xl bg-slate-50 group-hover:bg-blue-50 transition-colors`}>
                                        {getTypeIcon(item.type)}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {!item.is_active && (
                                            <Badge variant="secondary" className="text-[10px] bg-red-50 text-red-500 border-red-100">
                                                Inativo
                                            </Badge>
                                        )}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-slate-400">
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="rounded-xl border-slate-200 shadow-xl">
                                                <DropdownMenuItem className="gap-2 font-medium cursor-pointer" onClick={() => handleEdit(item)}>
                                                    <Edit className="w-4 h-4" /> Editar
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="gap-2 font-medium text-red-600 cursor-pointer" onClick={() => deleteItem(item.id)}>
                                                    <Trash2 className="w-4 h-4" /> Excluir
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                                <div>
                                    <Badge variant="outline" className="mb-2 text-[10px] font-bold uppercase tracking-wider bg-slate-50 text-slate-500 border-slate-200">
                                        {getTypeName(item.type)}
                                    </Badge>
                                    <h3 className="text-base font-extrabold text-slate-700 leading-tight group-hover:text-blue-600 transition-colors line-clamp-2">
                                        {item.title}
                                    </h3>
                                    {item.tags && item.tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {item.tags.map(tag => (
                                                <span key={tag} className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-bold">
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                    Atualizado em:
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">
                                    {format(new Date(item.updated_at), "dd MMM yyyy", { locale: ptBR })}
                                </span>
                            </div>
                        </Card>
                    ))
                ) : (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 text-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
                        <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                            <BookOpen className="w-8 h-8 text-slate-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-600">Nenhum item encontrado</h3>
                        <p className="text-sm text-slate-400 max-w-xs mt-1">Sua base de conhecimento está vazia. Comece cadastrando peças ou teses.</p>
                        <Button 
                            variant="outline" 
                            className="mt-6 rounded-xl border-slate-200 font-bold" 
                            onClick={() => {
                                setFilterType(null);
                                fetchItems();
                            }}
                        >
                            Limpar Filtros
                        </Button>
                    </div>
                )}
            </div>

            {/* Modal de Cadastro/Edição */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="sm:max-w-[600px] rounded-2xl border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-slate-800">
                            {editingItem?.id ? 'Editar Item' : 'Novo Item de Conhecimento'}
                        </DialogTitle>
                        <DialogDescription className="font-medium">
                            Preencha as informações para estruturar o conhecimento do escritório.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="type" className="font-bold text-slate-700">Tipo</Label>
                                <Select 
                                    value={editingItem?.type} 
                                    onValueChange={(v) => setEditingItem(prev => ({ ...prev, type: v as 'piece' | 'thesis' }))}
                                >
                                    <SelectTrigger className="rounded-xl bg-slate-50 border-slate-200 focus:ring-blue-500">
                                        <SelectValue placeholder="Selecione o tipo" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="piece">Peça</SelectItem>
                                        <SelectItem value="thesis">Tese</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="status" className="font-bold text-slate-700">Status</Label>
                                <Select 
                                    value={editingItem?.is_active ? 'active' : 'inactive'} 
                                    onValueChange={(v) => setEditingItem(prev => ({ ...prev, is_active: v === 'active' }))}
                                >
                                    <SelectTrigger className="rounded-xl bg-slate-50 border-slate-200 focus:ring-blue-500">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="active">Ativo</SelectItem>
                                        <SelectItem value="inactive">Inativo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="title" className="font-bold text-slate-700 text-sm">Título</Label>
                            <Input
                                id="title"
                                placeholder="Ex: Petição Inicial - Revisional de Alimentos"
                                className="rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
                                value={editingItem?.title || ""}
                                onChange={(e) => setEditingItem(prev => ({ ...prev, title: e.target.value }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="tags" className="font-bold text-slate-700 text-sm">Tags (separadas por vírgula)</Label>
                            <Input
                                id="tags"
                                placeholder="alimentos, revisional, familia"
                                className="rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
                                value={editingItem?.tags?.join(', ') || ""}
                                onChange={(e) => setEditingItem(prev => ({ ...prev, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="content" className="font-bold text-slate-700 text-sm">Conteúdo (Markdown)</Label>
                            <Textarea
                                id="content"
                                placeholder="Insira o texto completo da peça ou fundamentação da tese..."
                                className="min-h-[250px] rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-blue-500 font-mono text-sm"
                                value={editingItem?.content || ""}
                                onChange={(e) => setEditingItem(prev => ({ ...prev, content: e.target.value }))}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button 
                            variant="ghost" 
                            onClick={() => setIsModalOpen(false)}
                            className="rounded-xl font-bold text-slate-500"
                        >
                            Cancelar
                        </Button>
                        <Button 
                            onClick={handleSave}
                            disabled={!editingItem?.title || !editingItem?.type}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl px-8"
                        >
                            Salvar Alterações
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default OfficeKnowledgePage;
