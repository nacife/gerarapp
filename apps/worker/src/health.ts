import { createServer, type Server } from 'node:http';

export interface Pingable {
  ping: () => Promise<string>;
}

export interface WorkerReadiness {
  status: 'ok' | 'degraded';
  service: 'worker';
  checks: Record<string, 'up' | 'down'>;
}

/** Readiness pura do worker: checa o Redis. Testável isoladamente. */
export async function checkWorkerReadiness(redis: Pingable): Promise<WorkerReadiness> {
  let redisStatus: 'up' | 'down' = 'down';
  try {
    const pong = await redis.ping();
    redisStatus = pong === 'PONG' ? 'up' : 'down';
  } catch {
    redisStatus = 'down';
  }
  return {
    status: redisStatus === 'up' ? 'ok' : 'degraded',
    service: 'worker',
    checks: { redis: redisStatus },
  };
}

/** Sobe um servidor HTTP mínimo de health para o worker. */
export function startHealthServer(port: number, redis: Pingable): Server {
  const server = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'worker', uptime: process.uptime() }));
      return;
    }
    if (req.url === '/health/ready') {
      void checkWorkerReadiness(redis).then((report) => {
        res.writeHead(report.status === 'ok' ? 200 : 503, {
          'content-type': 'application/json',
        });
        res.end(JSON.stringify(report));
      });
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });
  server.listen(port, '0.0.0.0');
  return server;
}
