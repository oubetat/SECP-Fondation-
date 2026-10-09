/**
 * SECP Industrial OS v2 — PATCH-157: Evidence Correlation Engine
 * Tracks multi-dimensional causality, event correlation, and verification lineages.
 */

import { EvidenceEnvelope } from './types';

export interface EvidenceCausationNode {
  readonly evidence: EvidenceEnvelope;
  readonly children: EvidenceCausationNode[];
}

export interface EngineeringEvidenceTrace {
  readonly correlationId: string;
  readonly eventId?: string;
  readonly workflowId?: string;
  readonly runId?: string;
  readonly engineeringObjectId?: string;
  readonly sequence: readonly EvidenceEnvelope[];
  readonly rootEvidence?: EvidenceEnvelope;
  readonly causationTrees: readonly EvidenceCausationNode[];
  readonly totalEvidenceCount: number;
}

export class EvidenceCorrelationEngine {
  private correlationIndex = new Map<string, string[]>(); // correlationId -> evidenceIds
  private eventIndex = new Map<string, string[]>();       // eventId -> evidenceIds
  private workflowIndex = new Map<string, string[]>();    // workflowId -> evidenceIds
  private runIndex = new Map<string, string[]>();         // runId -> evidenceIds
  private objectIndex = new Map<string, string[]>();      // objectId -> evidenceIds
  private subjectIdentityIndex = new Map<string, string[]>(); // subjectIdentityId -> evidenceIds
  private sourceIdentityIndex = new Map<string, string[]>();  // sourceIdentityId -> evidenceIds
  private producerIdentityIndex = new Map<string, string[]>(); // producerIdentityId -> evidenceIds
  private parentIndex = new Map<string, string[]>();      // parentEvidenceId -> child evidenceIds

  /**
   * Indexes a new published EvidenceEnvelope for fast multi-dimensional correlation.
   */
  public indexEnvelope(envelope: EvidenceEnvelope): void {
    const id = envelope.evidenceId;

    // 1. Correlation ID
    if (envelope.correlation.correlationId) {
      const list = this.correlationIndex.get(envelope.correlation.correlationId) || [];
      if (!list.includes(id)) {
        list.push(id);
        this.correlationIndex.set(envelope.correlation.correlationId, list);
      }
    }

    // 2. Event ID
    if (envelope.correlation.eventId) {
      const list = this.eventIndex.get(envelope.correlation.eventId) || [];
      if (!list.includes(id)) {
        list.push(id);
        this.eventIndex.set(envelope.correlation.eventId, list);
      }
    }

    // 3. Workflow ID
    if (envelope.correlation.workflowId) {
      const list = this.workflowIndex.get(envelope.correlation.workflowId) || [];
      if (!list.includes(id)) {
        list.push(id);
        this.workflowIndex.set(envelope.correlation.workflowId, list);
      }
    }

    // 4. Run ID
    if (envelope.correlation.runId) {
      const list = this.runIndex.get(envelope.correlation.runId) || [];
      if (!list.includes(id)) {
        list.push(id);
        this.runIndex.set(envelope.correlation.runId, list);
      }
    }

    // 5. Engineering Object ID
    if (envelope.correlation.engineeringObjectId) {
      const list = this.objectIndex.get(envelope.correlation.engineeringObjectId) || [];
      if (!list.includes(id)) {
        list.push(id);
        this.objectIndex.set(envelope.correlation.engineeringObjectId, list);
      }
    }

    // 5b. Identity Linkage (PATCH-158)
    if (envelope.correlation.subjectIdentityId) {
      const list = this.subjectIdentityIndex.get(envelope.correlation.subjectIdentityId) || [];
      if (!list.includes(id)) {
        list.push(id);
        this.subjectIdentityIndex.set(envelope.correlation.subjectIdentityId, list);
      }
    }
    if (envelope.correlation.sourceIdentityId) {
      const list = this.sourceIdentityIndex.get(envelope.correlation.sourceIdentityId) || [];
      if (!list.includes(id)) {
        list.push(id);
        this.sourceIdentityIndex.set(envelope.correlation.sourceIdentityId, list);
      }
    }
    if (envelope.correlation.producerIdentityId) {
      const list = this.producerIdentityIndex.get(envelope.correlation.producerIdentityId) || [];
      if (!list.includes(id)) {
        list.push(id);
        this.producerIdentityIndex.set(envelope.correlation.producerIdentityId, list);
      }
    }

    // 6. Parent Evidence ID (Child tracking)
    if (envelope.correlation.parentEvidenceId) {
      const list = this.parentIndex.get(envelope.correlation.parentEvidenceId) || [];
      if (!list.includes(id)) {
        list.push(id);
        this.parentIndex.set(envelope.correlation.parentEvidenceId, list);
      }
    }
  }

