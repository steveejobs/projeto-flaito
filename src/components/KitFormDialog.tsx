import { useMemo, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CalendarIcon, FileText, Users } from "lucide-react";
import { ClientLawyerSelector } from "@/components/ClientLawyerSelector";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Types
export type TipoRemuneracao = "percentual" | "valor_fixo" | "misto";
export type FormaPagamento = "a_vista" | "parcelado" | "entrada_parcelas";
export type MetodoPagamento = "pix" | "transferencia" | "boleto" | "dinheiro";

export type KitAnswers = {
  tipo_remuneracao: TipoRemuneracao;
  percentual_honorarios: string;
  valor_fixo_honorarios: string;
  forma_pagamento: FormaPagamento;
  valor_entrada: string;
  numero_parcelas: string;
  valor_parcela: string;
  data_primeira_parcela: Date;
  datas_parcelas: Date[];
  metodo_pagamento: MetodoPagamento;
  chave_pix: string;
  // Advogados para documentos
  allLawyers: boolean;
  selectedLawyerIds: string[];
  primaryLawyerId: string | null;
};

// Helpers para formatação de moeda
export function formatCurrency(value: string): string {
  const numbers = value.replace(/\D/g, "");
  if (!numbers) return "";
  const amount = parseInt(numbers, 10) / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
}

export function parseCurrencyToNumber(value: string): number {
  const numbers = value.replace(/\D/g, "");
  if (!numbers) return 0;
  return parseInt(numbers, 10) / 100;
}

// Função para converter número em extenso
export function valorPorExtenso(valor: number): string {
  if (valor === 0) return "zero reais";
  
  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const centenas = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
  
  function extenso(n: number): string {
    if (n === 0) return "";
    if (n === 100) return "cem";
    if (n < 20) return unidades[n];
    if (n < 100) {
      const d = Math.floor(n / 10);
      const u = n % 10;
      return dezenas[d] + (u > 0 ? " e " + unidades[u] : "");
    }
    if (n < 1000) {
      const c = Math.floor(n / 100);
      const resto = n % 100;
      return centenas[c] + (resto > 0 ? " e " + extenso(resto) : "");
    }
    if (n < 1000000) {
      const milhar = Math.floor(n / 1000);
      const resto = n % 1000;
      const milharExtenso = milhar === 1 ? "mil" : extenso(milhar) + " mil";
      return milharExtenso + (resto > 0 ? (resto < 100 ? " e " : " ") + extenso(resto) : "");
    }
    if (n < 1000000000) {
      const milhao = Math.floor(n / 1000000);
      const resto = n % 1000000;
      const milhaoExtenso = milhao === 1 ? "um milhão" : extenso(milhao) + " milhões";
      return milhaoExtenso + (resto > 0 ? (resto < 1000 ? " e " : " ") + extenso(resto) : "");
    }
    return n.toString();
  }
  
  const reais = Math.floor(valor);
  const centavos = Math.round((valor - reais) * 100);
  
  let resultado = "";
  
  if (reais > 0) {
    resultado = extenso(reais) + (reais === 1 ? " real" : " reais");
  }
  
  if (centavos > 0) {
    if (resultado) resultado += " e ";
    resultado += extenso(centavos) + (centavos === 1 ? " centavo" : " centavos");
  }
  
  return resultado;
}

// Função para calcular datas das parcelas (+30 dias)
export function calcularDatasParcelas(dataInicial: Date, numeroParcelas: number): Date[] {
  const datas: Date[] = [];
  for (let i = 0; i < numeroParcelas; i++) {
    datas.push(addMonths(dataInicial, i));
  }
  return datas;
}

// Default kit answers
export function getDefaultKitAnswers(): KitAnswers {
  return {
    tipo_remuneracao: "valor_fixo",
    percentual_honorarios: "",
    valor_fixo_honorarios: "",
    forma_pagamento: "a_vista",
    valor_entrada: "",
    numero_parcelas: "",
    valor_parcela: "",
    data_primeira_parcela: new Date(),
    datas_parcelas: [],
    metodo_pagamento: "pix",
    chave_pix: "",
    allLawyers: true,
    selectedLawyerIds: [],
    primaryLawyerId: null,
  };
}

