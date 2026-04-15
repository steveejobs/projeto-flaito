export function PartyBlock(title: string, data: Record<string, string | undefined>) {
  const items = Object.entries(data)
    .filter(([_, value]) => !!value)
    .map(([label, value]) => `
      <div style="margin-bottom: 4px;">
        <strong style="text-transform: capitalize;">${label.replace(/_/g, ' ')}:</strong> ${value}
      </div>
    `)
    .join('');

  return `
    <div class="modern-section" style="page-break-inside: avoid;">
      <h3 style="margin-top: 0; font-size: 11pt; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 10px;">${title}</h3>
      <div style="font-size: 10pt; color: #333;">
        ${items}
      </div>
    </div>
  `;
}
