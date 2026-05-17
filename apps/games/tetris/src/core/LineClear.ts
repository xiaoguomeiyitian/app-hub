import type { ClearType, ClearResult } from '../types.js';

/** 基础攻击量 */
const BASE_ATTACK: Record<ClearType, number> = {
  single: 0,
  double: 1,
  triple: 2,
  quad: 4,
  tspin_mini: 0,
  tspin_mini_double: 1,
  tspin_single: 2,
  tspin_double: 4,
  tspin_triple: 6,
};

/** 困难操作（B2B 可叠加） */
const DIFFICULT: Set<ClearType> = new Set(['quad', 'tspin_single', 'tspin_double', 'tspin_triple']);

/**
 * 计算消行攻击量
 * @param lines 消行数
 * @param tspin T-Spin 类型
 * @param prevB2B 上一次 B2B 计数
 * @param combo 当前 Combo 数
 * @param allClear 是否全消
 */
export function calculateAttack(
  lines: number,
  tspin: 'none' | 'mini' | 'full',
  prevB2B: number,
  combo: number,
  allClear: boolean,
): ClearResult {
  // 确定消行类型
  let type: ClearType;
  if (tspin === 'full') {
    type = lines === 1 ? 'tspin_single' : lines === 2 ? 'tspin_double' : lines >= 3 ? 'tspin_triple' : 'tspin_single';
  } else if (tspin === 'mini') {
    type = lines === 1 ? 'tspin_mini' : 'tspin_mini_double';
  } else {
    type = lines === 1 ? 'single' : lines === 2 ? 'double' : lines === 3 ? 'triple' : 'quad';
  }

  const base = BASE_ATTACK[type] ?? 0;
  const isDifficult = DIFFICULT.has(type);

  // B2B
  let b2b = prevB2B;
  let b2bBonus = 0;
  if (base > 0) {
    if (isDifficult) {
      b2b++;
      b2bBonus = 1;
      if (b2b >= 4) {
        b2bBonus += (b2b - 3); // Surge 蓄力
      }
    } else {
      b2b = 0;
    }
  }

  // Combo
  let currentCombo = combo;
  let comboBonus = 0;
  if (base > 0 || (lines > 0 && tspin !== 'none')) {
    currentCombo++;
    comboBonus = Math.floor(base * 0.25 * currentCombo);
  } else if (lines > 0) {
    currentCombo++;
    comboBonus = Math.floor(base * 0.25 * currentCombo);
  } else {
    currentCombo = 0;
  }

  // All Clear bonus
  const allClearBonus = allClear ? 10 : 0;

  const totalAttack = base + b2bBonus + comboBonus + allClearBonus;

  return {
    linesCleared: lines,
    type,
    attack: base,
    b2bBonus,
    combo: currentCombo,
    comboBonus,
    totalAttack,
    allClear,
  };
}
