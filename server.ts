import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  executeSingleProbeWithFallback,
  measureSingleRequest,
  resolveAndValidateHost,
} from './src/lib/probeRunner.ts';
import { validateTargetUrl } from './src/lib/urlValidation.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MAX_PROBES = 20;
const MIN_PROBES = 5;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', runtime: 'express' });
  });

  app.post('/api/probe', async (req: Request, res: Response) => {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url : '';
    const requestedCount = Number(req.body?.count ?? 12);
    const requestedRate = Number(req.body?.ratePerSec ?? 2.5);
    const preferredMethod: 'HEAD' | 'GET' = req.body?.method === 'GET' ? 'GET' : 'HEAD';
    const mode = req.body?.mode === 'single' ? 'single' : 'stream';

    const validation = validateTargetUrl(rawUrl);
    if (!validation.valid || !validation.normalizedUrl || !validation.hostname) {
      res.status(400).json({ error: validation.error || 'URL inválida.' });
      return;
    }

    const dnsCheck = await resolveAndValidateHost(validation.hostname);
    if (!dnsCheck.ok) {
      res.status(400).json({ error: dnsCheck.error });
      return;
    }

    // Single-probe JSON mode (aligned with Vercel Serverless /api/probe)
    if (mode === 'single') {
      const sample = await executeSingleProbeWithFallback(
        validation.normalizedUrl,
        preferredMethod
      );
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        normalizedUrl: validation.normalizedUrl,
        hostname: validation.hostname,
        ...sample,
      });
      return;
    }

    const count = Math.min(
      MAX_PROBES,
      Math.max(MIN_PROBES, Math.round(Number.isFinite(requestedCount) ? requestedCount : 12))
    );
    const ratePerSec = Math.min(
      4,
      Math.max(1, Number.isFinite(requestedRate) ? requestedRate : 2.5)
    );
    const intervalMs = Math.round(1000 / ratePerSec);

    // Stream NDJSON probe samples one by one as they complete
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');

    let aborted = false;
    req.on('close', () => {
      aborted = true;
    });

    res.write(
      JSON.stringify({
        type: 'meta',
        url: validation.normalizedUrl,
        hostname: validation.hostname,
        count,
        ratePerSec,
        intervalMs,
      }) + '\n'
    );

    let activeMethod: 'HEAD' | 'GET' = preferredMethod;

    for (let i = 0; i < count; i++) {
      if (aborted) break;

      const stepStart = performance.now();
      let sample = await measureSingleRequest(validation.normalizedUrl, activeMethod);

      // Automatic fallback from HEAD to GET if target blocks HEAD (405 / 501)
      if (i === 0 && activeMethod === 'HEAD' && (sample.status === 405 || sample.status === 501)) {
        activeMethod = 'GET';
        sample = await measureSingleRequest(validation.normalizedUrl, 'GET');
      }

      if (aborted) break;

      res.write(
        JSON.stringify({
          type: 'sample',
          index: i + 1,
          total: count,
          ...sample,
        }) + '\n'
      );

      if (i < count - 1) {
        const elapsed = performance.now() - stepStart;
        const waitMs = Math.max(50, intervalMs - elapsed);
        await sleep(waitMs);
      }
    }

    if (!aborted) {
      res.write(JSON.stringify({ type: 'done' }) + '\n');
      res.end();
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

startServer();
