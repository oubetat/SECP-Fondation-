/**
 * SECP — Simulation Authority Internal
 * 
 * This file contains internal tokens and interfaces for the simulation authority boundary.
 * This is NOT a public API.
 */

import { SimulationResult } from './SimulationEngine';

// Private seal symbol not exported to prevent arbitrary sealing
const SEAL = Symbol('SIMULATION_AUTHORITY_SEAL');
let engineKey: symbol | null = null;

/**
 * Initializes the one-time handshake for SimulationEngine authority.
 * Must be called during system boot.
 */
export function initializeAuthorityHandshake(): symbol {
  if (engineKey) {
    throw new Error('SIMULATION_AUTHORITY_VIOLATION: Handshake already initialized.');
  }
  engineKey = Symbol('ENGINE_KEY');
  return engineKey;
}

/**
 * Seals an execution envelope using the authoritative engine key.
 */
export function sealEnvelope(envelope: any, key: symbol): any {
  if (!engineKey || key !== engineKey) {
    throw new Error('SIMULATION_AUTHORITY_VIOLATION: Unauthorized sealing attempt with invalid or missing key.');
  }
  envelope[SEAL] = true;
  return envelope;
}

/**
 * Verifies if an envelope carries the authoritative simulation seal.
 */
export function verifyEnvelopeSeal(envelope: any): boolean {
  return envelope && envelope[SEAL] === true;
}

/**
 * ADVERSARIAL FACTORY: Produces a sealed envelope using the active engine key.
 * Used exclusively in adversarial test suites to simulate a compromised authority
 * producing conflicting execution records for an existing identity.
 * 
 * SECURITY: Requires the system to be booted (handshake performed). 
 * Does not expose the engine key or the private seal symbol to the caller.
 */
export function mintCompromisedEnvelope(envelope: any): any {
  if (!engineKey) {
    throw new Error('SIMULATION_AUTHORITY_VIOLATION: Authority must be booted first.');
  }
  envelope[SEAL] = true;
  return envelope;
}

export interface SimulationExecutionEnvelope {
  readonly provenanceHash: string;
  readonly result: SimulationResult;
  readonly authoritativeRevisionHash: string;
  readonly authoritativeGeometryHash: string;
  readonly timestamp: string;
}
