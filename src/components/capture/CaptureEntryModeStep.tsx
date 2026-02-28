import { useState } from "react";
import { Camera, Keyboard, ChevronDown, FileText, MapPin, PenTool, Clock, Shield, Paperclip, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export type EntryMode = "SCAN" | "MANUAL";

interface CaptureEntryModeStepProps {
  onSelect: (mode: EntryMode) => void;
}

function GuideSection({
  icon: Icon,
  iconColor,
  title,
  children,
  defaultOpen = false,
}: {
  icon: React.ElementType;
  iconColor: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full flex items-center justify-between p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left">
        <div className="flex items-center gap-3">
          <Icon className={cn("w-5 h-5", iconColor)} strokeWidth={1.5} />
          <span className="text-base font-medium text-white/90">{title}</span>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-white/40 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 pt-2">
        <div className="pl-8 space-y-2 text-base text-white/60 leading-relaxed">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function CaptureGuide() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-6">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        {/* Header */}
        <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
              <Info className="w-5 h-5 text-white/70" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Como funciona o cadastro?
              </h3>
              <p className="text-sm text-white/50">
                Tudo o que você precisa saber
              </p>
            </div>
          </div>
          <ChevronDown
            className={cn(
              "w-5 h-5 text-white/40 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </CollapsibleTrigger>

        {/* Content */}
        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-2">
            {/* Intro */}
            <p className="text-base text-white/60 leading-relaxed pb-2 border-b border-white/5">
              Cadastro rápido, seguro e em conformidade com a LGPD. Seus dados
              são protegidos por sigilo profissional.
            </p>

            {/* Sections */}
            <GuideSection
              icon={Camera}
              iconColor="text-emerald-400"
              title="Formas de Preenchimento"
            >
              <div className="space-y-3">
                <div>
                  <p className="text-white/80 font-medium flex items-center gap-2">
                    <Camera className="w-4 h-4 text-emerald-400" />
                    Escanear Documentos (Recomendado)
                  </p>
                  <p className="text-white/50 mt-1">
                    Fotografe seu RG, CNH ou comprovante de endereço e nosso
                    sistema preenche os dados automaticamente. Mais rápido e
                    evita erros de digitação.
                  </p>
                </div>
                <div>
                  <p className="text-white/80 font-medium flex items-center gap-2">
                    <Keyboard className="w-4 h-4 text-white/60" />
                    Digitar Manualmente
                  </p>
                  <p className="text-white/50 mt-1">
                    Preencha você mesmo os campos do formulário. Ideal se você
                    não tiver os documentos em mãos no momento.
                  </p>
                </div>
              </div>
            </GuideSection>

            <GuideSection
              icon={FileText}
              iconColor="text-amber-400"
              title="O que você vai precisar"
            >
              <div className="space-y-3">
                <div>
                  <p className="text-white/80 font-medium">
                    📄 Documento de Identidade
                  </p>
                  <p className="text-white/50 mt-1">
                    RG, CNH ou outro documento oficial com foto. Será usado para
                    confirmar seus dados pessoais (nome, CPF, data de
                    nascimento).
                  </p>
                </div>
                <div>
                  <p className="text-white/80 font-medium">
                    🏠 Comprovante de Endereço
                  </p>
                  <p className="text-white/50 mt-1">
                    Conta de luz, água, telefone ou correspondência bancária dos
                    últimos 3 meses. Confirma seu endereço atual.
                  </p>
                </div>
              </div>
            </GuideSection>

            <GuideSection
              icon={Paperclip}
              iconColor="text-blue-400"
              title="Anexar Documentos"
            >
              <p>
                Durante o cadastro, há a opção de enviar cópias dos seus
                documentos em formato de foto ou PDF. Esses arquivos ficam
                armazenados de forma segura e criptografada, acessíveis apenas
                pelo escritório.
              </p>
              <p className="text-white/40 text-sm mt-2">
                Formatos aceitos: JPG, PNG, PDF (máximo 10MB por arquivo)
              </p>
            </GuideSection>

            <GuideSection
              icon={PenTool}
              iconColor="text-violet-400"
              title="Assinatura Digital"
            >
              <p>
                Na última etapa, você assinará diretamente na tela do seu
                celular ou computador usando o dedo ou mouse. Essa assinatura
                tem validade jurídica e será utilizada nos documentos gerados
                pelo escritório.
              </p>
              <p className="text-white/40 text-sm mt-2">
                💡 Dica: Em celulares, gire a tela para a posição horizontal
                para assinar com mais conforto.
              </p>
            </GuideSection>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2 border-t border-white/5">
              <div className="flex items-center gap-2 text-white/50 text-sm">
                <Clock className="w-4 h-4" />
                <span>Tempo estimado: 3 a 5 minutos</span>
              </div>
              <div className="flex items-center gap-2 text-emerald-400/70 text-sm">
                <Shield className="w-4 h-4" />
                <span>Dados criptografados • Sigilo OAB</span>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function CaptureEntryModeStep({ onSelect }: CaptureEntryModeStepProps) {
  return (
    <div className="space-y-5 capture-animate-in">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold text-white tracking-tight">
          Bem-vindo ao cadastro
        </h2>
        <p className="text-base text-white/50 mt-2">
          Leva menos de 5 minutos
        </p>
      </div>

      {/* Guide Card */}
      <CaptureGuide />

      {/* Entry Mode Selection */}
      <div className="space-y-3">
        <p className="text-base text-white/70 font-medium">
          Como deseja cadastrar?
        </p>

        <div className="grid gap-3">
          {/* Scan option */}
          <button
            type="button"
            onClick={() => onSelect("SCAN")}
            className={cn(
              "group p-5 rounded-xl border-2 bg-white/[0.03]",
              "border-[var(--brand-primary)]/40",
              "hover:border-[var(--brand-primary)]/70 hover:bg-white/[0.06]",
              "active:scale-[0.98] transition-all duration-200 text-left"
            )}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 shadow-lg"
                style={{ backgroundColor: "var(--brand-primary)" }}
              >
                <Camera className="w-7 h-7 text-black" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">
                  Escanear Documentos
                </h3>
                <p className="text-base text-white/60 leading-relaxed">
                  Fotografe RG/CNH e comprovante de endereço
                </p>
                <span
                  className="inline-flex mt-2.5 text-[10px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full shadow-sm"
                  style={{
                    backgroundColor: "var(--brand-primary)",
                    color: "#000",
                  }}
                >
                  Recomendado
                </span>
              </div>
            </div>
          </button>

          {/* Manual option */}
          <button
            type="button"
            onClick={() => onSelect("MANUAL")}
            className={cn(
              "group p-5 rounded-xl border border-white/10 bg-white/[0.02]",
              "hover:border-white/20 hover:bg-white/[0.05]",
              "active:scale-[0.98] transition-all duration-200 text-left"
            )}
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <Keyboard className="w-7 h-7 text-white/70" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  Digitar Manualmente
                </h3>
                <p className="text-base text-white/60 leading-relaxed">
                  Preencha os dados diretamente no formulário
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
