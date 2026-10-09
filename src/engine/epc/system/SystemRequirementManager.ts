/**
 * SECP Industrial OS — EPC-017: System Requirement Manager
 * Universal Lifecycle Manager, Status Transition Gatekeeper,
 * Readiness Evaluator, Coverage Computer, and EPC-002/003/004 Integrator.
 */

import {
  SystemRequirement,
  SystemRequirementValidationError,
  SystemRequirementStatus,
  SystemRequirementChangeRecord,
  RequirementCoverageReport,
  ReadinessEvaluationResult,
  ExecutionReadinessStatus,
  SystemRequirementPriority
} from './SystemRequirementTypes';
import { SystemRequirementValidator } from './SystemRequirementValidator';
import { RequirementImpactEngine } from './RequirementImpactEngine';
import { EngineeringRequirement } from '../EngineeringRequirementTypes';
import { TraceabilityArtifact, TraceabilityEdge } from '../TraceabilityTypes';

export class SystemRequirementManager {
  private readonly requirements: Map<string, SystemRequirement> = new Map();
  private readonly revisionHistory: Map<string, SystemRequirement[]> = new Map();

  constructor(initialRequirements?: readonly SystemRequirement[]) {
    if (initialRequirements && initialRequirements.length > 0) {
      this.loadRequirements(initialRequirements);
    }
  }

  /**
   * Loads and validates a collection of system requirements.
   */
  public loadRequirements(requirements: readonly SystemRequirement[]): void {
    const validated = SystemRequirementValidator.validateCollection(requirements);
    for (const req of validated) {
      this.requirements.set(req.requirementId, req);
      const history = this.revisionHistory.get(req.requirementId) || [];
      if (!history.some(h => String(h.revision) === String(req.revision))) {
        history.push(req);
      }
      this.revisionHistory.set(req.requirementId, history);
    }
  }

  /**
   * Retrieves a requirement by ID.
   */
  public getRequirement(requirementId: string): SystemRequirement | undefined {
    return this.requirements.get(requirementId);
  }

  /**
   * Retrieves all registered requirements.
   */
  public getAllRequirements(): readonly SystemRequirement[] {
    return Array.from(this.requirements.values());
  }

  /**
   * Retrieves all requirements of a specific category.
   */
  public getRequirementsByCategory(category: string): readonly SystemRequirement[] {
    return Array.from(this.requirements.values()).filter(r => r.category === category);
  }

  /**
   * Retrieves all requirements with CRITICAL priority.
   */
  public getCriticalRequirements(): readonly SystemRequirement[] {
    return Array.from(this.requirements.values()).filter(r => r.priority === 'CRITICAL');
  }

  /**
   * Registers a new SystemRequirement into the manager.
   */
  public addRequirement(candidate: SystemRequirement): SystemRequirement {
    const validated = SystemRequirementValidator.validate(candidate);

    if (this.requirements.has(validated.requirementId)) {
      throw new SystemRequirementValidationError(
        `Requirement with ID '${validated.requirementId}' already exists. Use updateRequirement() to create a new revision.`,
        'DUPLICATE_REQUIREMENT_ID'
      );
    }

    this.requirements.set(validated.requirementId, validated);
    this.revisionHistory.set(validated.requirementId, [validated]);
    return validated;
  }

  /**
   * Updates an existing requirement by creating a NEW immutable revision.
   * Tracks change history and detects multi-disciplinary impact.
   */
  public updateRequirement(
    requirementId: string,
    updates: Partial<SystemRequirement>,
    reason: string = 'Design parameter update',
    author: string = 'SECP System Engineer'
  ): { updatedRequirement: SystemRequirement; impact: ReturnType<typeof RequirementImpactEngine.analyzeChange> } {
    const existing = this.requirements.get(requirementId);
    if (!existing) {
      throw new SystemRequirementValidationError(
        `Cannot update requirement '${requirementId}': requirement not found`,
        'REQUIREMENT_NOT_FOUND'
      );
    }

    // Determine new revision identifier
    const currentRevNum = typeof existing.revision === 'number' ? existing.revision : parseFloat(String(existing.revision).replace(/[^0-9.]/g, '')) || 1.0;
    const nextRevision = typeof existing.revision === 'number' ? currentRevNum + 1 : (currentRevNum + 1.0).toFixed(1);

    const changedFields = Object.keys(updates).filter(k => (updates as Record<string, unknown>)[k] !== (existing as Record<string, unknown>)[k]);

    const changeRecord: SystemRequirementChangeRecord = {
      revision: nextRevision,
      timestamp: new Date().toISOString(),
      changedFields,
      reason,
      author,
      previousValues: changedFields.reduce((acc, k) => {
        acc[k] = (existing as Record<string, unknown>)[k];
        return acc;
      }, {} as Record<string, unknown>)
    };

    const newHistory = [...(existing.changeHistory || []), changeRecord];

    const updatedCandidate: SystemRequirement = {
      ...existing,
      ...updates,
      requirementId: existing.requirementId, // ID cannot be changed
      caseId: existing.caseId,
      revision: nextRevision,
      updatedAt: new Date().toISOString(),
      changeHistory: newHistory
    };

    const validated = SystemRequirementValidator.validate(updatedCandidate);
    const impact = RequirementImpactEngine.analyzeChange(existing, validated);

    this.requirements.set(requirementId, validated);
    const history = this.revisionHistory.get(requirementId) || [];
    history.push(validated);
    this.revisionHistory.set(requirementId, history);

    return { updatedRequirement: validated, impact };
  }

