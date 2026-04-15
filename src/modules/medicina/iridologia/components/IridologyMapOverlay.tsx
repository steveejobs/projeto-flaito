import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Eye, RotateCcw } from "lucide-react";

type MapType = 'jensen' | 'deck' | 'angerer';

interface IridologyMapOverlayProps {
    imageUrl: string;
    eye: 'left' | 'right';
    onZoneClick?: (zone: { number: number; name: string; system: string }) => void;
}

// Jensen iridology map zones (simplified, 12 sectors)
const JENSEN_ZONES: { number: number; name: string; system: string; startAngle: number; endAngle: number; ring: number }[] = [
    // Ring 1 = pupillary zone (innermost), Ring 2 = ciliary, Ring 3 = humoral, Ring 4 = sclera
    { number: 1, name: 'Cérebro', system: 'Neurológico', startAngle: 80, endAngle: 100, ring: 3 },
    { number: 2, name: 'Pulmão', system: 'Respiratório', startAngle: 100, endAngle: 130, ring: 3 },
    { number: 3, name: 'Coração', system: 'Cardiovascular', startAngle: 130, endAngle: 160, ring: 3 },
    { number: 4, name: 'Fígado', system: 'Digestivo', startAngle: 160, endAngle: 190, ring: 3 },
    { number: 5, name: 'Rim', system: 'Urinário', startAngle: 190, endAngle: 220, ring: 3 },
    { number: 6, name: 'Intestino Grosso', system: 'Digestivo', startAngle: 220, endAngle: 250, ring: 2 },
    { number: 7, name: 'Intestino Delgado', system: 'Digestivo', startAngle: 250, endAngle: 280, ring: 1 },
    { number: 8, name: 'Estômago', system: 'Digestivo', startAngle: 280, endAngle: 310, ring: 1 },
    { number: 9, name: 'Tireoide', system: 'Endócrino', startAngle: 310, endAngle: 340, ring: 2 },
    { number: 10, name: 'Baço/Pâncreas', system: 'Imunológico', startAngle: 340, endAngle: 10, ring: 2 },
    { number: 11, name: 'Coluna Vertebral', system: 'Musculoesquelético', startAngle: 10, endAngle: 40, ring: 3 },
    { number: 12, name: 'Sistema Linfático', system: 'Imunológico', startAngle: 40, endAngle: 80, ring: 4 },
];

const RING_NAMES: Record<number, string> = {
    1: 'Zona Pupilar',
    2: 'Zona Ciliar',
    3: 'Zona Humoral',
    4: 'Esclera',
};

const RING_RADII: Record<number, { inner: number; outer: number }> = {
    1: { inner: 15, outer: 25 },
    2: { inner: 25, outer: 35 },
    3: { inner: 35, outer: 45 },
    4: { inner: 45, outer: 50 },
};

const MAP_LABELS: Record<MapType, string> = {
    jensen: 'Mapa de Jensen',
    deck: 'Mapa de Deck',
    angerer: 'Mapa de Angerer',
};

