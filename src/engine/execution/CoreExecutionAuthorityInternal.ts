/**
 * SECP — Core Execution Authority Internal
 * 
 * Internal sealing capability and verification symbols for generic execution envelopes.
 * NOT exported to public APIs or plugins.
 */

import { createHash } from 'crypto';
import { GenericExecutionEnvelope } from './CoreExecutionTypes';

// Private seal symbol inaccessible outside internal core execution boundary
const SEAL = Symbol('CORE_EXECUTION_AUTHORITY_SEAL');
let coreEngineKey: symbol | null = null;
const SECRET_SALT = 'CORE_SECRET_SALT_2026';

/**
 * Initializes or returns the one-time handshake for CoreExecutionAuthority.
 */
export function initializeCoreAuthorityHandshake(): symbol {
  if (!coreEngineKey) {
    coreEngineKey = Symbol('CORE_ENGINE_KEY');
  }
  return coreEngineKey;
}

/**
 * Seals a generic execution envelope using the authoritative core key.
 */
export function sealGenericEnvelope(envelope: any, key: symbol): GenericExecutionEnvelope {
  if (!coreEngineKey || key !== coreEngineKey) {
    throw new Error('CORE_AUTHORITY_VIOLATION: Unauthorized sealing attempt with invalid or missing key.');
  }
  envelope[SEAL] = true;

  // Compute a secure cryptographic signature that survives JSON serialization (IndexedDB/Firestore)
  const payloadStr = `${envelope.executionId}|${envelope.resultDigest}|${SECRET_SALT}`;
  envelope.coreSeal = createHash('sha256').update(payloadStr).digest('hex');

  return envelope as GenericExecutionEnvelope;
}

/**
 * Verifies if a generic envelope carries the authoritative core execution seal.
 */
export function verifyGenericEnvelopeSeal(envelope: any): boolean {
  if (!envelope) return false;
  if (envelope[SEAL] === true) return true;

  if (typeof envelope.coreSeal === 'string') {
    const payloadStr = `${envelope.executionId}|${envelope.resultDigest}|${SECRET_SALT}`;
    const expected = createHash('sha256').update(payloadStr).digest('hex');
    return envelope.coreSeal === expected;
  }

  return false;
}

/**
 * ADVERSARIAL FACTORY: Produces a sealed generic envelope using the active engine key.
 * Used exclusively in adversarial test suites to simulate a compromised authority
 * producing conflicting execution records for an existing identity.
 */
export function mintCompromisedGenericEnvelope(envelope: any): GenericExecutionEnvelope {
  if (!coreEngineKey) {
    throw new Error('CORE_AUTHORITY_VIOLATION: Authority must be booted first.');
  }
  envelope[SEAL] = true;

  const payloadStr = `${envelope.executionId}|${envelope.resultDigest}|${SECRET_SALT}`;
  envelope.coreSeal = createHash('sha256').update(payloadStr).digest('hex');

  return envelope as GenericExecutionEnvelope;
}
