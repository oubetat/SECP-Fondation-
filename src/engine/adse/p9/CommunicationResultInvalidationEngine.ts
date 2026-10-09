/**
 * SECP — ADSE-P9 Communication Result Invalidation Engine
 * 
 * Manages result invalidation triggers when canonical revisions, nodes, links,
 * data flows, protocols, or upstream dependencies (P3/P5/P6/P7/P8) mutate.
 */

import { CommunicationRegistry } from './CommunicationRegistry';

export class CommunicationResultInvalidationEngine {
  private registry: CommunicationRegistry;

  constructor(registry: CommunicationRegistry) {
    this.registry = registry;
  }

  /**
   * Invalidates all executions and results for a given Communication System
   */
  public invalidateSystemResults(communicationSystemId: string, reason: string): number {
    return this.registry.invalidateResults({
      communicationSystemId,
      reason
    });
  }

  /**
   * Evaluates canonical revision impact and invalidates affected executions
   */
  public processCanonicalRevisionImpact(changedRevisionId: string) {
    return this.registry.evaluateCanonicalRevisionImpact(changedRevisionId);
  }
}
