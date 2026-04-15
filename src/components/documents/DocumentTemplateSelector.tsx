import React from 'react';
import { DocumentTemplateId } from '@/types/institutional';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Briefcase, FileText, Eraser } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TemplateOption {
  id: DocumentTemplateId;
  name: string;
  description: string;
  icon: React.ElementType;
  tag: string;
}

const TEMPLATE_OPTIONS: TemplateOption[] = [
  {
    id: 'premium_elegant',
    name: 'Premium Elegante',
    description: 'Estilo clássico jurídico com bordas e tipografia Serif.',
    icon: Crown,
    tag: 'Recomendado para Advocacia'
  },
  {
    id: 'modern_executive',
    name: 'Moderno Executivo',
    description: 'Visual limpo, corporativo e tecnológico.',
    icon: Briefcase,
    tag: 'Recomendado para Medicina'
  },
  {
    id: 'clean_white',
    name: 'Clean White',
    description: 'Minimalismo máximo para economia de tinta e clareza.',
    icon: Eraser,
    tag: 'Econômico'
  },
  {
    id: 'simple_watermark',
    name: 'Marca D\'água',
    description: 'Foco na identidade institucional e fluidez.',
    icon: FileText,
    tag: 'Institucional'
  }
];

interface DocumentTemplateSelectorProps {
  value: DocumentTemplateId;
  onChange: (id: DocumentTemplateId) => void;
  className?: string;
}

export const DocumentTemplateSelector: React.FC<DocumentTemplateSelectorProps> = ({
  value,
  onChange,
  className = ''
}) => {
  return (
    <div className={cn("grid grid-cols-1 gap-3", className)}>
      {TEMPLATE_OPTIONS.map((opt) => {
        const isSelected = value === opt.id;
        const Icon = opt.icon;

        return (
          <Card
            key={opt.id}
            role="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "relative p-4 cursor-pointer transition-all border-2 flex items-start gap-4 hover:bg-accent/50",
              isSelected ? "border-primary bg-primary/5" : "border-transparent"
            )}
          >
            <div className={cn(
              "p-2 rounded-lg",
              isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}>
              <Icon className="h-5 w-5" />
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">{opt.name}</h4>
                {isSelected && <Check className="h-4 w-4 text-primary" />}
              </div>
              <p className="text-xs text-muted-foreground leading-tight">
                {opt.description}
              </p>
              <Badge variant="outline" className="text-[10px] uppercase font-bold py-0 h-4">
                {opt.tag}
              </Badge>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
