// src/features/documents/DocumentStatusSelect.tsx
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

type DocumentStatusSelectProps = {
  documentId: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function DocumentStatusSelect({
  documentId,
  value,
  onChange,
  disabled,
}: DocumentStatusSelectProps) {
  const [nextStatuses, setNextStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadNextStatuses() {
      if (!value) {
        setNextStatuses([]);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase.rpc(
        "doc_next_statuses_from" as any,
        { p_from_status: value }
      );

      if (error) {
        console.error("Erro ao carregar próximos status do documento:", error);
        setNextStatuses([]);
      } else {
        setNextStatuses((data ?? []).map((row: any) => row.to_status));
      }

      setLoading(false);
    }

    loadNextStatuses();
  }, [value, documentId]);

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