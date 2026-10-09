/**
 * SECP Industrial OS — EPC-003: Requirement Traceability Engine
 * Core Canonical Requirement Traceability Engine & Graph.
 */

import {
  TraceabilityArtifact,
  TraceabilityEdge,
  TraceabilityArtifactType,
  TraceabilityRelationshipType,
  RequirementTraceResult,
  ReverseTraceResult,
  OrphanReport,
  TraceabilityGraphData,
  TraceabilityValidationError,
  TraceabilityStage
} from './TraceabilityTypes';
import { EngineeringRequirement } from './EngineeringRequirementTypes';

export const VALID_ARTIFACT_TYPES: readonly TraceabilityArtifactType[] = [
  'REQUIREMENT',
  'DESIGN_FEATURE',
  'ANALYSIS',
  'TEST',
  'EVIDENCE'
];

export const VALID_RELATIONSHIP_TYPES: readonly TraceabilityRelationshipType[] = [
  'REQUIREMENT_TO_DESIGN_FEATURE',
  'DESIGN_FEATURE_TO_ANALYSIS',
  'ANALYSIS_TO_TEST',
  'TEST_TO_EVIDENCE'
];

function cleanObject<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(cleanObject) as unknown as T;
  }
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      result[key] = typeof val === 'object' && val !== null ? cleanObject(val) : val;
    }
  }
  return result as T;
}

export class RequirementTraceabilityEngine {
  public readonly graphId: string;
  public readonly revision: string;
  private readonly artifactsMap: Map<string, TraceabilityArtifact> = new Map();
  private readonly edgesMap: Map<string, TraceabilityEdge> = new Map();

  constructor(graphId: string = 'TRACE-GRAPH-001', revision: string = 'v1.0.0') {
    if (!graphId || typeof graphId !== 'string' || graphId.trim() === '') {
      throw new TraceabilityValidationError('graphId must be a non-empty string', 'INVALID_GRAPH_ID');
    }
    this.graphId = graphId.trim();
    this.revision = revision || 'v1.0.0';
  }

  /**
   * Adds an artifact node to the graph.
   */
  public addArtifact(artifact: TraceabilityArtifact): void {
    if (!artifact || typeof artifact !== 'object') {
      throw new TraceabilityValidationError('Artifact must be a non-null object', 'INVALID_ARTIFACT');
    }

    if (!artifact.artifactId || typeof artifact.artifactId !== 'string' || artifact.artifactId.trim() === '') {
      throw new TraceabilityValidationError('Artifact missing mandatory field: artifactId', 'MISSING_ARTIFACT_ID');
    }

    if (!artifact.type || !VALID_ARTIFACT_TYPES.includes(artifact.type)) {
      throw new TraceabilityValidationError(
        `Invalid artifact type '${artifact.type}'. Allowed: ${VALID_ARTIFACT_TYPES.join(', ')}`,
        'INVALID_ARTIFACT_TYPE'
      );
    }

    if (!artifact.name || typeof artifact.name !== 'string' || artifact.name.trim() === '') {
      throw new TraceabilityValidationError('Artifact missing mandatory field: name', 'MISSING_ARTIFACT_NAME');
    }

    const trimmedId = artifact.artifactId.trim();
    const existing = this.artifactsMap.get(trimmedId);
    if (existing) {
      if (existing.type !== artifact.type) {
        throw new TraceabilityValidationError(
          `Cannot re-add artifact '${trimmedId}' with conflicting type '${artifact.type}' (existing: '${existing.type}')`,
          'ARTIFACT_TYPE_MISMATCH'
        );
      }
      const cleaned = cleanObject({ ...existing, ...artifact, artifactId: trimmedId });
      this.artifactsMap.set(trimmedId, Object.freeze(cleaned));
      return;
    }

    const cleaned = cleanObject({ ...artifact, artifactId: trimmedId });
    this.artifactsMap.set(trimmedId, Object.freeze(cleaned));
  }

  /**
   * Retrieves an artifact by ID.
   */
  public getArtifact(artifactId: string): TraceabilityArtifact | undefined {
    if (!artifactId || typeof artifactId !== 'string') return undefined;
    return this.artifactsMap.get(artifactId.trim());
  }

  /**
   * Returns all artifacts in the graph.
   */
  public getAllArtifacts(): readonly TraceabilityArtifact[] {
    return Array.from(this.artifactsMap.values());
  }

