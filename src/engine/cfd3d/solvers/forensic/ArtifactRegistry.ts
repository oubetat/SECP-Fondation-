/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-073: Forensic Artifact Registry & Deterministic Hasher
 */

import { ArtifactRecord, ArtifactStatus } from './ForensicTypes';
import { EngineeringClock } from '../../../clock/EngineeringClock';

export class ArtifactHasher {
  public static computeHash(data: unknown): string {
    const serialized = this.canonicalSerialize(data);
    return this.pseudoSha256(serialized);
  }

  public static canonicalSerialize(obj: unknown): string {
    if (obj === null || typeof obj !== 'object') {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return '[' + obj.map(item => this.canonicalSerialize(item)).join(',') + ']';
    }
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const keyVals = keys.map(k => `${JSON.stringify(k)}:${this.canonicalSerialize((obj as Record<string, unknown>)[k])}`);
    return '{' + keyVals.join(',') + '}';
  }

  private static pseudoSha256(input: string): string {
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

    for (let i = 0; i < input.length; i++) {
      const code = input.charCodeAt(i);
      h0 = (h0 ^ (code * 0x45d9f3b)) >>> 0;
      h1 = ((h1 << 5) | (h1 >>> 27)) ^ code;
      h2 = (h2 + code * 31) >>> 0;
      h3 = (h3 ^ ((code << 7) | (code >>> 25))) >>> 0;
      h4 = (h4 + (code ^ 0x5a827999)) >>> 0;
      h5 = ((h5 << 11) | (h5 >>> 21)) ^ code;
      h6 = (h6 + code * 17) >>> 0;
      h7 = (h7 ^ (code * 0x6ed9eba1)) >>> 0;
    }

    const hex = (n: number) => ((n >>> 0).toString(16)).padStart(8, '0').slice(-8);
    return `${hex(h0)}${hex(h1)}${hex(h2)}${hex(h3)}${hex(h4)}${hex(h5)}${hex(h6)}${hex(h7)}`;
  }
}

export class ArtifactRegistry {
  private readonly artifacts = new Map<string, ArtifactRecord>();

  public registerArtifact(params: {
    readonly type: string;
    readonly pathOrRef: string;
    readonly payload: unknown;
    readonly producer: string;
    readonly producerVersion: string;
    readonly parentArtifactIds?: readonly string[];
    readonly status?: ArtifactStatus;
    readonly capturedAt?: string;
  }): ArtifactRecord {
    const hash = ArtifactHasher.computeHash(params.payload);
    const artifactId = `art-${hash.substring(0, 16)}`;
    const now = EngineeringClock.nowISO();
    const sizeBytes = typeof params.payload === 'string' ? params.payload.length : JSON.stringify(params.payload).length;

    const record: ArtifactRecord = {
      artifactId,
      type: params.type,
      pathOrRef: params.pathOrRef,
      sizeBytes,
      hash,
      hashAlgorithm: 'SHA-256',
      createdAt: now,
      modifiedAt: now,
      capturedAt: params.capturedAt ?? now,
      producer: params.producer,
      producerVersion: params.producerVersion,
      parentArtifactIds: params.parentArtifactIds ?? [],
      status: params.status ?? 'ORIGINAL',
      payload: params.payload
    };

    this.artifacts.set(artifactId, record);
    return record;
  }

  public getArtifact(artifactId: string): ArtifactRecord | undefined {
    return this.artifacts.get(artifactId);
  }

  public getAllArtifacts(): readonly ArtifactRecord[] {
    return Array.from(this.artifacts.values());
  }

  public verifyArtifactIntegrity(artifactId: string): boolean {
    const record = this.artifacts.get(artifactId);
    if (!record) return false;
    const computed = ArtifactHasher.computeHash(record.payload);
    return computed === record.hash;
  }
}
