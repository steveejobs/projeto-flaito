import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

interface CaseStageSelectProps {
  caseId: string;
  value: string;
  onChange: (stage: string) => void;
  disabled?: boolean;
}

export function CaseStageSelect({
  caseId,
  value,
  onChange,
  disabled,
}: CaseStageSelectProps) {
  const [nextStages, setNextStages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      if (!caseId || !value) {
        setNextStages([]);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase.rpc(
        "case_next_stages_from" as any,
        { p_from_stage: value }
      );

      if (error) {
        console.error("Erro ao carregar próximas fases:", error);
        setNextStages([]);
      } else {
        setNextStages((data ?? []).map((row: any) => row.to_stage));
      }

      setLoading(false);
    }

    load();
  }, [caseId, value]);

  const options = Array.from(
    new Set(nextStages.filter((s) => s && s !== value))
  );

  return (
    <Select
      value={value ?? ""}
      onValueChange={(stage) => onChange(stage)}
      disabled={disabled || loading}
    >
      <SelectTrigger>
        <SelectValue placeholder="Selecione a fase" />
      </SelectTrigger>
      <SelectContent>
        {value && <SelectItem value={value}>{value}</SelectItem>}
        {options.map((stage) => (
          <SelectItem key={stage} value={stage}>
            {stage}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
