import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ComingSoonPlaceholderProps {
  title?: string;
  description?: string;
}

export function ComingSoonPlaceholder({
  title = "Funcionalidade em desenvolvimento",
  description = "Esta area esta sendo construida e estara disponivel em breve."
}: ComingSoonPlaceholderProps) {
  return (
    <div className="container mx-auto p-6 flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full border-dashed">
        <CardContent className="flex flex-col items-center text-center py-12 px-6 space-y-4">
          <div className="p-4 bg-muted rounded-full">
            <Construction className="h-8 w-8 text-muted-foreground" />
          </div>
          <Badge variant="secondary" className="text-xs uppercase tracking-wider">
            Em desenvolvimento
          </Badge>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </CardContent>
      </Card>
    </div>
  );
}
