import { useState } from "react";
import { Info, Sparkles, Bug, Zap, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useVersion } from "@/hooks/useVersion";
import { formatChangelogDate, type ChangelogChange } from "@/lib/changelog";

interface VersionButtonProps {
  collapsed?: boolean;
}

const changeTypeConfig: Record<ChangelogChange['type'], { icon: typeof Sparkles; label: string; className: string }> = {
  feature: { icon: Sparkles, label: "Novo", className: "text-emerald-500" },
  fix: { icon: Bug, label: "Correção", className: "text-amber-500" },
  improvement: { icon: Zap, label: "Melhoria", className: "text-blue-500" },
  breaking: { icon: AlertTriangle, label: "Crítico", className: "text-destructive" },
};

export function VersionButton({ collapsed = false }: VersionButtonProps) {
  const [open, setOpen] = useState(false);
  const { label, changelog, lastUpdateFormatted } = useVersion();

  const buttonContent = (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-center text-muted-foreground hover:text-foreground"
    >
      <Info className="h-4 w-4 shrink-0" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
            <TooltipContent side="right">
              <p>{label} • {lastUpdateFormatted}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          buttonContent
        )}
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Histórico de Versões
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {changelog.map((entry, index) => (
              <div key={entry.version} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant={index === 0 ? "default" : "secondary"}>
                      v{entry.version}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatChangelogDate(entry.date)}
                    </span>
                  </div>
                  {index === 0 && (
                    <Badge variant="outline" className="text-xs">
                      Atual
                    </Badge>
                  )}
                </div>

                <h4 className="font-medium">{entry.title}</h4>

                <ul className="space-y-2">
                  {entry.changes.map((change, changeIndex) => {
                    const config = changeTypeConfig[change.type];
                    const Icon = config.icon;

                    return (
                      <li key={changeIndex} className="flex items-start gap-2 text-sm">
                        <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${config.className}`} />
                        <span className="text-muted-foreground">{change.description}</span>
                      </li>
                    );
                  })}
                </ul>

                {index < changelog.length - 1 && (
                  <div className="border-t pt-4" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
