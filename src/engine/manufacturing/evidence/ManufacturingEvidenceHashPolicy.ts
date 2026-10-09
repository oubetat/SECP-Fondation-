/**
 * SECP Industrial OS v2 — Manufacturing Evidence Hash Policy
 */

import { createHash } from "crypto";

export class ManufacturingEvidenceHashPolicy {
  public static readonly ALGORITHM = "sha256";
  public static readonly CANONICALIZATION_VERSION = "1.0.0";
  public static readonly ENCODING: BufferEncoding = "hex";
  public static readonly FIELD_ORDERING = ["contract", "sourceIdentity", "eventIdentity", "payload", "context"];

  /**
   * Normalize and round floating point numbers to 6 decimal places to remove float precision drift.
   */
  public static normalizeValue(val: any): any {
    if (val === null || val === undefined) {
      return null;
    }
    if (typeof val === "number") {
      if (Number.isInteger(val)) return val;
      return Math.round(val * 1e6) / 1e6;
    }
    if (typeof val === "string") {
      return val.trim();
    }
    if (Array.isArray(val)) {
      return val.map((item) => this.normalizeValue(item));
    }
    if (typeof val === "object") {
      const sortedKeys = Object.keys(val).sort();
      const normalizedObj: Record<string, any> = {};
      for (const k of sortedKeys) {
        normalizedObj[k] = this.normalizeValue(val[k]);
      }
      return normalizedObj;
    }
    return val;
  }

  /**
   * Deterministically serialize an object to JSON string with lexicographically sorted keys.
   */
  public static canonicalizeJson(data: any): string {
    const normalized = this.normalizeValue(data);
    return JSON.stringify(normalized);
  }

  /**
   * Compute SHA-256 hash of a string or canonicalized data structure.
   */
  public static computeHash(data: any): string {
    const canonicalStr = typeof data === "string" ? data : this.canonicalizeJson(data);
    return createHash(this.ALGORITHM).update(canonicalStr, "utf8").digest(this.ENCODING as import("crypto").BinaryToTextEncoding);
  }

  /**
   * Compute chain hash from previous evidence hash and current evidence canonical hash.
   */
  public static computeChainHash(previousHash: string, currentCanonicalHash: string, sequence: number): string {
    const input = `${previousHash}:${currentCanonicalHash}:${sequence}`;
    return createHash(this.ALGORITHM).update(input, "utf8").digest(this.ENCODING as import("crypto").BinaryToTextEncoding);
  }
}
