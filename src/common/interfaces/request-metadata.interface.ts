import type { Request } from 'express';

export interface RequestMetadata {
  ip: string | null;
  userAgent: string | null;
}

export function requestMetadata(request: Request): RequestMetadata {
  const address = request.ip ?? request.socket.remoteAddress ?? null;
  const normalizedAddress = address?.startsWith('::ffff:')
    ? address.slice(7)
    : address;
  return {
    ip: normalizedAddress?.slice(0, 45) ?? 'DESCONOCIDA',
    userAgent: request.get('user-agent') ?? 'DESCONOCIDO',
  };
}
