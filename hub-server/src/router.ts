import { log, LogLevel } from './logger.js';
import type { Express } from 'express';
import type { Server as HttpServer } from 'http';
import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadProjectRoute, type LoadedProject, type RouteRegistry } from './route-loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const loadedProjects = new Map<string, LoadedProject>();
const EXCLUDED_PROJECTS = new Set(['admin', 'auth', 'platform', 'platform-console']);

const registry: RouteRegistry = {
  has: (projectName) => loadedProjects.has(projectName),
  get: (projectName) => loadedProjects.get(projectName),
  set: (projectName, project) => { loadedProjects.set(projectName, project); },
  values: () => loadedProjects.values(),
  keys: () => loadedProjects.keys(),
};

export type { LoadedProject } from './route-loader.js';

export async function discoverProjects(): Promise<string[]> {
  const routesDir = join(__dirname, 'routes');
  try {
    const entries = await readdir(routesDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && !EXCLUDED_PROJECTS.has(e.name)).map((e) => e.name).sort();
  } catch (err) {
    log(LogLevel.ERROR,'❌ 扫描路由目录失败:', err);
    return [];
  }
}

export async function initAllRoutes(app: Express, httpServer: HttpServer): Promise<LoadedProject[]> {
  const projects = await discoverProjects();
  const results: LoadedProject[] = [];

  for (const name of projects) {
    const loaded = await loadProjectRoute(name, app, httpServer, registry);
    if (loaded) results.push(loaded);
  }

  return results;
}

export function getLoadedProjects(): LoadedProject[] {
  return Array.from(loadedProjects.values());
}

export async function rescanAndLoad(
  app: Express,
  httpServer: HttpServer,
): Promise<{ newProjects: string[]; allProjects: string[] }> {
  const discovered = await discoverProjects();
  const newProjects: string[] = [];

  for (const name of discovered) {
    if (!EXCLUDED_PROJECTS.has(name) && !loadedProjects.has(name)) {
      const loaded = await loadProjectRoute(name, app, httpServer, registry);
      if (loaded) newProjects.push(name);
    }
  }

  return {
    newProjects,
    allProjects: Array.from(loadedProjects.keys()),
  };
}
