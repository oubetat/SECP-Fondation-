/**
 * Browser-safe Buffer Polyfill
 */

// @ts-ignore
export class Buffer extends Uint8Array {
  // @ts-ignore: Static from is incompatible with Uint8Array.from but required for Node compatibility
  public static from(data: any, encoding?: string): Buffer {
    if (typeof data === 'string') {
      if (encoding === 'hex') {
        const match = data.match(/.{1,2}/g) || [];
        const bytes = new Uint8Array(match.map(byte => parseInt(byte, 16)));
        return new Buffer(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength);
      }
      if (encoding === 'base64') {
        const binary = atob(data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return new Buffer(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength);
      }
      const encoder = new TextEncoder();
      const bytes = encoder.encode(data);
      return new Buffer(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength);
    }
    if (ArrayBuffer.isView(data)) {
      return new Buffer(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength);
    }
    if (data instanceof ArrayBuffer) {
      return new Buffer(data);
    }
    if (Array.isArray(data)) {
      return new Buffer(new Uint8Array(data).buffer as ArrayBuffer);
    }
    return new Buffer(0);
  }

  public static alloc(size: number, fill: number = 0): Buffer {
    const buf = new Uint8Array(size);
    if (fill !== 0) buf.fill(fill);
    return new Buffer(buf.buffer);
  }

  public static isBuffer(obj: any): boolean {
    return obj instanceof Buffer || obj instanceof Uint8Array;
  }

  public static concat(list: Uint8Array[], totalLength?: number): Buffer {
    if (list.length === 0) return new Buffer(0);
    if (totalLength === undefined) {
      totalLength = list.reduce((acc, curr) => acc + curr.length, 0);
    }
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const item of list) {
      result.set(item, offset);
      offset += item.length;
      if (offset >= totalLength) break;
    }
    return new Buffer(result.buffer);
  }

  public toString(encoding: string = 'utf8'): string {
    if (encoding === 'hex') {
      return Array.from(this)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
    if (encoding === 'base64') {
      let binary = '';
      const len = this.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(this[i]);
      }
      return btoa(binary);
    }
    const decoder = new TextDecoder();
    return decoder.decode(this);
  }
}

if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).global = window;
  if (!(window as any).process) {
    (window as any).process = { env: { NODE_ENV: 'development' }, cwd: () => '/' };
  }
}

if (typeof globalThis !== 'undefined' && typeof (globalThis as any).Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer;
  if (!(globalThis as any).process) {
    (globalThis as any).process = { env: { NODE_ENV: 'development' }, cwd: () => '/' };
  }
}

export default { Buffer };
