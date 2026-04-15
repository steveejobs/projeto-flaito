import React, { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { type Database } from "@/types/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useOfficeRole } from "@/hooks/useOfficeRole";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Users,
    Plus,
    Search,
    Phone,
    Mail,
    Calendar,
    Eye,
    MoreHorizontal,
    UserPlus,
    Filter,
    ArrowUpDown,
    ShieldCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PatientDocumentIntake } from "../components/PatientDocumentIntake";
import { PatientExtractionReview } from "../components/PatientExtractionReview";
import { type PatientExtractionResult } from "@/hooks/usePatientExtraction";
import { type PacienteUnified } from "@/types/medical";
import { FileSearch } from "lucide-react";

const statusColors: Record<string, string> = {
    ativo: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    inativo: 'bg-amber-50 text-amber-700 border-amber-200',
    arquivado: 'bg-slate-100 text-slate-600 border-slate-200',
};

const PacientesPage = () => {
    const navigate = useNavigate();
    const { officeId } = useOfficeRole();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('todos');
    const [cadastroOpen, setCadastroOpen] = useState(false);
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [pacientes, setPacientes] = useState<PacienteUnified[]>([]);

    // Form states
    const [formData, setFormData] = useState({
        full_name: '',
        cpf: '',
        birth_date: '',
        gender: '',
        phone: '',
        email: '',
        address_line: '',
        clinical_notes: '',
        alergias: '',
        medicamentos: ''
    });

    // Intake Flow States
    const [intakeStep, setIntakeStep] = useState<"upload" | "review" | "manual">("manual");
    const [currentExtraction, setCurrentExtraction] = useState<{ documentId: string; extractionId: string; extraction: any } | null>(null);

    const resetForm = () => {
        setFormData({
            full_name: '',
            cpf: '',
            birth_date: '',
            gender: '',
            phone: '',
            email: '',
            address_line: '',
            clinical_notes: '',
            alergias: '',
            medicamentos: ''
        });
    };

    const fetchPacientes = async () => {
        if (!officeId) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('v_pacientes_unified')
                .select('*')
                .eq('office_id', officeId)
                .order('created_at', { ascending: false });

            if (data) {
                // Mapear de volta para o formato esperado pelo componente se necessário
                // v_pacientes_unified usa 'paciente_id' como alias para 'p.id' na migration 20260319
                // Vamos garantir que o 'id' esteja presente
                const mappedData: PacienteUnified[] = data.map((p) => ({
                    ...p,
                    id: p.paciente_id || ''
                }));
                setPacientes(mappedData);
            }
        } catch (error) {
            console.error("Erro ao buscar pacientes:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPacientes();
    }, [officeId]);

    const filtered = pacientes.filter((p) => {
        const pEmail = p.email || '';
        const pCpf = p.cpf || '';
        const pFullName = p.full_name || p.nome || '';
        const matchSearch =
            pFullName.toLowerCase().includes(search.toLowerCase()) ||
            pCpf.includes(search) ||
            pEmail.toLowerCase().includes(search.toLowerCase());
        const matchStatus = statusFilter === 'todos' || p.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const handleSavePaciente = async () => {
        if (!formData.full_name) {
            alert("Nome é obrigatório");
            return;
        }

        if (!officeId) {
            console.error("Office ID não encontrado");
            return;
        }

        setIsSaving(true);
        try {
            // 1. Verificar se o cliente já existe (por CPF ou Email) no escritório
            let clientId: string | null = null;
            
            if (formData.cpf || formData.email) {
                let query = supabase
                    .from('clients')
                    .select('id')
                    .eq('office_id', officeId);
                
                if (formData.cpf) {
                    query.eq('cpf', formData.cpf);
                } else {
                    query.eq('email', formData.email);
                }
                
                const { data: existingClient } = await query.maybeSingle();
                if (existingClient) clientId = existingClient.id;
            }

            // 2. Criar ou atualizar biometria na tabela 'clients' (SSOT)
            const clientPayload = {
                full_name: formData.full_name,
                cpf: formData.cpf || null,
                email: formData.email || null,
                phone: formData.phone || null,
                address_line: formData.address_line || null,
                office_id: officeId,
                status: 'active'
            };

            let clientData;
            if (clientId) {
                const { data: updated, error: updateError } = await supabase
                    .from('clients')
                    .update(clientPayload)
                    .eq('id', clientId)
                    .select()
                    .single();
                if (updateError) throw updateError;
                clientData = updated;
            } else {
                const { data: created, error: insertError } = await supabase
                    .from('clients')
                    .insert(clientPayload)
                    .select()
                    .single();
                if (insertError) throw insertError;
                clientData = created;
            }

            // 3. Criar ou atualizar extensão clínica na tabela 'pacientes'
            const clinicalPayload = {
                client_id: clientData.id,
                office_id: officeId,
                full_name: formData.full_name,
                cpf: formData.cpf || null,
                phone: formData.phone || null,
                email: formData.email || null,
                birth_date: formData.birth_date || null,
                gender: formData.gender || null,
                clinical_notes: formData.clinical_notes || null,
                alergias: formData.alergias || null,
                medicamentos_em_uso: formData.medicamentos || null
            };

            // Verificar se já existe entrada em pacientes para este client_id
            const { data: existingPaciente } = await supabase
                .from('pacientes')
                .select('id')
                .eq('client_id', clientData.id)
                .maybeSingle();

            if (existingPaciente) {
                const { error: updatePError } = await supabase
                    .from('pacientes')
                    .update(clinicalPayload)
                    .eq('id', existingPaciente.id);
                if (updatePError) throw updatePError;
            } else {
                const { error: insertPError } = await supabase
                    .from('pacientes')
                    .insert(clinicalPayload);
                if (insertPError) throw insertPError;
            }

            // 4. Se veio de uma extração, vincular o documento ao paciente criado
            if (currentExtraction) {
                await supabase
                    .from('patient_documents')
                    .update({ patient_id: existingPaciente?.id || null })
                    .eq('id', currentExtraction.documentId);
            }

            // Sucesso!
            setCadastroOpen(false);
            resetForm();
            fetchPacientes(); // Atualiza a lista
            
            // Note: In production use a real Toast component
            console.log("Paciente salvo com sucesso!");
        } catch (error: any) {
            console.error("Erro ao salvar paciente:", error);
            alert("Erro ao salvar paciente: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-700 bg-[#FAFAFA] min-h-screen text-slate-800 font-inter">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-800">
                        Pacientes
                    </h1>
                    <p className="text-sm text-slate-500 font-medium">
                        Gestão completa de pacientes — cadastro, histórico e acompanhamento.
                    </p>
                </div>
                <Dialog open={cadastroOpen} onOpenChange={(open) => {
                    setCadastroOpen(open);
                    if (!open) {
                        setIntakeStep("manual");
                        setCurrentExtraction(null);
                    }
                }}>
                    <div className="flex gap-2">
                        <Button 
                            variant="outline"
                            className="gap-2 h-11 px-5 rounded-xl border-teal-200 text-teal-700 hover:bg-teal-50 transition-all hover:scale-105 active:scale-95 text-sm font-bold"
                            onClick={() => {
                                setIntakeStep("upload");
                                setCadastroOpen(true);
                            }}
                        >
                            <FileSearch className="h-4 w-4" />
                            Cadastrar via Documento
                        </Button>

                        <Button 
                            className="gap-2 h-11 px-5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-all hover:scale-105 active:scale-95 text-sm font-bold"
                            onClick={() => {
                                setIntakeStep("manual");
                                setCadastroOpen(true);
                            }}
                        >
                            <UserPlus className="h-4 w-4" />
                            Novo Paciente
                        </Button>
                    </div>

                    <DialogContent className={`max-h-[90vh] overflow-y-auto bg-white border border-gray-100 shadow-2xl rounded-2xl p-6 transition-all duration-500 
                        ${intakeStep === 'review' ? 'max-w-5xl' : 'max-w-3xl'}`}>
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                {intakeStep === 'upload' && <FileSearch className="h-5 w-5 text-teal-600" />}
                                {intakeStep === 'review' && <ShieldCheck className="h-5 w-5 text-teal-600" />}
                                {intakeStep === 'manual' && <UserPlus className="h-5 w-5 text-teal-600" />}
                                {intakeStep === 'upload' ? 'Extração Inteligente de Documento' : 
                                 intakeStep === 'review' ? 'Revisão de Dados' : 'Cadastrar Paciente'}
                            </DialogTitle>
                        </DialogHeader>

                                {intakeStep === 'upload' && (
                                    <PatientDocumentIntake 
                                        onExtractionComplete={(res) => {
                                            setCurrentExtraction(res);
                                            setIntakeStep("review");
                                        }}
                                        onCancel={() => setCadastroOpen(false)}
                                    />
                                )}

                                {intakeStep === 'review' && currentExtraction && (
                                    <PatientExtractionReview 
                                        extraction={currentExtraction.extraction}
                                        extractionId={currentExtraction.extractionId}
                                        documentId={currentExtraction.documentId}
                                        onBack={() => setIntakeStep("upload")}
                                        onConfirm={(confirmed) => {
                                            setFormData?.({
                                                ...formData,
                                                full_name: confirmed.full_name,
                                                cpf: confirmed.cpf,
                                                birth_date: confirmed.birth_date,
                                                address_line: `${confirmed.endereco_logradouro}, ${confirmed.endereco_numero} - ${confirmed.endereco_bairro}, ${confirmed.endereco_cidade} - ${confirmed.endereco_uf}`,
                                            } as any);
                                            setIntakeStep("manual");
                                            fetchPacientes(); // Atualiza pois o COMMIT_INTAKE já salvou se for paciente existente
                                        }}
                                    />
                                )}

                                {intakeStep === 'manual' && (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                            {/* Campos originais do formulário permanecem aqui, agora pré-preenchidos */}
                                            <div className="md:col-span-2">
                                                <Label>Nome Completo *</Label>
                                                <Input 
                                                    placeholder="Ex: Maria Silva Santos" 
                                                    className="mt-1" 
                                                    value={formData.full_name}
                                                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                                                />
                                            </div>
                                            <div>
                                                <Label>CPF</Label>
                                                <Input 
                                                    placeholder="000.000.000-00" 
                                                    className="mt-1" 
                                                    value={formData.cpf}
                                                    onChange={(e) => setFormData({...formData, cpf: e.target.value})}
                                                />
                                            </div>
                                            <div>
                                                <Label>Data de Nascimento</Label>
                                                <Input 
                                                    type="date" 
                                                    className="mt-1" 
                                                    value={formData.birth_date}
                                                    onChange={(e) => setFormData({...formData, birth_date: e.target.value})}
                                                />
                                            </div>
                                            {/* ... outros campos ... */}
                                        </div>
                                    </>
                                )}
                                
                                {intakeStep === 'manual' && (
                                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                                        <Button variant="outline" onClick={() => setCadastroOpen(false)} className="rounded-xl border-gray-200 text-slate-700 hover:bg-slate-50">
                                            Cancelar
                                        </Button>
                                        <Button 
                                            className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-sm"
                                            onClick={handleSavePaciente}
                                            disabled={isSaving}
                                        >
                                            {isSaving ? "Salvando..." : "Salvar Paciente"}
                                        </Button>
                                    </div>
                                )}
                            </DialogContent>
                        </Dialog>
            </header>

            {/* Filters */}
            <Card className="p-4 bg-white border border-gray-100 shadow-sm rounded-2xl">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por nome, CPF ou e-mail..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 h-11 rounded-xl border-gray-200 bg-slate-50 focus-visible:ring-teal-500 hover:border-gray-300 transition-colors"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full md:w-[200px] h-11 rounded-xl border-gray-200 bg-slate-50 hover:border-gray-300 transition-colors text-slate-700 font-medium">
                            <Filter className="h-4 w-4 mr-2 text-slate-400" />
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-gray-100 shadow-lg">
                            <SelectItem value="todos">Todos os Status</SelectItem>
                            <SelectItem value="ativo">Ativos</SelectItem>
                            <SelectItem value="inativo">Inativos</SelectItem>
                            <SelectItem value="arquivado">Arquivados</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <Card className="p-5 flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-md transition-all group">
                    <div className="p-3 bg-blue-50 rounded-xl group-hover:scale-110 transition-transform">
                        <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Total</p>
                        <p className="text-2xl font-black text-slate-800 tracking-tight">{pacientes.length}</p>
                    </div>
                </Card>
                <Card className="p-5 flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-md transition-all group">
                    <div className="p-3 bg-emerald-50 rounded-xl group-hover:scale-110 transition-transform">
                        <Users className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Ativos</p>
                        <p className="text-2xl font-black text-slate-800 tracking-tight">{pacientes.filter(p => p.status === 'ativo').length}</p>
                    </div>
                </Card>
                <Card className="p-5 flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-md transition-all group">
                    <div className="p-3 bg-amber-50 rounded-xl group-hover:scale-110 transition-transform">
                        <Users className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Inativos</p>
                        <p className="text-2xl font-black text-slate-800 tracking-tight">{pacientes.filter(p => p.status === 'inativo').length}</p>
                    </div>
                </Card>
                <Card className="p-5 flex items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] hover:shadow-md transition-all group">
                    <div className="p-3 bg-cyan-50 rounded-xl group-hover:scale-110 transition-transform">
                        <Calendar className="h-5 w-5 text-cyan-600" />
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Consultas Hoje</p>
                        <p className="text-2xl font-black text-slate-800 tracking-tight">3</p>
                    </div>
                </Card>
            </div>

            {/* Table */}
            <Card className="bg-white border border-gray-100 shadow-sm overflow-hidden rounded-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/50">
                            <tr className="border-b border-gray-100">
                                <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-widest">
                                    <button className="flex items-center gap-1 hover:text-slate-800 transition-colors">
                                        Paciente <ArrowUpDown className="h-3 w-3" />
                                    </button>
                                </th>
                                <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-widest hidden md:table-cell">CPF</th>
                                <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-widest hidden lg:table-cell">Contato</th>
                                <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-widest hidden lg:table-cell">Última Consulta</th>
                                <th className="text-left p-4 text-xs font-semibold text-slate-500 uppercase tracking-widest">Status</th>
                                <th className="text-right p-4 text-xs font-semibold text-slate-500 uppercase tracking-widest">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((pac) => (
                                <tr
                                    key={pac.id}
                                    className="border-b border-gray-50 hover:bg-slate-50 transition-colors cursor-pointer group"
                                    onClick={() => navigate(`/medical/patients/${pac.id}`)}
                                >
                                    <td className="p-4">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-700 font-bold text-sm shadow-sm">
                                                {(pac.full_name || pac.nome || 'P').split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800">{pac.full_name || pac.nome}</p>
                                                <p className="text-xs text-slate-500 font-medium mt-0.5">
                                                    {(pac.gender || pac.sexo) === 'M' ? 'Masculino' : (pac.gender || pac.sexo) === 'F' ? 'Feminino' : (pac.gender || pac.sexo) || 'Não informado'} 
                                                    {(pac.birth_date || pac.data_nascimento) && ` • ${new Date().getFullYear() - new Date(pac.birth_date || pac.data_nascimento).getFullYear()} anos`}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-slate-600 font-medium hidden md:table-cell">{pac.cpf}</td>
                                    <td className="p-4 hidden lg:table-cell">
                                        <div className="space-y-1.5">
                                            <p className="text-xs text-slate-600 font-medium flex items-center gap-2">
                                                <Phone className="h-3.5 w-3.5 text-slate-400" /> {pac.phone || pac.telefone}
                                            </p>
                                            <p className="text-xs text-slate-600 font-medium flex items-center gap-2">
                                                <Mail className="h-3.5 w-3.5 text-slate-400" /> {pac.email}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-slate-600 font-medium hidden lg:table-cell">
                                        {pac.ultima_consulta
                                            ? new Date(pac.ultima_consulta).toLocaleDateString('pt-BR')
                                            : '—'}
                                    </td>
                                    <td className="p-4">
                                        <Badge variant="outline" className={statusColors[pac.status]}>
                                            {pac.status.charAt(0).toUpperCase() + pac.status.slice(1)}
                                        </Badge>
                                    </td>
                                    <td className="p-4 text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-teal-600 hover:bg-teal-50"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/medical/patients/${pac.id}`);
                                            }}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filtered.length === 0 && (
                    <div className="p-16 text-center text-slate-500">
                        <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                        <p className="text-lg font-bold text-slate-700">Nenhum paciente encontrado</p>
                        <p className="text-sm mt-1">Tente ajustar os filtros ou cadastre um novo paciente.</p>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default PacientesPage;
