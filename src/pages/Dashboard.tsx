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
            {/* Barra de abas (Context Switcher Premium) */}
            <div className="px-4 md:px-6 lg:px-8 pt-4 pb-2 relative z-20">
                <div className="inline-flex items-center p-1 rounded-xl bg-black/40 border border-white/5 backdrop-blur-xl shadow-lg">
                    <button
                        onClick={() => setActiveTab('LEGAL')}
                        className={`
                            relative flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs font-bold tracking-[0.15em]
                            transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-hidden
                            ${activeTab === 'LEGAL'
                                ? 'text-primary'
                                : 'text-muted-foreground hover:text-white hover:bg-white/5'
                            }
                        `}
                    >
                        {activeTab === 'LEGAL' && (
                            <div className="absolute inset-0 bg-primary/10 backdrop-blur-md rounded-lg" />
                        )}
                        {activeTab === 'LEGAL' && (
                            <div className="absolute inset-0 border border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.1)] rounded-lg opacity-100" />
                        )}
                        <Scale className={`h-3.5 w-3.5 relative z-10 ${activeTab === 'LEGAL' ? 'drop-shadow-[0_0_8px_rgba(var(--primary),0.8)]' : ''}`} />
                        <span className="relative z-10">JURÍDICO</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('MEDICAL')}
                        className={`
                            relative flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-xs font-bold tracking-[0.15em]
                            transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-hidden
                            ${activeTab === 'MEDICAL'
                                ? 'text-blue-400'
                                : 'text-muted-foreground hover:text-white hover:bg-white/5'
                            }
                        `}
                    >
                        {activeTab === 'MEDICAL' && (
                            <div className="absolute inset-0 bg-blue-500/10 backdrop-blur-md rounded-lg" />
                        )}
                        {activeTab === 'MEDICAL' && (
                            <div className="absolute inset-0 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)] rounded-lg opacity-100" />
                        )}
                        <Stethoscope className={`h-3.5 w-3.5 relative z-10 ${activeTab === 'MEDICAL' ? 'drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]' : ''}`} />
                        <span className="relative z-10">MÉDICO</span>
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