const IridologyMapOverlay: React.FC<IridologyMapOverlayProps> = ({
    imageUrl,
    eye,
    onZoneClick,
}) => {
    const [mapType, setMapType] = useState<MapType>('jensen');
    const [opacity, setOpacity] = useState(50);
    const [rotation, setRotation] = useState(0);
    const [scale, setScale] = useState(100);
    const [hoveredZone, setHoveredZone] = useState<number | null>(null);
    const [showLabels, setShowLabels] = useState(true);

    const zones = useMemo(() => {
        // Mirror zones horizontally for left eye
        if (eye === 'left') {
            return JENSEN_ZONES.map(z => ({
                ...z,
                startAngle: (360 - z.endAngle + 360) % 360,
                endAngle: (360 - z.startAngle + 360) % 360,
            }));
        }
        return JENSEN_ZONES;
    }, [eye]);

    const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
        const rad = ((angleDeg - 90) * Math.PI) / 180;
        return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    };

    const createArcPath = (cx: number, cy: number, innerR: number, outerR: number, startAngle: number, endAngle: number) => {
        let sweep = endAngle - startAngle;
        if (sweep < 0) sweep += 360;
        const largeArc = sweep > 180 ? 1 : 0;

        const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
        const outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
        const innerStart = polarToCartesian(cx, cy, innerR, endAngle);
        const innerEnd = polarToCartesian(cx, cy, innerR, startAngle);

        return [
            `M ${outerStart.x} ${outerStart.y}`,
            `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
            `L ${innerStart.x} ${innerStart.y}`,
            `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEnd.x} ${innerEnd.y}`,
            'Z',
        ].join(' ');
    };

    const zoneMidAngle = (zone: typeof JENSEN_ZONES[0]) => {
        let mid = (zone.startAngle + zone.endAngle) / 2;
        if (zone.endAngle < zone.startAngle) mid = ((zone.startAngle + zone.endAngle + 360) / 2) % 360;
        return mid;
    };

    return (
        <div className="space-y-4">
            {/* Overlaid image + map */}
            <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '1/1' }}>
                <img src={imageUrl} alt={`Íris ${eye === 'left' ? 'esquerda' : 'direita'}`} className="w-full h-full object-cover" />

                {/* SVG Map Overlay */}
                <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 100 100"
                    style={{
                        opacity: opacity / 100,
                        transform: `rotate(${rotation}deg) scale(${scale / 100})`,
                        transformOrigin: 'center center',
                        transition: 'opacity 0.2s, transform 0.2s',
                    }}
                >
                    {/* Concentric rings */}
                    {[1, 2, 3, 4].map(ring => (
                        <circle
                            key={ring}
                            cx="50" cy="50"
                            r={RING_RADII[ring].outer}
                            fill="none"
                            stroke="rgba(255,255,255,0.3)"
                            strokeWidth="0.2"
                        />
                    ))}

                    {/* Pupil center */}
                    <circle cx="50" cy="50" r="15" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.3" strokeDasharray="2 1" />

                    {/* Zone sectors */}
                    {zones.map(zone => {
                        const ringRadii = RING_RADII[zone.ring];
                        const path = createArcPath(50, 50, ringRadii.inner, ringRadii.outer, zone.startAngle, zone.endAngle);
                        const isHovered = hoveredZone === zone.number;

                        return (
                            <g key={zone.number}>
                                <path
                                    d={path}
                                    fill={isHovered ? 'rgba(20, 184, 166, 0.4)' : 'rgba(255,255,255,0.05)'}
                                    stroke={isHovered ? 'rgba(20, 184, 166, 0.8)' : 'rgba(255,255,255,0.25)'}
                                    strokeWidth={isHovered ? '0.5' : '0.2'}
                                    className="cursor-pointer transition-all duration-200"
                                    onMouseEnter={() => setHoveredZone(zone.number)}
                                    onMouseLeave={() => setHoveredZone(null)}
                                    onClick={() => onZoneClick?.({ number: zone.number, name: zone.name, system: zone.system })}
                                />
                                {/* Zone label */}
                                {showLabels && (() => {
                                    const mid = zoneMidAngle(zone);
                                    const midR = (ringRadii.inner + ringRadii.outer) / 2;
                                    const pos = polarToCartesian(50, 50, midR, mid);
                                    return (
                                        <text
                                            x={pos.x}
                                            y={pos.y}
                                            textAnchor="middle"
                                            dominantBaseline="central"
                                            fill="white"
                                            fontSize="2"
                                            fontWeight="600"
                                            className="pointer-events-none select-none"
                                            style={{ textShadow: '0 0 3px rgba(0,0,0,0.8)' }}
                                        >
                                            {zone.number}
                                        </text>
                                    );
                                })()}
                            </g>
                        );
                    })}
                </svg>

                {/* Hovered zone info */}
                {hoveredZone && (
                    <div className="absolute top-3 left-3 bg-black/80 backdrop-blur rounded-lg px-3 py-2">
                        <p className="text-xs font-bold text-teal-400">
                            Zona {hoveredZone}: {zones.find(z => z.number === hoveredZone)?.name}
                        </p>
                        <p className="text-[10px] text-white/70">
                            Sistema: {zones.find(z => z.number === hoveredZone)?.system} • {RING_NAMES[zones.find(z => z.number === hoveredZone)?.ring || 1]}
                        </p>
                    </div>
                )}

                {/* Eye label */}
                <div className="absolute top-3 right-3 bg-black/70 backdrop-blur rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                    <Eye className="h-3 w-3 text-teal-400" />
                    <span className="text-xs font-bold text-white">{eye === 'left' ? 'OE' : 'OD'}</span>
                </div>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Mapa</label>
                    <Select value={mapType} onValueChange={(v) => setMapType(v as MapType)}>
                        <SelectTrigger className="text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(MAP_LABELS).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Opacidade: {opacity}%</label>
                    <Slider value={[opacity]} min={0} max={100} step={5} onValueChange={([v]) => setOpacity(v)} />
                </div>

                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Rotação: {rotation}°</label>
                    <Slider value={[rotation]} min={-180} max={180} step={5} onValueChange={([v]) => setRotation(v)} />
                </div>

                <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Escala: {scale}%</label>
                    <Slider value={[scale]} min={50} max={150} step={5} onValueChange={([v]) => setScale(v)} />
                </div>
            </div>

            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setRotation(0); setScale(100); setOpacity(50); }} className="gap-1 text-xs">
                    <RotateCcw className="h-3 w-3" /> Resetar
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowLabels(!showLabels)} className="text-xs">
                    {showLabels ? 'Ocultar Números' : 'Mostrar Números'}
                </Button>
            </div>
        </div>
    );
};

export default IridologyMapOverlay;
