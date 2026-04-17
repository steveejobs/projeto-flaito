import { useEffect, useRef, useState, useCallback } from "react";
import { Check, AlertTriangle, RotateCw, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface SignatureCanvasApi {
  clear: () => void;
  getDataUrl: () => string;
  isEmpty: () => boolean;
  getCoverage: () => number;
}

interface SignatureCanvasProps {
  onReady: (api: SignatureCanvasApi) => void;
  width?: number;
  height?: number;
  minCoverage?: number;
  onValidChange?: (isValid: boolean) => void;
  showValidation?: boolean;
  className?: string;
}

export function SignatureCanvas({
  onReady,
  width = 1600,
  height = 500,
  minCoverage = 0.5,
  onValidChange,
  showValidation = false,
  className = "w-full h-[250px]",
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);

  // Stable refs for callbacks
  const onReadyRef = useRef(onReady);
  const onValidChangeRef = useRef(onValidChange);
  const minCoverageRef = useRef(minCoverage);

  const [validationState, setValidationState] = useState<"empty" | "invalid" | "valid">("empty");
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [ignoreOrientationAdvice, setIgnoreOrientationAdvice] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
      setIsMobile(window.innerWidth < 768);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  useEffect(() => {
    onReadyRef.current = onReady;
    onValidChangeRef.current = onValidChange;
    minCoverageRef.current = minCoverage;
  }, [onReady, onValidChange, minCoverage]);

  const calculateCoverage = useCallback((): number => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return 0;

    const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let drawnPixels = 0;
    const totalPixels = canvas.width * canvas.height;

    for (let i = 0; i < currentData.data.length; i += 4) {
      const r = currentData.data[i];
      const g = currentData.data[i + 1];
      const b = currentData.data[i + 2];
      if (r < 250 || g < 250 || b < 250) drawnPixels++;
    }
    return (drawnPixels / totalPixels) * 100;
  }, []);

  const updateValidation = useCallback(() => {
    if (!hasDrawnRef.current) {
      setValidationState("empty");
      onValidChangeRef.current?.(false);
      return;
    }
    const coverage = calculateCoverage();
    const isValid = coverage >= minCoverageRef.current;
    setValidationState(isValid ? "valid" : "invalid");
    onValidChangeRef.current?.(isValid);
  }, [calculateCoverage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctxRef.current = ctx;

    // Fill background to prevent transparency breaking data on resize
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Always ensure drawing properties are set
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000";

    onReadyRef.current({
      clear: () => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (!canvas || !ctx) return;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        hasDrawnRef.current = false;
        setValidationState("empty");
        onValidChangeRef.current?.(false);
      },
      getDataUrl: () => canvasRef.current?.toDataURL("image/png", 1.0) || "",
      isEmpty: () => !hasDrawnRef.current,
      getCoverage: calculateCoverage,
    });
  }, [width, height, calculateCoverage]);

  const lastPointRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const midPointRef = useRef<{ x: number; y: number } | null>(null);
  const lastWidthRef = useRef(3.5);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, time: Date.now() };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      time: Date.now(),
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !ctxRef.current) return;

    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    hasDrawnRef.current = true;
    
    const pos = getPos(e);
    lastPointRef.current = pos;
    midPointRef.current = { x: pos.x, y: pos.y };
    lastWidthRef.current = 4; // Reset to initial width

    const ctx = ctxRef.current;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000000";
    ctx.shadowBlur = 0.5; // Slight softening
    ctx.shadowColor = "#000000";
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !ctxRef.current || !lastPointRef.current) return;
    
    const currentPoint = getPos(e);
    const lastPoint = lastPointRef.current;
    const ctx = ctxRef.current;

    // Calculate velocity for variable width
    const dist = Math.sqrt(Math.pow(currentPoint.x - lastPoint.x, 2) + Math.pow(currentPoint.y - lastPoint.y, 2));
    const time = Math.max(currentPoint.time - lastPoint.time, 1);
    const velocity = dist / time;

    // Map velocity to width (faster = thinner)
    const targetWidth = Math.max(1.8, Math.min(5.5, 8 / (velocity + 1.2)));
    // Smooth width transitions (lerp)
    const newWidth = lastWidthRef.current * 0.6 + targetWidth * 0.4;
    
    // Draw using Quadratic Bézier for smoothing
    const midPoint = {
      x: (lastPoint.x + currentPoint.x) / 2,
      y: (lastPoint.y + currentPoint.y) / 2,
    };

    ctx.beginPath();
    ctx.lineWidth = newWidth;
    if (midPointRef.current) {
      ctx.moveTo(midPointRef.current.x, midPointRef.current.y);
      ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, midPoint.x, midPoint.y);
    } else {
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(midPoint.x, midPoint.y);
    }
    ctx.stroke();

    lastPointRef.current = currentPoint;
    midPointRef.current = midPoint;
    lastWidthRef.current = newWidth;
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    
    // Draw final stroke segment
    if (ctxRef.current && lastPointRef.current && midPointRef.current) {
      const ctx = ctxRef.current;
      const lastPoint = lastPointRef.current;
      ctx.beginPath();
      ctx.lineWidth = lastWidthRef.current;
      ctx.moveTo(midPointRef.current.x, midPointRef.current.y);
      ctx.lineTo(lastPoint.x, lastPoint.y);
      ctx.stroke();
    }

    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    
    lastPointRef.current = null;
    midPointRef.current = null;
    updateValidation();
  };

  return (
    <>
      <div className="relative">
      {/* Linha de apoio puramente CSS e Visual */}
      <div className="absolute inset-x-[10%] bottom-[20%] h-[2px] bg-slate-300 pointer-events-none rounded-full" />
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={`${className} touch-none cursor-crosshair bg-white rounded-lg border border-slate-200 transition-shadow hover:shadow-inner`}
        style={{ touchAction: "none" }}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        onContextMenu={(e) => e.preventDefault()}
      />

      <AnimatePresence>
        {isMobile && isPortrait && !hasDrawnRef.current && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div className="bg-slate-900/95 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2.5 shadow-2xl border border-white/5 whitespace-nowrap">
              <RotateCw className="h-3.5 w-3.5 text-blue-400 animate-spin-slow" />
              <span className="text-[10px] font-black text-white uppercase tracking-[0.1em]">Gire para melhorar (Opcional)</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

    {showValidation && (
        <div className="flex items-center gap-2 mt-2">
          {validationState === "valid" ? (
            <span className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              Assinatura válida
            </span>
          ) : validationState === "invalid" ? (
            <span className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Assinatura muito pequena - continue desenhando
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              Desenhe sua assinatura no campo acima
            </span>
          )}
        </div>
      )}
    </>
  );
}
