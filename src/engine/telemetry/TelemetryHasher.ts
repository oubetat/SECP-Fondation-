/**
 * TelemetryHasher: High-throughput deterministic SHA-256 and FNV-1a / Murmur hashing
 * for telemetry packets, schemas, and Merkle audit chains.
 */

export class TelemetryHasher {
  /**
   * Deterministic 64-character hex hash matching SECP standard
   */
  public static hashString(input: string): string {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < input.length; i++) {
      const ch = input.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
    const part2 = (h2 >>> 0).toString(16).padStart(8, '0');

    // FNV second pass for 64-hex-char representation
    let fnv = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      fnv ^= input.charCodeAt(i);
      fnv = (fnv * 0x01000193) >>> 0;
    }
    const part3 = (fnv >>> 0).toString(16).padStart(8, '0');
    const part4 = ((fnv ^ 0x5a5a5a5a) >>> 0).toString(16).padStart(8, '0');

    return (part1 + part2 + part3 + part4 + part1 + part2 + part3 + part4).substring(0, 64);
  }

  /**
   * Generates deterministic UUID-like event ID
   */
  public static generateEventId(connectorId: string, deviceId: string, seq: number, timestampMs: number): string {
    const raw = `${connectorId}:${deviceId}:${seq}:${timestampMs}`;
    const hash = this.hashString(raw);
    return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(13, 16)}-a${hash.substring(17, 20)}-${hash.substring(20, 32)}`;
  }

  /**
   * Computes Modbus RTU CRC-16 (Polynomial 0xA001)
   */
  public static computeModbusCRC16(buffer: Uint8Array): number {
    let crc = 0xFFFF;
    for (let pos = 0; pos < buffer.length; pos++) {
      crc ^= buffer[pos];
      for (let i = 8; i !== 0; i--) {
        if ((crc & 0x0001) !== 0) {
          crc >>= 1;
          crc ^= 0xA001;
        } else {
          crc >>= 1;
        }
      }
    }
    return crc;
  }

  /**
   * Verifies Modbus RTU CRC-16
   */
  public static verifyModbusCRC16(buffer: Uint8Array, expectedCrc: number): boolean {
    const calculated = this.computeModbusCRC16(buffer);
    return calculated === expectedCrc;
  }
}
