import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Calendar, ArrowLeftRight } from "lucide-react";

interface IrisEvolutionSliderProps {
    beforeImage: string;
    afterImage: string;
    beforeDate?: string;
    afterDate?: string;
    zoneName?: string;
}

const IrisEvolutionSlider: React.FC<IrisEvolutionSliderProps> = ({
    beforeImage,
    afterImage,
    beforeDate = 'Anterior',
    afterDate = 'Atual',
    zoneName,
}) => {
    const [position, setPosition] = useState(50);

    return (
        <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ArrowLeftRight className="h-4 w-4 text-teal-400" />
                    <h3 className="text-sm font-semibold text-foreground">Evolução Temporal</h3>
                </div>
                {zoneName && (
                    <span className="text-xs text-teal-400 font-medium">{zoneName}</span>
                )}
            </div>

            {/* Slider comparison */}
            <div className="relative rounded-xl overflow-hidden bg-black aspect-square select-none">
                {/* After image (full) */}
                <img src={afterImage} alt="Depois" className="absolute inset-0 w-full h-full object-cover" />

                {/* Before image (clipped by slider) */}
                <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ width: `${position}%` }}
                >
                    <img
                        src={beforeImage}
                        alt="Antes"
                        className="w-full h-full object-cover"
                        style={{ width: `${10000 / position}%`, maxWidth: 'none' }}
                    />
                </div>

                {/* Divider line */}
                <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
                    style={{ left: `${position}%` }}
                >
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center">
                        <ArrowLeftRight className="h-4 w-4 text-gray-800" />
                    </div>
                </div>

                {/* Labels */}
                <div className="absolute top-3 left-3 bg-black/70 backdrop-blur rounded-lg px-2 py-1 z-20">
                    <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-blue-400" />
                        <span className="text-xs text-white font-medium">{beforeDate}</span>
                    </div>
                </div>
                <div className="absolute top-3 right-3 bg-black/70 backdrop-blur rounded-lg px-2 py-1 z-20">
                    <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-emerald-400" />
                        <span className="text-xs text-white font-medium">{afterDate}</span>
                    </div>
                </div>
            </div>

            {/* Position slider */}
            <Slider
                value={[position]}
                min={5}
                max={95}
                step={1}
                onValueChange={([v]) => setPosition(v)}
            />
        </Card>
    );
};

export default IrisEvolutionSlider;
