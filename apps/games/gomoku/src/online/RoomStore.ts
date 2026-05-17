import type { PlayerInfo } from './OnlineTypes.js';

/**
 * 联机房间状态管理
 */
export class RoomStore {
  private _roomId: string | null = null;
  private _myColor: 'black' | 'white' | null = null;
  private _myName: string = '';
  private _opponentName: string = '';
  private _players: PlayerInfo[] = [];
  private _status: 'idle' | 'waiting' | 'playing' | 'finished' = 'idle';
  private _board: number[][] = [];
  private _turn: 'black' | 'white' = 'black';
  private _winner: 'black' | 'white' | 'draw' | null = null;

  get roomId(): string | null { return this._roomId; }
  get myColor(): 'black' | 'white' | null { return this._myColor; }
  get myName(): string { return this._myName; }
  get opponentName(): string { return this._opponentName; }
  get players(): PlayerInfo[] { return this._players; }
  get status(): string { return this._status; }
  get board(): number[][] { return this._board; }
  get turn(): 'black' | 'white' { return this._turn; }
  get winner(): 'black' | 'white' | 'draw' | null { return this._winner; }

  setMyName(name: string): void {
    this._myName = name;
  }

  setMatchFound(roomId: string, myColor: 'black' | 'white', opponentName: string): void {
    this._roomId = roomId;
    this._myColor = myColor;
    this._opponentName = opponentName;
    this._status = 'playing';
    this._winner = null;
  }

  setRoomCreated(roomId: string): void {
    this._roomId = roomId;
    this._myColor = 'black';
    this._status = 'waiting';
    this._winner = null;
  }

  setRoomJoined(roomId: string, players: PlayerInfo[]): void {
    this._roomId = roomId;
    this._players = players;
    this._myColor = players.find(p => p.socketId)?.color ?? null;
    this._opponentName = players.find(p => p.socketId === undefined || p.color !== this._myColor)?.name ?? '';
  }

  setRoomUpdate(players: PlayerInfo[], status: string): void {
    this._players = players;
    this._status = status as typeof this._status;
  }

  setGameStarted(turn: 'black', board: number[][]): void {
    this._turn = turn;
    this._board = board;
    this._status = 'playing';
    this._winner = null;
  }

  setTurn(turn: 'black' | 'white'): void {
    this._turn = turn;
  }

  isMyTurn(): boolean {
    return this._turn === this._myColor;
  }

  setWinner(winner: 'black' | 'white' | 'draw'): void {
    this._winner = winner;
    this._status = 'finished';
  }

  reset(): void {
    this._roomId = null;
    this._myColor = null;
    this._opponentName = '';
    this._players = [];
    this._status = 'idle';
    this._board = [];
    this._turn = 'black';
    this._winner = null;
  }
}
