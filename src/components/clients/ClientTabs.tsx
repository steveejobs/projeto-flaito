import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export type TabValue = "dados" | "casos" | "kit" | "arquivos" | "timeline" | "timeline_360" | "whatsapp" | "agente";

type Props = {
  value: TabValue;
  onValueChange: (v: TabValue) => void;
  casesCount?: number;
  docsCount?: number;
  filesCount?: number;
  timelineCount?: number;
};

function CountBadge({ n }: { n?: number }) {
  if (!n || n <= 0) return null;
  return (
    <Badge variant="secondary" className="ml-2 h-5 px-2 text-[11px] font-medium">
      {n}
    </Badge>
  );
}

export function ClientTabs({
  value,
  onValueChange,
  casesCount = 0,
  docsCount = 0,
  filesCount = 0,
  timelineCount = 0,
}: Props) {
  return (
    <Tabs value={value} onValueChange={(v) => onValueChange(v as TabValue)} className="w-full">
      <TabsList className="w-full justify-start border-b bg-transparent p-0 h-auto gap-4 md:gap-6 rounded-none overflow-x-auto">
        <TabsTrigger
          value="dados"
          className="px-1 pb-3 pt-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:font-semibold text-sm"
        >
          Dados
        </TabsTrigger>

        <TabsTrigger
          value="casos"
          className="px-1 pb-3 pt-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:font-semibold text-sm flex items-center"
        >
          Casos <CountBadge n={casesCount} />
        </TabsTrigger>

        <TabsTrigger
          value="kit"
          className="px-1 pb-3 pt-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:font-semibold text-sm flex items-center"
        >
          Kit <CountBadge n={docsCount} />
        </TabsTrigger>

        <TabsTrigger
          value="arquivos"
          className="px-1 pb-3 pt-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:font-semibold text-sm flex items-center"
        >
          Arquivos <CountBadge n={filesCount} />
        </TabsTrigger>

        <TabsTrigger
          value="timeline"
          className="px-1 pb-3 pt-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:font-semibold text-sm flex items-center"
        >
          Timeline <CountBadge n={timelineCount} />
        </TabsTrigger>

        <TabsTrigger
          value="timeline_360"
          className="px-1 pb-3 pt-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:font-semibold text-sm flex items-center text-teal-600 dark:text-teal-400"
        >
          Histórico 360
        </TabsTrigger>
        
        <TabsTrigger
          value="whatsapp"
          className="px-1 pb-3 pt-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:font-semibold text-sm flex items-center text-emerald-600 dark:text-emerald-400"
        >
          WhatsApp
        </TabsTrigger>

        <TabsTrigger
          value="agente"
          className="px-1 pb-3 pt-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:font-semibold text-sm flex items-center text-violet-600 dark:text-violet-400"
        >
          Agente IA
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export default ClientTabs;
