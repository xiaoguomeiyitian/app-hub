import type { Move, Color, Piece } from './types';
import { PIECE_NAMES } from './types.js';
import { createInitialBoard, getPiece } from './board-setup.js';
import { makeMove } from './logic.js';

// Bug #9: 中国象棋标准记谱法
const CN_NUM_RED = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const CN_NUM_BLACK = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

function toChineseNotation(move: Move, piece: Piece): string {
  const name = PIECE_NAMES[piece.type];
  const numArr = piece.color === 'red' ? CN_NUM_RED : CN_NUM_BLACK;
  // 红方从右往左数，黑方从左往右数
  const startCol = piece.color === 'red' ? (8 - move.from.col) : move.from.col;
  const endCol = piece.color === 'red' ? (8 - move.to.col) : move.to.col;

  const colDiff = move.to.col - move.from.col;
  const rowDiff = move.to.row - move.from.row;

  let direction: string;
  let target: string;

  if (colDiff === 0) {
    // 纵向移动
    direction = '进';
    target = `${Math.abs(rowDiff)}`;
  } else {
    // 横向移动
    direction = '平';
    target = numArr[endCol] || `${endCol + 1}`;
  }

  return `${name}${numArr[startCol] || `${startCol + 1}`}${direction}${target}`;
}

export interface GameRecord {
  id: string;
  timestamp: number;
  mode: 'single' | 'online';
  myColor: Color;
  opponent: string;
  result: 'win' | 'lose' | 'draw';
  moveCount: number;
  duration: number;
  moves: Move[];
}

const STORAGE_KEY = 'xiangqi:history';
const MAX_RECORDS = 20;

export function getHistory(): GameRecord[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveRecord(record: GameRecord): void {
  const history = getHistory();
  history.unshift(record);
  if (history.length > MAX_RECORDS) history.length = MAX_RECORDS;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function deleteRecord(id: string): void {
  const history = getHistory().filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function exportGameToText(record: GameRecord): string {
  const date = new Date(record.timestamp);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

  const redPlayer = record.myColor === 'red' ? '玩家' : record.opponent;
  const blackPlayer = record.myColor === 'black' ? '玩家' : record.opponent;
  const winnerText = record.result === 'draw' ? '和棋' :
    (record.myColor === 'red' ? (record.result === 'win' ? '红胜' : '黑胜') : (record.result === 'win' ? '黑胜' : '红胜'));

  let text = `中国象棋对局\n`;
  text += `红方：${redPlayer}\n`;
  text += `黑方：${blackPlayer}\n`;
  text += `日期：${dateStr}\n`;
  text += `结果：${winnerText}（${record.moveCount} 回合）\n\n`;

  // Bug #9: 使用标准中国象棋记谱法
  let board = createInitialBoard();

  for (let i = 0; i < record.moves.length; i++) {
    const move = record.moves[i];
    const stepNum = Math.floor(i / 2) + 1;
    const isRed = i % 2 === 0;
    const piece = getPiece(board, move.from.col, move.from.row);
    const notation = piece ? toChineseNotation(move, piece) : `${move.from.col}${move.from.row}→${move.to.col}${move.to.row}`;
    board = makeMove(board, move);

    if (isRed) {
      text += `${stepNum}. ${notation.padEnd(10)}`;
    } else {
      text += `${notation}\n`;
    }
  }
  if (record.moves.length % 2 !== 0) text += '\n';

  return text;
}
