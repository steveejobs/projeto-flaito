/**
 * Converte páginas de um PDF em imagens base64 para OCR/Vision
 * Usa PDF.js no cliente para renderizar páginas como canvas
 */

// Carregar PDF.js dinamicamente do CDN
async function loadPdfJs(): Promise<any> {
  if ((window as any).pdfjsLib) return (window as any).pdfjsLib;

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      if (pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve(pdfjsLib);
      } else {
        reject(new Error("PDF.js não foi carregado"));
      }
    };
    script.onerror = () => reject(new Error("Falha ao baixar PDF.js"));
    document.head.appendChild(script);
  });
}

export interface PdfToImageResult {
  success: boolean;
  imageBase64?: string;
  totalPages?: number;
  pageNumber?: number;
  error?: string;
}

/**
 * Converte uma página específica de um PDF File em imagem base64
 * @param file - O arquivo PDF
 * @param scale - Escala de renderização (1.5 = 150% do tamanho original, bom para OCR)
 * @param pageNumber - Número da página (1-indexed, default: 1)
 * @returns Objeto com a imagem base64 ou erro
 */
export async function convertPdfPageToImage(
  file: File,
  scale: number = 1.5,
  pageNumber: number = 1
): Promise<PdfToImageResult> {
  try {
    console.log(`[pdfToImage] Iniciando conversão: ${file.name}, página ${pageNumber}`);
    
    const pdfjsLib = await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    const totalPages = pdf.numPages;
    console.log(`[pdfToImage] PDF carregado, páginas: ${totalPages}`);
    
    // Validar pageNumber
    if (pageNumber < 1 || pageNumber > totalPages) {
      return {
        success: false,
        error: `Página ${pageNumber} não existe (total: ${totalPages})`,
        totalPages,
        pageNumber,
      };
    }
    
    // Pegar página específica
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    
    // Criar canvas para renderizar
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    
    if (!context) {
      throw new Error("Não foi possível criar contexto 2D");
    }
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // Renderizar página no canvas
    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise;
    
    // Converter canvas para base64 (JPEG para menor tamanho)
    const imageBase64 = canvas.toDataURL("image/jpeg", 0.85);
    
    console.log(`[pdfToImage] Página ${pageNumber} convertida, tamanho: ${Math.round(imageBase64.length / 1024)} KB`);
    
    return {
      success: true,
      imageBase64,
      totalPages,
      pageNumber,
    };
    
  } catch (error) {
    console.error("[pdfToImage] Erro:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
      pageNumber,
    };
  }
}

/**
 * Alias para compatibilidade - converte a primeira página
 * @deprecated Use convertPdfPageToImage(file, scale, 1) diretamente
 */
export const convertPdfFirstPageToImage = (
  file: File,
  scale: number = 1.5
): Promise<PdfToImageResult> => convertPdfPageToImage(file, scale, 1);
