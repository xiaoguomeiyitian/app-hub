import { log, LogLevel } from './logger.js';
import type { IncomingMessage, Server as HttpServer } from "http";
import type { Duplex } from "stream";

export type UpgradeListener = (req: IncomingMessage, socket: Duplex, head: Buffer) => void;

interface ServerState {
  listeners: Set<UpgradeListener>;
  installed: boolean;
  dispatch: UpgradeListener;
}

const states = new WeakMap<HttpServer, ServerState>();

function getState(server: HttpServer): ServerState {
  let state = states.get(server);
  if (state) return state;

  const listeners = new Set<UpgradeListener>();
  const dispatch: UpgradeListener = (req, socket, head) => {
    for (const listener of listeners) {
      try {
        listener(req, socket, head);
      } catch (err) {
        log(LogLevel.ERROR,"⚠️ upgrade listener 执行失败:", err);
      }
    }
  };

  state = { listeners, installed: false, dispatch };
  states.set(server, state);
  return state;
}

function ensureDispatcher(server: HttpServer): void {
  const state = getState(server);
  if (state.installed) return;
  server.on("upgrade", state.dispatch);
  state.installed = true;
}

function registerUpgradeListener(server: HttpServer, listener: UpgradeListener): void {
  const state = getState(server);
  state.listeners.add(listener);
  ensureDispatcher(server);
}

function removeUpgradeListener(server: HttpServer, listener: UpgradeListener): void {
  const state = states.get(server);
  if (!state) return;
  state.listeners.delete(listener);
}

export function createUpgradeAwareServer(server: HttpServer): HttpServer {
  ensureDispatcher(server);

  return new Proxy(server, {
    get(target, prop, receiver) {
      if (prop === "on" || prop === "addListener" || prop === "prependListener") {
        return (event: string, listener: UpgradeListener) => {
          if (event === "upgrade") {
            registerUpgradeListener(target, listener);
            return receiver;
          }
          const method = Reflect.get(target, prop, receiver) as Function;
          return method.call(target, event, listener);
        };
      }

      if (prop === "removeListener" || prop === "off") {
        return (event: string, listener: UpgradeListener) => {
          if (event === "upgrade") {
            removeUpgradeListener(target, listener);
            return receiver;
          }
          const method = Reflect.get(target, prop, receiver) as Function;
          return method.call(target, event, listener);
        };
      }

      return Reflect.get(target, prop, receiver);
    },
  }) as HttpServer;
}
