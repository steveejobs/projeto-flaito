import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, RotateCcw, Check, X, Loader2 } from "lucide-react";

interface IrisCameraCaptureProps {
    onCapture: (imageData: string) => void;
    onClose?: () => void;
}

const IrisCameraCapture: React.FC<IrisCameraCaptureProps> = ({ onCapture, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [focusScore, setFocusScore] = useState(0);

    const startCamera = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    focusMode: 'continuous' as any,
                }
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            setIsLoading(false);
        } catch (err) {
            setError('Não foi possível acessar a câmera. Verifique as permissões.');
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        startCamera();
        return () => {
            stream?.getTracks().forEach(t => t.stop());
        };
    }, []);

    // Focus quality estimation via Laplacian variance on canvas
    useEffect(() => {
        if (!videoRef.current || capturedImage) return;
        const interval = setInterval(() => {
            const video = videoRef.current;
            if (!video || video.readyState < 2) return;
            const c = document.createElement('canvas');
            c.width = 160;
            c.height = 120;
            const ctx = c.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(video, 0, 0, 160, 120);
            const data = ctx.getImageData(0, 0, 160, 120).data;
            // Simple Laplacian variance for focus detection
            let sum = 0;
            let sumSq = 0;
            let count = 0;
            for (let y = 1; y < 119; y++) {
                for (let x = 1; x < 159; x++) {
                    const idx = (y * 160 + x) * 4;
                    const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
                    const top = data[((y - 1) * 160 + x) * 4] * 0.299 + data[((y - 1) * 160 + x) * 4 + 1] * 0.587 + data[((y - 1) * 160 + x) * 4 + 2] * 0.114;
                    const bot = data[((y + 1) * 160 + x) * 4] * 0.299 + data[((y + 1) * 160 + x) * 4 + 1] * 0.587 + data[((y + 1) * 160 + x) * 4 + 2] * 0.114;
                    const lft = data[(y * 160 + x - 1) * 4] * 0.299 + data[(y * 160 + x - 1) * 4 + 1] * 0.587 + data[(y * 160 + x - 1) * 4 + 2] * 0.114;
                    const rgt = data[(y * 160 + x + 1) * 4] * 0.299 + data[(y * 160 + x + 1) * 4 + 1] * 0.587 + data[(y * 160 + x + 1) * 4 + 2] * 0.114;
                    const laplacian = Math.abs(top + bot + lft + rgt - 4 * gray);
                    sum += laplacian;
                    sumSq += laplacian * laplacian;
                    count++;
                }
            }
            const variance = (sumSq / count) - Math.pow(sum / count, 2);
            setFocusScore(Math.min(100, Math.round(variance / 5)));
        }, 500);
        return () => clearInterval(interval);
    }, [capturedImage]);

    const handleCapture = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        setCapturedImage(dataUrl);
    };

    const handleRetake = () => {
        setCapturedImage(null);
    };

    const handleConfirm = () => {
        if (capturedImage) {
            onCapture(capturedImage);
        }
    };

    const focusColor = focusScore > 60 ? 'text-emerald-400' : focusScore > 30 ? 'text-amber-400' : 'text-red-400';
    const focusRingColor = focusScore > 60 ? 'stroke-emerald-400' : focusScore > 30 ? 'stroke-amber-400' : 'stroke-red-400';

    return (
        <Card className="relative overflow-hidden bg-black rounded-2xl">
            <canvas ref={canvasRef} className="hidden" />

            {isLoading && (
                <div className="flex items-center justify-center h-96">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
                    <span className="ml-3 text-white">Iniciando câmera...</span>
                </div>
            )}

            {error && (
                <div className="flex flex-col items-center justify-center h-96 text-red-400 p-6 text-center">
                    <Camera className="h-12 w-12 mb-4 opacity-50" />
                    <p className="text-sm">{error}</p>
                    <Button onClick={startCamera} variant="outline" className="mt-4">Tentar novamente</Button>
                </div>
            )}

            {!capturedImage && !error && (
                <div className="relative">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-auto"
                        onLoadedMetadata={() => setIsLoading(false)}
                    />
                    {/* Circular guide overlay */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                        {/* Dark overlay */}
                        <defs>
                            <mask id="iris-mask">
                                <rect width="100" height="100" fill="white" />
                                <circle cx="50" cy="50" r="28" fill="black" />
                            </mask>
                        </defs>
                        <rect width="100" height="100" fill="rgba(0,0,0,0.5)" mask="url(#iris-mask)" />
                        {/* Guide circle */}
                        <circle cx="50" cy="50" r="28" fill="none" className={focusRingColor} strokeWidth="0.5" strokeDasharray="4 2" />
                        {/* Center crosshair */}
                        <line x1="48" y1="50" x2="52" y2="50" stroke="white" strokeWidth="0.2" opacity="0.6" />
                        <line x1="50" y1="48" x2="50" y2="52" stroke="white" strokeWidth="0.2" opacity="0.6" />
                        {/* Label */}
                        <text x="50" y="82" textAnchor="middle" fill="white" fontSize="3" opacity="0.8">
                            Centralize a íris dentro do círculo
                        </text>
                    </svg>

                    {/* Focus indicator */}
                    <div className="absolute top-4 right-4 bg-black/70 backdrop-blur rounded-lg px-3 py-2 flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${focusScore > 60 ? 'bg-emerald-400' : focusScore > 30 ? 'bg-amber-400 animate-pulse' : 'bg-red-400 animate-pulse'}`} />
                        <span className={`text-xs font-medium ${focusColor}`}>
                            {focusScore > 60 ? 'Foco OK' : focusScore > 30 ? 'Ajuste o foco' : 'Sem foco'}
                        </span>
                    </div>

                    {/* Capture button */}
                    <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
                        {onClose && (
                            <Button onClick={onClose} variant="ghost" size="icon" className="rounded-full bg-black/50 text-white h-12 w-12">
                                <X className="h-5 w-5" />
                            </Button>
                        )}
                        <Button
                            onClick={handleCapture}
                            size="icon"
                            className="rounded-full bg-white text-black h-16 w-16 shadow-lg hover:bg-gray-200 transition-transform active:scale-95"
                        >
                            <Camera className="h-7 w-7" />
                        </Button>
                    </div>
                </div>
            )}

            {capturedImage && (
                <div className="relative">
                    <img src={capturedImage} alt="Iris capturada" className="w-full h-auto" />
                    <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-4">
                        <Button onClick={handleRetake} variant="ghost" className="rounded-full bg-black/60 text-white gap-2 px-6">
                            <RotateCcw className="h-4 w-4" /> Recapturar
                        </Button>
                        <Button onClick={handleConfirm} className="rounded-full bg-emerald-500 text-white gap-2 px-6 hover:bg-emerald-400">
                            <Check className="h-4 w-4" /> Confirmar
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    );
};

export default IrisCameraCapture;
