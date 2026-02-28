import { useState, useEffect } from "react";
import { CaseKnowledgePanel } from "@/features/cases/CaseKnowledgePanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Briefcase, FileQuestion } from "lucide-react";

interface CaseOption {
  id: string;
  title: string;
  area?: string | null;
  subtype?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nija_full_analysis?: any;
}

type Mode = "by-case" | "loose";

export default function Knowledge() {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("by-case");
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");

  useEffect(() => {
    if (mode === "by-case") {
      loadCases();
    }
  }, [mode]);

  const loadCases = async () => {
    setCasesLoading(true);
    try {
      const { data, error } = await supabase
        .from("cases")
        .select("id, title, area, subtype, nija_full_analysis")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setCases(data || []);
    } catch (err: any) {
      toast({
        title: "Erro ao carregar casos",
        description: err?.message,
        variant: "destructive",
      });
    } finally {
      setCasesLoading(false);
    }
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    if (newMode === "loose") {
      setSelectedCaseId(null);
      setSubject("");
    }
  };

  // Auto-preencher subject quando caso é selecionado
  useEffect(() => {
    if (!selectedCaseId || mode !== "by-case") return;

    const selectedCase = cases.find((c) => c.id === selectedCaseId);
    if (!selectedCase) return;

    let autoSubject = "";

    // Prioridade: nija.meta.assunto > nija.meta.ramo > area+subtype > título do caso
    const nija = selectedCase.nija_full_analysis;
    const nijaAssunto = nija?.meta?.assunto;
    const nijaRamo = nija?.meta?.ramo;

    if (nijaAssunto) {
      autoSubject = nijaAssunto;
    } else if (nijaRamo) {
      autoSubject = nijaRamo;
    } else if (selectedCase.area) {
      autoSubject = selectedCase.subtype
        ? `${selectedCase.area} - ${selectedCase.subtype}`
        : selectedCase.area;
    } else if (selectedCase.title) {
      // Fallback: usar título do caso (removendo prefixos comuns)
      autoSubject = selectedCase.title
        .replace(/^NIJA\s*[–-]\s*/i, "")
        .replace(/^Análise solta\s*[–-]\s*/i, "")
        .trim();
    }

    setSubject(autoSubject);
  }, [selectedCaseId, cases, mode]);

  const effectiveCaseId = mode === "by-case" ? selectedCaseId : null;

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Conhecimento do Caso</h1>
            <p className="text-muted-foreground">
              Busque precedentes, vídeos e trilhas de aprendizado
            </p>
          </div>
        </div>

        {/* Mode Selector */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Modo de Análise</CardTitle>
            <CardDescription>
              Escolha entre vincular a um caso ou realizar uma análise solta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup
              value={mode}
              onValueChange={(v) => handleModeChange(v as Mode)}
              className="flex flex-col sm:flex-row gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="by-case" id="by-case" />
                <Label htmlFor="by-case" className="flex items-center gap-2 cursor-pointer">
                  <Briefcase className="h-4 w-4" />
                  Por Caso
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="loose" id="loose" />
                <Label htmlFor="loose" className="flex items-center gap-2 cursor-pointer">
                  <FileQuestion className="h-4 w-4" />
                  Análise Solta
                </Label>
              </div>
            </RadioGroup>

            {mode === "by-case" && (
              <div className="space-y-2">
                <Label>Selecione o Caso</Label>
                {casesLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select
                    value={selectedCaseId || ""}
                    onValueChange={(v) => setSelectedCaseId(v || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um caso..." />
                    </SelectTrigger>
                    <SelectContent>
                      {cases.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Knowledge Panel */}
        <CaseKnowledgePanel
          caseId={effectiveCaseId}
          subject={subject}
          onSubjectChange={setSubject}
        />
      </div>
  );
}
