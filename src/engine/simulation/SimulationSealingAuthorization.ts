/**
 * SECP — Simulation Sealing Authorization
 * 
 * Enforces an internal authorization boundary for simulation sealing.
 * Only modules possessing a valid SealingCapability can request HMAC seals.
 */

import { randomBytes } from 'crypto';

/**
 * Opaque capability token that grants authority to seal bindings.
 * This is NOT a string or a simple secret; it is an object instance
 * that must be presented to the Authority.
 */
export interface SealingCapability {
  readonly capabilityId: string;
  readonly authorizedContext: string;
  readonly authorizedDomains: readonly string[];
  readonly cadRevisionHash?: string;
  readonly canonicalGeometryHash?: string;
  readonly issuedAt: number;
  readonly expiresAt?: number;
  isRevoked?: boolean;
  readonly maxUses?: number;
  usedCount: number;
}

class SealingCapabilityImpl implements SealingCapability {
  public readonly capabilityId: string;
  public readonly issuedAt: number;
  public isRevoked: boolean = false;
  public usedCount: number = 0;

  constructor(
    public readonly authorizedContext: string,
    public readonly authorizedDomains: readonly string[],
    public readonly cadRevisionHash?: string,
    public readonly canonicalGeometryHash?: string,
    public readonly expiresAt?: number,
    public readonly maxUses?: number
  ) {
    this.capabilityId = randomBytes(16).toString('hex');
    this.issuedAt = Date.now();
  }
}

/**
 * Registry of issued capabilities.
 */
const capabilityRegistry = new Map<string, SealingCapability>();

/**
 * Internal system-only function to issue capabilities.
 */
export function issueSealingCapability(
  context: string,
  domains: string[],
  options?: {
    cadRevisionHash?: string;
    canonicalGeometryHash?: string;
    ttlMs?: number;
    maxUses?: number;
  }
): SealingCapability {
  const expiresAt = options?.ttlMs ? Date.now() + options.ttlMs : undefined;
  const cap = new SealingCapabilityImpl(
    context,
    domains,
    options?.cadRevisionHash,
    options?.canonicalGeometryHash,
    expiresAt,
    options?.maxUses
  );
  capabilityRegistry.set(cap.capabilityId, cap);
  return cap;
}

/**
 * Revokes a specific capability by ID.
 */
export function revokeCapability(capabilityId: string): boolean {
  const cap = capabilityRegistry.get(capabilityId);
  if (cap) {
    (cap as any).isRevoked = true;
    return true;
  }
  return false;
}

/**
 * Validates a presented capability.
 */
export function validateCapability(
  capability: any,
  requiredDomain?: string,
  requiredRevisionHash?: string,
  requiredGeometryHash?: string
): SealingCapability {
  if (!capability || typeof capability !== 'object') {
    throw new Error('SIMULATION_AUTHORITY_VIOLATION: Invalid or missing SealingCapability.');
  }

  const registered = capabilityRegistry.get(capability.capabilityId);
  if (!registered || registered !== capability) {
    throw new Error('SIMULATION_AUTHORITY_VIOLATION: Unrecognized or forged SealingCapability.');
  }

  if (registered.isRevoked) {
    throw new Error('SIMULATION_AUTHORITY_VIOLATION: SealingCapability has been revoked.');
  }

  if (registered.expiresAt && Date.now() > registered.expiresAt) {
    throw new Error('SIMULATION_AUTHORITY_VIOLATION: SealingCapability has expired.');
  }

  if (requiredDomain && !registered.authorizedDomains.includes(requiredDomain)) {
    throw new Error(`SIMULATION_AUTHORITY_VIOLATION: Capability is not authorized for domain '${requiredDomain}'.`);
  }

  if (registered.cadRevisionHash && requiredRevisionHash && registered.cadRevisionHash !== requiredRevisionHash) {
    throw new Error(`SIMULATION_AUTHORITY_VIOLATION: Capability CAD revision mismatch. Expected '${registered.cadRevisionHash}', got '${requiredRevisionHash}'.`);
  }

  if (registered.canonicalGeometryHash && requiredGeometryHash && registered.canonicalGeometryHash !== requiredGeometryHash) {
    throw new Error(`SIMULATION_AUTHORITY_VIOLATION: Capability geometry hash mismatch. Expected '${registered.canonicalGeometryHash}', got '${requiredGeometryHash}'.`);
  }

  if (registered.maxUses !== undefined && registered.usedCount >= registered.maxUses) {
    throw new Error('SIMULATION_AUTHORITY_VIOLATION: SealingCapability usage limit exceeded (replay rejected).');
  }

  (registered as any).usedCount = (registered.usedCount || 0) + 1;

  return registered;
}

/**
 * Revokes all issued capabilities.
 */
export function revokeAllCapabilities(): void {
  capabilityRegistry.clear();
}

