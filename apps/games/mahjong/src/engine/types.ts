// 麻将核心类型

export type Suit = 'wan' | 'tiao' | 'tong' | 'feng' | 'hua';
export type Seat = 'east' | 'south' | 'west' | 'north';

export interface Tile {
  id: number;
  suit: Suit;
  value: number; // wan/tiao/tong: 1-9, feng: 1=东 2=南 3=西 4=北, 5=中 6=发 7=白, hua: 1-8
  label: string;
}

export interface Meld {
  type: 'chi' | 'pong' | 'kong' | 'angang';
  tiles: Tile[];
  from?: Seat;
}

export interface Player {
  seat: Seat;
  name: string;
  hand: Tile[];
  melds: Meld[];
  isHuman: boolean;
  discards: Tile[];
}

export type GamePhase = 'playing' | 'finished';

export interface GameState {
  phase: GamePhase;
  wall: Tile[];
  players: Record<Seat, Player>;
  currentTurn: Seat;
  lastDiscard: Tile | null;
  lastDiscardSeat: Seat | null;
  winner: Seat | null;
  winType: 'zimo' | 'dianpao' | null;
  actionPending: { seat: Seat; actions: string[]; tile: Tile } | null;
  log: string[];
  mode: 'guobiao' | 'chuanma';
  dealer: Seat;
  turnCount: number;
}

export const SEATS: Seat[] = ['east', 'south', 'west', 'north'];
export const NEXT_SEAT: Record<Seat, Seat> = { east: 'south', south: 'west', west: 'north', north: 'east' };
export const SEAT_LABEL: Record<Seat, string> = { east: '东', south: '南', west: '西', north: '北' };
