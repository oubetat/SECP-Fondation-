/**
 * SECP Industrial OS — Certificate Canonicalizer & Deterministic Hasher
 */

import * as crypto from 'crypto';

export class CertificateCanonicalizer {
  /**
   * Deterministically normalizes any JavaScript object or primitive.
   */
  public static normalize(val: any): any {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') {
      if (Object.is(val, -0)) return 0;
      if (!Number.isFinite(val)) {
        throw new Error(`[CertificateCanonicalizer] Non-finite number (${val}) rejected`);
      }
      return Number(val.toFixed(8));
    }
    if (typeof val === 'string') {
      return val.normalize('NFC').trim();
    }
    if (typeof val === 'boolean') {
      return val;
    }
    if (Array.isArray(val)) {
      return val.map(item => this.normalize(item));
    }
    if (typeof val === 'object') {
      const sortedKeys = Object.keys(val).sort();
      const obj: Record<string, any> = {};
      for (const k of sortedKeys) {
        // Exclude signature and calculated certificate hash from canonical preimage
        if (k === 'certificateHash' || k === 'certificateSignature') continue;
        const v = val[k];
        if (typeof v !== 'function' && typeof v !== 'symbol' && v !== undefined) {
          obj[k] = this.normalize(v);
        }
      }
      return obj;
    }
    return String(val);
  }

  /**
   * Computes the deterministic SHA-256 hash of a certificate.
   */
  public static computeHash(cert: any): string {
    const normalized = this.normalize(cert);
    const jsonString = JSON.stringify(normalized);
    return crypto.createHash('sha256').update(jsonString, 'utf8').digest('hex');
  }
}
