import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Palette, Settings2, RotateCcw, Save, Type, Maximize2, Layout, Sparkles } from "lucide-react";
import { useOfficeUISettings, DEFAULT_SETTINGS, type OfficeUISettings } from '@/contexts/OfficeUISettingsContext';
import { useOfficeRole } from '@/hooks/useOfficeRole';
import { toast } from '@/hooks/use-toast';

const FONT_OPTIONS = [
  { value: 'inter', label: 'Inter', description: 'Moderna e limpa' },
  { value: 'ibm_plex_sans', label: 'IBM Plex Sans', description: 'Profissional e técnica' },
  { value: 'source_sans_3', label: 'Source Sans 3', description: 'Equilibrada e legível' },
] as const;

const DENSITY_OPTIONS = [
  { value: 'compact', label: 'Compacto', description: 'Menos espaçamento' },
  { value: 'normal', label: 'Normal', description: 'Espaçamento padrão' },
  { value: 'comfortable', label: 'Confortável', description: 'Mais espaçamento' },
] as const;

const ACCENT_OPTIONS = [
  { value: 'gold', label: 'Ouro', color: 'bg-amber-500' },
  { value: 'silver', label: 'Prata', color: 'bg-slate-400' },
  { value: 'blue', label: 'Azul', color: 'bg-blue-500' },
] as const;

export default function AparenciaPage() {
  const { settings, loading, updateSettings, refetch } = useOfficeUISettings();
  const { role, loading: roleLoading } = useOfficeRole();
  const isAdmin = role === 'OWNER' || role === 'ADMIN';
  
  // Local form state
  const [formData, setFormData] = useState<OfficeUISettings>(settings);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Sync form with loaded settings
  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  // Check for changes
  useEffect(() => {
    const changed = 
      formData.ui_font !== settings.ui_font ||
      formData.ui_scale !== settings.ui_scale ||
      formData.ui_density !== settings.ui_density ||
      formData.accent !== settings.accent ||
      formData.sidebar_logo_scale !== settings.sidebar_logo_scale;
    setHasChanges(changed);
  }, [formData, settings]);

  const handleSave = async () => {
    setSaving(true);
    const success = await updateSettings(formData);
    setSaving(false);

    if (success) {
      toast({
        title: 'Configurações salvas',
        description: 'As alterações de aparência foram aplicadas.',
      });
    } else {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    }
  };

  const handleResetDefaults = async () => {
    setSaving(true);
    const success = await updateSettings(DEFAULT_SETTINGS);
    setSaving(false);

    if (success) {
      setFormData(DEFAULT_SETTINGS);
      toast({
        title: 'Padrões restaurados',
        description: 'A aparência foi restaurada para o padrão institucional.',
      });
    } else {
      toast({
        title: 'Erro ao restaurar',
        description: 'Não foi possível restaurar os padrões.',
        variant: 'destructive',
      });
    }
  };

  const isLoading = loading || roleLoading;
  const isDisabled = !isAdmin || saving;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Palette className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Aparência do Sistema</h1>
          <p className="text-sm text-muted-foreground">
            Personalize a interface do seu escritório
          </p>
        </div>
      </div>

      {/* Access info for non-admins */}
      {!isAdmin && !roleLoading && (
        <Card className="border-muted bg-muted/30">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              Apenas proprietários e administradores podem alterar as configurações de aparência.
              Você está visualizando as configurações atuais do escritório.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Font Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Type className="h-5 w-5" />
            Fonte da Interface
          </CardTitle>
          <CardDescription>
            Escolha a fonte utilizada em toda a interface do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select 
            value={formData.ui_font} 
            onValueChange={(v) => setFormData(prev => ({ ...prev, ui_font: v as OfficeUISettings['ui_font'] }))}
            disabled={isDisabled || isLoading}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione uma fonte" />
            </SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-muted-foreground ml-2">— {opt.description}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Scale Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Maximize2 className="h-5 w-5" />
            Escala da Fonte
          </CardTitle>
          <CardDescription>
            Ajuste o tamanho base do texto (95% a 105%)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Slider
              value={[formData.ui_scale]}
              onValueChange={([v]) => setFormData(prev => ({ ...prev, ui_scale: v }))}
              min={0.95}
              max={1.05}
              step={0.01}
              disabled={isDisabled || isLoading}
              className="flex-1"
            />
            <span className="text-sm font-mono w-16 text-right">
              {Math.round(formData.ui_scale * 100)}%
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Density Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Layout className="h-5 w-5" />
            Densidade
          </CardTitle>
          <CardDescription>
            Controla o espaçamento entre elementos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={formData.ui_density}
            onValueChange={(v) => setFormData(prev => ({ ...prev, ui_density: v as OfficeUISettings['ui_density'] }))}
            disabled={isDisabled || isLoading}
            className="flex flex-wrap gap-4"
          >
            {DENSITY_OPTIONS.map(opt => (
              <div key={opt.value} className="flex items-center space-x-2">
                <RadioGroupItem value={opt.value} id={`density-${opt.value}`} />
                <Label htmlFor={`density-${opt.value}`} className="cursor-pointer">
                  <span className="font-medium">{opt.label}</span>
                  <span className="text-muted-foreground text-xs ml-1">({opt.description})</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Accent Color */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5" />
            Cor de Destaque
          </CardTitle>
          <CardDescription>
            Cor utilizada em elementos de destaque e acentos visuais
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={formData.accent}
            onValueChange={(v) => setFormData(prev => ({ ...prev, accent: v as OfficeUISettings['accent'] }))}
            disabled={isDisabled || isLoading}
            className="flex flex-wrap gap-4"
          >
            {ACCENT_OPTIONS.map(opt => (
              <div key={opt.value} className="flex items-center space-x-2">
                <RadioGroupItem value={opt.value} id={`accent-${opt.value}`} />
                <Label htmlFor={`accent-${opt.value}`} className="cursor-pointer flex items-center gap-2">
                  <span className={`w-4 h-4 rounded-full ${opt.color}`} />
                  <span className="font-medium">{opt.label}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Sidebar Logo Scale */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings2 className="h-5 w-5" />
            Tamanho da Logo na Sidebar
          </CardTitle>
          <CardDescription>
            Ajuste o tamanho da logo no menu lateral (90% a 115%)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Slider
              value={[formData.sidebar_logo_scale]}
              onValueChange={([v]) => setFormData(prev => ({ ...prev, sidebar_logo_scale: v }))}
              min={0.90}
              max={1.15}
              step={0.01}
              disabled={isDisabled || isLoading}
              className="flex-1"
            />
            <span className="text-sm font-mono w-16 text-right">
              {Math.round(formData.sidebar_logo_scale * 100)}%
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {isAdmin && (
        <div className="flex items-center gap-3 pt-4">
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || saving}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleResetDefaults}
            disabled={saving}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Restaurar Padrão
          </Button>
        </div>
      )}

      {/* Info about legal documents */}
      <Card className="border-muted bg-muted/20">
        <CardContent className="py-4">
          <p className="text-xs text-muted-foreground">
            <strong>Nota:</strong> Estas configurações afetam apenas a interface do sistema. 
            Documentos jurídicos e impressões utilizam formatação padronizada (Times New Roman) 
            conforme normas técnicas, independentemente destas configurações.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
