import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PenTool, Type, ArrowRight, Circle, Square, Undo2, Trash2, Download } from "lucide-react";

type Tool = 'pen' | 'text' | 'arrow' | 'circle' | 'rect';
interface Annotation {
    id: string;
    type: Tool;
    data: any;
    color: string;
}

interface IrisAnnotationCanvasProps {
    imageUrl: string;
    annotations?: Annotation[];
    onChange?: (annotations: Annotation[]) => void;
    readOnly?: boolean;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ffffff'];

const IrisAnnotationCanvas: React.FC<IrisAnnotationCanvasProps> = ({
    imageUrl,
    annotations: initialAnnotations = [],
    onChange,
    readOnly = false,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
    const [activeTool, setActiveTool] = useState<Tool>('pen');
    const [activeColor, setActiveColor] = useState('#ef4444');
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
    const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [imgLoaded, setImgLoaded] = useState(false);

    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            imgRef.current = img;
            setImgLoaded(true);
        };
        img.src = imageUrl;
    }, [imageUrl]);

    const redraw = useCallback(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !imgRef.current) return;

        canvas.width = imgRef.current.naturalWidth;
        canvas.height = imgRef.current.naturalHeight;
        ctx.drawImage(imgRef.current, 0, 0);

        annotations.forEach(ann => {
            ctx.strokeStyle = ann.color;
            ctx.fillStyle = ann.color;
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';

            if (ann.type === 'pen' && ann.data.points) {
                ctx.beginPath();
                ann.data.points.forEach((p: any, i: number) => {
                    if (i === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                });
                ctx.stroke();
            } else if (ann.type === 'circle' && ann.data.center && ann.data.radius) {
                ctx.beginPath();
                ctx.arc(ann.data.center.x, ann.data.center.y, ann.data.radius, 0, Math.PI * 2);
                ctx.stroke();
            } else if (ann.type === 'rect' && ann.data.start && ann.data.end) {
                ctx.strokeRect(ann.data.start.x, ann.data.start.y, ann.data.end.x - ann.data.start.x, ann.data.end.y - ann.data.start.y);
            } else if (ann.type === 'arrow' && ann.data.start && ann.data.end) {
                const dx = ann.data.end.x - ann.data.start.x;
                const dy = ann.data.end.y - ann.data.start.y;
                const angle = Math.atan2(dy, dx);
                ctx.beginPath();
                ctx.moveTo(ann.data.start.x, ann.data.start.y);
                ctx.lineTo(ann.data.end.x, ann.data.end.y);
                ctx.stroke();
                // Arrowhead
                ctx.beginPath();
                ctx.moveTo(ann.data.end.x, ann.data.end.y);
                ctx.lineTo(ann.data.end.x - 20 * Math.cos(angle - Math.PI / 6), ann.data.end.y - 20 * Math.sin(angle - Math.PI / 6));
                ctx.moveTo(ann.data.end.x, ann.data.end.y);
                ctx.lineTo(ann.data.end.x - 20 * Math.cos(angle + Math.PI / 6), ann.data.end.y - 20 * Math.sin(angle + Math.PI / 6));
                ctx.stroke();
            } else if (ann.type === 'text' && ann.data.position && ann.data.text) {
                ctx.font = 'bold 24px sans-serif';
                ctx.fillText(ann.data.text, ann.data.position.x, ann.data.position.y);
            }
        });
    }, [annotations, imgLoaded]);

    useEffect(() => { redraw(); }, [redraw]);

    const getCanvasCoords = (e: React.MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) / rect.width) * canvas.width,
            y: ((e.clientY - rect.top) / rect.height) * canvas.height,
        };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (readOnly) return;
        const coords = getCanvasCoords(e);
        setIsDrawing(true);
        setDrawStart(coords);
        if (activeTool === 'pen') {
            setCurrentPath([coords]);
        } else if (activeTool === 'text') {
            const text = prompt('Texto da anotação:');
            if (text) {
                const newAnn: Annotation = {
                    id: crypto.randomUUID(),
                    type: 'text',
                    data: { position: coords, text },
                    color: activeColor,
                };
                const updated = [...annotations, newAnn];
                setAnnotations(updated);
                onChange?.(updated);
            }
            setIsDrawing(false);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDrawing || readOnly) return;
        const coords = getCanvasCoords(e);
        if (activeTool === 'pen') {
            setCurrentPath(prev => [...prev, coords]);
            // Live draw
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx && currentPath.length > 0) {
                ctx.strokeStyle = activeColor;
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.beginPath();
                const last = currentPath[currentPath.length - 1];
                ctx.moveTo(last.x, last.y);
                ctx.lineTo(coords.x, coords.y);
                ctx.stroke();
            }
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (!isDrawing || readOnly) return;
        const coords = getCanvasCoords(e);
        setIsDrawing(false);

        let newAnnotation: Annotation | null = null;

        if (activeTool === 'pen' && currentPath.length > 1) {
            newAnnotation = { id: crypto.randomUUID(), type: 'pen', data: { points: [...currentPath, coords] }, color: activeColor };
        } else if (activeTool === 'circle' && drawStart) {
            const dx = coords.x - drawStart.x;
            const dy = coords.y - drawStart.y;
            const radius = Math.sqrt(dx * dx + dy * dy);
            newAnnotation = { id: crypto.randomUUID(), type: 'circle', data: { center: drawStart, radius }, color: activeColor };
        } else if (activeTool === 'rect' && drawStart) {
            newAnnotation = { id: crypto.randomUUID(), type: 'rect', data: { start: drawStart, end: coords }, color: activeColor };
        } else if (activeTool === 'arrow' && drawStart) {
            newAnnotation = { id: crypto.randomUUID(), type: 'arrow', data: { start: drawStart, end: coords }, color: activeColor };
        }

        if (newAnnotation) {
            const updated = [...annotations, newAnnotation];
            setAnnotations(updated);
            onChange?.(updated);
        }
        setCurrentPath([]);
        setDrawStart(null);
    };

    const handleUndo = () => {
        const updated = annotations.slice(0, -1);
        setAnnotations(updated);
        onChange?.(updated);
    };

    const handleClear = () => {
        setAnnotations([]);
        onChange?.([]);
    };

    const handleExport = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const link = document.createElement('a');
        link.download = `iris-annotated-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    const tools: { tool: Tool; icon: React.ReactNode; label: string }[] = [
        { tool: 'pen', icon: <PenTool className="h-4 w-4" />, label: 'Desenhar' },
        { tool: 'text', icon: <Type className="h-4 w-4" />, label: 'Texto' },
        { tool: 'arrow', icon: <ArrowRight className="h-4 w-4" />, label: 'Seta' },
        { tool: 'circle', icon: <Circle className="h-4 w-4" />, label: 'Círculo' },
        { tool: 'rect', icon: <Square className="h-4 w-4" />, label: 'Retângulo' },
    ];

    return (
        <div className="space-y-3">
            {/* Canvas */}
            <div className="relative rounded-xl overflow-hidden bg-black">
                <canvas
                    ref={canvasRef}
                    className="w-full h-auto cursor-crosshair"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={() => { setIsDrawing(false); setCurrentPath([]); }}
                />
            </div>

            {!readOnly && (
                <Card className="p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Tools */}
                        {tools.map(t => (
                            <Button
                                key={t.tool}
                                variant={activeTool === t.tool ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setActiveTool(t.tool)}
                                className="gap-1 text-xs"
                                title={t.label}
                            >
                                {t.icon}
                            </Button>
                        ))}

                        <div className="w-px h-6 bg-border mx-1" />

                        {/* Colors */}
                        {COLORS.map(c => (
                            <button
                                key={c}
                                onClick={() => setActiveColor(c)}
                                className={`w-6 h-6 rounded-full border-2 transition-transform ${activeColor === c ? 'border-white scale-125' : 'border-transparent'}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}

                        <div className="w-px h-6 bg-border mx-1" />

                        {/* Actions */}
                        <Button variant="ghost" size="sm" onClick={handleUndo} title="Desfazer" disabled={annotations.length === 0}>
                            <Undo2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleClear} title="Limpar tudo" disabled={annotations.length === 0}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleExport} title="Exportar imagem">
                            <Download className="h-4 w-4" />
                        </Button>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default IrisAnnotationCanvas;