  /**
   * Resolves all evidence IDs matching a given correlation criteria.
   */
  public findEvidenceIds(criteria: {
    correlationId?: string;
    eventId?: string;
    workflowId?: string;
    runId?: string;
    engineeringObjectId?: string;
    subjectIdentityId?: string;
    sourceIdentityId?: string;
    producerIdentityId?: string;
    parentEvidenceId?: string;
  }): string[] {
    const sets: Set<string>[] = [];

    if (criteria.correlationId !== undefined) {
      if (!this.correlationIndex.has(criteria.correlationId)) return [];
      sets.push(new Set(this.correlationIndex.get(criteria.correlationId)));
    }
    if (criteria.eventId !== undefined) {
      if (!this.eventIndex.has(criteria.eventId)) return [];
      sets.push(new Set(this.eventIndex.get(criteria.eventId)));
    }
    if (criteria.workflowId !== undefined) {
      if (!this.workflowIndex.has(criteria.workflowId)) return [];
      sets.push(new Set(this.workflowIndex.get(criteria.workflowId)));
    }
    if (criteria.runId !== undefined) {
      if (!this.runIndex.has(criteria.runId)) return [];
      sets.push(new Set(this.runIndex.get(criteria.runId)));
    }
    if (criteria.engineeringObjectId !== undefined) {
      if (!this.objectIndex.has(criteria.engineeringObjectId)) return [];
      sets.push(new Set(this.objectIndex.get(criteria.engineeringObjectId)));
    }
    if (criteria.subjectIdentityId !== undefined) {
      if (!this.subjectIdentityIndex.has(criteria.subjectIdentityId)) return [];
      sets.push(new Set(this.subjectIdentityIndex.get(criteria.subjectIdentityId)));
    }
    if (criteria.sourceIdentityId !== undefined) {
      if (!this.sourceIdentityIndex.has(criteria.sourceIdentityId)) return [];
      sets.push(new Set(this.sourceIdentityIndex.get(criteria.sourceIdentityId)));
    }
    if (criteria.producerIdentityId !== undefined) {
      if (!this.producerIdentityIndex.has(criteria.producerIdentityId)) return [];
      sets.push(new Set(this.producerIdentityIndex.get(criteria.producerIdentityId)));
    }
    if (criteria.parentEvidenceId !== undefined) {
      if (!this.parentIndex.has(criteria.parentEvidenceId)) return [];
      sets.push(new Set(this.parentIndex.get(criteria.parentEvidenceId)));
    }

    if (sets.length === 0) return [];

    // Intersection
    let result = Array.from(sets[0]);
    for (let i = 1; i < sets.length; i++) {
      const currentSet = sets[i];
      result = result.filter(id => currentSet.has(id));
    }
    return result;
  }

  /**
   * Constructs the full ancestry chain starting backwards from the target evidence.
   */
  public getAncestryChain(
    evidenceId: string,
    resolver: (id: string) => EvidenceEnvelope | undefined
  ): EvidenceEnvelope[] {
    const chain: EvidenceEnvelope[] = [];
    const visited = new Set<string>();
    let currentId: string | undefined = evidenceId;

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const ev = resolver(currentId);
      if (!ev) break;
      chain.unshift(ev);
      currentId = ev.correlation.parentEvidenceId;
    }

    return chain;
  }

  /**
   * Builds a full causation tree branching forwards from root evidence.
   */
  public buildCausationTree(
    rootEvidence: EvidenceEnvelope,
    resolver: (id: string) => EvidenceEnvelope | undefined
  ): EvidenceCausationNode {
    const buildNode = (ev: EvidenceEnvelope, visited: Set<string>): EvidenceCausationNode => {
      visited.add(ev.evidenceId);
      const childrenIds = this.parentIndex.get(ev.evidenceId) || [];
      const children: EvidenceCausationNode[] = [];

      for (const childId of childrenIds) {
        if (!visited.has(childId)) {
          const childEv = resolver(childId);
          if (childEv) {
            children.push(buildNode(childEv, visited));
          }
        }
      }

      return { evidence: ev, children };
    };

    return buildNode(rootEvidence, new Set());
  }

  /**
   * Produces an end-to-end trace for a correlation context.
   */
  public generateTrace(
    correlationId: string,
    resolver: (id: string) => EvidenceEnvelope | undefined
  ): EngineeringEvidenceTrace | undefined {
    const evidenceIds = this.correlationIndex.get(correlationId);
    if (!evidenceIds || evidenceIds.length === 0) {
      return undefined;
    }

    const envelopes = evidenceIds
      .map(id => resolver(id))
      .filter((ev): ev is EvidenceEnvelope => ev !== undefined)
      .sort((a, b) => a.identity.sequence - b.identity.sequence);

    if (envelopes.length === 0) return undefined;

    const first = envelopes[0];
    const rootEnvelopes = envelopes.filter(e => !e.correlation.parentEvidenceId);
    const causationTrees = rootEnvelopes.map(r => this.buildCausationTree(r, resolver));

    return {
      correlationId,
      eventId: first.correlation.eventId,
      workflowId: first.correlation.workflowId,
      runId: first.correlation.runId,
      engineeringObjectId: first.correlation.engineeringObjectId,
      sequence: Object.freeze(envelopes),
      rootEvidence: rootEnvelopes[0],
      causationTrees: Object.freeze(causationTrees),
      totalEvidenceCount: envelopes.length
    };
  }

  /**
   * Clears all indexes.
   */
  public clear(): void {
    this.correlationIndex.clear();
    this.eventIndex.clear();
    this.workflowIndex.clear();
    this.runIndex.clear();
    this.objectIndex.clear();
    this.subjectIdentityIndex.clear();
    this.sourceIdentityIndex.clear();
    this.producerIdentityIndex.clear();
    this.parentIndex.clear();
  }
}
