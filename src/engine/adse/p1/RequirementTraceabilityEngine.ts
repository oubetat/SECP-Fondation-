/**
 * SECP — ADSE-P1 Requirement Traceability Engine
 * Authoritative system-level relationship and lineage tracker.
 */

import { TraceabilityLink } from './types';

export class RequirementTraceabilityEngine {
  private links: TraceabilityLink[] = [];

  /**
   * Authoritatively records a traceability link.
   */
  public addLink(sourceId: string, targetId: string, relationship: TraceabilityLink['relationship']): void {
    const existing = this.links.find(l => l.sourceId === sourceId && l.targetId === targetId && l.relationship === relationship);
    if (!existing) {
      this.links.push({ sourceId, targetId, relationship });
    }
  }

  /**
   * Forward trace: What implements or verifies this entity?
   */
  public getForwardTrace(sourceId: string): TraceabilityLink[] {
    return this.links.filter(l => l.sourceId === sourceId);
  }

  /**
   * Backward trace: Why does this entity exist? (What requirement/source drove it?)
   */
  public getBackwardTrace(targetId: string): TraceabilityLink[] {
    return this.links.filter(l => l.targetId === targetId);
  }

  /**
   * Discovers the complete downstream impact path.
   */
  public getImpactTrace(rootId: string): string[] {
    const affected = new Set<string>();
    const queue = [rootId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const downstream = this.getForwardTrace(current);
      for (const link of downstream) {
        if (!affected.has(link.targetId)) {
          affected.add(link.targetId);
          queue.push(link.targetId);
        }
      }
    }

    return Array.from(affected);
  }

  public getAllLinks(): TraceabilityLink[] {
    return [...this.links];
  }

  public clear(): void {
    this.links = [];
  }
}
