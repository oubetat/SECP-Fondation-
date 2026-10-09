/**
 * PATCH-SECP-070: Trust Revocation Engine
 * Manages the invalidation of trust certificates and identities.
 */

import { TrustStatus } from './EnterpriseTrustTypes';

export class TrustRevocationEngine {
  private static revokedIds: Set<string> = new Set();

  public static revoke(id: string): void {
    this.revokedIds.add(id);
  }

  public static getStatus(id: string, currentStatus: TrustStatus): TrustStatus {
    return this.revokedIds.has(id) ? 'REVOKED' : currentStatus;
  }
}
