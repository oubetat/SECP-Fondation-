/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-162: Attestation Canonicalizer & Invariant Serializer
 */

import * as crypto from 'crypto';
import { AttestationCanonicalPayload, CryptographicAttestation } from './types';

export class AttestationCanonicalizer {
  /**
   * Deterministically normalizes any value:
   * - Key sorting on all objects
   * - Handling -0 and floating invariants
   * - Eliminating undefined and function properties
   * - Recursive array normalization
   */
  public static normalizeValue(val: unknown): any {
    if (val === null || val === undefined) {
      return null;
    }
    if (typeof val === 'number') {
      if (Object.is(val, -0)) return 0;
      if (!Number.isFinite(val)) {
        throw new Error(`[AttestationCanonicalizer] Non-finite number (${val}) cannot be canonicalized`);
      }
      return val;
    }
    if (typeof val === 'boolean' || typeof val === 'string') {
      return val;
    }
    if (Array.isArray(val)) {
      return val.map(item => this.normalizeValue(item));
    }
    if (typeof val === 'object') {
      const keys = Object.keys(val as Record<string, any>).sort();
      const result: Record<string, any> = {};
      for (const k of keys) {
        const item = (val as any)[k];
        if (typeof item !== 'function' && typeof item !== 'symbol' && item !== undefined) {
          result[k] = this.normalizeValue(item);
        }
      }
      return result;
    }
    return String(val);
  }

  /**
   * Serializes an arbitrary data structure to a deterministic JSON string.
   */
  public static canonicalize(data: unknown): string {
    const normalized = this.normalizeValue(data);
    return JSON.stringify(normalized);
  }

  /**
   * Computes SHA-256 hex digest of a UTF-8 string deterministically.
   */
  public static sha256(input: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.createHash === 'function') {
      return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
    }
    return this.pureSha256(input);
  }

  /**
   * Computes deterministic hash of any object via canonicalization.
   */
  public static hashObject(obj: unknown): string {
    const canonicalStr = this.canonicalize(obj);
    return this.sha256(canonicalStr);
  }

  /**
   * Fallback pure JS SHA-256 implementation if crypto module is unavailable.
   */
  private static pureSha256(str: string): string {
    function rightRotate(value: number, amount: number) {
      return (value >>> amount) | (value << (32 - amount));
    }

    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let i = 0, j = 0;
    let result = '';

    const words: number[] = [];
    const asciiBitLength = str.length * 8;

    const hash = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];

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

    for (let idx = 0; idx < str.length; idx++) {
      const code = str.charCodeAt(idx);
      words[idx >> 2] |= (code & 0xff) << (24 - (idx % 4) * 8);
    }

    words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
    words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

    const w = new Array(64);

    for (i = 0; i < words.length; i += 16) {
      let a = hash[0], b = hash[1], c = hash[2], d = hash[3];
      let e = hash[4], f = hash[5], g = hash[6], h = hash[7];

      for (j = 0; j < 64; j++) {
        if (j < 16) {
          w[j] = words[i + j] | 0;
        } else {
          const gamma0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
          const gamma1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
          w[j] = (w[j - 16] + gamma0 + w[j - 7] + gamma1) | 0;
        }

        const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + s1 + ch + k[j] + w[j]) | 0;
        const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (s0 + maj) | 0;

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

    for (i = 0; i < 8; i++) {
      for (j = 3; j >= 0; j--) {
        const byte = (hash[i] >> (j * 8)) & 255;
        result += (byte < 16 ? '0' : '') + byte.toString(16);
      }
    }

    return result;
  }

  /**
   * Constructs the structured 8-stage canonical payload representation:
   * Subject -> Inputs -> Execution -> Solver -> Output -> Verification -> Evidence -> Policy
   */
  public static buildCanonicalPayload(payload: AttestationCanonicalPayload): string {
    const orderedRepresentation = {
      // 1. Subject
      stage1_subject: {
        subjectId: payload.subject.subjectId,
        subjectType: payload.subject.subjectType,
        revision: payload.subject.revision,
        artifactHash: payload.subject.artifactHash,
      },
      // 2. Inputs
      stage2_inputs: {
        inputHash: payload.inputs.inputHash,
        solverInputs: this.normalizeValue(payload.inputs.solverInputs),
      },
      // 3. Execution
      stage3_execution: {
        executionId: payload.execution.executionId,
        engineeringIdentity: payload.execution.engineeringIdentity,
        timestamp: payload.execution.timestamp,
        environmentHash: payload.execution.environmentHash || 'ENV_STANDARD_000',
      },
      // 4. Solver
      stage4_solver: {
        solverIdentity: payload.solver.solverIdentity,
        solverVersion: payload.solver.solverVersion,
      },
      // 5. Output
      stage5_output: {
        outputHash: payload.output.outputHash,
      },
      // 6. Verification
      stage6_verification: {
        verificationHash: payload.verification.verificationHash,
        gateVerdict: payload.verification.gateVerdict,
      },
      // 7. Evidence
      stage7_evidence: {
        evidenceId: payload.evidence.evidenceId,
        evidenceHash: payload.evidence.evidenceHash,
      },
      // 8. Policy
      stage8_policy: {
        policyId: payload.policy.policyId,
        policyHash: payload.policy.policyHash,
      },
    };

    return this.canonicalize(orderedRepresentation);
  }

  /**
   * Computes the SHA-256 hash of the canonical payload.
   */
  public static hashCanonicalPayload(payload: AttestationCanonicalPayload): string {
    const canonicalStr = this.buildCanonicalPayload(payload);
    return this.sha256(canonicalStr);
  }

  /**
   * Generates a stable deterministic Attestation ID.
   */
  public static generateAttestationId(subjectId: string, executionId: string, payloadHash: string): string {
    const seed = `ATTEST::${subjectId}::${executionId}::${payloadHash}`;
    const digest = this.sha256(seed);
    return `ATT-${digest.substring(0, 16).toUpperCase()}`;
  }
}
