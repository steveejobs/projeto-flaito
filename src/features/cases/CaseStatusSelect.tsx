// src/components/CaseStatusSelect.tsx
// ✔ Import correto para este projeto: "@/integrations/supabase/client"

import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CaseStatusSelectProps = {
  caseId: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function CaseStatusSelect({
  caseId,
  value,
  onChange,
  disabled,
}: CaseStatusSelectProps) {
  const [nextStatuses, setNextStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadNextStatuses() {
      if (!caseId) {
        setNextStatuses([]);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase.rpc(
        "case_next_statuses_for_case" as any,
        { p_case_id: caseId }
      );

      if (error) {
        console.error("Erro ao carregar próximos status:", error);
        setNextStatuses([]);
      } else {
        setNextStatuses((data ?? []).map((row: any) => row.to_status));
      }

      setLoading(false);
    }

    loadNextStatuses();
  }, [caseId]);

  const options = Array.from(
    new Set(nextStatuses.filter((s) => s && s !== value))
  );

  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled || loading}
    >
      <SelectTrigger>
        <SelectValue
          placeholder={loading ? "Carregando..." : "Selecione o status"}
        />
      </SelectTrigger>

      <SelectContent>
        {value && <SelectItem value={value}>{value}</SelectItem>}

        {options.map((status) => (
          <SelectItem key={status} value={status}>
            {status}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
