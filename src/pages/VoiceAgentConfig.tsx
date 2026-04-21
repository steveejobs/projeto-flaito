import { VoiceSettingsCard } from "@/components/VoiceSettingsCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useVoiceAgent } from "@/contexts/VoiceAgentContext";
import { Mic, Volume2, Shield, Activity, Eye, Zap } from "lucide-react";

export default function VoiceAgentConfig() {
  const { isActive, state, mode, isBrowserSupported } = useVoiceAgent();

  const getModeLabel = () => {
    switch (mode) {
      case 'consultation': return { label: 'Consulta', icon: Eye, color: 'text-blue-500' };
      case 'assisted': return { label: 'Assistido', icon: Activity, color: 'text-green-500' };
      case 'critical': return { label: 'Critico', icon: Shield, color: 'text-red-500' };
      default: return { label: 'Automatico', icon: Zap, color: 'text-amber-500' };
    }
  };

  const modeInfo = getModeLabel();

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Mic className="h-5 w-5 text-primary" />
          </div>
          Configuracao do Agente de Voz
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure a voz, modo de operacao e ativacao do assistente de voz.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Status do Agente</CardTitle>
          <CardDescription>Estado atual do agente de voz nesta sessao.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge variant={isActive ? "default" : "secondary"}>
              {isActive ? "Ativo" : "Inativo"}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <modeInfo.icon className={`h-3 w-3 ${modeInfo.color}`} />
              {modeInfo.label}
            </Badge>
            {!isBrowserSupported && (
              <Badge variant="destructive">Navegador nao suportado</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              Estado: {state}
            </span>
          </div>
        </CardContent>
      </Card>

      <VoiceSettingsCard />
    </div>
  );
}
