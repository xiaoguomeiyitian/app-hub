import WebSocket from 'ws';

const URL = 'ws://127.0.0.1:20008/api/xiangqi/websocket';

function connect(name) {
  const ws = new WebSocket(URL);
  const state = { name, messages: [], socketId: '' };

  ws.on('open', () => {
    console.log(`[${name}] open`);
    ws.send(JSON.stringify({ type: 'match:join', data: { nickname: name, elo: 1200, timeConfig: { preset: 'standard' } } }));
  });

  ws.on('message', (buf) => {
    const msg = JSON.parse(buf.toString());
    state.messages.push(msg);
    console.log(`[${name}]`, msg.type, msg.data ? JSON.stringify(msg.data) : '');
    if (msg.type === 'connected') state.socketId = msg.data.socketId;
  });

  ws.on('error', (err) => {
    console.error(`[${name}] error`, err.message);
  });

  return { ws, state };
}

const a = connect('A');
const b = connect('B');

let moved = false;
const timer = setInterval(() => {
  if (moved) return;
  const foundA = a.state.messages.find((m) => m.type === 'match:found');
  const foundB = b.state.messages.find((m) => m.type === 'match:found');
  if (!foundA || !foundB) return;
  const stateMsg = a.state.messages.find((m) => m.type === 'game:state');
  if (!stateMsg) return;
  const state = stateMsg.data;
  const from = { col: 0, row: 0 };
  const to = { col: 0, row: 1 };
  const mover = state.red.nickname === 'A' ? a : b;
  mover.ws.send(JSON.stringify({ type: 'game:move', data: { from, to } }));
  moved = true;
  setTimeout(() => {
    console.log('DONE');
    a.ws.close();
    b.ws.close();
    clearInterval(timer);
  }, 1500);
}, 500);
