/**
 * ReciboFormDialog - Dialog para coletar dados para geração de Recibo de Pagamento
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

export interface ReciboAnswers {
  valor: string;
  data_pagamento: string;
  descricao_pagamento: string;
  tipo_pagamento: "parcial" | "total";
  numero_parcela: string;
  total_parcelas: string;
  metodo_pagamento: "pix" | "transferencia" | "boleto" | "dinheiro" | "";
}

export function getDefaultReciboAnswers(): ReciboAnswers {
  const today = new Date().toISOString().split("T")[0];
  return {
    valor: "",
    data_pagamento: today,
    descricao_pagamento: "Pagamento de honorários advocatícios",
    tipo_pagamento: "total",
    numero_parcela: "",
    total_parcelas: "",
    metodo_pagamento: "pix",
  };
}

// Format currency for display
function formatCurrency(value: string): string {
  const numbers = value.replace(/\D/g, "");
  if (!numbers) return "";
  const numValue = parseInt(numbers, 10) / 100;
  return numValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Parse currency string to number
function parseCurrencyToNumber(value: string): number {
  const numbers = value.replace(/\D/g, "");
  if (!numbers) return 0;
  return parseInt(numbers, 10) / 100;
}

// Valor por extenso
function valorPorExtenso(valor: number): string {
  if (valor === 0) return "zero reais";
  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const especiais = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

  const converterGrupo = (n: number): string => {
    if (n === 0) return "";
    if (n === 100) return "cem";
    let resultado = "";
    const c = Math.floor(n / 100);
    const resto = n % 100;
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    if (c > 0) resultado += centenas[c];
    if (resto > 0) {
      if (c > 0) resultado += " e ";
      if (resto < 10) resultado += unidades[resto];
      else if (resto < 20) resultado += especiais[resto - 10];
      else { resultado += dezenas[d]; if (u > 0) resultado += " e " + unidades[u]; }
    }
    return resultado;
  };

  const parteInteira = Math.floor(valor);
  const centavos = Math.round((valor - parteInteira) * 100);
  let resultado = "";
  
  if (parteInteira >= 1000000) {
    const milhoes = Math.floor(parteInteira / 1000000);
    resultado += converterGrupo(milhoes) + (milhoes === 1 ? " milhão" : " milhões");
    const resto = parteInteira % 1000000;
    if (resto > 0) resultado += resto < 100 ? " e " : " ";
  }
  const semMilhoes = parteInteira % 1000000;
  if (semMilhoes >= 1000) {
    const milhares = Math.floor(semMilhoes / 1000);
    resultado += milhares === 1 ? "mil" : converterGrupo(milhares) + " mil";
    const resto = semMilhoes % 1000;
    if (resto > 0) resultado += resto < 100 ? " e " : " ";
  }
  const unidadesParte = semMilhoes % 1000;
  if (unidadesParte > 0) resultado += converterGrupo(unidadesParte);
  if (parteInteira === 1) resultado += " real";
  else if (parteInteira > 0) resultado += " reais";
  if (centavos > 0) {
    if (parteInteira > 0) resultado += " e ";
    resultado += converterGrupo(centavos) + (centavos === 1 ? " centavo" : " centavos");
  }
  return resultado.trim();
}

interface ReciboFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reciboAnswers: ReciboAnswers;
  setReciboAnswers: React.Dispatch<React.SetStateAction<ReciboAnswers>>;
  loading: boolean;
  onConfirm: () => void;
}

export function ReciboFormDialog({
  open,
  onOpenChange,
  reciboAnswers,
  setReciboAnswers,
  loading,
  onConfirm,
}: ReciboFormDialogProps) {
  const [valorExtenso, setValorExtenso] = useState("");

  // Calculate valor por extenso when valor changes
  useEffect(() => {
    const num = parseCurrencyToNumber(reciboAnswers.valor);
    setValorExtenso(num > 0 ? valorPorExtenso(num) : "");
  }, [reciboAnswers.valor]);

  const handleValorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    setReciboAnswers(prev => ({ ...prev, valor: formatted }));
  };

  const isParcial = reciboAnswers.tipo_pagamento === "parcial";
  const isValid = parseCurrencyToNumber(reciboAnswers.valor) > 0 
    && reciboAnswers.data_pagamento 
    && reciboAnswers.descricao_pagamento.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Gerar Recibo de Pagamento</DialogTitle>
          <DialogDescription>
            Informe os dados do pagamento recebido para gerar o recibo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-2">
          {/* Valor */}
          <div className="space-y-2">
            <Label htmlFor="valor">Valor Recebido *</Label>
            <Input
              id="valor"
              value={reciboAnswers.valor}
              onChange={handleValorChange}
              placeholder="R$ 0,00"
            />
            {valorExtenso && (
              <p className="text-xs text-muted-foreground italic">
                {valorExtenso}
              </p>
            )}
          </div>

          {/* Data do Pagamento */}
          <div className="space-y-2">
            <Label htmlFor="data_pagamento">Data do Pagamento *</Label>
            <Input
              id="data_pagamento"
              type="date"
              value={reciboAnswers.data_pagamento}
              onChange={(e) => setReciboAnswers(prev => ({ ...prev, data_pagamento: e.target.value }))}
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Input
              id="descricao"
              value={reciboAnswers.descricao_pagamento}
              onChange={(e) => setReciboAnswers(prev => ({ ...prev, descricao_pagamento: e.target.value }))}
              placeholder="Pagamento de honorários advocatícios"
            />
          </div>

          {/* Tipo de Pagamento */}
          <div className="space-y-2">
            <Label>Tipo de Pagamento</Label>
            <Select
              value={reciboAnswers.tipo_pagamento}
              onValueChange={(v) => setReciboAnswers(prev => ({ ...prev, tipo_pagamento: v as "parcial" | "total" }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total">Pagamento Total</SelectItem>
                <SelectItem value="parcial">Pagamento Parcial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Parcela info (if parcial) */}
          {isParcial && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="numero_parcela">Parcela Nº</Label>
                <Input
                  id="numero_parcela"
                  type="number"
                  min="1"
                  value={reciboAnswers.numero_parcela}
                  onChange={(e) => setReciboAnswers(prev => ({ ...prev, numero_parcela: e.target.value }))}
                  placeholder="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="total_parcelas">de Total</Label>
                <Input
                  id="total_parcelas"
                  type="number"
                  min="1"
                  value={reciboAnswers.total_parcelas}
                  onChange={(e) => setReciboAnswers(prev => ({ ...prev, total_parcelas: e.target.value }))}
                  placeholder="12"
                />
              </div>
            </div>
          )}

          {/* Método de Pagamento */}
          <div className="space-y-2">
            <Label>Método de Pagamento</Label>
            <Select
              value={reciboAnswers.metodo_pagamento}
              onValueChange={(v) => setReciboAnswers(prev => ({ ...prev, metodo_pagamento: v as any }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                <SelectItem value="boleto">Boleto Bancário</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={loading || !isValid}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              "Gerar Recibo"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
