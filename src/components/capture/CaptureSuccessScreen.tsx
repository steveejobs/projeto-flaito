import { CheckCircle2, Copy, Plus, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface CaptureSuccessScreenProps {
  displayId: string;
  officeName?: string;
  onNewClient: () => void;
}

export function CaptureSuccessScreen({
  displayId,
  officeName,
  onNewClient,
}: CaptureSuccessScreenProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(displayId);
    toast.success("ID copiado!");
  };

  return (
    <div className="text-center py-8 space-y-6 capture-animate-in">
      {/* Success icon com animação */}
      <div className="flex justify-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center animate-[scale-in_0.3s_ease-out] shadow-lg"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          <CheckCircle2 className="w-10 h-10 text-black" strokeWidth={1.5} />
        </div>
      </div>

      {/* Título humanizado */}
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold text-white tracking-tight">
          Cadastro concluído!
        </h2>
        <p className="text-base text-white/50">
          {officeName ? `Seu cadastro em ${officeName} foi realizado` : "Cadastro realizado com sucesso"}
        </p>
      </div>

      {/* Display ID badge */}
      <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 border border-white/20">
        <span className="text-sm text-white/60">ID:</span>
        <span className="font-mono font-medium text-lg text-white">
          {displayId.slice(0, 8).toUpperCase()}
        </span>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded hover:bg-white/10 transition-colors active:scale-95"
        >
          <Copy className="w-4 h-4 text-white/60" />
        </button>
      </div>

      {/* Kit info */}
      <div className="p-5 rounded-xl bg-white/5 border border-white/10 text-left">
        <p className="text-base text-white/80 mb-3 font-medium">
          Documentos gerados:
        </p>
        <ul className="text-base text-white/60 space-y-2">
          <li className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--brand-primary)" }}
            />
            Procuração
          </li>
          <li className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--brand-primary)" }}
            />
            Declaração de Hipossuficiência
          </li>
        </ul>
        <p className="text-sm text-white/40 mt-4 italic">
          O Contrato de Honorários será gerado pelo escritório com os dados financeiros.
        </p>
      </div>

      {/* Mensagem de confiança final */}
      <p className="text-sm text-white/40 flex items-center justify-center gap-2">
        <Shield className="w-4 h-4 text-emerald-400/60" />
        Seus dados estão protegidos por sigilo profissional
      </p>

      {/* New client button */}
      <Button
        onClick={onNewClient}
        variant="outline"
        className="w-full bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white active:scale-[0.98] transition-all duration-200"
      >
        <Plus className="w-4 h-4 mr-2" />
        Cadastrar outro cliente
      </Button>
    </div>
  );
}
