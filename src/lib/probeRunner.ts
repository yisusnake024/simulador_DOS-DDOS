import dns from 'node:dns/promises';
import net from 'node:net';
import {
  isPrivateOrReservedIpv4,
  isPrivateOrReservedIpv6,
} from './urlValidation.ts';

export const REQUEST_TIMEOUT_MS = 8000;

export interface SingleProbeResult {
  ok: boolean;
  status: number | null;
  latencySec: number;
  latencyMs: number;
  methodUsed: 'HEAD' | 'GET';
  error?: string;
}

export async function resolveAndValidateHost(
  hostname: string
): Promise<{ ok: boolean; error?: string }> {
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
        return {
          ok: false,
          error: 'El dominio resuelve a una IP privada/interna bloqueada.',
        };
      }
      if (rec.family === 6 && isPrivateOrReservedIpv6(rec.address)) {
        return {
          ok: false,
          error: 'El dominio resuelve a una IPv6 privada/interna bloqueada.',
        };
      }
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: `No se pudo resolver el host "${hostname}" vía DNS.`,
    };
  }
}

export async function measureSingleRequest(
  targetUrl: string,
  method: 'HEAD' | 'GET'
): Promise<SingleProbeResult> {
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

export async function executeSingleProbeWithFallback(
  targetUrl: string,
  preferredMethod: 'HEAD' | 'GET'
): Promise<SingleProbeResult> {
  const sample = await measureSingleRequest(targetUrl, preferredMethod);
  if (
    preferredMethod === 'HEAD' &&
    (sample.status === 405 || sample.status === 501)
  ) {
    return measureSingleRequest(targetUrl, 'GET');
  }
  return sample;
}
