import React from 'react';
import { useOfficeRole } from '@/hooks/useOfficeRole';
import LegalDashboard from '@/modules/legal/pages/LegalDashboard';
import MedicalDashboard from '@/modules/medical/pages/MedicalDashboard';
import { Skeleton } from '@/components/ui/skeleton';

const Dashboard = () => {
    const { module, loading } = useOfficeRole();

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

    if (module === 'MEDICAL') {
        return <MedicalDashboard />;
    }

    return <LegalDashboard />;
};

export default Dashboard;
