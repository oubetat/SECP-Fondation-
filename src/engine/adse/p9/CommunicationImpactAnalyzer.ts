/**
 * SECP — ADSE-P9 Communication Impact Analyzer
 * 
 * Interacts with SECP RevisionImpactAnalyzer to discover downstream communication impacts
 * when upstream CAD, Architecture, or System Revisions change.
 */

import { RevisionEngine } from '../../revision/RevisionEngine';
import { CommunicationRegistry } from './CommunicationRegistry';

export class CommunicationImpactAnalyzer {
  private revisionEngine: RevisionEngine;
  private registry: CommunicationRegistry;

  constructor(revisionEngine: RevisionEngine, registry: CommunicationRegistry) {
    this.revisionEngine = revisionEngine;
    this.registry = registry;
  }

  /**
   * Discovers impacted communication systems/executions for a changed revision
   */
  public analyzeImpact(changedRevisionId: string) {
    const impacts = this.revisionEngine.getImpact(changedRevisionId);
    const affectedCommunicationSystems: string[] = [];

    for (const item of impacts) {
      const matching = this.registry.getAllSystems().filter(
        s => s.id === item.entityId || s.p3ArchitectureId === item.entityId || s.revisionId === item.revisionCode
      );

      for (const sys of matching) {
        if (!affectedCommunicationSystems.includes(sys.id)) {
          affectedCommunicationSystems.push(sys.id);
        }
      }
    }

    return {
      rawImpacts: impacts,
      affectedCommunicationSystems
    };
  }
}
