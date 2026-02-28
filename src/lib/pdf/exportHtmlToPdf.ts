import html2pdf from "html2pdf.js";

interface ExportOptions {
  fileName: string;
  margin?: number;
}

/**
 * Detect iOS/Safari environment
 */
function isIOSSafari(): boolean {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  return isIOS || isSafari;
}

/**
 * Creates a temporary A4-sized container for PDF export
 * iOS/Safari requires smaller scale and longer delays
 */
function createA4Container(htmlContent: string): HTMLDivElement {
  const ios = isIOSSafari();
  const container = document.createElement("div");
  container.innerHTML = htmlContent;

  // A4 at ~96dpi
  container.style.width = "794px";
  container.style.minHeight = "1123px";
  container.style.padding = "76px"; // ~20mm
  container.style.boxSizing = "border-box";
  container.style.fontFamily = "'Times New Roman', Times, serif";
  container.style.background = "#ffffff";
  container.style.backgroundColor = "#ffffff";
  container.style.color = "#000000";
  container.style.setProperty("color", "#000000", "important");
  (container.style as any).webkitTextSizeAdjust = "100%";

  // iOS Safari: Keep visible in viewport for proper rendering
  // Desktop: Position offscreen
  if (ios) {
    container.style.position = "absolute";
    container.style.left = "0";
    container.style.top = "0";
    container.style.zIndex = "99999";
    container.style.visibility = "visible";
    container.style.opacity = "1";
  } else {
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "0";
  }
  
  container.style.pointerEvents = "none";

  // Inject CSS to prevent orphaned signatures
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    /* Force all text to be black */
    * {
      color: #000000 !important;
      -webkit-text-fill-color: #000000 !important;
    }
    
    /* Evitar assinatura sozinha na última página */
    .signature-section,
    .assinatura,
    [class*="signature"],
    [class*="assinatura"] {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-before: avoid !important;
      break-before: avoid !important;
    }

    /* Manter última cláusula + assinatura juntas */
    .clausula:last-of-type,
    p:last-of-type {
      page-break-after: avoid !important;
      break-after: avoid !important;
    }

    /* Garantir que o bloco de assinatura tenha contexto */
    .signature-block,
    .bloco-assinatura {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  `;
  container.insertBefore(styleEl, container.firstChild);

  document.body.appendChild(container);
  console.log("[PDF Export] container created", {
    innerTextLength: container.innerText.length,
    isIOSSafari: ios,
    position: container.style.position,
    left: container.style.left,
  });
  return container;
}

/**
 * Wait for next animation frame
 */
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * Wait for specified milliseconds
 */
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * iOS/Safari needs more time for layout stabilization
 */
async function waitForLayoutStabilization() {
  const ios = isIOSSafari();
  
  // Standard: 2 frames
  await nextFrame();
  await nextFrame();
  
  if (ios) {
    // iOS needs MUCH more time for rendering - critical for blank PDF fix
    await wait(500);
    await nextFrame();
    await nextFrame();
    await wait(300);
    await nextFrame();
    await wait(200);
  } else {
    await wait(100);
  }
}

/**
 * Get PDF options optimized for the current platform
 */
function getPdfOptions(fileName: string, margin: number = 15) {
  const ios = isIOSSafari();
  
  console.log("[PDF Export] getPdfOptions", { ios, fileName });
  
  return {
    margin,
    filename: fileName,
    image: { type: "jpeg", quality: ios ? 0.85 : 0.98 },
    html2canvas: {
      scale: ios ? 1 : 2, // Minimum scale for iOS to avoid memory/rendering issues
      useCORS: true,
      logging: true, // Enable logging for debugging
      scrollX: 0,
      scrollY: 0,
      windowWidth: 794,
      windowHeight: 1123,
      backgroundColor: "#ffffff",
      foreignObjectRendering: false,
      allowTaint: true,
      imageTimeout: ios ? 5000 : 15000, // Shorter timeout for iOS
      removeContainer: false, // Keep container for debugging
      onclone: (clonedDoc: Document) => {
        console.log("[PDF Export] onclone started");
        const clonedBody = clonedDoc.body;
        clonedBody.style.background = "#ffffff";
        clonedBody.style.backgroundColor = "#ffffff";
        clonedBody.style.color = "#000000";
        (clonedBody.style as any).webkitTextFillColor = "#000000";
        (clonedBody.style as any).printColorAdjust = "exact";
        (clonedBody.style as any).webkitPrintColorAdjust = "exact";

        const allElements = clonedDoc.querySelectorAll("*");
        allElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          if (!htmlEl.style) return;

          htmlEl.style.visibility = "visible";
          htmlEl.style.opacity = "1";

          const computed = clonedDoc.defaultView?.getComputedStyle(htmlEl);
          const bgColor = computed?.backgroundColor || "";
          const hasBackground =
            bgColor &&
            bgColor !== "transparent" &&
            bgColor !== "rgba(0, 0, 0, 0)" &&
            bgColor !== "rgb(255, 255, 255)";

          if (!hasBackground) {
            htmlEl.style.setProperty("color", "#000000", "important");
            (htmlEl.style as any).webkitTextFillColor = "#000000";
          }
        });
        console.log("[PDF Export] onclone finished");
      },
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const },
  };
}

/**
 * Create a download link and trigger it
 */
function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  
  // Cleanup after a delay
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Export HTML content to PDF and trigger download
 * Includes iOS/Safari specific optimizations
 */
export async function exportHtmlToPdf(
  htmlContent: string,
  options: ExportOptions
): Promise<void> {
  const ios = isIOSSafari();
  console.log("[PDF Export] exportHtmlToPdf started", { ios, contentLength: htmlContent.length });
  
  const container = createA4Container(htmlContent);

  try {
    const pdfOptions = getPdfOptions(options.fileName, options.margin);
    
    console.log("[PDF Export] waiting for layout stabilization...");
    await waitForLayoutStabilization();
    console.log("[PDF Export] layout stabilized, starting html2pdf...");
    
    // Force a repaint before capture
    container.offsetHeight; // Force reflow
    await new Promise(r => requestAnimationFrame(r));
    
    if (ios) {
      // Extra wait for iOS rendering
      await new Promise(r => setTimeout(r, 500));
    }
    
    // Use outputPdf to get blob, then trigger download manually
    // This works better on iOS than the built-in save()
    const blob = await html2pdf().set(pdfOptions).from(container).outputPdf("blob");
    
    console.log("[PDF Export] blob generated", { size: blob.size, type: blob.type });
    
    // Check if blob is valid
    if (!blob || blob.size < 1000) {
      console.error("[PDF Export] Generated PDF is too small, likely blank", { size: blob?.size });
      throw new Error("PDF gerado está vazio. Tente novamente.");
    }
    
    // Ensure correct MIME type
    const pdfBlob = blob.type === "application/pdf" 
      ? blob 
      : new Blob([blob], { type: "application/pdf" });
    
    triggerDownload(pdfBlob, options.fileName);
    console.log("[PDF Export] download triggered");
    
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Export HTML content to PDF and return as Blob (for ZIP archives)
 */
export async function exportHtmlToPdfBlob(
  htmlContent: string,
  options: ExportOptions
): Promise<Blob> {
  const container = createA4Container(htmlContent);

  try {
    const pdfOptions = getPdfOptions(options.fileName, options.margin);
    await waitForLayoutStabilization();
    const blob = await html2pdf().set(pdfOptions).from(container).outputPdf("blob");

    if (blob.type !== "application/pdf") {
      return new Blob([blob], { type: "application/pdf" });
    }

    return blob;
  } finally {
    document.body.removeChild(container);
  }
}
