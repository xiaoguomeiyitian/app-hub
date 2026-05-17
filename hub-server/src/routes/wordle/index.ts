import { Router } from 'express';
import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import type { RawData } from 'ws';
import { nanoid } from 'nanoid';

export const description = 'Wordle - 猜词竞速游戏';
export const router = Router();

const WORDS = ['apple','beach','crane','dream','eagle','flame','grape','heart','ivory','joker','knock','lemon','mango','night','ocean','piano','queen','river','stone','tiger','uncle','vivid','whale','xenon','youth','zebra','about','above','abuse','actor','acute','admit','adopt','adult','after','again','agent','agree','ahead','alarm','album','alert','alien','align','alike','alive','allow','alone','alter','among','ample','angel','anger','angle','angry','apart','apply','arena','argue','arise','armor','array','arrow','aside','asset'];
const clients = new Map<string, WebSocket>();

function send(ws: WebSocket, type: string, data?: unknown) { if (ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify({type,data})); }
function checkGuess(guess: string, target: string): string[] {
  const result: string[] = Array(5).fill('absent');
  const targetChars = target.split('');
  for (let i = 0; i < 5; i++) { if (guess[i] === targetChars[i]) { result[i] = 'correct'; targetChars[i] = ''; } }
  for (let i = 0; i < 5; i++) { if (result[i] !== 'correct') { const idx = targetChars.indexOf(guess[i]); if (idx >= 0) { result[i] = 'present'; targetChars[idx] = ''; } } }
  return result;
}

router.get('/health',(_req,res)=>res.json({status:'ok',game:'wordle'}));

export function socketSetup(httpServer: HttpServer, wsPath: string): void {
  const targetPath = wsPath.replace(/\/$/,'')+'/websocket';
  const wss = new WebSocketServer({noServer:true});
  httpServer.on('upgrade',(req,socket,head)=>{const url=(req.url||'').split('?')[0];if(url!==targetPath)return;wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));});

  wss.on('connection',(ws:WebSocket)=>{
    const sid=nanoid(12); clients.set(sid,ws); send(ws,'connected',{socketId:sid});
    let room: any = null;

    ws.on('message',(raw:RawData)=>{
      try{const msg=JSON.parse(raw.toString());
        if(msg.type==='ping') return send(ws,'pong');

        if(msg.type==='room:create'||msg.type==='match:join'){
          const word = WORDS[Math.floor(Math.random()*WORDS.length)];
          room = { id:nanoid(8), players:[{id:sid,ws,nick:msg.data?.nick||'匿名',guesses:[],won:false}], word, maxGuesses:6, phase:'playing' };
          send(ws,'game:start',{maxGuesses:6,wordLength:5,roomId:room.id});
          // Auto add bot after 8s
          setTimeout(()=>{
            if(room&&room.players.length<2){
              room.players.push({id:'bot-'+nanoid(4),ws:null,isBot:true,nick:'AI',guesses:[],won:false});
              send(ws,'opponent:joined',{nick:'AI'});
            }
          },8000);
        }

        if(msg.type==='room:join'&&msg.data?.roomId){
          // join existing not implemented for simplicity
        }

        if(msg.type==='game:guess'){
          if(!room)return;
          const guess=(msg.data?.word||'').toLowerCase();
          if(guess.length!==5)return send(ws,'error',{message:'请输入5个字母'});
          const player=room.players.find((p:any)=>p.id===sid);
          if(!player||player.guesses.length>=room.maxGuesses)return;
          const result=checkGuess(guess,room.word);
          player.guesses.push({word:guess,result});
          const won=guess===room.word;
          if(won)player.won=true;
          send(ws,'game:result',{guess,result,won,guesses:player.guesses.length});
          // Notify opponent
          const opp=room.players.find((p:any)=>p.id!==sid&&!p.isBot);
          if(opp?.ws)send(opp.ws,'opponent:guessed',{guesses:player.guesses.length,won});
          // Check game over
          if(won||player.guesses.length>=room.maxGuesses){
            send(ws,'game:over',{won,word:room.word});
            if(opp?.ws)send(opp.ws,'game:over',{won:false,word:room.word});
          }
          // Bot plays
          const bot=room.players.find((p:any)=>p.isBot);
          if(bot&&bot.guesses.length<room.maxGuesses&&!bot.won){
            const botGuess=WORDS[Math.floor(Math.random()*WORDS.length)];
            bot.guesses.push({word:botGuess,result:checkGuess(botGuess,room.word)});
            if(botGuess===room.word)bot.won=true;
            send(ws,'opponent:guessed',{guesses:bot.guesses.length,won:botGuess===room.word});
          }
        }
      } catch (e) { console.warn('[wordle] msg error:', e); }
    });
    ws.on('close',()=>clients.delete(sid));
    ws.on('error',()=>clients.delete(sid));
  });
  console.log(`🔌 WebSocket 已注册: ${targetPath}`);
}
