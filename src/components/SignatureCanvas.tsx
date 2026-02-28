import { useEffect, useRef, useState } from "react";
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
  minCoverage?: number; // Minimum coverage percentage (e.g., 0.5 = 0.5%)
  onValidChange?: (isValid: boolean) => void;
  showValidation?: boolean; // Show validation feedback UI
}

export function SignatureCanvas({ 
  onReady, 
  width = 1600, 
  height = 500,
  minCoverage = 0.5,
  onValidChange,
  showValidation = false
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const initializedRef = useRef(false);
  const baselineImageDataRef = useRef<ImageData | null>(null);
  
  // Stable refs for callbacks to prevent re-initialization
  const onReadyRef = useRef(onReady);
  const onValidChangeRef = useRef(onValidChange);
  const minCoverageRef = useRef(minCoverage);
  
  const [validationState, setValidationState] = useState<'empty' | 'invalid' | 'valid'>('empty');

  // Keep refs in sync with props without causing re-renders
  useEffect(() => {
    onReadyRef.current = onReady;
    onValidChangeRef.current = onValidChange;
    minCoverageRef.current = minCoverage;
  }, [onReady, onValidChange, minCoverage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || initializedRef.current) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctxRef.current = ctx;
    initializedRef.current = true;

    // Helper to draw baseline
    const drawBaseline = () => {
      const y = canvas.height * 0.8;
      const marginX = canvas.width * 0.1;
      
      ctx.save();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(marginX, y);
      ctx.lineTo(canvas.width - marginX, y);
      ctx.stroke();
      ctx.restore();
    };

    // Fill with white background for clean export - only on first init
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw baseline guide
    drawBaseline();
    
    // Capture baseline snapshot for coverage calculation (to ignore baseline pixels)
    baselineImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Enable anti-aliasing for smoother lines
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Set up drawing styles - thicker line for better legibility when scaled down
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#000";

    const getPos = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      let clientX: number, clientY: number;
      
      if ("touches" in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ("clientX" in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      } else {
        return { x: 0, y: 0 };
      }
      
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    };

    const calculateCoverage = (): number => {
      const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const baselineData = baselineImageDataRef.current;
      let drawnPixels = 0;
      const totalPixels = canvas.width * canvas.height;

      // Count pixels that differ from baseline (ignores baseline itself)
      for (let i = 0; i < currentData.data.length; i += 4) {
        if (baselineData) {
          // Compare with baseline - count as drawn if significantly different
          const dr = Math.abs(currentData.data[i] - baselineData.data[i]);
          const dg = Math.abs(currentData.data[i + 1] - baselineData.data[i + 1]);
          const db = Math.abs(currentData.data[i + 2] - baselineData.data[i + 2]);
          if (dr + dg + db > 30) {
            drawnPixels++;
          }
        } else {
          // Fallback: count non-white pixels
          const r = currentData.data[i];
          const g = currentData.data[i + 1];
          const b = currentData.data[i + 2];
          if (r < 250 || g < 250 || b < 250) {
            drawnPixels++;
          }
        }
      }

      return (drawnPixels / totalPixels) * 100;
    };

    const updateValidation = () => {
      if (!hasDrawnRef.current) {
        setValidationState('empty');
        onValidChangeRef.current?.(false);
        return;
      }

      const coverage = calculateCoverage();
      const isValid = coverage >= minCoverageRef.current;
      
      setValidationState(isValid ? 'valid' : 'invalid');
      onValidChangeRef.current?.(isValid);
    };

    const handleDown = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      drawingRef.current = true;
      hasDrawnRef.current = true;
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!drawingRef.current) return;
      e.preventDefault();
      const { x, y } = getPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const handleUp = () => {
      if (drawingRef.current) {
        drawingRef.current = false;
        // Update validation after stroke ends
        updateValidation();
      }
    };

    // Mouse events
    canvas.addEventListener("mousedown", handleDown as EventListener);
    canvas.addEventListener("mousemove", handleMove as EventListener);
    canvas.addEventListener("mouseup", handleUp);
    canvas.addEventListener("mouseleave", handleUp);

    // Touch events
    canvas.addEventListener("touchstart", handleDown as EventListener, { passive: false });
    canvas.addEventListener("touchmove", handleMove as EventListener, { passive: false });
    canvas.addEventListener("touchend", handleUp);

    // Provide API to parent via stable ref
    onReadyRef.current({
      clear: () => {
        // Clear and restore white background + baseline
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawBaseline();
        // Update baseline snapshot after clear
        baselineImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
        hasDrawnRef.current = false;
        setValidationState('empty');
        onValidChangeRef.current?.(false);
      },
      getDataUrl: () => {
        // Export as high-quality PNG
        return canvas.toDataURL("image/png", 1.0);
      },
      isEmpty: () => !hasDrawnRef.current,
      getCoverage: calculateCoverage,
    });

    return () => {
      canvas.removeEventListener("mousedown", handleDown as EventListener);
      canvas.removeEventListener("mousemove", handleMove as EventListener);
      canvas.removeEventListener("mouseup", handleUp);
      canvas.removeEventListener("mouseleave", handleUp);
      canvas.removeEventListener("touchstart", handleDown as EventListener);
      canvas.removeEventListener("touchmove", handleMove as EventListener);
      canvas.removeEventListener("touchend", handleUp);
    };
  }, []); // Empty dependency array - only run once on mount

  return (
    <>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-[250px] touch-none cursor-crosshair bg-white rounded-lg"
        style={{ touchAction: "none" }}
      />
      
      {showValidation && (
        <div className="flex items-center gap-2 mt-2">
          {validationState === 'valid' ? (
            <span className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              Assinatura válida
            </span>
          ) : validationState === 'invalid' ? (
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
