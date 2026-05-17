export enum GamePhase {
  Waiting = 'waiting',
  Playing = 'playing',
  Finished = 'finished',
}

export enum MessageType {
  Ping = 'ping',
  Pong = 'pong',
  MatchJoin = 'match:join',
  MatchCancel = 'match:cancel',
  RoomCreate = 'room:create',
  RoomJoin = 'room:join',
  RoomLeave = 'room:leave',
  RoomReady = 'room:ready',
  RoomStart = 'room:start',
  GamePlay = 'game:play',
  GamePass = 'game:pass',
  TributeSubmit = 'tribute:submit',
  GameStart = 'game:start',
  GameOver = 'game:over',
}

export const GAME_TIME_LIMIT = 300; // seconds
export const MATCH_QUEUE_TIMEOUT = 8000; // ms
export const BALL_SPEED = 0.005;
