import QRCode from 'qrcode';

export async function generateQR(text: string, size: number = 256): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  await QRCode.toCanvas(canvas, text, {
    width: size,
    margin: 2,
  });
  return canvas;
}

export async function generateQRDataURL(text: string, size: number = 256): Promise<string> {
  return QRCode.toDataURL(text, { width: size, margin: 2 });
}
