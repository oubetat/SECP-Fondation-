/**
 * SECP Industrial OS v2 — Phase 1: Engineering Truth Core
 * PATCH-013: Provenance Graph Custom Errors
 */

export class ProvenanceGraphError extends Error {
  constructor(message: string) {
    super(`[ProvenanceGraph] ${message}`);
    this.name = 'ProvenanceGraphError';
  }
}

export class DuplicateNodeError extends ProvenanceGraphError {
  constructor(nodeId: string) {
    super(`Duplicate node with ID '${nodeId}' already exists in graph.`);
    this.name = 'DuplicateNodeError';
  }
}

export class MissingNodeError extends ProvenanceGraphError {
  constructor(nodeId: string) {
    super(`Referenced node '${nodeId}' does not exist in graph.`);
    this.name = 'MissingNodeError';
  }
}

export class InvalidSelfLoopError extends ProvenanceGraphError {
  constructor(nodeId: string, edgeType: string) {
    super(`Self-loop edge on node '${nodeId}' with type '${edgeType}' is forbidden.`);
    this.name = 'InvalidSelfLoopError';
  }
}

export class InvalidNodeError extends ProvenanceGraphError {
  constructor(reason: string) {
    super(`Invalid node structure: ${reason}`);
    this.name = 'InvalidNodeError';
  }
}

export class InvalidEdgeError extends ProvenanceGraphError {
  constructor(reason: string) {
    super(`Invalid edge structure: ${reason}`);
    this.name = 'InvalidEdgeError';
  }
}
