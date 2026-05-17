import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { nanoid } from 'nanoid';
export const description = '宝石迷阵 - 三消对战';
export const router = Router();
const S=8,GEMS=['💎','🔮','🔴','🟢','🔵','🟡','🟣'],clients=new Map<string,WebSocket>(),rooms=new Map<string,any>(),matchQ:any[]=[];
function send(ws:WebSocket,t:string,d?:unknown){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:t,data:d}));}
function bc(r:any,t:string,d?:unknown){for(const p of r.players)if(!p.isBot&&p.ws?.readyState===WebSocket.OPEN)send(p.ws,t,d);}
function initBoard(){const b:number[][]=[];for(let r=0;r<S;r++){b[r]=[];for(let c=0;c<S;c++)b[r][c]=Math.floor(Math.random()*GEMS.length);}return b;}
function handleMsg(msg:any,sid:string,ws:WebSocket){
  if(msg.type==='match:join'){matchQ.push({id:sid,ws,nick:msg.data?.nick||'匿名'});send(ws,'match:queued',{position:matchQ.length});
    setTimeout(()=>{const idx=matchQ.findIndex(q=>q.id===sid);if(idx<0)return;while(matchQ.length<2)matchQ.push({id:'bot-'+nanoid(4),ws:null,isBot:true,nick:'AI'});const m=matchQ.splice(0,2);const id=nanoid(8);const r={id,players:m.map((x:any)=>({...x,score:0})),board:initBoard(),phase:'playing',timeLeft:90};rooms.set(id,r);m.filter((x:any)=>!x.isBot).forEach((x:any)=>send(x.ws,'match:found',{roomId:id,position:m.indexOf(x)}));bc(r,'game:start',{board:r.board,gems:GEMS,timeLeft:90});},8000);}
  if(msg.type==='room:create'){const r={id:nanoid(8),players:[{id:sid,ws,nick:msg.data?.nick||'匿名',score:0}],board:initBoard(),phase:'playing',timeLeft:90};rooms.set(r.id,r);send(ws,'room:created',{roomId:r.id});}
  if(msg.type==='room:join'){const r=rooms.get(msg.data?.roomId);if(!r)return send(ws,'error',{message:'不存在'});if(r.players.length>=2)return send(ws,'error',{message:'已满'});r.players.push({id:sid,ws,nick:msg.data?.nick||'匿名',score:0});bc(r,'room:joined',{total:r.players.length});if(r.players.length>=2)bc(r,'game:start',{board:r.board,gems:GEMS,timeLeft:90});}
  if(msg.type==='game:swap'){for(const[,r]of rooms){const pos=r.players.findIndex((p:any)=>p.id===sid);
    if(pos>=0&&r.phase==='playing'){const{r1,c1,r2,c2}=msg.data;if(Math.abs(r1-r2)+Math.abs(c1-c2)!==1)return;
      [r.board[r1][c1],r.board[r2][c2]]=[r.board[r2][c2],r.board[r1][c1]];const pts=Math.floor(Math.random()*30+10);r.players[pos].score+=pts;
      bc(r,'game:swap',{position:pos,r1,c1,r2,c2,score:r.players[pos].score,points:pts});break;}}}
}
router.get('/health',(_req,res)=>res.json({status:'ok',game:'bejeweled'}));
export function socketSetup(httpServer: HttpServer, wsPath: string): void {
  const tp = wsPath.replace(/\/$/, '') + '/websocket';
  const wss = new WebSocketServer({ noServer: true });
  httpServer.on('upgrade', (req, s, head) => {
    const u = (req.url || '').split('?')[0];
    if (u !== tp) return;
    wss.handleUpgrade(req, s, head, (ws) => wss.emit('connection', ws, req));
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
      } catch (e) { console.warn('[bejeweled] msg error:', e); }
    });
    ws.on('close', () => {
      clients.delete(sid);
      const i = matchQ.findIndex(q => q.id === sid);
      if (i >= 0) matchQ.splice(i, 1);
    });
    ws.on('error', () => clients.delete(sid));
  });
  console.log(`🔌 WebSocket 已注册: ${tp}`);
}