  /**
   * Gets complete revision history for a given requirement ID.
   */
  public getRevisionHistory(requirementId: string): readonly SystemRequirement[] {
    return this.revisionHistory.get(requirementId) || [];
  }

  /**
   * Strict status transition gatekeeper.
   * Prevents premature VERIFIED without verification evidence,
   * and VALIDATED without validation evidence.
   */
  public transitionStatus(
    requirementId: string,
    targetStatus: SystemRequirementStatus,
    evidenceId?: string,
    isValidationEvidence: boolean = false
  ): SystemRequirement {
    const existing = this.requirements.get(requirementId);
    if (!existing) {
      throw new SystemRequirementValidationError(
        `Cannot transition status for requirement '${requirementId}': not found`,
        'REQUIREMENT_NOT_FOUND'
      );
    }

    // Gate rule 1: Transition to VERIFIED requires verified evidence
    if (targetStatus === 'VERIFIED') {
      const activeEvidence = evidenceId || existing.verificationEvidenceId;
      if (!activeEvidence || activeEvidence.trim() === '') {
        throw new SystemRequirementValidationError(
          `Cannot transition requirement '${requirementId}' to 'VERIFIED': Verification Evidence is required and cannot be null/empty.`,
          'VERIFICATION_EVIDENCE_REQUIRED'
        );
      }
    }

    // Gate rule 2: Transition to VALIDATED requires validation evidence
    if (targetStatus === 'VALIDATED') {
      const activeValEvidence = (isValidationEvidence && evidenceId) ? evidenceId : existing.validationEvidenceId;
      if (!activeValEvidence || activeValEvidence.trim() === '') {
        throw new SystemRequirementValidationError(
          `Cannot transition requirement '${requirementId}' to 'VALIDATED': Validation Evidence is required and cannot be null/empty.`,
          'VALIDATION_EVIDENCE_REQUIRED'
        );
      }
      if (existing.status !== 'VERIFIED' && existing.verificationStatus !== 'PASSED') {
        throw new SystemRequirementValidationError(
          `Cannot transition requirement '${requirementId}' to 'VALIDATED' before verification has passed.`,
          'VERIFICATION_PREREQUISITE_FAILED'
        );
      }
    }

    const updated: SystemRequirement = {
      ...existing,
      status: targetStatus,
      verificationStatus: targetStatus === 'VERIFIED' ? 'PASSED' : (targetStatus === 'FAILED' ? 'FAILED' : existing.verificationStatus),
      validationStatus: targetStatus === 'VALIDATED' ? 'PASSED' : existing.validationStatus,
      verificationEvidenceId: (targetStatus === 'VERIFIED' && evidenceId) ? evidenceId : existing.verificationEvidenceId,
      validationEvidenceId: (isValidationEvidence && evidenceId) ? evidenceId : existing.validationEvidenceId,
      updatedAt: new Date().toISOString()
    };

    this.requirements.set(requirementId, updated);
    return updated;
  }

