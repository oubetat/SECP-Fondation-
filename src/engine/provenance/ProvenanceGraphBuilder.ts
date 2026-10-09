/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-013: Provenance Graph Builder
 */

import { EngineeringIdentity } from '../identity/CanonicalEngineeringIdentity';
import { EngineeringIdentityFactory } from '../identity/EngineeringIdentityFactory';
import { CanonicalSerializer } from '../serialization/CanonicalSerializer';
import {
  ProvenanceNode,
  ProvenanceEdge,
  ProvenanceNodeType,
  ProvenanceEdgeType
} from './ProvenanceGraphTypes';
import { ProvenanceGraph } from './ProvenanceGraph';
import { ProvenanceGraphSerializer } from './ProvenanceGraphSerializer';
import { InvalidNodeError, InvalidEdgeError } from './ProvenanceGraphErrors';

export interface AddNodeOptions {
  type: ProvenanceNodeType;
  engineeringIdentityId: string;
  canonicalHash: string;
  version?: string;
  createdAt?: string;
  source?: string;
  metadataHash?: string;
  evidenceRefs?: string[];
  attributes?: Record<string, unknown>;
}

export interface AddEdgeOptions {
  type: ProvenanceEdgeType;
  fromNodeId: string;
  toNodeId: string;
  createdAt?: string;
  evidenceRefs?: string[];
  metadata?: Record<string, unknown>;
  relationHash?: string;
}

export class ProvenanceGraphBuilder {
  private nodes: ProvenanceNode[] = [];
  private edges: ProvenanceEdge[] = [];
  private clockSource: string;

  constructor(clockSource = 'SystemEngineeringClock') {
    this.clockSource = clockSource;
  }

  /**
   * Helper to format clock time in ISO format without direct raw Date.now() if passed
   */
  private getTimestamp(provided?: string): string {
    if (provided && provided.trim() !== '') {
      return provided;
    }
    return new Date().toISOString();
  }

  /**
   * Add Node to the graph builder with identity validation
   */
  public addNode(options: AddNodeOptions): this {
    if (!options.engineeringIdentityId || options.engineeringIdentityId.trim() === '') {
      throw new InvalidNodeError('engineeringIdentityId must be provided');
    }

    if (!options.canonicalHash || options.canonicalHash.trim() === '') {
      throw new InvalidNodeError('canonicalHash must be provided');
    }

    const version = options.version || '1.0.0';
    const createdAt = this.getTimestamp(options.createdAt);

    // Compute deterministic Node ID
    const id = ProvenanceGraphSerializer.computeNodeId(
      options.engineeringIdentityId,
      options.type,
      options.canonicalHash,
      version
    );

    const node: ProvenanceNode = Object.freeze({
      id,
      type: options.type,
      engineeringIdentityId: options.engineeringIdentityId,
      canonicalHash: options.canonicalHash,
      version,
      createdAt,
      source: options.source,
      metadataHash: options.metadataHash,
      evidenceRefs: Object.freeze([...(options.evidenceRefs || [])]),
      attributes: options.attributes ? Object.freeze({ ...options.attributes }) : undefined
    });

    this.nodes.push(node);
    return this;
  }

  /**
   * Add Edge connecting two Nodes
   */
  public addEdge(options: AddEdgeOptions): this {
    if (!options.fromNodeId || !options.toNodeId) {
      throw new InvalidEdgeError('fromNodeId and toNodeId must be provided');
    }

    const createdAt = this.getTimestamp(options.createdAt);

    // Compute relationHash if not provided
    const relationHash =
      options.relationHash ||
      ProvenanceGraphSerializer.computeRelationHash(
        options.fromNodeId,
        options.type,
        options.toNodeId,
        options.metadata
      );

    // Compute deterministic Edge ID
    const id = ProvenanceGraphSerializer.computeEdgeId(
      options.fromNodeId,
      options.type,
      options.toNodeId,
      relationHash
    );

    const edge: ProvenanceEdge = Object.freeze({
      id,
      type: options.type,
      fromNodeId: options.fromNodeId,
      toNodeId: options.toNodeId,
      createdAt,
      evidenceRefs: Object.freeze([...(options.evidenceRefs || [])]),
      relationHash,
      metadata: options.metadata ? Object.freeze({ ...options.metadata }) : undefined
    });

    this.edges.push(edge);
    return this;
  }

  /**
   * High-level helper: link artifact node to evidence node
   */
  public linkEvidence(nodeId: string, evidenceId: string, evidenceHash: string, timestamp?: string): this {
    // Ensure evidence node exists or add it
    const evidenceIdentityStr = `SECP:EVIDENCE:${evidenceId}`;
    let evidenceNodeId = ProvenanceGraphSerializer.computeNodeId(
      evidenceIdentityStr,
      'EVIDENCE',
      evidenceHash,
      '1.0.0'
    );

    if (!this.nodes.some(n => n.id === evidenceNodeId)) {
      this.addNode({
        type: 'EVIDENCE',
        engineeringIdentityId: evidenceIdentityStr,
        canonicalHash: evidenceHash,
        version: '1.0.0',
        createdAt: timestamp,
        evidenceRefs: [evidenceId]
      });
    }

    // Add VERIFIED_BY or CERTIFIES edge
    this.addEdge({
      type: 'VERIFIED_BY',
      fromNodeId: nodeId,
      toNodeId: evidenceNodeId,
      createdAt: timestamp,
      evidenceRefs: [evidenceId]
    });

    return this;
  }

  /**
   * Build the validated ProvenanceGraph data structure
   */
  public build(): ProvenanceGraph {
    return new ProvenanceGraph(this.nodes, this.edges);
  }
}
