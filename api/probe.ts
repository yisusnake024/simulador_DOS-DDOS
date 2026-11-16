import dns from 'node:dns/promises';
import net from 'node:net';

const REQUEST_TIMEOUT_MS = 8000;

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateOrReservedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === '::1' || normalized === '::' || normalized === '0:0:0:0:0:0:0:1') {
    return true;
  }
  if (normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }
  if (normalized.startsWith('::ffff:')) {
    const mappedV4 = normalized.slice('::ffff:'.length);
    return isPrivateOrReservedIpv4(mappedV4);
  }
  return false;
}

function validateTargetUrl(rawInput: string): {
  valid: boolean;
  normalizedUrl?: string;
  hostname?: string;
  error?: string;
} {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { valid: false, error: 'Ingresa una URL válida (por ejemplo, https://example.com).' };
  }

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
  const withScheme = hasScheme ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return { valid: false, error: 'El formato de la URL no es válido.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Solo se permiten protocolos HTTP o HTTPS.' };
  }

  if (parsed.username || parsed.password) {
    return { valid: false, error: 'No se permiten credenciales incrustadas en la URL.' };
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return { valid: false, error: 'No se permite sondear direcciones locales o internas.' };
  }

  if (isPrivateOrReservedIpv4(host) || isPrivateOrReservedIpv6(host)) {
    return { valid: false, error: 'No se permite sondear IPs privadas o reservadas.' };
  }

  return {
    valid: true,
    normalizedUrl: parsed.toString(),
    hostname: host,
  };
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

async function measureSingleRequest(targetUrl: string, method: 'HEAD' | 'GET') {
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

export async function POST(request: Request): Promise<Response> {
  let body: { url?: unknown; method?: unknown } = {};
  try {
    body = (await request.json()) as { url?: unknown; method?: unknown };
  } catch {
    return Response.json(
      { error: 'Cuerpo JSON inválido en la solicitud.' },
      { status: 400 }
    );
  }

  const rawUrl = typeof body?.url === 'string' ? body.url : '';
  const preferredMethod: 'HEAD' | 'GET' = body?.method === 'GET' ? 'GET' : 'HEAD';

  const validation = validateTargetUrl(rawUrl);
  if (!validation.valid || !validation.normalizedUrl || !validation.hostname) {
    return Response.json(
      { error: validation.error || 'URL inválida.' },
      { status: 400 }
    );
  }

  const dnsCheck = await resolveAndValidateHost(validation.hostname);
  if (!dnsCheck.ok) {
    return Response.json(
      { error: dnsCheck.error || 'Host no permitido o no resuelto.' },
      { status: 400 }
    );
  }

  let sample = await measureSingleRequest(validation.normalizedUrl, preferredMethod);
  if (preferredMethod === 'HEAD' && (sample.status === 405 || sample.status === 501)) {
    sample = await measureSingleRequest(validation.normalizedUrl, 'GET');
  }

  return Response.json(
    {
      normalizedUrl: validation.normalizedUrl,
      hostname: validation.hostname,
      ...sample,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

export async function GET(): Promise<Response> {
  return Response.json(
    { error: 'Usa POST /api/probe con { url, method } para ejecutar un sondeo.' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}
