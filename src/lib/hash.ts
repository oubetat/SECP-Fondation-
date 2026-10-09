import { pureSha256 } from '../polyfills/crypto';

export function computeSHA256(data: string): string {
  return pureSha256(data);
}

export function generateEvidenceHash(payload: unknown): string {
  return computeSHA256(typeof payload === 'string' ? payload : JSON.stringify(payload));
}

export function generateDeterministicHashSync(payload: unknown): string {
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return pureSha256(str);
}

export async function generateDeterministicHash(payload: unknown): Promise<string> {
  return generateDeterministicHashSync(payload);
}