  /**
   * Evaluates if a requirement is READY_FOR_VERIFICATION.
   */
  public evaluateReadiness(
    requirementId: string,
    providedInputs: readonly string[] = []
  ): ReadinessEvaluationResult {
    const req = this.requirements.get(requirementId);
    if (!req) {
      throw new SystemRequirementValidationError(
        `Requirement '${requirementId}' not found for readiness evaluation`,
        'REQUIREMENT_NOT_FOUND'
      );
    }

    const missingInputs: string[] = [];

    // Check 1: Definition completeness
    if (!req.acceptanceCriteria || req.acceptanceCriteria.trim() === '') {
      missingInputs.push('ACCEPTANCE_CRITERIA');
    }
    if (!req.verificationMethod) {
      missingInputs.push('VERIFICATION_METHOD');
    }

    // Check 2: Inputs required for specific verification methods
    const method = req.verificationMethod;
    const providedSet = new Set(providedInputs.map(i => i.toUpperCase()));

    if (method === 'SIMULATION' || method === 'ANALYSIS') {
      if (req.category === 'STRUCTURAL' || req.type === 'STRUCTURAL') {
        if (!providedSet.has('CAD_GEOMETRY') && !providedSet.has('GEOMETRY')) missingInputs.push('CAD_GEOMETRY');
        if (!providedSet.has('MATERIAL_PROPERTIES') && !providedSet.has('MATERIAL')) missingInputs.push('MATERIAL_PROPERTIES');
        if (!providedSet.has('LOAD_CASES') && !providedSet.has('LOADS')) missingInputs.push('LOAD_CASES');
        if (!providedSet.has('BOUNDARY_CONDITIONS')) missingInputs.push('BOUNDARY_CONDITIONS');
      } else if (req.category === 'AERODYNAMICS' || req.category === 'PROPULSION') {
        if (!providedSet.has('CAD_GEOMETRY') && !providedSet.has('GEOMETRY')) missingInputs.push('CAD_GEOMETRY');
        if (!providedSet.has('ATMOSPHERIC_CONDITIONS')) missingInputs.push('ATMOSPHERIC_CONDITIONS');
        if (!providedSet.has('FLOW_SOLVER_SETTINGS')) missingInputs.push('FLOW_SOLVER_SETTINGS');
      } else if (req.category === 'ENDURANCE' || req.category === 'POWER' || req.category === 'BATTERY') {
        if (!providedSet.has('BATTERY_CELL_MODEL')) missingInputs.push('BATTERY_CELL_MODEL');
        if (!providedSet.has('POWER_DRAW_PROFILE')) missingInputs.push('POWER_DRAW_PROFILE');
      }
    } else if (method === 'TEST' || method === 'MEASUREMENT') {
      if (!providedSet.has('PHYSICAL_PROTOTYPE') && !providedSet.has('TEST_SPECIMEN')) {
        missingInputs.push('PHYSICAL_PROTOTYPE');
      }
      if (!providedSet.has('CALIBRATED_INSTRUMENTATION')) {
        missingInputs.push('CALIBRATED_INSTRUMENTATION');
      }
    }

    const isReady = missingInputs.length === 0;
    const readinessStatus: ExecutionReadinessStatus = isReady ? 'READY_FOR_VERIFICATION' : 'NOT_READY';

    return {
      requirementId,
      readinessStatus,
      isReady,
      missingInputs,
      reason: isReady
        ? 'Requirement has complete specification, unambiguous acceptance criteria, and all necessary multidisciplinary inputs.'
        : `Verification cannot proceed. Missing prerequisites: ${missingInputs.join(', ')}`
    };
  }

  /**
   * Computes requirement verification coverage and gate readiness.
   */
  public computeCoverage(): RequirementCoverageReport {
    const all = Array.from(this.requirements.values());
    const totalRequirements = all.length;

    const categoryBreakdown: Record<string, number> = {};
    const priorityBreakdown: Record<SystemRequirementPriority, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0
    };
    const statusBreakdown: Record<SystemRequirementStatus, number> = {
      DRAFT: 0,
      DEFINED: 0,
      IMPLEMENTED: 0,
      VERIFIABLE: 0,
      VERIFIED: 0,
      VALIDATED: 0,
      FAILED: 0,
      INCONCLUSIVE: 0
    };

    let withVerificationPathCount = 0;
    let withValidationPathCount = 0;
    let verifiedCount = 0;
    let validatedCount = 0;
    let criticalCount = 0;
    let criticalVerifiedCount = 0;
    const criticalUnverifiedIds: string[] = [];

    for (const req of all) {
      // Category count
      categoryBreakdown[req.category] = (categoryBreakdown[req.category] || 0) + 1;

      // Priority count
      priorityBreakdown[req.priority] = (priorityBreakdown[req.priority] || 0) + 1;

      // Status count
      statusBreakdown[req.status] = (statusBreakdown[req.status] || 0) + 1;

      if (req.verificationMethod) {
        withVerificationPathCount++;
      }
      if (req.validationMethod) {
        withValidationPathCount++;
      }

      if (req.status === 'VERIFIED' || req.verificationStatus === 'PASSED') {
        verifiedCount++;
      }
      if (req.status === 'VALIDATED' || req.validationStatus === 'PASSED') {
        validatedCount++;
      }

      if (req.priority === 'CRITICAL') {
        criticalCount++;
        if (req.status === 'VERIFIED' || req.status === 'VALIDATED' || req.verificationStatus === 'PASSED') {
          criticalVerifiedCount++;
        } else {
          criticalUnverifiedIds.push(req.requirementId);
        }
      }
    }

