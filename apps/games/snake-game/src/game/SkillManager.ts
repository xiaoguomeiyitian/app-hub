import type { SkillType, SkillCard, ActiveSkill } from '../types';
import { MAX_SKILL_CARDS, FOODS_PER_SKILL, SKILL_CONFIG } from '../config/constants';

export class SkillManager {
  private foodsSinceLastSkill: number;

  constructor() {
    this.foodsSinceLastSkill = 0;
  }

  reset(): void {
    this.foodsSinceLastSkill = 0;
  }

  /** 记录一次进食，检查是否获得技能卡 */
  tryGrant(cards: SkillCard[]): SkillCard | null {
    this.foodsSinceLastSkill++;
    if (this.foodsSinceLastSkill >= FOODS_PER_SKILL && cards.length < MAX_SKILL_CARDS) {
      this.foodsSinceLastSkill = 0;
      const type = this.randomSkill();
      const card: SkillCard = { type, obtainedAt: Date.now() };
      return card;
    }
    return null;
  }

  /** 生成镜像翻转的反向方向 */
  static flipDirection(dir: string): string {
    switch (dir) {
      case 'UP': return 'DOWN';
      case 'DOWN': return 'UP';
      case 'LEFT': return 'RIGHT';
      case 'RIGHT': return 'LEFT';
      default: return dir;
    }
  }

  /** 获取镜像方向（双蛇模式用） */
  static mirrorDirection(dir: string): string {
    switch (dir) {
      case 'UP': return 'DOWN';
      case 'DOWN': return 'UP';
      case 'LEFT': return 'RIGHT';
      case 'RIGHT': return 'LEFT';
      default: return dir;
    }
  }

  /** 检查技能是否活跃 */
  static isActive(activeSkills: ActiveSkill[], type: SkillType): boolean {
    return activeSkills.some(s => s.type === type && s.expiresAt > Date.now());
  }

  /** 清除过期技能 */
  static cleanExpired(activeSkills: ActiveSkill[]): ActiveSkill[] {
    const now = Date.now();
    return activeSkills.filter(s => s.expiresAt > now);
  }

  /** 使用技能卡，返回激活的技能或null */
  static useCard(cards: SkillCard[], index: number): ActiveSkill | null {
    if (index < 0 || index >= cards.length) return null;
    const card = cards[index];
    cards.splice(index, 1);
    const cfg = SKILL_CONFIG[card.type];
    if (cfg.duration === 0) return null; // instant effect
    return { type: card.type, expiresAt: Date.now() + cfg.duration };
  }

  private randomSkill(): SkillType {
    const types: SkillType[] = ['wallPass', 'ghost', 'magnet', 'timeStop', 'mirrorFlip', 'doubleScore'];
    // 均等概率
    return types[Math.floor(Math.random() * types.length)];
  }
}