  /**
   * Adds a traceability relationship edge to the graph.
   */
  public addEdge(edge: TraceabilityEdge): void {
    if (!edge || typeof edge !== 'object') {
      throw new TraceabilityValidationError('Edge must be a non-null object', 'INVALID_EDGE');
    }

    if (!edge.edgeId || typeof edge.edgeId !== 'string' || edge.edgeId.trim() === '') {
      throw new TraceabilityValidationError('Edge missing mandatory field: edgeId', 'MISSING_EDGE_ID');
    }

    if (!edge.sourceId || typeof edge.sourceId !== 'string' || edge.sourceId.trim() === '') {
      throw new TraceabilityValidationError('Edge missing mandatory field: sourceId', 'MISSING_SOURCE_ID');
    }

    if (!edge.targetId || typeof edge.targetId !== 'string' || edge.targetId.trim() === '') {
      throw new TraceabilityValidationError('Edge missing mandatory field: targetId', 'MISSING_TARGET_ID');
    }

    if (edge.sourceId.trim() === edge.targetId.trim()) {
      throw new TraceabilityValidationError(
        `Self-referencing edge rejected: sourceId and targetId cannot be identical ('${edge.sourceId}')`,
        'SELF_REFERENCING_EDGE'
      );
    }

    const sourceArtifact = this.getArtifact(edge.sourceId);
    if (!sourceArtifact) {
      throw new TraceabilityValidationError(
        `Source artifact '${edge.sourceId}' not found in traceability graph`,
        'SOURCE_ARTIFACT_NOT_FOUND'
      );
    }

    const targetArtifact = this.getArtifact(edge.targetId);
    if (!targetArtifact) {
      throw new TraceabilityValidationError(
        `Target artifact '${edge.targetId}' not found in traceability graph`,
        'TARGET_ARTIFACT_NOT_FOUND'
      );
    }

    if (edge.sourceType && edge.sourceType !== sourceArtifact.type) {
      throw new TraceabilityValidationError(
        `Source type mismatch: edge specifies '${edge.sourceType}', but source artifact is '${sourceArtifact.type}'`,
        'SOURCE_TYPE_MISMATCH'
      );
    }

    if (edge.targetType && edge.targetType !== targetArtifact.type) {
      throw new TraceabilityValidationError(
        `Target type mismatch: edge specifies '${edge.targetType}', but target artifact is '${targetArtifact.type}'`,
        'TARGET_TYPE_MISMATCH'
      );
    }

    if (!edge.relationshipType || !VALID_RELATIONSHIP_TYPES.includes(edge.relationshipType)) {
      throw new TraceabilityValidationError(
        `Invalid relationshipType '${edge.relationshipType}'. Allowed: ${VALID_RELATIONSHIP_TYPES.join(', ')}`,
        'INVALID_RELATIONSHIP_TYPE'
      );
    }

    // Validate strict directional alignment
    this.validateDirectionalRelationship(sourceArtifact.type, targetArtifact.type, edge.relationshipType);

    const edgeId = edge.edgeId.trim();
    const sourceId = sourceArtifact.artifactId;
    const targetId = targetArtifact.artifactId;

    // Check for logical duplicate edge (sourceId + targetId + relationshipType)
    for (const existingEdge of this.edgesMap.values()) {
      if (
        existingEdge.sourceId === sourceId &&
        existingEdge.targetId === targetId &&
        existingEdge.relationshipType === edge.relationshipType
      ) {
        if (existingEdge.edgeId === edgeId) {
          // Idempotent re-add of identical edge
          return;
        }
        throw new TraceabilityValidationError(
          `Duplicate logical trace edge rejected: Link from '${sourceId}' to '${targetId}' via '${edge.relationshipType}' already exists`,
          'DUPLICATE_TRACE_EDGE'
        );
      }
    }

    const rawEdge = {
      edgeId,
      sourceId,
      sourceType: sourceArtifact.type,
      targetId,
      targetType: targetArtifact.type,
      relationshipType: edge.relationshipType,
      version: edge.version || 'v1.0.0',
      createdAt: edge.createdAt || new Date().toISOString(),
      metadata: edge.metadata
    };

    const frozenEdge: TraceabilityEdge = Object.freeze(cleanObject(rawEdge));

    this.edgesMap.set(edgeId, frozenEdge);
  }