// Props do componente
type KitFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kitAnswers: KitAnswers;
  setKitAnswers: React.Dispatch<React.SetStateAction<KitAnswers>>;
  loading: boolean;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  templateCodes?: string[]; // Códigos dos templates sendo gerados
  officeId?: string; // ID do escritório para buscar advogados
  clientId?: string | null; // ID do cliente para buscar advogados vinculados
  skipLawyerInitialLoad?: boolean; // Pular carregamento inicial de advogados se já tiver valores
};

export function KitFormDialog({
  open,
  onOpenChange,
  kitAnswers,
  setKitAnswers,
  loading,
  onConfirm,
  title = "Dados para o kit de documentos",
  description = "Informe os dados para gerar procuração, declaração e contrato de honorários.",
  confirmLabel = "Gerar kit agora",
  templateCodes,
  officeId,
  clientId,
  skipLawyerInitialLoad = false,
}: KitFormDialogProps) {
  // Só mostra campos de contrato se CONTRATO estiver nos templates
  const needsContractFields = templateCodes?.includes("CONTRATO") ?? true;
  
  // Seção de advogados é exibida para PROC (procuração) ou CONTRATO
  const needsLawyerFields = templateCodes?.some(c => ["PROC", "CONTRATO"].includes(c)) ?? true;
  
  // Computed values - só calcula se precisar de campos de contrato
  const valorFixoNum = needsContractFields ? parseCurrencyToNumber(kitAnswers.valor_fixo_honorarios) : 0;
  const valorEntradaNum = needsContractFields ? parseCurrencyToNumber(kitAnswers.valor_entrada) : 0;
  const valorParcelaNum = needsContractFields ? parseCurrencyToNumber(kitAnswers.valor_parcela) : 0;
  const numParcelas = needsContractFields ? (parseInt(kitAnswers.numero_parcelas, 10) || 0) : 0;
  
  // Auto-calculate installment value when number of installments or total changes
  useEffect(() => {
    // Skip calculations if not generating contract
    if (!needsContractFields) return;
    
    if (numParcelas > 0 && valorFixoNum > 0) {
      let valorParcelaCalculado = 0;
      
      if (kitAnswers.forma_pagamento === "parcelado") {
        valorParcelaCalculado = valorFixoNum / numParcelas;
      } else if (kitAnswers.forma_pagamento === "entrada_parcelas") {
        const restante = valorFixoNum - valorEntradaNum;
        valorParcelaCalculado = restante > 0 ? restante / numParcelas : 0;
      }
      
      if (valorParcelaCalculado > 0) {
        const cents = Math.round(valorParcelaCalculado * 100).toString();
        const formatted = formatCurrency(cents);
        setKitAnswers((prev) => ({ ...prev, valor_parcela: formatted }));
      }
    }
  }, [needsContractFields, numParcelas, valorFixoNum, valorEntradaNum, kitAnswers.forma_pagamento]);

  // Auto-generate installment dates when number of installments or first date changes
  useEffect(() => {
    // Skip calculations if not generating contract
    if (!needsContractFields) return;
    
    if (numParcelas > 0) {
      const novasDatas = calcularDatasParcelas(kitAnswers.data_primeira_parcela, numParcelas);
      setKitAnswers((prev) => ({ ...prev, datas_parcelas: novasDatas }));
    } else {
      setKitAnswers((prev) => ({ ...prev, datas_parcelas: [] }));
    }
  }, [needsContractFields, numParcelas, kitAnswers.data_primeira_parcela]);

  // Preview das parcelas using datas_parcelas state
  const previewParcelas = useMemo(() => {
    if (!needsContractFields) return [];
    if (numParcelas <= 0 || valorParcelaNum <= 0 || kitAnswers.datas_parcelas.length === 0) return [];
    return kitAnswers.datas_parcelas.slice(0, 12).map((data, i) => ({
      numero: i + 1,
      data: format(data, "dd/MM/yyyy", { locale: ptBR }),
      valor: formatCurrency(kitAnswers.valor_parcela),
      extenso: valorPorExtenso(valorParcelaNum),
    }));
  }, [needsContractFields, kitAnswers.datas_parcelas, numParcelas, kitAnswers.valor_parcela, valorParcelaNum]);

  const handleCurrencyChange = (field: keyof KitAnswers) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCurrency(e.target.value);
    setKitAnswers((prev) => ({ ...prev, [field]: formatted }));
  };

  const handleDateChange = (index: number, newDate: Date) => {
    setKitAnswers((prev) => {
      const novasDatas = [...prev.datas_parcelas];
      novasDatas[index] = newDate;
      return { ...prev, datas_parcelas: novasDatas };
    });
  };

  // Determina título e descrição com base nos documentos
  const dialogTitle = needsContractFields 
    ? title 
    : "Confirmar Geração";
  
  const dialogDescription = needsContractFields 
    ? description 
    : `Os documentos (${templateCodes?.join(", ")}) serão gerados automaticamente com os dados do cadastro do cliente.`;

  const dialogConfirmLabel = needsContractFields 
    ? confirmLabel 
    : "Confirmar e Gerar";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={(needsContractFields || needsLawyerFields) ? "max-w-lg max-h-[90vh] overflow-y-auto" : "max-w-md"}>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm py-2">
          {/* Seção de Advogados - sempre exibida para PROC/CONTRATO */}
          {needsLawyerFields && officeId && (
            <div className="space-y-3 pb-4 border-b border-border">
              <div className="flex items-center gap-2 text-primary">
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">Advogado(s) nos Documentos</span>
              </div>
              <ClientLawyerSelector
                officeId={officeId}
                clientId={clientId}
                allLawyers={kitAnswers.allLawyers}
                selectedLawyerIds={kitAnswers.selectedLawyerIds}
                primaryLawyerId={kitAnswers.primaryLawyerId}
                onAllLawyersChange={(v) => setKitAnswers(prev => ({ ...prev, allLawyers: v }))}
                onSelectedLawyersChange={(ids) => setKitAnswers(prev => ({ ...prev, selectedLawyerIds: ids }))}
                onPrimaryLawyerChange={(id) => setKitAnswers(prev => ({ ...prev, primaryLawyerId: id }))}
                skipInitialLoad={skipLawyerInitialLoad}
              />
            </div>
          )}

          {needsContractFields ? (
            <>
              {/* Tipo de remuneração */}
              <div className="space-y-1.5">
                <Label>Tipo de remuneração *</Label>
                <Select
                  value={kitAnswers.tipo_remuneracao}
                  onValueChange={(v: TipoRemuneracao) =>
                    setKitAnswers((prev) => ({ ...prev, tipo_remuneracao: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="valor_fixo">Valor fixo</SelectItem>
                    <SelectItem value="percentual">Percentual sobre o proveito econômico</SelectItem>
                    <SelectItem value="misto">Misto (percentual + valor fixo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Campos condicionais por tipo de remuneração */}
              {(kitAnswers.tipo_remuneracao === "percentual" || kitAnswers.tipo_remuneracao === "misto") && (
                <div className="space-y-1.5">
                  <Label>Percentual de honorários (%) *</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={kitAnswers.percentual_honorarios}
                    onChange={(e) =>
                      setKitAnswers((prev) => ({
                        ...prev,
                        percentual_honorarios: e.target.value,
                      }))
                    }
                    placeholder="Ex.: 20"
                  />
                </div>
              )}

              {(kitAnswers.tipo_remuneracao === "valor_fixo" || kitAnswers.tipo_remuneracao === "misto") && (
                <div className="space-y-1.5">
                  <Label>Valor dos honorários *</Label>
                  <Input
                    value={kitAnswers.valor_fixo_honorarios}
                    onChange={handleCurrencyChange("valor_fixo_honorarios")}
                    placeholder="R$ 0,00"
                  />
                  {valorFixoNum > 0 && (
                    <p className="text-xs text-muted-foreground">
                      ({valorPorExtenso(valorFixoNum)})
                    </p>
                  )}
                </div>
              )}

              {/* Forma de pagamento */}
              <div className="space-y-1.5">
                <Label>Forma de pagamento *</Label>
                <Select
                  value={kitAnswers.forma_pagamento}
                  onValueChange={(v: FormaPagamento) =>
                    setKitAnswers((prev) => ({ ...prev, forma_pagamento: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a_vista">À vista</SelectItem>
                    <SelectItem value="parcelado">Parcelado</SelectItem>
                    <SelectItem value="entrada_parcelas">Entrada + Parcelas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Campos de parcelamento */}
              {kitAnswers.forma_pagamento === "entrada_parcelas" && (
                <div className="space-y-1.5">
                  <Label>Valor da entrada *</Label>
                  <Input
                    value={kitAnswers.valor_entrada}
                    onChange={handleCurrencyChange("valor_entrada")}
                    placeholder="R$ 0,00"
                  />
                  {parseCurrencyToNumber(kitAnswers.valor_entrada) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      ({valorPorExtenso(parseCurrencyToNumber(kitAnswers.valor_entrada))})
                    </p>
                  )}
                </div>
              )}

              {(kitAnswers.forma_pagamento === "parcelado" || kitAnswers.forma_pagamento === "entrada_parcelas") && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Número de parcelas *</Label>
                      <Input
                        type="number"
                        min="1"
                        max="48"
                        value={kitAnswers.numero_parcelas}
                        onChange={(e) =>
                          setKitAnswers((prev) => ({
                            ...prev,
                            numero_parcelas: e.target.value,
                          }))
                        }
                        placeholder="Ex.: 3"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Valor de cada parcela *</Label>
                      <Input
                        value={kitAnswers.valor_parcela}
                        onChange={handleCurrencyChange("valor_parcela")}
                        placeholder="R$ 0,00"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Data da 1ª parcela *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !kitAnswers.data_primeira_parcela && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {kitAnswers.data_primeira_parcela
                            ? format(kitAnswers.data_primeira_parcela, "dd/MM/yyyy", { locale: ptBR })
                            : "Selecione uma data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={kitAnswers.data_primeira_parcela}
                          onSelect={(date) =>
                            date && setKitAnswers((prev) => ({ ...prev, data_primeira_parcela: date }))
                          }
                          locale={ptBR}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground">
                      Normalmente a data do contrato
                    </p>
                  </div>

                  {/* Parcelas com datas editáveis */}
                  {kitAnswers.datas_parcelas.length > 0 && valorParcelaNum > 0 && (
                    <div className="bg-muted/50 rounded-md p-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Parcelas (clique na data para editar):
                      </p>
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {kitAnswers.datas_parcelas.slice(0, 12).map((data, index) => (
                          <div key={index} className="flex items-center gap-2 text-xs">
                            <span className="font-medium w-8">{index + 1}ª:</span>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs px-2"
                                >
                                  <CalendarIcon className="mr-1 h-3 w-3" />
                                  {format(data, "dd/MM/yyyy", { locale: ptBR })}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={data}
                                  onSelect={(newDate) => newDate && handleDateChange(index, newDate)}
                                  locale={ptBR}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <span className="text-muted-foreground">-</span>
                            <span>{formatCurrency(kitAnswers.valor_parcela)}</span>
                          </div>
                        ))}
                      </div>
                      {numParcelas > 12 && (
                        <p className="text-xs text-muted-foreground italic mt-1">
                          ... e mais {numParcelas - 12} parcelas
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Total: {formatCurrency(String(Math.round(valorParcelaNum * numParcelas * 100)))}
                        {kitAnswers.forma_pagamento === "entrada_parcelas" && valorEntradaNum > 0 && (
                          <> (+ entrada de {formatCurrency(kitAnswers.valor_entrada)})</>
                        )}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Método de pagamento */}
              <div className="space-y-1.5">
                <Label>Método de pagamento *</Label>
                <Select
                  value={kitAnswers.metodo_pagamento}
                  onValueChange={(v: MetodoPagamento) =>
                    setKitAnswers((prev) => ({ ...prev, metodo_pagamento: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX (mais comum)</SelectItem>
                    <SelectItem value="transferencia">Transferência bancária</SelectItem>
                    <SelectItem value="boleto">Boleto bancário</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Chave PIX (condicional) */}
              {kitAnswers.metodo_pagamento === "pix" && (
                <div className="space-y-1.5">
                  <Label>Chave PIX *</Label>
                  <Input
                    value={kitAnswers.chave_pix}
                    onChange={(e) =>
                      setKitAnswers((prev) => ({ ...prev, chave_pix: e.target.value }))
                    }
                    placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                  />
                  <p className="text-xs text-muted-foreground">
                    Informe a chave PIX do escritório para recebimento
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6 space-y-2">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Nenhum dado adicional é necessário.
              </p>
              <p className="text-xs text-muted-foreground">
                O documento será gerado usando os dados do cadastro do cliente.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              dialogConfirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
