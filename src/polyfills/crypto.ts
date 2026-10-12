/**
 * Browser-safe Crypto Polyfill for SECP Industrial OS
 * Provides pure deterministic SHA-256, random bytes, UUIDs, and sign/verify shims.
 */

import { Buffer } from './buffer';

// Standard SHA-256 implementation in pure JS/TS
function sha256(ascii: string | Uint8Array): Uint8Array {
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = 'length';
  let i = 0;
  let j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  // Initial hash value: first 32 bits of fractional parts of square roots of first 8 primes
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  // First 32 bits of fractional parts of cube roots of first 64 primes
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let bytes: Uint8Array;
  if (typeof ascii === 'string') {
    const encoder = new TextEncoder();
    bytes = encoder.encode(ascii);
  } else {
    bytes = ascii;
  }

  for (i = 0; i < bytes.length; i++) {
    const wordIndex = i >> 2;
    words[wordIndex] = (words[wordIndex] || 0) | (bytes[i] << ((3 - (i % 4)) * 8));
  }

  words[bytes.length >> 2] = (words[bytes.length >> 2] || 0) | (0x80 << ((3 - (bytes.length % 4)) * 8));
  words[(((bytes.length + 8) >> 6) << 4) + 15] = asciiBitLength;

  for (i = 0; i < words.length; i += 16) {
    const w = words.slice(i, i + 16);
    let a = hash[0], b = hash[1], c = hash[2], d = hash[3];
    let e = hash[4], f = hash[5], g = hash[6], h = hash[7];

    for (j = 0; j < 64; j++) {
      if (j >= 16) {
        const gamma0 = ((w[j - 15] >>> 7) | (w[j - 15] << 25)) ^ ((w[j - 15] >>> 18) | (w[j - 15] << 14)) ^ (w[j - 15] >>> 3);
        const gamma1 = ((w[j - 2] >>> 17) | (w[j - 2] << 15)) ^ ((w[j - 2] >>> 19) | (w[j - 2] << 13)) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + gamma0 + w[j - 7] + gamma1) | 0;
      }

      const ch = (e & f) ^ (~e & g);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const sigma0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const sigma1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const temp1 = (h + sigma1 + ch + k[j] + (w[j] || 0)) | 0;
      const temp2 = (sigma0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  const out = new Uint8Array(32);
  for (let idx = 0; idx < 8; idx++) {
    const val = hash[idx];
    out[idx * 4] = (val >>> 24) & 0xff;
    out[idx * 4 + 1] = (val >>> 16) & 0xff;
    out[idx * 4 + 2] = (val >>> 8) & 0xff;
    out[idx * 4 + 3] = val & 0xff;
  }
  return out;
}

export class Hash {
  private chunks: Uint8Array[] = [];

  constructor(public algorithm: string = 'sha256') {}

  public update(data: any, encoding?: string): Hash {
    if (typeof data === 'string') {
      const encoder = new TextEncoder();
      this.chunks.push(encoder.encode(data));
    } else if (data instanceof Uint8Array) {
      this.chunks.push(data);
    } else if (data && typeof data === 'object') {
      const encoder = new TextEncoder();
      this.chunks.push(encoder.encode(JSON.stringify(data)));
    }
    return this;
  }

  public digest(encoding: 'hex' | 'binary' | 'base64' | string = 'hex'): any {
    const totalLen = this.chunks.reduce((acc, c) => acc + c.length, 0);
    const combined = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of this.chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    const hashed = sha256(combined);

    if (encoding === 'hex') {
      return Array.from(hashed)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
    if (encoding === 'base64') {
      let binary = '';
      for (let i = 0; i < hashed.length; i++) {
        binary += String.fromCharCode(hashed[i]);
      }
      return btoa(binary);
    }
    return Buffer.from(hashed);
  }
}

export function pureSha256(data: string | Uint8Array): string {
  const hashed = sha256(data);
  return Array.from(hashed).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function createHash(algorithm: string = 'sha256'): Hash {
  return new Hash(algorithm);
}

export function randomBytes(size: number): Buffer {
  const arr = new Uint8Array(size);
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < size; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  return Buffer.from(arr);
}

export function randomUUID(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createSign(algorithm: string): any {
  return {
    update: () => {},
    sign: () => Buffer.from('SECP_SIGNATURE_PROOF_' + randomBytes(16).toString('hex'))
  };
}

export function createVerify(algorithm: string): any {
  return {
    update: () => {},
    verify: () => true
  };
}

export function generateKeyPairSync(type: string, options: any): any {
  return {
    publicKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0=\n-----END PUBLIC KEY-----',
    privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoI=\n-----END PRIVATE KEY-----'
  };
}

const cryptoPolyfill = {
  createHash,
  randomBytes,
  randomUUID,
  createSign,
  createVerify,
  generateKeyPairSync,
  Buffer
};

export default cryptoPolyfill;
