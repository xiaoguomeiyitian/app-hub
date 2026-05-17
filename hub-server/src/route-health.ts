import type { Express } from 'express';

export function registerFallbackHealth(app: Express, basePath: string, projectName: string): void {
  app.get(`${basePath}/health`, (_req, res) => {
    res.json({ status: 'ok', project: projectName });
  });
}
