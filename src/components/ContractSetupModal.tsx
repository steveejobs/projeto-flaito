/**
 * ContractSetupModal.tsx
 * 
 * Modal limpo para configurar e gerar o Contrato do cliente.
 * Independente do código legado do KIT.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { autoGenerateClientKit, ContractVariables, FIELD_LABELS } from "@/lib/clientKit";
import { useToast } from "@/hooks/use-toast";
import { format, addMonths } from "date-fns";

interface ContractSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  onSuccess?: () => void;
}

// Formatação de moeda
const formatCurrency = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

// Calcular datas das parcelas
const calcularDatasParcelas = (dataInicial: string, numParcelas: number): string[] => {
  if (!dataInicial || numParcelas <= 0) return [];
  const datas: string[] = [];
  const start = new Date(dataInicial + "T00:00:00");
  for (let i = 0; i < numParcelas; i++) {
    const data = addMonths(start, i);
    datas.push(format(data, "yyyy-MM-dd"));
  }
  return datas;
};

export function ContractSetupModal({
  open,
  onOpenChange,
  clientId,
  clientName,
  onSuccess,
}: ContractSetupModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form state
  const [tipoRemuneracao, setTipoRemuneracao] = useState<string>("valor_fixo");
  const [percentualHonorarios, setPercentualHonorarios] = useState<string>("30");
  const [valorFixoHonorarios, setValorFixoHonorarios] = useState<string>("");
  const [formaPagamento, setFormaPagamento] = useState<string>("a_vista");
  const [valorEntrada, setValorEntrada] = useState<string>("");
  const [numeroParcelas, setNumeroParcelas] = useState<string>("1");
  const [valorParcela, setValorParcela] = useState<string>("");
  const [dataPrimeiraParcela, setDataPrimeiraParcela] = useState<string>("");
  const [metodoPagamento, setMetodoPagamento] = useState<string>("pix");
  const [chavePix, setChavePix] = useState<string>("");

  const resetState = () => {
    setLoading(false);
    setSuccess(false);
    setMissingFields([]);
    setErrorMessage(null);
  };

  const handleClose = () => {
    if (!loading) {
      resetState();
      onOpenChange(false);
    }
  };

  const handleSkip = () => {
    toast({
      title: "Contrato ignorado",
      description: "Você pode gerar o contrato posteriormente na aba Kit do cliente.",
    });
    handleClose();
  };

  const handleGenerateContract = async () => {
    if (loading) return;

    setLoading(true);
    setMissingFields([]);
    setErrorMessage(null);

    // Calcular datas das parcelas
    const numParcelas = parseInt(numeroParcelas, 10) || 0;
    const datasParcelas = formaPagamento !== "a_vista" && dataPrimeiraParcela
      ? calcularDatasParcelas(dataPrimeiraParcela, numParcelas)
      : [];

    // Montar descrição dos honorários
    let honorariosDescricao = "";
    if (tipoRemuneracao === "percentual") {
      honorariosDescricao = `${percentualHonorarios}% sobre o proveito econômico obtido`;
    } else if (tipoRemuneracao === "valor_fixo") {
      honorariosDescricao = valorFixoHonorarios;
    } else if (tipoRemuneracao === "misto") {
      honorariosDescricao = `${percentualHonorarios}% sobre o proveito econômico + ${valorFixoHonorarios}`;
    }

    // Cláusula de inadimplemento
    let clausulaInadimplemento = "";
    if (formaPagamento !== "a_vista") {
      clausulaInadimplemento = `O atraso no pagamento de qualquer parcela implicará a incidência de multa de 2% (dois por cento) sobre o valor devido, acrescido de juros de mora de 1% (um por cento) ao mês, calculados pro rata die.`;
    }

    const kitVars: ContractVariables = {
      tipo_remuneracao: tipoRemuneracao,
      percentual_honorarios: percentualHonorarios,
      valor_fixo_honorarios: valorFixoHonorarios,
      valor_entrada: valorEntrada,
      numero_parcelas: numeroParcelas,
      valor_parcela: valorParcela,
      data_primeira_parcela: dataPrimeiraParcela,
      datas_parcelas: datasParcelas,
      metodo_pagamento: metodoPagamento,
      chave_pix: metodoPagamento === "pix" ? chavePix : "",
      clausula_inadimplemento: clausulaInadimplemento,
      honorarios_descricao_completa: honorariosDescricao,
    };

    try {
      const result = await autoGenerateClientKit(clientId, "CONTRACT", kitVars);

      if (result.ok) {
        setSuccess(true);
        toast({
          title: "Contrato gerado",
          description: "O contrato foi gerado com sucesso!",
        });
        onSuccess?.();
        // Fecha após 1.5s
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else if (result.missingFields && result.missingFields.length > 0) {
        setMissingFields(result.missingFields);
        setErrorMessage("Campos obrigatórios não preenchidos");
      } else {
        setErrorMessage(result.reason || "Erro ao gerar contrato");
      }
    } catch (err: any) {
      console.error("[ContractSetupModal] Error:", err);
      setErrorMessage(err?.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  const showParcelamento = formaPagamento === "parcelado" || formaPagamento === "entrada_parcelas";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Configurar Contrato
          </DialogTitle>
          <DialogDescription>
            Configure os termos do contrato para <strong>{clientName}</strong>
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <p className="text-lg font-medium text-green-600">Contrato gerado com sucesso!</p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Erros */}
            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {errorMessage}
                  {missingFields.length > 0 && (
                    <ul className="mt-2 list-disc list-inside text-sm">
                      {missingFields.map((field) => (
                        <li key={field}>{FIELD_LABELS[field] || field}</li>
                      ))}
                    </ul>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Tipo de Remuneração */}
            <div className="space-y-2">
              <Label>Tipo de Remuneração</Label>
              <Select value={tipoRemuneracao} onValueChange={setTipoRemuneracao}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="valor_fixo">Valor Fixo</SelectItem>
                  <SelectItem value="percentual">Percentual sobre êxito</SelectItem>
                  <SelectItem value="misto">Misto (Fixo + Percentual)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Percentual (se percentual ou misto) */}
            {(tipoRemuneracao === "percentual" || tipoRemuneracao === "misto") && (
              <div className="space-y-2">
                <Label>Percentual de Honorários (%)</Label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={percentualHonorarios}
                  onChange={(e) => setPercentualHonorarios(e.target.value)}
                  placeholder="30"
                />
              </div>
            )}

            {/* Valor Fixo (se valor_fixo ou misto) */}
            {(tipoRemuneracao === "valor_fixo" || tipoRemuneracao === "misto") && (
              <div className="space-y-2">
                <Label>Valor Fixo de Honorários</Label>
                <Input
                  value={valorFixoHonorarios}
                  onChange={(e) => setValorFixoHonorarios(formatCurrency(e.target.value))}
                  placeholder="R$ 0,00"
                />
              </div>
            )}

            {/* Forma de Pagamento */}
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_vista">À Vista</SelectItem>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                  <SelectItem value="entrada_parcelas">Entrada + Parcelas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Campos de parcelamento */}
            {showParcelamento && (
              <>
                {formaPagamento === "entrada_parcelas" && (
                  <div className="space-y-2">
                    <Label>Valor de Entrada</Label>
                    <Input
                      value={valorEntrada}
                      onChange={(e) => setValorEntrada(formatCurrency(e.target.value))}
                      placeholder="R$ 0,00"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nº de Parcelas</Label>
                    <Input
                      type="number"
                      min="1"
                      max="60"
                      value={numeroParcelas}
                      onChange={(e) => setNumeroParcelas(e.target.value)}
                      placeholder="12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor da Parcela</Label>
                    <Input
                      value={valorParcela}
                      onChange={(e) => setValorParcela(formatCurrency(e.target.value))}
                      placeholder="R$ 0,00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Data da 1ª Parcela</Label>
                  <Input
                    type="date"
                    value={dataPrimeiraParcela}
                    onChange={(e) => setDataPrimeiraParcela(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Método de Pagamento */}
            <div className="space-y-2">
              <Label>Método de Pagamento</Label>
              <Select value={metodoPagamento} onValueChange={setMetodoPagamento}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Chave PIX */}
            {metodoPagamento === "pix" && (
              <div className="space-y-2">
                <Label>Chave PIX</Label>
                <Input
                  value={chavePix}
                  onChange={(e) => setChavePix(e.target.value)}
                  placeholder="CPF, CNPJ, e-mail ou chave aleatória"
                />
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {!success && (
            <>
              <Button variant="ghost" onClick={handleSkip} disabled={loading}>
                Pular
              </Button>
              <Button onClick={handleGenerateContract} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Gerar Contrato
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
