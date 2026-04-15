import { useEffect, useRef, useState, useCallback } from "react";
import { Check, AlertTriangle } from "lucide-react";

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
  const baselineImageDataRef = useRef<ImageData | null>(null);

  // Stable refs for callbacks
  const onReadyRef = useRef(onReady);
  const onValidChangeRef = useRef(onValidChange);
  const minCoverageRef = useRef(minCoverage);

  const [validationState, setValidationState] = useState<"empty" | "invalid" | "valid">("empty");

  useEffect(() => {
    onReadyRef.current = onReady;
    onValidChangeRef.current = onValidChange;
    minCoverageRef.current = minCoverage;
  }, [onReady, onValidChange, minCoverage]);

  const drawBaseline = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const y = canvas.height * 0.8;
    const marginX = canvas.width * 0.1;
    ctx.save();
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(marginX, y);
    ctx.lineTo(canvas.width - marginX, y);
    ctx.stroke();
    ctx.restore();
  }, []);

  const calculateCoverage = useCallback((): number => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return 0;

    const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const baselineData = baselineImageDataRef.current;
    let drawnPixels = 0;
    const totalPixels = canvas.width * canvas.height;

    for (let i = 0; i < currentData.data.length; i += 4) {
      if (baselineData) {
        const dr = Math.abs(currentData.data[i] - baselineData.data[i]);
        const dg = Math.abs(currentData.data[i + 1] - baselineData.data[i + 1]);
        const db = Math.abs(currentData.data[i + 2] - baselineData.data[i + 2]);
        if (dr + dg + db > 30) drawnPixels++;
      } else {
        const r = currentData.data[i];
        const g = currentData.data[i + 1];
        const b = currentData.data[i + 2];
        if (r < 250 || g < 250 || b < 250) drawnPixels++;
      }
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

  const initializedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctxRef.current = ctx;

    // Only fully re-initialize if dimensions changed or first time
    if (!initializedRef.current) {
      initializedRef.current = true;

      // Fill background
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw baseline helper
      const y = canvas.height * 0.8;
      const marginX = canvas.width * 0.1;
      ctx.save();
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(marginX, y);
      ctx.lineTo(canvas.width - marginX, y);
      ctx.stroke();
      ctx.restore();

      // Capture baseline for coverage diff
      baselineImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

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

        const y = canvas.height * 0.8;
        const marginX = canvas.width * 0.1;
        ctx.save();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(marginX, y);
        ctx.lineTo(canvas.width - marginX, y);
        ctx.stroke();
        ctx.restore();

        baselineImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
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
