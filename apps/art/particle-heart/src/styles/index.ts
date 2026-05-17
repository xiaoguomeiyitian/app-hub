/**
 * 样式注册表
 */
import { HeartbeatStyle } from './01-heartbeat.js';
import { RainbowStyle } from './02-rainbow.js';
import { MouseInteractiveStyle } from './03-mouse.js';
import { Rotate3DStyle } from './04-rotate3d.js';
import { CrystalStyle } from './05-crystal.js';
import { ConvergeStyle } from './06-converge.js';
import { FlameStyle } from './07-flame.js';
import { StarfieldStyle } from './08-starfield.js';
import { DualHeartStyle } from './09-dual.js';
import { MusicBeatStyle } from './10-music.js';
import { Crystal3DStyle } from './11-crystal3d.js';
import { NebulaStyle } from './12-nebula.js';
import { FractalStyle } from './13-fractal.js';

export interface HeartStyle {
  render(): void;
  resize(w: number, h: number): void;
  onMouseMove?: (x: number, y: number) => void;
}

export interface StyleEntry {
  name: string;
  description: string;
  create: (ctx: CanvasRenderingContext2D, w: number, h: number) => HeartStyle;
}

export const styles: StyleEntry[] = [
  { name: '心跳粒子', description: '李峋同款经典心形脉冲动画', create: (c, w, h) => new HeartbeatStyle(c, w, h) },
  { name: '彩虹渐变', description: 'HSL色相循环流光效果', create: (c, w, h) => new RainbowStyle(c, w, h) },
  { name: '鼠标交互', description: '跟随鼠标扩散汇聚 + 连线', create: (c, w, h) => new MouseInteractiveStyle(c, w, h) },
  { name: '3D旋转', description: 'Y轴旋转透视投影近大远小', create: (c, w, h) => new Rotate3DStyle(c, w, h) },
  { name: '水晶轮廓', description: '半透明闪烁淡蓝星光', create: (c, w, h) => new CrystalStyle(c, w, h) },
  { name: '粒子汇聚', description: '随机位置汇聚 → 心跳 → 散开', create: (c, w, h) => new ConvergeStyle(c, w, h) },
  { name: '火焰粒子', description: '底部红色到顶部黄色火焰', create: (c, w, h) => new FlameStyle(c, w, h) },
  { name: '星空粒子', description: '大量闪烁小星 + 脉冲恒星', create: (c, w, h) => new StarfieldStyle(c, w, h) },
  { name: '双爱心交错', description: '红+粉双心形反向呼吸', create: (c, w, h) => new DualHeartStyle(c, w, h) },
  { name: '音乐节拍', description: '节拍脉冲 + 冲击波 + 爆发', create: (c, w, h) => new MusicBeatStyle(c, w, h) },
  { name: '立体水晶', description: '3D心形棱线水晶旋转', create: (c, w, h) => new Crystal3DStyle(c, w, h) },
  { name: '星云漩涡', description: '银河旋臂式引力环绕', create: (c, w, h) => new NebulaStyle(c, w, h) },
  { name: '分形递归', description: '大心形由小心形组成', create: (c, w, h) => new FractalStyle(c, w, h) },
];
