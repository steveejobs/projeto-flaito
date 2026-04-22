import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Save, Brain, AlertTriangle } from "lucide-react";
import TextareaAutosize from "react-textarea-autosize";
import { useClientStudyContext } from "@/hooks/useClientStudyContext";
import { STUDY_CONTEXT_PROMPT_FIELDS } from "@/types/clientStudyContext";
import type { ClientStudyContext } from "@/types/clientStudyContext";

interface Props {
  clientId: string;
  officeId: string;
  clientName?: string;
  isMedical?: boolean;
}

const FIELD_DESCRIPTIONS: Record<string, string> = {
  case_summary: "Resumo geral do(s) caso(s) vinculado(s) a este cliente",
  current_objective: "O que o escritório busca alcançar agora para este cliente",
  office_strategy: "Linha estratégica principal sendo seguida",
  sensitive_facts: "Fatos que exigem cuidado especial na comunicação e na condução do caso",
  opposing_counsel_profile: "Informações sobre a parte contrária, seu advogado ou perfil de atuação",
  judge_profile: "Informações relevantes sobre o juiz ou tribunal responsável",
  procedural_posture: "Estado atual do processo — fase, últimas movimentações, próximos passos",
  communication_recommendations: "Como se comunicar com o cliente ou sobre o caso",
  risk_notes: "Riscos identificados, pontos de atenção, cenários adversos",
  internal_observations: "Notas internas do time, não compartilhadas com o cliente",
  vertical_notes: "Notas específicas do contexto jurídico ou médico",
};

export function ClientStudyContextPanel({ clientId, officeId, clientName, isMedical = false }: Props) {
  const { studyContext, isLoading, isSaving, save } = useClientStudyContext(clientId, officeId);
  const [form, setForm] = useState<Partial<ClientStudyContext>>({});
  const [dirty, setDirty] = useState(false);

  // Seed form from loaded data
  useEffect(() => {
    if (studyContext) {
      setForm(studyContext);
      setDirty(false);
    }
  }, [studyContext]);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    save({
      ...form,
      vertical_type: isMedical ? "medical" : "legal",
    });
    setDirty(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const filledCount = STUDY_CONTEXT_PROMPT_FIELDS.filter(
    ({ key }) => {
      const val = form[key as keyof ClientStudyContext];
      return typeof val === "string" && val.trim().length > 0;
    }
  ).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-teal-600" />
          <CardTitle className="text-base">
            Contexto de Estudo{clientName ? ` — ${clientName}` : ""}
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {filledCount}/{STUDY_CONTEXT_PROMPT_FIELDS.length} campos
          </Badge>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!dirty || isSaving}
          className="gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? "Salvando..." : "Salvar"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex items-start gap-2 rounded-md bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 p-3 text-sm text-teal-800 dark:text-teal-200">
          <Brain className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Estes campos alimentam a <strong>Athena</strong> quando este cliente estiver selecionado.
            Apenas campos preenchidos são injetados no contexto — quanto mais preciso, melhor a assistência.
          </p>
        </div>

        {STUDY_CONTEXT_PROMPT_FIELDS.map(({ key, label }) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`ctx-${key}`} className="text-sm font-medium">
              {label}
            </Label>
            <p className="text-xs text-muted-foreground">
              {FIELD_DESCRIPTIONS[key] ?? ""}
            </p>
            <TextareaAutosize
              id={`ctx-${key}`}
              value={(form[key as keyof ClientStudyContext] as string) ?? ""}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={`Preencha o ${label.toLowerCase()}...`}
              minRows={2}
              maxRows={10}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
          </div>
        ))}

        {filledCount === 0 && (
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>Nenhum campo preenchido. A Athena usará apenas dados básicos do cliente.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
