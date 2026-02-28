import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Mic, Link2, Unlink, Expand, Sparkles, Loader2, 
  AlertCircle, Clock, CheckCircle2 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PlaudAsset {
  id: string;
  title: string;
  transcript: string | null;
  summary: string | null;
  received_at: string;
  created_at_source: string | null;
  case_id: string | null;
  audio_url: string | null;
  duration: number | null;
}

type AiStatus = "none" | "queued" | "running" | "done" | "failed";

interface PlaudAssetCardProps {
  asset: PlaudAsset;
  aiStatus: AiStatus;
  onExpand: () => void;
  onLink?: () => void;
  onUnlink?: () => void;
}

function AiStatusBadge({ status }: { status: AiStatus }) {
  switch (status) {
    case "queued":
      return (
        <Badge variant="outline" className="text-xs gap-1">
          <Clock className="h-3 w-3" />
          Na fila
        </Badge>
      );
    case "running":
      return (
        <Badge variant="secondary" className="text-xs gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Analisando...
        </Badge>
      );
    case "done":
      return (
        <Badge className="text-xs gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
          <Sparkles className="h-3 w-3" />
          IA Pronto
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="text-xs gap-1">
          <AlertCircle className="h-3 w-3" />
          Erro
        </Badge>
      );
    default:
      return null;
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function PlaudAssetCard({
  asset,
  aiStatus,
  onExpand,
  onLink,
  onUnlink,
}: PlaudAssetCardProps) {
  const timeAgo = formatDistanceToNow(new Date(asset.received_at), {
    addSuffix: true,
    locale: ptBR,
  });

  const preview = asset.summary?.slice(0, 120) || asset.transcript?.slice(0, 120);

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
              <h4 className="font-medium text-sm truncate">{asset.title}</h4>
            </div>
            
            {preview && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                {preview}...
              </p>
            )}
            
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
              
              {asset.duration && (
                <Badge variant="outline" className="text-xs">
                  {formatDuration(asset.duration)}
                </Badge>
              )}
              
              <AiStatusBadge status={aiStatus} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onExpand}
              title="Expandir"
            >
              <Expand className="h-4 w-4" />
            </Button>
            
            {onLink && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                onClick={onLink}
                title="Vincular ao caso"
              >
                <Link2 className="h-4 w-4" />
              </Button>
            )}
            
            {onUnlink && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                onClick={onUnlink}
                title="Desvincular"
              >
                <Unlink className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
