export type TimeTierKey = 'bullet' | 'blitz' | 'rapid' | 'classical';

export interface TimeTierConfig {
  key: TimeTierKey;
  label: string;
  description: string;
  stepTime: number;
  totalTime: number;
  increment: number;
}

export const TIME_TIERS: TimeTierConfig[] = [
  {
    key: 'bullet',
    label: '闪电局',
    description: '30秒步时 / 5分钟局时 / 无加秒',
    stepTime: 30_000,
    totalTime: 300_000,
    increment: 0,
  },
  {
    key: 'blitz',
    label: '快棋局',
    description: '60秒步时 / 10分钟局时 / 5秒加秒',
    stepTime: 60_000,
    totalTime: 600_000,
    increment: 5_000,
  },
  {
    key: 'rapid',
    label: '标准局',
    description: '90秒步时 / 20分钟局时 / 15秒加秒',
    stepTime: 90_000,
    totalTime: 1_200_000,
    increment: 15_000,
  },
  {
    key: 'classical',
    label: '慢棋局',
    description: '120秒步时 / 30分钟局时 / 20秒加秒',
    stepTime: 120_000,
    totalTime: 1_800_000,
    increment: 20_000,
  },
];

export const DEFAULT_TIME_TIER: TimeTierKey = 'rapid';

export function isTimeTierKey(value: unknown): value is TimeTierKey {
  return typeof value === 'string' && TIME_TIERS.some((tier) => tier.key === value);
}

export function getTimeTierConfig(value: TimeTierKey): TimeTierConfig {
  return TIME_TIERS.find((tier) => tier.key === value) ?? TIME_TIERS[2];
}