    const coveragePercentage = totalRequirements > 0
      ? Math.round((withVerificationPathCount / totalRequirements) * 1000) / 10
      : 0;

    // Gate Block check: any unverified CRITICAL requirement blocks gate
    const isGateBlocked = criticalUnverifiedIds.length > 0 || statusBreakdown['FAILED'] > 0;
    let gateBlockReason: string | undefined;

    if (criticalUnverifiedIds.length > 0) {
      gateBlockReason = `Gate blocked: ${criticalUnverifiedIds.length} CRITICAL requirement(s) are unverified: ${criticalUnverifiedIds.join(', ')}`;
    } else if (statusBreakdown['FAILED'] > 0) {
      gateBlockReason = `Gate blocked: ${statusBreakdown['FAILED']} requirement(s) in FAILED status`;
    }

    return {
      totalRequirements,
      categoryBreakdown,
      priorityBreakdown,
      statusBreakdown,
      withVerificationPathCount,
      withValidationPathCount,
      verifiedCount,
      validatedCount,
      criticalCount,
      criticalVerifiedCount,
      criticalUnverifiedIds,
      coveragePercentage,
      isGateBlocked,
      gateBlockReason
    };
  }

  /**
   * Converts all registered SystemRequirement items to EPC-002 EngineeringRequirement items.
   */
  public toEPC002Requirements(): readonly EngineeringRequirement[] {
    return Array.from(this.requirements.values()).map(req => {
      // Create canonical tolerance
      const tolerance = req.tolerance || {
        type: (req.minimumValue !== undefined && req.maximumValue !== undefined)
          ? 'BOUNDS'
          : (req.maximumValue !== undefined ? 'BOUNDS' : 'EXACT'),
        lowerBound: req.minimumValue,
        upperBound: req.maximumValue,
        nominalValue: req.targetValue ?? req.value
      };

      // Map validationMethod safely to EPC-002
      let valMethod = req.validationMethod as any;
      if (!valMethod || valMethod === 'SIMULATION_VALIDATION') {
        valMethod = 'SIMULATION_CORRELATION';
      }

      return {
        requirementId: req.requirementId,
        description: req.description,
        parameter: req.parameter || req.title,
        unit: req.unit || 'dimensionless',
        tolerance,
        priority: req.priority,
        verificationMethod: req.verificationMethod,
        validationMethod: valMethod,
        category: req.category,
        revision: String(req.revision),
        metadata: {
          title: req.title,
          type: req.type,
          acceptanceCriteria: req.acceptanceCriteria,
          status: req.status,
          caseId: req.caseId,
          domain: req.domain,
          source: req.source,
          derivedFromMissionId: req.derivedFromMissionId
        }
      };
    });
  }

  /**
   * Generates EPC-003 Traceability Artifacts and Edges for requirements.
   */
  public toTraceabilityGraph(): {
    artifacts: readonly TraceabilityArtifact[];
    edges: readonly TraceabilityEdge[];
  } {
    const artifacts: TraceabilityArtifact[] = [];
    const edges: TraceabilityEdge[] = [];

    for (const req of this.requirements.values()) {
      // 1. Requirement Artifact
      artifacts.push({
        artifactId: req.requirementId,
        type: 'REQUIREMENT',
        name: req.title,
        description: req.description,
        category: req.category,
        revision: String(req.revision),
        metadata: {
          priority: req.priority,
          verificationMethod: req.verificationMethod,
          derivedFromMissionId: req.derivedFromMissionId
        }
      });

      // 2. Link from Mission if available
      if (req.derivedFromMissionId) {
        edges.push({
          edgeId: `EDGE-MIS-${req.derivedFromMissionId}-${req.requirementId}`,
          sourceId: req.derivedFromMissionId,
          sourceType: 'REQUIREMENT',
          targetId: req.requirementId,
          targetType: 'REQUIREMENT',
          relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE' as any,
          metadata: { lineage: 'MISSION_TO_SYSTEM_REQUIREMENT' }
        });
      }
    }

    return { artifacts, edges };
  }
}
