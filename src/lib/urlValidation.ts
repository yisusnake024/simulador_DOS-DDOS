/**
 * URL validation and SSRF protection helpers for baseline HTTP probing.
 */

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  hostname?: string;
  error?: string;
}

/**
 * Checks whether an IPv4 address belongs to private, loopback, or link-local ranges.
 */
export function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  return false;
}

/**
 * Checks whether an IPv6 address is loopback, unspecified, or unique-local/link-local.
 */
export function isPrivateOrReservedIpv6(ip: string): boolean {
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

/**
 * Validates and normalizes an external HTTP/HTTPS URL for benign baseline probing.
 */
export function validateTargetUrl(rawInput: string): UrlValidationResult {
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
