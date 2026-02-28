import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function NijaTooltip() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-4 w-4 cursor-pointer text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">
        O NIJA é o módulo inteligente do Projeto Flaito que analisa automaticamente documentos e identifica erros, nulidades, riscos, prescrição e estratégias jurídicas.
      </TooltipContent>
    </Tooltip>
  );
}