  /**
   * Enforces valid directional stage mapping.
   */
  private validateDirectionalRelationship(
    sourceType: TraceabilityArtifactType,
    targetType: TraceabilityArtifactType,
    relType: TraceabilityRelationshipType
  ): void {
    if (relType === 'REQUIREMENT_TO_DESIGN_FEATURE') {
      if (sourceType !== 'REQUIREMENT' || targetType !== 'DESIGN_FEATURE') {
        throw new TraceabilityValidationError(
          `Relationship 'REQUIREMENT_TO_DESIGN_FEATURE' requires source 'REQUIREMENT' and target 'DESIGN_FEATURE', got '${sourceType}' -> '${targetType}'`,
          'INVALID_DIRECTIONAL_RELATIONSHIP'
        );
      }
    } else if (relType === 'DESIGN_FEATURE_TO_ANALYSIS') {
      if (sourceType !== 'DESIGN_FEATURE' || targetType !== 'ANALYSIS') {
        throw new TraceabilityValidationError(
          `Relationship 'DESIGN_FEATURE_TO_ANALYSIS' requires source 'DESIGN_FEATURE' and target 'ANALYSIS', got '${sourceType}' -> '${targetType}'`,
          'INVALID_DIRECTIONAL_RELATIONSHIP'
        );
      }
    } else if (relType === 'ANALYSIS_TO_TEST') {
      if (sourceType !== 'ANALYSIS' || targetType !== 'TEST') {
        throw new TraceabilityValidationError(
          `Relationship 'ANALYSIS_TO_TEST' requires source 'ANALYSIS' and target 'TEST', got '${sourceType}' -> '${targetType}'`,
          'INVALID_DIRECTIONAL_RELATIONSHIP'
        );
      }
    } else if (relType === 'TEST_TO_EVIDENCE') {
      if (sourceType !== 'TEST' || targetType !== 'EVIDENCE') {
        throw new TraceabilityValidationError(
          `Relationship 'TEST_TO_EVIDENCE' requires source 'TEST' and target 'EVIDENCE', got '${sourceType}' -> '${targetType}'`,
          'INVALID_DIRECTIONAL_RELATIONSHIP'
        );
      }
    }
  }

  /**
   * Retrieves an edge by ID.
   */
  public getEdge(edgeId: string): TraceabilityEdge | undefined {
    if (!edgeId || typeof edgeId !== 'string') return undefined;
    return this.edgesMap.get(edgeId.trim());
  }

  /**
   * Returns all edges in the graph.
   */
  public getAllEdges(): readonly TraceabilityEdge[] {
    return Array.from(this.edgesMap.values());
  }

  /**
   * Returns all outgoing edges from a given source artifact.
   */
  public getOutgoingEdges(sourceId: string): TraceabilityEdge[] {
    if (!sourceId || typeof sourceId !== 'string') return [];
    const trimmed = sourceId.trim();
    return Array.from(this.edgesMap.values()).filter(e => e.sourceId === trimmed);
  }

  /**
   * Returns all incoming edges to a given target artifact.
   */
  public getIncomingEdges(targetId: string): TraceabilityEdge[] {
    if (!targetId || typeof targetId !== 'string') return [];
    const trimmed = targetId.trim();
    return Array.from(this.edgesMap.values()).filter(e => e.targetId === trimmed);
  }

