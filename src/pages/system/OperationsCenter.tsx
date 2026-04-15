import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, AlertCircle, Search, Settings2, Database, History } from "lucide-react";
import OverviewTab from "@/features/operations/components/OverviewTab";
import ServiceHealthTab from "@/features/operations/components/ServiceHealthTab";
import ActiveIncidentsTab from "@/features/operations/components/ActiveIncidentsTab";
import PendingStatesTab from "@/features/operations/components/PendingStatesTab";
import ReconciliationConsoleTab from "@/features/operations/components/ReconciliationConsoleTab";

export default function OperationsCenter() {
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-8 w-8 text-primary" />
            Operations Control Center
          </h1>
          <p className="text-muted-foreground">
            Monitoramento SRE, Incidentes e Reconciliação de Produção.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono bg-muted p-2 rounded border">
          <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          SYSTEM_LIVE: {new Date().toLocaleTimeString()}
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-6 h-auto gap-1 bg-transparent p-0">
          <TabsTrigger value="overview" className="data-[state=active]:bg-muted flex items-center gap-2">
            <Activity className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="services" className="data-[state=active]:bg-muted flex items-center gap-2">
            <Database className="h-4 w-4" /> Serviços
          </TabsTrigger>
          <TabsTrigger value="incidents" className="data-[state=active]:bg-muted flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Incidentes
          </TabsTrigger>
          <TabsTrigger value="pending" className="data-[state=active]:bg-muted flex items-center gap-2">
            <History className="h-4 w-4" /> Pendências
          </TabsTrigger>
          <TabsTrigger value="reconciliation" className="data-[state=active]:bg-muted flex items-center gap-2">
            <Settings2 className="h-4 w-4" /> Reconciliador
          </TabsTrigger>
          <TabsTrigger value="trace" className="data-[state=active]:bg-muted flex items-center gap-2">
            <Search className="h-4 w-4" /> Trace
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 outline-none">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="services" className="space-y-4 outline-none">
          <ServiceHealthTab />
        </TabsContent>

        <TabsContent value="incidents" className="space-y-4 outline-none">
          <ActiveIncidentsTab />
        </TabsContent>

        <TabsContent value="pending" className="space-y-4 outline-none">
          <PendingStatesTab />
        </TabsContent>

        <TabsContent value="reconciliation" className="space-y-4 outline-none">
          <ReconciliationConsoleTab />
        </TabsContent>

        <TabsContent value="trace" className="space-y-4 outline-none">
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-lg bg-muted/20">
             <Search className="h-10 w-10 text-muted-foreground mb-4 opacity-20" />
             <h3 className="text-lg font-semibold">Trace Explorer</h3>
             <p className="text-sm text-muted-foreground">Previsto para a Sprint 3. Rastreamento por Correlation ID.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
