import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";

type ClientCasesPanelProps = {
  clientId: string;
  compact?: boolean;
};

type ClientCase = {
  id: string;
  title: string;
  status: string | null;
  side: string | null;
  created_at: string;
};

export function ClientCasesPanel({ clientId, compact = false }: ClientCasesPanelProps) {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [cases, setCases] = useState<ClientCase[]>([]);
  const [loading, setLoading] = useState(true);

  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSide, setNewSide] = useState<"ATAQUE" | "DEFESA">("ATAQUE");

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data, error } = await supabase
        .from("cases" as any)
        .select("id, title, status, side, created_at")
        .eq("client_id", clientId as any)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setCases(data as unknown as ClientCase[]);
      }

      setLoading(false);
    }

    if (clientId) {
      load();
    }
  }, [clientId]);

  const handleCreateCase = async () => {
    if (!newTitle.trim()) {
      toast({ title: "Atenção", description: "Informe o título do caso." });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("cases" as any)
        .insert({
          client_id: clientId,
          title: newTitle.trim(),
          side: newSide,
          status: "EM_ANDAMENTO",
        } as any)
        .select("id")
        .single();

      if (error) throw error;
      const newCaseId = (data as any).id as string;

      toast({
        title: "Caso criado",
        description: "Caso criado para este cliente. Deseja gerar o primeiro documento agora?",
        action: (
          <Button
            size="sm"
            onClick={() => navigate(`/documents/new?caseId=${newCaseId}`)}
          >
            Gerar documento
          </Button>
        ),
      });

      setNewTitle("");
      setNewSide("ATAQUE");

      navigate(`/cases/${newCaseId}`);
    } catch (err: any) {
      toast({
        title: "Erro ao criar caso",
        description: err?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Compact form for creating new case */}
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input
            placeholder="Título do novo caso"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="h-8 text-sm"
          />

          <Select
            value={newSide}
            onValueChange={(v) => setNewSide(v as "ATAQUE" | "DEFESA")}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Polo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ATAQUE">Ataque</SelectItem>
              <SelectItem value="DEFESA">Defesa</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={handleCreateCase} disabled={creating} size="sm" className="h-8">
            {creating ? "Criando..." : "Criar caso"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground py-2">
          Carregando casos...
        </div>
      ) : cases.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2">
          Nenhum caso cadastrado.
        </div>
      ) : (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {cases.map((c) => (
            <div
              key={c.id}
              onClick={() => navigate(`/cases/${c.id}`)}
              className="flex items-center justify-between gap-2 px-2 py-1.5 border rounded text-xs cursor-pointer hover:bg-accent/50 transition"
            >
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-medium truncate">{c.title}</span>
                <span className="text-muted-foreground">
                  {c.side ?? "-"} · {c.status ?? "-"}
                </span>
              </div>
              <span className="text-muted-foreground flex-shrink-0">
                {new Date(c.created_at).toLocaleDateString("pt-BR")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
