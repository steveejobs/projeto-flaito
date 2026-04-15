import React, { useEffect, useState, useRef } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, XCircle, Camera, Sun, Focus, Square } from "lucide-react";

interface ImageQualityFeedbackProps {
    imageData: string; // base64 or URL
    onQualityResult?: (result: QualityResult) => void;
}

export interface QualityResult {
    overall: 'good' | 'fair' | 'poor';
    score: number;
    brightness: { value: number; status: 'good' | 'fair' | 'poor' };
    contrast: { value: number; status: 'good' | 'fair' | 'poor' };
    sharpness: { value: number; status: 'good' | 'fair' | 'poor' };
    centering: { value: number; status: 'good' | 'fair' | 'poor' };
}

const ImageQualityFeedback: React.FC<ImageQualityFeedbackProps> = ({ imageData, onQualityResult }) => {
    const [result, setResult] = useState<QualityResult | null>(null);
    const [analyzing, setAnalyzing] = useState(false);

    useEffect(() => {
        if (!imageData) return;
        setAnalyzing(true);

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = 200;
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.drawImage(img, 0, 0, size, size);
            const data = ctx.getImageData(0, 0, size, size).data;

            // 1. Brightness analysis
            let totalBrightness = 0;
            for (let i = 0; i < data.length; i += 4) {
                totalBrightness += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            }
            const avgBrightness = totalBrightness / (size * size);
            const brightnessStatus: 'good' | 'fair' | 'poor' =
                avgBrightness > 60 && avgBrightness < 200 ? 'good' :
                    avgBrightness > 40 && avgBrightness < 220 ? 'fair' : 'poor';

            // 2. Contrast analysis (std dev of brightness)
            let sumSq = 0;
            for (let i = 0; i < data.length; i += 4) {
                const b = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                sumSq += (b - avgBrightness) ** 2;
            }
            const contrastVal = Math.sqrt(sumSq / (size * size));
            const contrastStatus: 'good' | 'fair' | 'poor' =
                contrastVal > 40 ? 'good' : contrastVal > 25 ? 'fair' : 'poor';

            // 3. Sharpness (Laplacian variance)
            let lapSum = 0;
            let lapCount = 0;
            for (let y = 1; y < size - 1; y++) {
                for (let x = 1; x < size - 1; x++) {
                    const idx = (y * size + x) * 4;
                    const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
                    const top = data[((y - 1) * size + x) * 4] * 0.299 + data[((y - 1) * size + x) * 4 + 1] * 0.587 + data[((y - 1) * size + x) * 4 + 2] * 0.114;
                    const bot = data[((y + 1) * size + x) * 4] * 0.299 + data[((y + 1) * size + x) * 4 + 1] * 0.587 + data[((y + 1) * size + x) * 4 + 2] * 0.114;
                    const lft = data[(y * size + x - 1) * 4] * 0.299 + data[(y * size + x - 1) * 4 + 1] * 0.587 + data[(y * size + x - 1) * 4 + 2] * 0.114;
                    const rgt = data[(y * size + x + 1) * 4] * 0.299 + data[(y * size + x + 1) * 4 + 1] * 0.587 + data[(y * size + x + 1) * 4 + 2] * 0.114;
                    lapSum += Math.abs(top + bot + lft + rgt - 4 * gray);
                    lapCount++;
                }
            }
            const sharpnessVal = lapSum / lapCount;
            const sharpnessStatus: 'good' | 'fair' | 'poor' =
                sharpnessVal > 8 ? 'good' : sharpnessVal > 4 ? 'fair' : 'poor';

            // 4. Centering (detect dark circle in center for iris)
            const centerSize = size / 4;
            const cx = size / 2, cy = size / 2;
            let centerDark = 0, totalCenter = 0;
            for (let y = Math.floor(cy - centerSize); y < Math.floor(cy + centerSize); y++) {
                for (let x = Math.floor(cx - centerSize); x < Math.floor(cx + centerSize); x++) {
                    const dx = x - cx, dy = y - cy;
                    if (dx * dx + dy * dy <= centerSize * centerSize) {
                        const idx = (y * size + x) * 4;
                        const b = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
                        if (b < 100) centerDark++;
                        totalCenter++;
                    }
                }
            }
            const centerRatio = totalCenter > 0 ? centerDark / totalCenter : 0;
            const centeringVal = Math.round(centerRatio * 100);
            const centeringStatus: 'good' | 'fair' | 'poor' =
                centerRatio > 0.2 ? 'good' : centerRatio > 0.1 ? 'fair' : 'poor';

            // Overall score
            const scores = { good: 3, fair: 2, poor: 1 };
            const totalScore = [brightnessStatus, contrastStatus, sharpnessStatus, centeringStatus].reduce(
                (sum, s) => sum + scores[s], 0
            );
            const overall: 'good' | 'fair' | 'poor' = totalScore >= 10 ? 'good' : totalScore >= 7 ? 'fair' : 'poor';

            const qualityResult: QualityResult = {
                overall,
                score: Math.round((totalScore / 12) * 100),
                brightness: { value: Math.round(avgBrightness), status: brightnessStatus },
                contrast: { value: Math.round(contrastVal), status: contrastStatus },
                sharpness: { value: Math.round(sharpnessVal * 10), status: sharpnessStatus },
                centering: { value: centeringVal, status: centeringStatus },
            };

            setResult(qualityResult);
            onQualityResult?.(qualityResult);
            setAnalyzing(false);
        };
        img.src = imageData;
    }, [imageData]);

    const statusIcon = (s: string) => {
        if (s === 'good') return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
        if (s === 'fair') return <AlertCircle className="h-4 w-4 text-amber-400" />;
        return <XCircle className="h-4 w-4 text-red-400" />;
    };

    const statusBadge = (s: string) => {
        const colors = {
            good: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
            fair: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            poor: 'bg-red-500/20 text-red-400 border-red-500/30',
        };
        const labels = { good: 'Bom', fair: 'Regular', poor: 'Ruim' };
        return <Badge variant="outline" className={colors[s as keyof typeof colors]}>{labels[s as keyof typeof labels]}</Badge>;
    };

    if (analyzing) {
        return (
            <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Camera className="h-4 w-4 animate-pulse" />
                    <span className="text-sm">Analisando qualidade da imagem...</span>
                </div>
            </Card>
        );
    }

    if (!result) return null;

    return (
        <Card className={`p-4 space-y-3 ${result.overall === 'poor' ? 'border-red-500/30' : result.overall === 'fair' ? 'border-amber-500/30' : 'border-emerald-500/30'}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-teal-400" />
                    <h4 className="text-sm font-semibold text-foreground">Qualidade da Imagem</h4>
                </div>
                {statusBadge(result.overall)}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                    {statusIcon(result.brightness.status)}
                    <div>
                        <div className="flex items-center gap-1">
                            <Sun className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-medium">Iluminação</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{result.brightness.value}/255</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {statusIcon(result.contrast.status)}
                    <div>
                        <span className="text-xs font-medium">Contraste</span>
                        <br />
                        <span className="text-xs text-muted-foreground">σ={result.contrast.value}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {statusIcon(result.sharpness.status)}
                    <div>
                        <div className="flex items-center gap-1">
                            <Focus className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-medium">Nitidez</span>
                        </div>
                        <span className="text-xs text-muted-foreground">Laplacian: {result.sharpness.value}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {statusIcon(result.centering.status)}
                    <div>
                        <div className="flex items-center gap-1">
                            <Square className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-medium">Enquadramento</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{result.centering.value}%</span>
                    </div>
                </div>
            </div>

            {result.overall === 'poor' && (
                <p className="text-xs text-red-400 mt-2">
                    ⚠️ A qualidade da imagem está baixa. Recapture com melhor iluminação e foco para análise precisa.
                </p>
            )}
            {result.overall === 'fair' && (
                <p className="text-xs text-amber-400 mt-2">
                    ℹ️ Qualidade aceitável, mas pode impactar a precisão. Considere recapturar se possível.
                </p>
            )}
        </Card>
    );
};

export default ImageQualityFeedback;
