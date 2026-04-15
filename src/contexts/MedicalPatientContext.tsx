import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useOfficeSession } from '@/hooks/useOfficeSession';
import { useAuth } from '@/contexts/AuthContext';

export interface MedicalActivePatient {
    id: string;
    nome: string;
    cpf?: string | null;
    telefone?: string | null;
}

interface MedicalPatientContextType {
    activePatient: MedicalActivePatient | null;
    setActivePatient: (patient: MedicalActivePatient | null) => void;
    clearActivePatient: () => void;
}

const MedicalPatientContext = createContext<MedicalPatientContextType | undefined>(undefined);

export function MedicalPatientProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const officeSession = useOfficeSession(user?.id);
    const officeId = officeSession.officeId;

    const [activePatient, setActivePatientState] = useState<MedicalActivePatient | null>(null);

    // Load from sessionStorage on init, isolating by officeId if necessary
    useEffect(() => {
        if (!officeId) return;
        
        try {
            const stored = sessionStorage.getItem(`medical_active_patient_${officeId}`);
            if (stored) {
                setActivePatientState(JSON.parse(stored));
            }
        } catch (e) {
            console.error("Error parsing medical active patient from session storage", e);
        }
    }, [officeId]);

    const setActivePatient = (patient: MedicalActivePatient | null) => {
        setActivePatientState(patient);
        if (officeId) {
            if (patient) {
                sessionStorage.setItem(`medical_active_patient_${officeId}`, JSON.stringify(patient));
            } else {
                sessionStorage.removeItem(`medical_active_patient_${officeId}`);
            }
        }
    };

    const clearActivePatient = () => {
        setActivePatient(null);
    };

    return (
        <MedicalPatientContext.Provider value={{ activePatient, setActivePatient, clearActivePatient }}>
            {children}
        </MedicalPatientContext.Provider>
    );
}

export function useMedicalPatient() {
    const context = useContext(MedicalPatientContext);
    if (!context) {
        throw new Error('useMedicalPatient must be used within a MedicalPatientProvider');
    }
    return context;
}
