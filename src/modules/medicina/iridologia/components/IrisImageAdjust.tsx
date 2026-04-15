import React, { useState, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RotateCcw, Sun, Contrast, Droplets, Eye } from "lucide-react";

interface IrisImageAdjustProps {
    imageUrl: string;
    onApply?: (filters: ImageFilters) => void;
}

export interface ImageFilters {
    brightness: number;
    contrast: number;
    saturation: number;
    hueRotate: number;
    invert: boolean;
    grayscale: number;
}

const PRESETS: { name: string; label: string; filters: Partial<ImageFilters> }[] = [
    { name: 'normal', label: 'Normal', filters: {} },
    { name: 'fibras', label: 'Revelar Fibras', filters: { contrast: 180, saturation: 50, brightness: 110 } },
    { name: 'pigmentos', label: 'Pigmentações', filters: { saturation: 200, contrast: 140 } },
    { name: 'lacunas', label: 'Lacunas', filters: { contrast: 200, brightness: 90, saturation: 0 } },
    { name: 'aneis', label: 'Anéis Nervosos', filters: { contrast: 250, saturation: 30, brightness: 95 } },
    { name: 'infrared', label: 'Infravermelho', filters: { hueRotate: 180, contrast: 150, saturation: 80 } },
];

const DEFAULT_FILTERS: ImageFilters = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    hueRotate: 0,
    invert: false,
    grayscale: 0,
};

const IrisImageAdjust: React.FC<IrisImageAdjustProps> = ({ imageUrl, onApply }) => {
    const [filters, setFilters] = useState<ImageFilters>({ ...DEFAULT_FILTERS });

    const filterStyle = useMemo(() => ({
        filter: `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) hue-rotate(${filters.hueRotate}deg) ${filters.invert ? 'invert(1)' : ''} grayscale(${filters.grayscale}%)`,
        transition: 'filter 0.3s ease',
    }), [filters]);

    const handleReset = () => setFilters({ ...DEFAULT_FILTERS });

    const handlePreset = (preset: typeof PRESETS[0]) => {
        setFilters({ ...DEFAULT_FILTERS, ...preset.filters });
    };

    const updateFilter = (key: keyof ImageFilters, value: number) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="space-y-4">
            {/* Image preview */}
            <div className="relative rounded-xl overflow-hidden bg-black">
                <img src={imageUrl} alt="Íris" className="w-full h-auto" style={filterStyle} />
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-2">
                {PRESETS.map(p => (
                    <Button
                        key={p.name}
                        variant="outline"
                        size="sm"
                        onClick={() => handlePreset(p)}
                        className="text-xs rounded-full"
                    >
                        {p.label}
                    </Button>
                ))}
            </div>

            {/* Controls */}
            <Card className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">Ajustes de Imagem</h4>
                    <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs gap-1">
                        <RotateCcw className="h-3 w-3" /> Resetar
                    </Button>
                </div>

                <div className="space-y-3">
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><Sun className="h-3 w-3" /> Brilho</span>
                            <span className="text-xs font-mono text-muted-foreground">{filters.brightness}%</span>
                        </div>
                        <Slider value={[filters.brightness]} min={0} max={300} step={5} onValueChange={([v]) => updateFilter('brightness', v)} />
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><Contrast className="h-3 w-3" /> Contraste</span>
                            <span className="text-xs font-mono text-muted-foreground">{filters.contrast}%</span>
                        </div>
                        <Slider value={[filters.contrast]} min={0} max={300} step={5} onValueChange={([v]) => updateFilter('contrast', v)} />
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><Droplets className="h-3 w-3" /> Saturação</span>
                            <span className="text-xs font-mono text-muted-foreground">{filters.saturation}%</span>
                        </div>
                        <Slider value={[filters.saturation]} min={0} max={300} step={5} onValueChange={([v]) => updateFilter('saturation', v)} />
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" /> Matiz</span>
                            <span className="text-xs font-mono text-muted-foreground">{filters.hueRotate}°</span>
                        </div>
                        <Slider value={[filters.hueRotate]} min={0} max={360} step={10} onValueChange={([v]) => updateFilter('hueRotate', v)} />
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Escala de cinza</span>
                            <span className="text-xs font-mono text-muted-foreground">{filters.grayscale}%</span>
                        </div>
                        <Slider value={[filters.grayscale]} min={0} max={100} step={5} onValueChange={([v]) => updateFilter('grayscale', v)} />
                    </div>
                </div>

                {onApply && (
                    <Button onClick={() => onApply(filters)} className="w-full bg-teal-600 hover:bg-teal-500 text-white">
                        Aplicar Filtros
                    </Button>
                )}
            </Card>
        </div>
    );
};

export default IrisImageAdjust;
