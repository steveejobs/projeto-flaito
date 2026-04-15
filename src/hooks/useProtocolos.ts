import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

export const useProtocolos = (_pacienteId?: string, _officeId?: string) => {
    const [protocolos, setProtocolos] = useState<any[]>([]);
    const [dietas, setDietas] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchProtocolos = async () => {
        console.warn("useProtocolos: protocolos_terapeuticos table no longer exists in schema");
        toast({
            title: 'Módulo indisponível',
            description: 'A tabela de protocolos terapêuticos não existe mais no banco de dados.',
            variant: 'destructive',
        });
        setProtocolos([]);
    };

    const fetchDietas = async () => {
        console.warn("useProtocolos: receitas_dietas table no longer exists in schema");
        toast({
            title: 'Módulo indisponível',
            description: 'A tabela de receitas/dietas não existe mais no banco de dados.',
            variant: 'destructive',
        });
        setDietas([]);
    };

    const saveProtocolo = async (_dados: unknown) => {
        console.warn("useProtocolos: saveProtocolo disabled — table removed");
        return null;
    };

    const saveDieta = async (_dados: unknown) => {
        console.warn("useProtocolos: saveDieta disabled — table removed");
        return null;
    };

    return {
        protocolos,
        dietas,
        loading,
        fetchProtocolos,
        fetchDietas,
        saveProtocolo,
        saveDieta
    };
};
