export function WatermarkOverlay(imageUrl?: string) {
  if (!imageUrl) return '';
  return `
    <div class="watermark no-print" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; display: flex; align-items: center; justify-content: center; pointer-events: none;">
      <img src="${imageUrl}" style="width: 100%; max-width: 600px; height: auto; opacity: inherit;" alt="Watermark" />
    </div>
  `;
}
