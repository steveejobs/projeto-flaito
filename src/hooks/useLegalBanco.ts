import { useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

export const useLegalBanco = (_officeId?: string) => {
    const [documents, setDocuments] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchDocuments = async (_filters: Record<string, unknown> = {}) => {
        console.warn("useLegalBanco: banco_juridico table no longer exists in schema");
        setDocuments([]);
    };

    const saveDocument = async (_doc: unknown) => {
        console.warn("useLegalBanco: saveDocument disabled — table removed");
        return null;
    };

    const deleteDocument = async (_id: string) => {
        console.warn("useLegalBanco: deleteDocument disabled — table removed");
    };

    useEffect(() => {
    }, []);

    return { documents, loading, fetchDocuments, saveDocument, deleteDocument };
};
