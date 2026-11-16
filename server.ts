import express from 'express';
import type { Request, Response } from 'express';
import dns from 'node:dns/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isPrivateOrReservedIpv4,
  isPrivateOrReservedIpv6,
  validateTargetUrl,
} from './src/lib/urlValidation.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MAX_PROBES = 20;
const MIN_PROBES = 5;
const REQUEST_TIMEOUT_MS = 8000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveAndValidateHost(hostname: string): Promise<{ ok: boolean; error?: string }> {
  if (net.isIPv4(hostname)) {
    return isPrivateOrReservedIpv4(hostname)
      ? { ok: false, error: 'IP privada o reservada bloqueada.' }
      : { ok: true };
  }
  if (net.isIPv6(hostname)) {
    return isPrivateOrReservedIpv6(hostname)
      ? { ok: false, error: 'IPv6 privada o reservada bloqueada.' }
      : { ok: true };
  }

  try {
    const records = await dns.lookup(hostname, { all: true });
    if (!records || records.length === 0) {
      return { ok: false, error: 'No se pudo resolver el dominio DNS.' };
    }
    for (const rec of records) {
      if (rec.family === 4 && isPrivateOrReservedIpv4(rec.address)) {
        return { ok: false, error: 'El dominio resuelve a una IP privada/interna bloqueada.' };
      }
      if (rec.family === 6 && isPrivateOrReservedIpv6(rec.address)) {
        return { ok: false, error: 'El dominio resuelve a una IPv6 privada/interna bloqueada.' };
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, error: `No se pudo resolver el host "${hostname}" vía DNS.` };
  }
}

async function measureSingleRequest(
  targetUrl: string,
  method: 'HEAD' | 'GET'
): Promise<{
  ok: boolean;
  status: number | null;
  latencySec: number;
  latencyMs: number;
  methodUsed: 'HEAD' | 'GET';
  error?: string;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const t0 = performance.now();

  try {
    const res = await fetch(targetUrl, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Simulador-MM1-BaselineProbe/1.0 (+academic-latency-estimator)',
        'Cache-Control': 'no-cache',
      },
    });

    // Cancel body consumption immediately after headers to keep probing lightweight
    if (res.body) {
      try {
        await res.body.cancel();
      } catch {
        // Ignore cancellation errors
      }
    }

    const elapsedMs = performance.now() - t0;
    return {
      ok: res.status < 500,
      status: res.status,
      latencySec: elapsedMs / 1000,
      latencyMs: Number(elapsedMs.toFixed(2)),
      methodUsed: method,
    };
  } catch (err) {
    const elapsedMs = performance.now() - t0;
    const message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? 'Timeout (>8s)'
          : err.message
        : 'Error de red';
    return {
      ok: false,
      status: null,
      latencySec: elapsedMs / 1000,
      latencyMs: Number(elapsedMs.toFixed(2)),
      methodUsed: method,
      error: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/probe', async (req: Request, res: Response) => {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url : '';
    const requestedCount = Number(req.body?.count ?? 12);
    const requestedRate = Number(req.body?.ratePerSec ?? 2.5);
    const preferredMethod = req.body?.method === 'GET' ? 'GET' : 'HEAD';

    const count = Math.min(MAX_PROBES, Math.max(MIN_PROBES, Math.round(Number.isFinite(requestedCount) ? requestedCount : 12)));
    const ratePerSec = Math.min(4, Math.max(1, Number.isFinite(requestedRate) ? requestedRate : 2.5));
    const intervalMs = Math.round(1000 / ratePerSec);

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
