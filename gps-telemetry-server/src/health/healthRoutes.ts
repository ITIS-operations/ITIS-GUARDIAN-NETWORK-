import { Router, Request, Response } from 'express';

export interface HealthRouteOptions {
  storageMode: 'memory' | 'postgresql';
  version?: string;
  getActiveSessions?: () => number;
}

export function createHealthRouter(options: HealthRouteOptions): Router {
  const router = Router();

  router.get('/health', (_req: Request, res: Response) => {
    const storage = options.storageMode === 'postgresql' ? 'POSTGRESQL' : 'MEMORY';

    res.status(200).json({
      status: 'HEALTHY',
      service: 'ITIS GPS Telemetry Server',
      version: options.version || '1.0.0',
      storage,
      timestamp: new Date().toISOString(),
      ...(options.getActiveSessions ? { activeSessions: options.getActiveSessions() } : {})
    });
  });

  return router;
}