  /**
   * Evaluates complete downstream traceability chain for a requirement.
   */
  public getRequirementTrace(
    requirementId: string,
    requirementSpec?: EngineeringRequirement
  ): RequirementTraceResult {
    if (!requirementId || typeof requirementId !== 'string' || requirementId.trim() === '') {
      throw new TraceabilityValidationError(
        'requirementId must be a non-empty string',
        'MISSING_REQUIREMENT_ID'
      );
    }

    const trimmedReqId = requirementId.trim();
    const reqArtifact = this.getArtifact(trimmedReqId);

    // 1. Find Design Features
    const designFeatureEdges = Array.from(this.edgesMap.values()).filter(
      e => e.sourceId === trimmedReqId && e.relationshipType === 'REQUIREMENT_TO_DESIGN_FEATURE'
    );
    const designFeatureIds = new Set(designFeatureEdges.map(e => e.targetId));
    const designFeatures = Array.from(designFeatureIds)
      .map(id => this.getArtifact(id))
      .filter((a): a is TraceabilityArtifact => a !== undefined);

    // 2. Find Analyses from linked Design Features
    const analysisEdges = Array.from(this.edgesMap.values()).filter(
      e => designFeatureIds.has(e.sourceId) && e.relationshipType === 'DESIGN_FEATURE_TO_ANALYSIS'
    );
    const analysisIds = new Set(analysisEdges.map(e => e.targetId));
    const analyses = Array.from(analysisIds)
      .map(id => this.getArtifact(id))
      .filter((a): a is TraceabilityArtifact => a !== undefined);

    // 3. Find Tests from linked Analyses
    const testEdges = Array.from(this.edgesMap.values()).filter(
      e => analysisIds.has(e.sourceId) && e.relationshipType === 'ANALYSIS_TO_TEST'
    );
    const testIds = new Set(testEdges.map(e => e.targetId));
    const tests = Array.from(testIds)
      .map(id => this.getArtifact(id))
      .filter((a): a is TraceabilityArtifact => a !== undefined);

    // 4. Find Evidence from linked Tests
    const evidenceEdges = Array.from(this.edgesMap.values()).filter(
      e => testIds.has(e.sourceId) && e.relationshipType === 'TEST_TO_EVIDENCE'
    );
    const evidenceIds = new Set(evidenceEdges.map(e => e.targetId));
    const evidence = Array.from(evidenceIds)
      .map(id => this.getArtifact(id))
      .filter((a): a is TraceabilityArtifact => a !== undefined);

    const hasDesignFeature = designFeatures.length > 0;
    const hasAnalysis = analyses.length > 0;
    const hasTest = tests.length > 0;
    const hasEvidence = evidence.length > 0;

    const missingStages: ('DESIGN_FEATURE' | 'ANALYSIS' | 'TEST' | 'EVIDENCE')[] = [];
    if (!hasDesignFeature) missingStages.push('DESIGN_FEATURE');
    if (!hasAnalysis) missingStages.push('ANALYSIS');
    if (!hasTest) missingStages.push('TEST');
    if (!hasEvidence) missingStages.push('EVIDENCE');

    let status: RequirementTraceResult['status'] = 'PARTIALLY_TRACEABLE';
    if (hasDesignFeature && hasAnalysis && hasTest && hasEvidence) {
      status = 'FULLY_TRACEABLE';
    } else if (!hasDesignFeature && !hasAnalysis && !hasTest && !hasEvidence) {
      status = 'UNTRACEABLE';
    }

    const isValidChain = status === 'FULLY_TRACEABLE';

    // Evaluate Critical Requirement Rule
    const isCritical = requirementSpec?.priority === 'CRITICAL' || reqArtifact?.metadata?.priority === 'CRITICAL';
    const criticalGatePassed = isCritical ? isValidChain : true;

    return {
      requirementId: trimmedReqId,
      requirement: requirementSpec,
      designFeatures,
      analyses,
      tests,
      evidence,
      status,
      missingStages,
      isValidChain,
      criticalGatePassed
    };
  }

  /**
   * Reverse lookup from Evidence to Requirement(s).
   * Evidence ← Test ← Analysis ← Design Feature ← Requirement
   */
  public getReverseTrace(evidenceId: string): ReverseTraceResult {
    if (!evidenceId || typeof evidenceId !== 'string' || evidenceId.trim() === '') {
      throw new TraceabilityValidationError('evidenceId must be a non-empty string', 'MISSING_EVIDENCE_ID');
    }

    const trimmedEvId = evidenceId.trim();
    const evidenceArtifact = this.getArtifact(trimmedEvId);

    // Find tests linked to this evidence
    const testEdges = Array.from(this.edgesMap.values()).filter(
      e => e.targetId === trimmedEvId && e.relationshipType === 'TEST_TO_EVIDENCE'
    );
    const testIds = new Set(testEdges.map(e => e.sourceId));
    const tests = Array.from(testIds)
      .map(id => this.getArtifact(id))
      .filter((a): a is TraceabilityArtifact => a !== undefined);

    // Find analyses linked to these tests
    const analysisEdges = Array.from(this.edgesMap.values()).filter(
      e => testIds.has(e.targetId) && e.relationshipType === 'ANALYSIS_TO_TEST'
    );
    const analysisIds = new Set(analysisEdges.map(e => e.sourceId));
    const analyses = Array.from(analysisIds)
      .map(id => this.getArtifact(id))
      .filter((a): a is TraceabilityArtifact => a !== undefined);

    // Find design features linked to these analyses
    const designFeatureEdges = Array.from(this.edgesMap.values()).filter(
      e => analysisIds.has(e.targetId) && e.relationshipType === 'DESIGN_FEATURE_TO_ANALYSIS'
    );
    const designFeatureIds = new Set(designFeatureEdges.map(e => e.sourceId));
    const designFeatures = Array.from(designFeatureIds)
      .map(id => this.getArtifact(id))
      .filter((a): a is TraceabilityArtifact => a !== undefined);

    // Find requirements linked to these design features
    const reqEdges = Array.from(this.edgesMap.values()).filter(
      e => designFeatureIds.has(e.targetId) && e.relationshipType === 'REQUIREMENT_TO_DESIGN_FEATURE'
    );
    const reqIds = new Set(reqEdges.map(e => e.sourceId));
    const requirements = Array.from(reqIds)
      .map(id => this.getArtifact(id))
      .filter((a): a is TraceabilityArtifact => a !== undefined);

    const isCompleteReverseChain =
      tests.length > 0 && analyses.length > 0 && designFeatures.length > 0 && requirements.length > 0;

    return {
      evidenceId: trimmedEvId,
      evidence: evidenceArtifact,
      tests,
      analyses,
      designFeatures,
      requirements,
      isCompleteReverseChain
    };
  }

