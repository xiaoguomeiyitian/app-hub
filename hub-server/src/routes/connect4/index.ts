import { log, LogLevel } from '../../logger.js';
import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { nanoid } from 'nanoid';
import { Player, Room } from '../../types/game.js';

export const description = '四子棋 - 经典连四对战';
export const router = Router();
const clients = new Map<string, WebSocket>();
const rooms = new Map<string, Room>();
const matchQ: Player[] = [];
const ROWS=6,COLS=7;

function send(ws:WebSocket,type:string,data?:unknown){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type,data}));}
function broadcast(room:Room,type:string,data?:unknown){for(const p of room.players)if(!p.isBot&&p.ws?.readyState===WebSocket.OPEN)send(p.ws,type,data);}
function checkWin(b:number[][],r:number,c:number,p:number):boolean{
  const dirs=[[0,1],[1,0],[1,1],[1,-1]];
  for(const[dr,dc]of dirs){let count=1;
    for(const s of[1,-1])for(let i=1;i<4;i++){const nr=r+dr*i*s,nc=c+dc*i*s;
      if(nr<0||nr>=ROWS||nc<0||nc>=COLS||b[nr][nc]!==p)break;count++;}
    if(count>=4)return true;}return false;}

function handleMsg(msg:any,sid:string,ws:WebSocket){
  if(msg.type==='match:join'){matchQ.push({id:sid,ws,nick:msg.data?.nick||'匿名',isBot:false,score:0} as Player);send(ws,'match:queued',{position:matchQ.length});
    const timerId=setTimeout(()=>{const idx=matchQ.findIndex(q=>q.id===sid);if(idx<0)return;
      while(matchQ.length<2)matchQ.push({id:'bot-'+nanoid(4),ws:null,isBot:true,nick:'AI'});
      const m=matchQ.splice(0,2);const roomId=nanoid(8);
      const room:any={id:roomId,players:m.map((x:any)=>({...x})),board:Array.from({length:ROWS},()=>Array(COLS).fill(0)),currentPlayer:0,phase:'playing',timerId:null};
      room.timerId=timerId;
      rooms.set(roomId,room);m.filter((x:any)=>!x.isBot).forEach((x:any)=>send(x.ws,'match:found',{roomId,position:m.indexOf(x)}));
      broadcast(room,'game:start',{rows:ROWS,cols:COLS,currentPlayer:0});
    },8000);}
  if(msg.type==='room:create'){const room={id:nanoid(8),players:[{id:sid,ws,nick:msg.data?.nick||'匿名',isBot:false,score:0} as Player],board:Array.from({length:ROWS},()=>Array(COLS).fill(0)),currentPlayer:0,phase:'playing'};rooms.set(room.id,room);send(ws,'room:created',{roomId:room.id});}
  if(msg.type==='room:join'){const room=rooms.get(msg.data?.roomId);if(!room)return send(ws,'error',{message:'房间不存在'});if(room.players.length>=2)return send(ws,'error',{message:'房间已满'});room.players.push({id:sid,ws,nick:msg.data?.nick||'匿名',isBot:false,score:0} as Player);broadcast(room,'room:joined',{total:room.players.length});if(room.players.length>=2)broadcast(room,'game:start',{rows:ROWS,cols:COLS,currentPlayer:0});}
  if(msg.type==='game:drop'){for(const[,room]of rooms){const pos=room.players.findIndex((p:any)=>p.id===sid);
    if(pos>=0&&pos===room.currentPlayer&&room.phase==='playing'){const col=msg.data?.col;if(col<0||col>=COLS)return;
      let row=-1;for(let r=ROWS-1;r>=0;r--)if(room.board[r][col]===0){row=r;break;}
      if(row<0)return send(ws,'error',{message:'列已满'});
      room.board[row][col]=pos+1;const won=checkWin(room.board,row,col,pos+1);
      const full=room.board[0].every((c:number)=>c!==0);
      broadcast(room,'game:drop',{position:pos,col,row,won,gameOver:won||full,board:room.board});
      if(won||full){room.phase='finished';broadcast(room,'game:over',{winner:won?pos:-1});}
      else{room.currentPlayer=(room.currentPlayer+1)%2;broadcast(room,'game:turn',{position:room.currentPlayer});}
      break;}
  }}
}

router.get('/health',(_req,res)=>res.json({status:'ok',game:'connect4'}));
export function socketSetup(httpServer: HttpServer, wsPath: string): void {
  const targetPath = wsPath.replace(/\/$/, '') + '/websocket';
  const wss = new WebSocketServer({ noServer: true });
  httpServer.on('upgrade', (req, socket, head) => {
    const url = (req.url || '').split('?')[0];
    if (url !== targetPath) return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });
  wss.on('connection', (ws: WebSocket) => {
    const sid = nanoid(12);
    clients.set(sid, ws);
    send(ws, 'connected', { socketId: sid });
    ws.on('message', (raw: RawData) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'ping') return send(ws, 'pong');
        handleMsg(msg, sid, ws);
      } catch (e) { console.warn('[connect4] msg error:', e); }
    });
    ws.on('close', () => {
      clients.delete(sid);
      const i = matchQ.findIndex(q => q.id === sid);
      if (i >= 0) matchQ.splice(i, 1);
    });
    ws.on('error', () => clients.delete(sid));
  });
  log(LogLevel.INFO, `🔌 WebSocket 已注册: ${targetPath}`);
}
