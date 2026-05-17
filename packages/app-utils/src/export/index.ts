export async function exportCanvas(
  canvas: HTMLCanvasElement,
  type: 'png' | 'jpg' = 'png',
  quality?: number
): Promise<void> {
  const mime = type === 'jpg' ? 'image/jpeg' : 'image/png';
  const dataUrl = canvas.toDataURL(mime, quality);
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `export.${type === 'jpg' ? 'jpg' : 'png'}`;
  a.click();
}

export async function exportSVG(svg: SVGElement, filename: string = 'export.svg'): Promise<void> {
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svg);
  const blob = new Blob([source], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

import { jsPDF } from 'jspdf';

export async function exportPDF(canvas: HTMLCanvasElement, _pages?: number[]): Promise<void> {
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [canvas.width, canvas.height],
  });
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save('export.pdf');
}
