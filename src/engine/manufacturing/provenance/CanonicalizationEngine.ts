/**
 * SECP Industrial OS v2 — Canonicalization & Hash Engine
 * Deterministic JSON Canonicalization & Cryptographic Hashing
 */

import crypto from "crypto";

export class CanonicalizationEngine {
  /**
   * Recursively canonicalize an object/value into a deterministic representation:
   * - Object keys sorted lexicographically
   * - Numbers formatted to fixed precision (e.g. 6 decimal places for floats)
   * - Arrays maintained in order or sorted if marked set
   * - Undefined/null normalized
   */
  public static canonicalize(data: any): string {
    if (data === null || data === undefined) {
      return "null";
    }

    if (typeof data === "boolean") {
      return data ? "true" : "false";
    }

    if (typeof data === "number") {
      if (isNaN(data) || !isFinite(data)) {
        return "null";
      }
      // If integer, format as string. If float, round to 6 decimals to eliminate IEEE-754 drift
      if (Number.isInteger(data)) {
        return data.toString();
      }
      return data.toFixed(6);
    }

    if (typeof data === "string") {
      return JSON.stringify(data);
    }

    if (Array.isArray(data)) {
      const items = data.map(item => CanonicalizationEngine.canonicalize(item));
      return `[${items.join(",")}]`;
    }

    if (typeof data === "object") {
      const keys = Object.keys(data).sort();
      const pairs = keys
        .filter(k => data[k] !== undefined)
        .map(k => `${JSON.stringify(k)}:${CanonicalizationEngine.canonicalize(data[k])}`);
      return `{${pairs.join(",")}}`;
    }

    return JSON.stringify(String(data));
  }

  /**
   * Computes SHA-256 hash of canonicalized data
   */
  public static computeHash(data: any): string {
    const canonicalStr = CanonicalizationEngine.canonicalize(data);
    return crypto.createHash("sha256").update(canonicalStr, "utf8").digest("hex");
  }

  /**
   * Computes SHA-256 hash of raw string/buffer
   */
  public static computeRawHash(raw: string): string {
    return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
  }
}
