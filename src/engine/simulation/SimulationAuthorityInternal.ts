import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { 
  SealingCapability, 
  validateCapability, 
  revokeAllCapabilities 
} from './SimulationSealingAuthorization';

export type AuthorityInitializationState = 'UNINITIALIZED' | 'INITIALIZED' | 'INITIALIZATION_FAILED';

const SEAL_SYMBOL = Symbol('SIMULATION_AUTHORITY_SEAL');

let initializationState: AuthorityInitializationState = 'UNINITIALIZED';
let activeKeyVersion: string | null = null;
let authoritySecretHMAC: Buffer | null = null;
let initLock = false;

/**
 * Initializes the one-time canonical authority handshake for system boot.
 * Ensures atomicity and fail-closed state on failure.
 */
export function initializeAuthorityHandshake(config?: { forceSecret?: string; simulateFailure?: boolean }): string {
  if (initLock) {
    throw new Error('SIMULATION_AUTHORITY_CONCURRENT_INIT_BLOCKED: Concurrent initialization prohibited.');
  }

  if (config?.simulateFailure) {
    initializationState = 'INITIALIZATION_FAILED';
    activeKeyVersion = null;
    authoritySecretHMAC = null;
    throw new Error('SIMULATION_AUTHORITY_INITIALIZATION_FAILED: Authority boot failed due to invalid boot configuration.');
  }

  if (initializationState === 'INITIALIZED' && activeKeyVersion && authoritySecretHMAC) {
    return activeKeyVersion;
  }

  try {
    initLock = true;
    
    // Fail-closed check: if previously failed, do not allow "soft" re-init without explicit reset
    if (initializationState === 'INITIALIZATION_FAILED') {
      throw new Error('SIMULATION_AUTHORITY_INITIALIZATION_FAILED: System authority is in a terminal failed state. Manual reset required.');
    }

    const version = process.env.SECP_AUTHORITY_KEY_VERSION || `SECP-AUTH-KEY-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    let secretBuffer: Buffer;

    if (config?.forceSecret) {
      secretBuffer = Buffer.from(config.forceSecret, 'utf8');
    } else if (process.env.SECP_AUTHORITY_SECRET) {
      secretBuffer = Buffer.from(process.env.SECP_AUTHORITY_SECRET, 'utf8');
    } else {
      secretBuffer = randomBytes(32);
    }

    activeKeyVersion = version;
    authoritySecretHMAC = secretBuffer;
    initializationState = 'INITIALIZED';
    return version;
  } catch (err) {
    initializationState = 'INITIALIZATION_FAILED';
    throw err;
  } finally {
    initLock = false;
  }
}

/**
 * Revokes current authority key state and all issued capabilities.
 */
export function revokeAuthorityState(): void {
  initializationState = 'UNINITIALIZED';
  activeKeyVersion = null;
  authoritySecretHMAC = null;
  initLock = false;
  revokeAllCapabilities();
}

/**
 * Returns current authority initialization state.
 */
export function getAuthorityInitializationState(): AuthorityInitializationState {
  return initializationState;
}

/**
 * Returns active key version if initialized.
 */
export function getActiveKeyVersion(): string | null {
  return activeKeyVersion;
}

/**
 * Computes an unforgeable cryptographic HMAC seal signature over domain binding metadata.
 * REQUIRES:
 * 1. Authority initialization (fails closed).
 * 2. Valid SealingCapability presented by caller.
 */
export function computeHMACSealToken(
  capability: SealingCapability,
  domain: string,
  canonicalEntityId: string,
  revisionId: string | number,
  geometryHash: string,
  keyVersion?: string
): { sealToken: string; keyVersion: string } {
  if (initializationState === 'INITIALIZATION_FAILED') {
    throw new Error('SIMULATION_AUTHORITY_INITIALIZATION_FAILED: System authority is in a failed initialization state.');
  }
  if (initializationState !== 'INITIALIZED' || !authoritySecretHMAC || !activeKeyVersion) {
    throw new Error('SIMULATION_AUTHORITY_NOT_INITIALIZED: Cannot compute seal before secure authority handshake completion.');
  }

  // Mandatory capability validation
  const validatedCap = validateCapability(capability, domain, String(revisionId), geometryHash);

  const targetKeyVersion = keyVersion || activeKeyVersion;
  const executionContext = validatedCap.authorizedContext;
  
  const payload = `SEAL:${targetKeyVersion}:${domain}:${canonicalEntityId}:${revisionId}:${geometryHash}:${executionContext}`;
  const sealToken = createHmac('sha256', authoritySecretHMAC).update(payload, 'utf8').digest('hex');

  return { sealToken, keyVersion: targetKeyVersion };
}

/**
 * Verifies HMAC seal token using constant-time tag comparison.
 */
export function verifyHMACSealToken(
  sealToken: string,
  domain: string,
  canonicalEntityId: string,
  revisionId: string | number,
  geometryHash: string,
  executionContext = 'CORE_EXECUTION',
  keyVersion?: string
): boolean {
  if (initializationState !== 'INITIALIZED' || !authoritySecretHMAC || !activeKeyVersion) {
    return false;
  }

  const targetKeyVersion = keyVersion || activeKeyVersion;
  if (targetKeyVersion !== activeKeyVersion) {
    return false;
  }

  try {
    // Note: This internal verification does NOT require a capability because it's for validation, not issuance.
    const payload = `SEAL:${targetKeyVersion}:${domain}:${canonicalEntityId}:${revisionId}:${geometryHash}:${executionContext}`;
    const expected = createHmac('sha256', authoritySecretHMAC).update(payload, 'utf8').digest('hex');

    const a = Buffer.from(sealToken, 'utf8');
    const b = Buffer.from(expected, 'utf8');

    if (a.length !== b.length) {
      return false;
    }

    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Seals an execution envelope inside the SimulationAuthority boundary.
 * REQUIRES valid SealingCapability.
 */
export function sealEnvelope(
  envelope: any, 
  capability: SealingCapability
): any {
  if (initializationState === 'INITIALIZATION_FAILED') {
    throw new Error('SIMULATION_AUTHORITY_INITIALIZATION_FAILED: Authority boot failed.');
  }
  if (initializationState !== 'INITIALIZED') {
    throw new Error('SIMULATION_AUTHORITY_NOT_INITIALIZED: Cannot seal execution envelope before authority initialization.');
  }

  // Validate capability for core execution context
  validateCapability(capability, 'SIMULATION', envelope?.authoritativeRevisionHash, envelope?.authoritativeGeometryHash);

  envelope[SEAL_SYMBOL] = true;
  return envelope;
}

/**
 * Verifies if an envelope carries the authoritative simulation seal.
 */
export function verifyEnvelopeSeal(envelope: any): boolean {
  return envelope && envelope[SEAL_SYMBOL] === true;
}

export interface SimulationExecutionEnvelope {
  readonly provenanceHash: string;
  readonly result: any;
  readonly authoritativeRevisionHash: string;
  readonly authoritativeGeometryHash: string;
  readonly timestamp: string;
}

