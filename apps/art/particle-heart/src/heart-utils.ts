/**
 * 心形参数方程工具函数
 * x = 16 sin³(t)
 * y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
 * 注意：Canvas y轴朝下，所以需要取反
 */

/** 生成心形曲线上的点（归一化到 [-1, 1] 范围） */
export function heartPoint(t: number): { x: number; y: number } {
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
  return { x, y };
}

/** 生成心形轮廓上的等距点 */
export function generateHeartOutline(count: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    points.push(heartPoint(t));
  }
  return points;
}

/** 生成心形内部填充点（使用 rejection sampling） */
export function generateHeartFill(count: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  let attempts = 0;
  while (points.length < count && attempts < count * 20) {
    attempts++;
    const x = (Math.random() - 0.5) * 34;
    const y = (Math.random() - 0.5) * 30;
    if (isInsideHeart(x, y)) {
      points.push({ x, y });
    }
  }
  return points;
}

/** 判断点是否在心形内部 */
function isInsideHeart(px: number, py: number): boolean {
  // 用射线法近似：检查点是否在心形边界内
  // 简化方法：心形方程隐式近似
  // (x² + y² - 1)³ - x²y³ < 0  (经典心形隐式方程，归一化后)
  const x = px / 16;
  const y = -py / 16; // 取反因为y轴
  const a = x * x + y * y - 1;
  return a * a * a - x * x * y * y * y < 0;
}

/** 生成3D心形点云 */
export function generateHeart3D(count: number): { x: number; y: number; z: number }[] {
  const points: { x: number; y: number; z: number }[] = [];
  let attempts = 0;
  while (points.length < count && attempts < count * 20) {
    attempts++;
    const x = (Math.random() - 0.5) * 34;
    const y = (Math.random() - 0.5) * 30;
    const z = (Math.random() - 0.5) * 20;
    // 3D心形：在xy平面检查心形，z方向给一定厚度
    if (isInsideHeart(x, y)) {
      const zFactor = 1 - (z * z) / 100; // 椭球形z衰减
      if (Math.random() < zFactor) {
        points.push({ x, y, z });
      }
    }
  }
  return points;
}

/** 心形轮廓点（用于轮廓类效果） */
export function generateHeartContourPoints(count: number, scale: number = 1): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    const p = heartPoint(t);
    points.push({ x: p.x * scale, y: p.y * scale });
  }
  return points;
}

/** HSL 转 RGB */
export function hslToRgb(h: number, s: number, l: number): string {
  h = h % 360;
  const c = (1 - Math.abs(2 * l / 100 - 1)) * s / 100;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l / 100 - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return `rgb(${Math.round((r + m) * 255)}, ${Math.round((g + m) * 255)}, ${Math.round((b + m) * 255)})`;
}
