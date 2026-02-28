import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearTjtoCache } from "@/nija";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { TableEmptyState } from "@/components/ui/table-empty-state";

type Row = {
  id: string;
  code: string;
  label: string;
  legal_desc: string;
  category: string;
  active: boolean;
  updated_at: string | null;
};

const CATEGORIES = [
  "PECA_PROCESSUAL",
  "REPRESENTACAO",
  "PROVA_DOCUMENTAL",
  "COMUNICACAO_PROCESSUAL",
  "PRONUNCIAMENTO_JUDICIAL",
  "ATO_CARTORARIO",
  "COMPROVACAO_COMUNICACAO",
  "COMPROVANTE",
  "CALCULOS",
  "CUSTAS",
  "CUMPRIMENTO",
  "RELATORIO",
  "INFORMACAO",
  "SISTEMA",
  "ANEXO",
] as const;

function normalizeCode(v: string) {
  return (v || "").toUpperCase().replace(/\s+/g, "");
}

function isValidCode(v: string) {
  return /^[A-Z]+[0-9]+$/.test(v);
}

export default function TjtoDictionaryAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);

  const [formCode, setFormCode] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formCategory, setFormCategory] = useState<string>("ANEXO");
  const [formActive, setFormActive] = useState(true);

  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function fetchRows() {
    setLoading(true);
    const { data, error } = await supabase
      .from("nija_tjto_document_dictionary")
      .select("id,code,label,legal_desc,category,active,updated_at")
      .order("code", { ascending: true });

    setLoading(false);
    if (error) {
      console.error(error);
      return;
    }
    setRows((data as Row[]) ?? []);
  }

  useEffect(() => {
    fetchRows();
  }, []);

  function resetForm() {
    setFormCode("");
    setFormLabel("");
    setFormDesc("");
    setFormCategory("ANEXO");
    setFormActive(true);
    setEditId(null);
  }

  const codeError = useMemo(() => {
    const c = normalizeCode(formCode);
    if (!c) return "Informe o código.";
    if (!isValidCode(c)) return "Formato inválido. Use padrão: LETRAS+NÚMEROS (ex.: ATOORD1).";
    return null;
  }, [formCode]);

  async function createRow() {
    const code = normalizeCode(formCode);
    if (codeError) return;

    setSaving(true);
    const { error } = await supabase.from("nija_tjto_document_dictionary").insert({
      code,
      label: formLabel.trim(),
      legal_desc: formDesc.trim(),
      category: formCategory,
      active: formActive,
    });
    setSaving(false);

    if (error) {
      console.error(error);
      return;
    }

    clearTjtoCache();
    setOpenCreate(false);
    resetForm();
    fetchRows();
  }

  function openEditRow(r: Row) {
    setEditId(r.id);
    setFormCode(r.code);
    setFormLabel(r.label ?? "");
    setFormDesc(r.legal_desc ?? "");
    setFormCategory(r.category ?? "ANEXO");
    setFormActive(!!r.active);
    setOpenEdit(true);
  }

  async function saveEdit() {
    if (!editId) return;

    setSaving(true);
    const { error } = await supabase
      .from("nija_tjto_document_dictionary")
      .update({
        label: formLabel.trim(),
        legal_desc: formDesc.trim(),
        category: formCategory,
        active: formActive,
      })
      .eq("id", editId);

    setSaving(false);

    if (error) {
      console.error(error);
      return;
    }

    clearTjtoCache();
    setOpenEdit(false);
    resetForm();
    fetchRows();
  }

  async function toggleActive(r: Row) {
    const { error } = await supabase
      .from("nija_tjto_document_dictionary")
      .update({ active: !r.active })
      .eq("id", r.id);

    if (error) {
      console.error(error);
      return;
    }

    clearTjtoCache();
    fetchRows();
  }

  return (
    <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dicionário TJTO (NIJA)</h1>
            <p className="text-sm text-muted-foreground">
              Tipos de documento TJTO por código (ex.: ATOORD1, INT1, PET1).
            </p>
          </div>

          <Dialog open={openCreate} onOpenChange={(v) => { setOpenCreate(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button>Novo</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Novo registro</DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Código</label>
                  <Input
                    value={formCode}
                    onChange={(e) => setFormCode(normalizeCode(e.target.value))}
                    placeholder="Ex.: ATOORD1"
                  />
                  {codeError && <p className="text-xs text-destructive">{codeError}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Label</label>
                  <Input value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="Ex.: Ato Ordinatório" />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Descrição jurídica</label>
                  <Textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Descrição objetiva para IA e humano." />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Categoria</label>
                    <Select value={formCategory} onValueChange={setFormCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Ativo</p>
                      <p className="text-xs text-muted-foreground">Disponível para o NIJA</p>
                    </div>
                    <Switch checked={formActive} onCheckedChange={setFormActive} />
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancelar</Button>
                <Button onClick={createRow} disabled={!!codeError || saving}>
                  {saving ? "Salvando..." : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="table-cell-actions">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeleton rows={5} columns={5} />
              ) : rows.length === 0 ? (
                <TableEmptyState colSpan={5} />
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="table-cell-mono table-cell-primary">{r.code}</TableCell>
                    <TableCell>{r.label}</TableCell>
                    <TableCell className="table-cell-secondary">
                      <Badge variant="secondary">{r.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={!!r.active} onCheckedChange={() => toggleActive(r)} />
                    </TableCell>
                    <TableCell className="table-cell-actions">
                      <Button variant="outline" size="sm" onClick={() => openEditRow(r)}>
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={openEdit} onOpenChange={(v) => { setOpenEdit(v); if (!v) resetForm(); }}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Editar registro</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Código (somente leitura)</label>
                <Input value={formCode} readOnly />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Label</label>
                <Input value={formLabel} onChange={(e) => setFormLabel(e.target.value)} />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Descrição jurídica</label>
                <Textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Categoria</label>
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Ativo</p>
                    <p className="text-xs text-muted-foreground">Disponível para o NIJA</p>
                  </div>
                  <Switch checked={formActive} onCheckedChange={setFormActive} />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setOpenEdit(false)}>Cancelar</Button>
              <Button onClick={saveEdit} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  );
}
