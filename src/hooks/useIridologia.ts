import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

export const useIridologia = (_pacienteId?: string, _officeId?: string) => {
    const [avaliacoes, setAvaliacoes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchAvaliacoes = async () => {
        console.warn("useIridologia: iris_analyses table no longer exists in schema");
        toast({
            title: 'Módulo indisponível',
            description: 'A tabela de análises de íris não existe mais no banco de dados.',
            variant: 'destructive',
        });
        setAvaliacoes([]);
    };

    const saveAvaliacao = async (_dados: unknown) => {
        console.warn("useIridologia: saveAvaliacao disabled — table removed");
        return null;
    };

    const saveLaudo = async (_laudo: unknown) => {
        console.warn("useIridologia: saveLaudo disabled — table removed");
        return null;
    };

    return { avaliacoes, loading, fetchAvaliacoes, saveAvaliacao, saveLaudo };
};
