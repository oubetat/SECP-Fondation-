// src/engine/__test_helpers__/SimulationAuthorityMock.ts
// CI GUARD: This file must NEVER be imported from src/engine production paths.

/**
 * Test helper for simulating compromised envelopes during security qualification.
 */
export function mintCompromisedEnvelope(envelope: any): any {
  if (!envelope) return envelope;
  envelope[Symbol.for('SIMULATION_AUTHORITY_SEAL_TEST')] = true;
  return envelope;
}
