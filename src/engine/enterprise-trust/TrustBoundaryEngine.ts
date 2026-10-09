/**
 * PATCH-SECP-070: Trust Boundary Engine
 * Defines and enforces the perimeter between SECP Core and external entities.
 */

export type BoundaryZone = 'TRUSTED_INTERNAL' | 'CONTROLLED_EXTERNAL' | 'UNTRUSTED_EXTERNAL' | 'QUARANTINED';

export class TrustBoundaryEngine {
  public static getZone(source: string): BoundaryZone {
    if (source.startsWith('SECP_CORE')) return 'TRUSTED_INTERNAL';
    if (source.startsWith('PARTNER_')) return 'CONTROLLED_EXTERNAL';
    if (source.startsWith('QUARANTINE_')) return 'QUARANTINED';
    return 'UNTRUSTED_EXTERNAL';
  }
}
