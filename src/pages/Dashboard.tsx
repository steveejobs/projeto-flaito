import React, { useState, useEffect } from 'react';
import { useOfficeRole } from '@/hooks/useOfficeRole';
import LegalDashboard from '@/modules/legal/pages/LegalDashboard';
import MedicalDashboard from '@/modules/medicina/MedicalDashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { Scale, Stethoscope } from 'lucide-react';

type DashboardTab = 'LEGAL' | 'MEDICAL';

const Dashboard = () => {
    const { module, loading } = useOfficeRole();
    const [activeTab, setActiveTab] = useState<DashboardTab>('LEGAL');

    // Sincroniza a aba ativa com o módulo do usuário após carregar
    useEffect(() => {
        if (!loading) {
            setActiveTab(module === 'MEDICAL' ? 'MEDICAL' : 'LEGAL');
        }
    }, [loading, module]);

    if (loading) {
        return (
            <div className="p-8 space-y-6">
                <div className="space-y-2">
                    <Skeleton className="h-10 w-[200px]" />
                    <Skeleton className="h-4 w-[300px]" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-32 w-full" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Skeleton className="h-[400px] lg:col-span-2 w-full" />
                    <Skeleton className="h-[400px] w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-background">
            {/* Barra de abas */}
            <div className="px-4 md:px-6 lg:px-8 pt-4 pb-0">
                <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <button
                        onClick={() => setActiveTab('LEGAL')}
                        className={`
                            inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                            transition-all duration-200 ease-out
                            ${activeTab === 'LEGAL'
                                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                            }
                        `}
                    >
                        <Scale className="h-4 w-4" />
                        Jurídico
                    </button>
                    <button
                        onClick={() => setActiveTab('MEDICAL')}
                        className={`
                            inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                            transition-all duration-200 ease-out
                            ${activeTab === 'MEDICAL'
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                            }
                        `}
                    >
                        <Stethoscope className="h-4 w-4" />
                        Médico
                    </button>
                </div>
            </div>

            {/* Conteúdo do dashboard */}
            <div className="flex-1">
                {activeTab === 'MEDICAL' ? <MedicalDashboard /> : <LegalDashboard />}
            </div>
        </div>
    );
};

export default Dashboard;
