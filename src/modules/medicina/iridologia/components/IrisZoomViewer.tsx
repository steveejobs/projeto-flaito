import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Slider } from "@/components/ui/slider";
import { ZoomIn, ZoomOut, Move } from "lucide-react";

interface IrisZoomViewerProps {
    imageUrl: string;
    className?: string;
}

const IrisZoomViewer: React.FC<IrisZoomViewerProps> = ({ imageUrl, className = '' }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [showLens, setShowLens] = useState(false);
    const [lensPos, setLensPos] = useState({ x: 0, y: 0 });

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        setZoom(prev => Math.max(1, Math.min(10, prev + (e.deltaY > 0 ? -0.3 : 0.3))));
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (zoom > 1) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
        }
        // Lens position
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
            setLensPos({
                x: ((e.clientX - rect.left) / rect.width) * 100,
                y: ((e.clientY - rect.top) / rect.height) * 100,
            });
        }
    };

    const handleMouseUp = () => setIsDragging(false);

    return (
        <div className={`space-y-3 ${className}`}>
            <div
                ref={containerRef}
                className="relative overflow-hidden rounded-xl bg-black cursor-crosshair select-none"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => { setIsDragging(false); setShowLens(false); }}
                onMouseEnter={() => setShowLens(true)}
                style={{ aspectRatio: '1/1' }}
            >
                <img
                    src={imageUrl}
                    alt="Íris zoom"
                    className="w-full h-full object-cover"
                    style={{
                        transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                        transition: isDragging ? 'none' : 'transform 0.2s ease',
                        transformOrigin: `${lensPos.x}% ${lensPos.y}%`,
                    }}
                    draggable={false}
                />

                {/* Zoom level indicator */}
                <div className="absolute top-3 right-3 bg-black/70 backdrop-blur rounded-lg px-3 py-1.5">
                    <span className="text-xs font-mono text-white">{zoom.toFixed(1)}x</span>
                </div>

                {/* Crosshair at center when zoomed */}
                {zoom > 1 && (
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                        <svg width="40" height="40" viewBox="0 0 40 40">
                            <circle cx="20" cy="20" r="8" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
                            <line x1="15" y1="20" x2="25" y2="20" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" />
                            <line x1="20" y1="15" x2="20" y2="25" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" />
                        </svg>
                    </div>
                )}

                {/* Coordinate readout */}
                {showLens && zoom > 2 && (
                    <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur rounded-lg px-3 py-1.5 flex items-center gap-2">
                        <Move className="h-3 w-3 text-white/60" />
                        <span className="text-xs font-mono text-white/80">
                            {lensPos.x.toFixed(0)}%, {lensPos.y.toFixed(0)}%
                        </span>
                    </div>
                )}
            </div>

            {/* Zoom slider */}
            <div className="flex items-center gap-3">
                <ZoomOut className="h-4 w-4 text-muted-foreground" />
                <Slider
                    value={[zoom]}
                    min={1}
                    max={10}
                    step={0.1}
                    onValueChange={([v]) => setZoom(v)}
                    className="flex-1"
                />
                <ZoomIn className="h-4 w-4 text-muted-foreground" />
            </div>
        </div>
    );
};

export default IrisZoomViewer;
