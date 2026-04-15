import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, ArrowLeftRight } from "lucide-react";

interface IrisComparisonDEProps {
    leftImageUrl?: string;
    rightImageUrl?: string;
}

const IrisComparisonDE: React.FC<IrisComparisonDEProps> = ({ leftImageUrl, rightImageUrl }) => {
    const [syncHover, setSyncHover] = useState<{ x: number; y: number } | null>(null);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setSyncHover({
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
        });
    };

    const renderEye = (imageUrl: string | undefined, label: string, side: 'OE' | 'OD') => (
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={`text-xs ${side === 'OE' ? 'border-blue-400 text-blue-400' : 'border-emerald-400 text-emerald-400'}`}>
                    <Eye className="h-3 w-3 mr-1" /> {side}
                </Badge>
                <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <div
                className="relative rounded-xl overflow-hidden bg-black aspect-square"
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setSyncHover(null)}
            >
                {imageUrl ? (
                    <>
                        <img src={imageUrl} alt={label} className="w-full h-full object-cover" />
                        {/* Sync crosshair */}
                        {syncHover && (
                            <div
                                className="absolute pointer-events-none"
                                style={{
                                    left: `${syncHover.x}%`,
                                    top: `${syncHover.y}%`,
                                    transform: 'translate(-50%, -50%)',
                                }}
                            >
                                <svg width="30" height="30" viewBox="0 0 30 30">
                                    <circle cx="15" cy="15" r="6" fill="none" stroke="rgba(20,184,166,0.6)" strokeWidth="1" />
                                    <line x1="10" y1="15" x2="20" y2="15" stroke="rgba(20,184,166,0.6)" strokeWidth="0.5" />
                                    <line x1="15" y1="10" x2="15" y2="20" stroke="rgba(20,184,166,0.6)" strokeWidth="0.5" />
                                </svg>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                            <Eye className="h-10 w-10 mx-auto opacity-20 mb-2" />
                            <p className="text-xs">Nenhuma imagem</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-teal-400" />
                <h3 className="text-sm font-semibold text-foreground">Comparação Bilateral D/E</h3>
            </div>
            <div className="flex gap-4">
                {renderEye(rightImageUrl, 'Olho Direito', 'OD')}
                {renderEye(leftImageUrl, 'Olho Esquerdo', 'OE')}
            </div>
            <p className="text-xs text-muted-foreground">
                Mova o cursor sobre uma das imagens para sincronizar a posição do crosshair em ambas.
            </p>
        </Card>
    );
};

export default IrisComparisonDE;