  /**
   * Detects orphaned artifacts across all 5 stages.
   */
  public detectOrphans(): OrphanReport {
    const allArtifacts = Array.from(this.artifactsMap.values());
    const allEdges = Array.from(this.edgesMap.values());

    const sourcesWithOutgoingReqEdges = new Set(
      allEdges.filter(e => e.relationshipType === 'REQUIREMENT_TO_DESIGN_FEATURE').map(e => e.sourceId)
    );
    const targetsWithIncomingReqEdges = new Set(
      allEdges.filter(e => e.relationshipType === 'REQUIREMENT_TO_DESIGN_FEATURE').map(e => e.targetId)
    );
    const targetsWithIncomingAnalysisEdges = new Set(
      allEdges.filter(e => e.relationshipType === 'DESIGN_FEATURE_TO_ANALYSIS').map(e => e.targetId)
    );
    const targetsWithIncomingTestEdges = new Set(
      allEdges.filter(e => e.relationshipType === 'ANALYSIS_TO_TEST').map(e => e.targetId)
    );
    const targetsWithIncomingEvidenceEdges = new Set(
      allEdges.filter(e => e.relationshipType === 'TEST_TO_EVIDENCE').map(e => e.targetId)
    );

    const orphanRequirements = allArtifacts.filter(
      a => a.type === 'REQUIREMENT' && !sourcesWithOutgoingReqEdges.has(a.artifactId)
    );

    const orphanDesignFeatures = allArtifacts.filter(
      a => a.type === 'DESIGN_FEATURE' && !targetsWithIncomingReqEdges.has(a.artifactId)
    );

    const orphanAnalyses = allArtifacts.filter(
      a => a.type === 'ANALYSIS' && !targetsWithIncomingAnalysisEdges.has(a.artifactId)
    );

    const orphanTests = allArtifacts.filter(
      a => a.type === 'TEST' && !targetsWithIncomingTestEdges.has(a.artifactId)
    );

    const orphanEvidence = allArtifacts.filter(
      a => a.type === 'EVIDENCE' && !targetsWithIncomingEvidenceEdges.has(a.artifactId)
    );

    const totalOrphans =
      orphanRequirements.length +
      orphanDesignFeatures.length +
      orphanAnalyses.length +
      orphanTests.length +
      orphanEvidence.length;

    return {
      orphanRequirements,
      orphanDesignFeatures,
      orphanAnalyses,
      orphanTests,
      orphanEvidence,
      totalOrphans
    };
  }

  /**
   * Exports canonical graph data payload for serialization.
   */
  public toGraphData(): TraceabilityGraphData {
    // Sort artifacts and edges deterministically by ID
    const sortedArtifacts = Array.from(this.artifactsMap.values()).sort((a, b) =>
      a.artifactId.localeCompare(b.artifactId)
    );
    const sortedEdges = Array.from(this.edgesMap.values()).sort((a, b) =>
      a.edgeId.localeCompare(b.edgeId)
    );

    return {
      graphId: this.graphId,
      revision: this.revision,
      artifacts: sortedArtifacts,
      edges: sortedEdges
    };
  }

  /**
   * Restores graph state from GraphData payload.
   */
  public static fromGraphData(data: TraceabilityGraphData): RequirementTraceabilityEngine {
    if (!data || typeof data !== 'object') {
      throw new TraceabilityValidationError('Graph data must be a non-null object', 'INVALID_GRAPH_DATA');
    }

    const engine = new RequirementTraceabilityEngine(data.graphId, data.revision);

    if (Array.isArray(data.artifacts)) {
      for (const artifact of data.artifacts) {
        engine.addArtifact(artifact);
      }
    }

    if (Array.isArray(data.edges)) {
      for (const edge of data.edges) {
        engine.addEdge(edge);
      }
    }

    return engine;
  }
}
