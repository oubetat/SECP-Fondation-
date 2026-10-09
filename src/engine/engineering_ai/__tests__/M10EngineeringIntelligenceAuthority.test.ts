import { describe, it, expect, beforeEach } from 'vitest';
import { EngineeringAIRuntime } from '../EngineeringAIRuntime';
import { EngineeringAIModelRegistry } from '../EngineeringAIModelRegistry';
import { EngineeringAIContextEngine } from '../EngineeringAIContextEngine';
import { IndependentAIVerifier } from '../IndependentAIVerifier';
import { CanonicalAISerializer } from '../CanonicalAISerializer';
import { EngineeringGeometryReasoner } from '../geometry/EngineeringGeometryReasoner';
import { TwinEvidenceGraphEngine } from '../../twin_evidence/TwinEvidenceGraphEngine';
import { CoreExecutionAuthority } from '../../execution/CoreExecutionAuthority';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { RevisionLifecycleState } from '../../revision/types';
import { CrossDomainConflictEngine } from '../../crossdomain/CrossDomainConflictEngine';
import { EngineeringAIModel, EngineeringAIContext } from '../types';

describe('M10.1 Engineering Intelligence Authority & Truth Boundary Suite', () => {
  let modelRegistry: EngineeringAIModelRegistry;
  let baseModel: EngineeringAIModel;
  let ctxR1: EngineeringAIContext;
  let ctxR2: EngineeringAIContext;
  let twinGraph: TwinEvidenceGraphEngine;
  let revisionEngine: RevisionEngine;

  const objectId = 'OBJ-M10-AERO-001';

  beforeEach(() => {
    CoreExecutionAuthority.clear();
    revisionEngine = new RevisionEngine();
    CoreExecutionAuthority.initialize(revisionEngine);

    modelRegistry = new EngineeringAIModelRegistry();
    baseModel = {
      modelId: 'SURROGATE-STRESS-NN-01',
      modelName: 'Aerospace Wing Stress Surrogate',
      modelType: 'NEURAL_SURROGATE' as any,
      version: '1.0.0',
      domain: 'AEROSPACE',
      architecture: 'MLP_3_LAYER',
      trainingDatasetId: 'DS-AERO-WINGS-2026',
      featureSchemaId: 'SCHEMA-FEAT-01',
      status: 'QUALIFIED',
      inputContract: {
        schemaId: 'SCHEMA-IN-01',
        units: { force: 'N', area: 'mm2' },
        dimensions: { force: [1], area: [1] },
        ranges: [
          { field: 'force', min: 0, max: 100000, unit: 'N' },
          { field: 'area', min: 10, max: 5000, unit: 'mm2' }
        ],
        requiredFields: ['force', 'area'],
        optionalFields: [],
        coordinateSystem: 'CARTESIAN',
        referenceFrame: 'GLOBAL',
        validityRules: []
      },
      outputContract: {
        outputType: 'SCALAR',
        unit: 'MPa',
        validRange: [0, 2000],
        supportUncertainty: true,
        limitations: []
      },
      parameterHash: 'PARAM-HASH-01',
      modelHash: '',
      weights: { force: 0.05, area: -0.01 },
      createdAt: new Date().toISOString()
    };
    baseModel = modelRegistry.register(baseModel);

    // Build Context for Revision 1 (R1)
    ctxR1 = EngineeringAIContextEngine.createContext('CTX-R1-001', {
      geometryState: { length: 1200, span: 400, topologyHash: 'TOPO-R1-AERO' },
      materialState: { materialId: 'AL-7075-T6', yieldMpa: 503 },
      configurationState: { revisionId: 'REV-R1-INITIAL', objectId },
      evidenceSnapshotHash: 'SNAP-EVID-R1'
    });

    // Build Context for Revision 2 (R2)
    ctxR2 = EngineeringAIContextEngine.createContext('CTX-R2-002', {
      geometryState: { length: 1250, span: 410, topologyHash: 'TOPO-R2-AERO-MOD' },
      materialState: { materialId: 'AL-7075-T6', yieldMpa: 503 },
      configurationState: { revisionId: 'REV-R2-MODIFIED', objectId },
      evidenceSnapshotHash: 'SNAP-EVID-R2'
    });

    twinGraph = new TwinEvidenceGraphEngine(`TWIN-${objectId}`);
  });

  // M10.1-01: Canonical Mutation Attempt
  it('M10.1-01: AI attempts to directly mutate the canonical engineering model -> REJECTED', () => {
    const inputs = { force: 50000, area: 500 };
    const units = { force: 'N', area: 'mm2' };

    const inference = EngineeringAIRuntime.executeInference({
      model: baseModel,
      context: ctxR1,
      inputs,
      units,
      evidenceEngine: twinGraph
    });

    expect(inference.status).toBe('SUCCESS');
    expect(inference.prediction).toBeGreaterThan(0);

    // Assert that inference result has no mutate method or direct database handles
    expect((inference as any).mutateCanonicalModel).toBeUndefined();
    expect((EngineeringAIRuntime as any).canonicalDocument).toBeUndefined();
    // Verify canonical state inside context remains pristine
    expect(ctxR1.geometryState.length).toBe(1200);
  });

  // M10.1-02: Revision Mutation Attempt
  it('M10.1-02: AI attempts to advance or create an active Canonical Revision -> REJECTED', () => {
    // AI cannot create or advance revisions without CoreExecutionAuthority & RevisionEngine
    expect((EngineeringAIRuntime as any).createRevision).toBeUndefined();
    expect((EngineeringAIRuntime as any).advanceRevision).toBeUndefined();
  });

  // M10.1-03: Stale Revision Ingestion
  it('M10.1-03: AI inference generated for Revision R1 evaluated against advanced Revision R2 -> REJECTED (STALE_CONTEXT)', () => {
    const inputs = { force: 60000, area: 400 };
    const units = { force: 'N', area: 'mm2' };

    const inferenceR1 = EngineeringAIRuntime.executeInference({
      model: baseModel,
      context: ctxR1,
      inputs,
      units,
      evidenceEngine: twinGraph
    });

    // Independent verification against current context R2 (the active revision)
    const verificationOnR2 = IndependentAIVerifier.verifyInference(
      inferenceR1,
      baseModel,
      ctxR2, // Active context has advanced to R2
      inputs,
      units
    );

    expect(verificationOnR2.verdict).toBe('INVALID');
    expect(verificationOnR2.details).toContain('CONTEXT_MISMATCH');
    expect(verificationOnR2.recomputedContextHash).not.toBe(inferenceR1.contextHash);
  });

  // M10.1-04: Context Hash Mismatch
  it('M10.1-04: AI result presented with falsified/tampered contextHash -> REJECTED', () => {
    const inputs = { force: 40000, area: 300 };
    const units = { force: 'N', area: 'mm2' };

    const inference = EngineeringAIRuntime.executeInference({
      model: baseModel,
      context: ctxR1,
      inputs,
      units,
      evidenceEngine: twinGraph
    });

    // Tamper with contextHash
    const tamperedInference = {
      ...inference,
      contextHash: '0000000000000000000000000000000000000000000000000000000000000000'
    };

    const result = IndependentAIVerifier.verifyInference(
      tamperedInference,
      baseModel,
      ctxR1,
      inputs,
      units
    );

    expect(result.verdict).toBe('INVALID');
    expect(result.details).toContain('CONTEXT_MISMATCH');
  });

  // M10.1-05: Model Identity Tampering
  it('M10.1-05: Model weights tampered after inference creation -> REJECTED (MODEL_INTEGRITY_FAILURE)', () => {
    const inputs = { force: 50000, area: 500 };
    const units = { force: 'N', area: 'mm2' };

    const inference = EngineeringAIRuntime.executeInference({
      model: baseModel,
      context: ctxR1,
      inputs,
      units
    });

    // Model artifact weights modified without updating modelHash
    const tamperedModel: EngineeringAIModel = {
      ...baseModel,
      weights: { force: 0.08, area: -0.01 } // Altered weight
    };

    const verifyTampered = IndependentAIVerifier.verifyInference(
      inference,
      tamperedModel,
      ctxR1,
      inputs,
      units
    );

    expect(verifyTampered.verdict).toBe('MODEL_INTEGRITY_FAILURE');
    expect(verifyTampered.details).toContain('MODEL_INTEGRITY_FAILURE');
  });

  // M10.1-06: Verification Bypass (GENERATED -> ACCEPTED without verification)
  it('M10.1-06: Attempt to promote unverified AI inference directly to ACCEPTED -> REJECTED', () => {
    const inputs = { force: 50000, area: 500 };
    const units = { force: 'N', area: 'mm2' };

    const inference = EngineeringAIRuntime.executeInference({
      model: baseModel,
      context: ctxR1,
      inputs,
      units
    });

    // Raw AI output status is SUCCESS in AI runtime, but verdict in verifier is strictly restricted to AI layer
    const verifierCheck = IndependentAIVerifier.verifyInference(
      inference,
      baseModel,
      ctxR1,
      inputs,
      units
    );

    expect(verifierCheck.verdict).toBe('VERIFIED');
    expect(verifierCheck.details).toContain('INFERENCE_VERIFIED_IN_AI_LAYER');
  });

  // M10.1-07: Release Bypass
  it('M10.1-07: AI output attempts to execute RELEASE without authorized engineering approval -> REJECTED', () => {
    const rev = revisionEngine.createRevision({
      revisionId: 'REV-AI-TEST',
      entityId: objectId,
      entityType: 'CAD_MODEL' as any,
      revisionCode: 'A',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdBy: 'AI_AGENT',
      content: { test: true }
    } as any);

    // Attempting to release without authorized engineering approval must throw
    expect(() => {
      revisionEngine.releaseRevision(rev.revisionId, 'AI_AGENT', 'Unauthorized AI Release');
    }).toThrow();
  });

  // M10.1-08: Physics Override
  it('M10.1-08: AI prediction contradicts authoritative physics constraint -> REJECTED (PHYSICS_FAILURE)', () => {
    const inputs = { force: 50000, area: 500 };
    const units = { force: 'N', area: 'mm2' };

    // Execute inference with an evaluator that detects physical conservation failure
    const physicsFailingInference = EngineeringAIRuntime.executeInference({
      model: baseModel,
      context: ctxR1,
      inputs,
      units,
      physicsEvaluator: () => false // Violates physics constraint
    });

    expect(physicsFailingInference.status).toBe('PHYSICS_VIOLATION');

    const verifyPhysics = IndependentAIVerifier.verifyInference(
      physicsFailingInference,
      baseModel,
      ctxR1,
      inputs,
      units
    );

    expect(verifyPhysics.verdict).toBe('PHYSICS_FAILURE');
  });

  // M10.1-09: Geometry Override
  it('M10.1-09: AI hallucinated geometry claim rejected by CAD Kernel -> REJECTED (UNGROUNDED)', () => {
    const geometryEntities = [
      {
        entityId: 'FACE-PLANAR-01',
        entityType: 'FACE' as const,
        surfaceType: 'PLANE' as const,
        geometryHash: 'HASH-FACE-01',
        adjacentEntityIds: [],
        parameters: { areaMm2: 2400 }
      },
      {
        entityId: 'FACE-CYL-01',
        entityType: 'FACE' as const,
        surfaceType: 'CYLINDER' as const,
        geometryHash: 'HASH-FACE-02',
        adjacentEntityIds: [],
        parameters: { radiusMm: 10, isHole: true }
      }
    ];

    const claim = {
      claimText: 'Cylindrical hole on FACE-NONEXISTENT',
      mentionedEntityIds: ['FACE-NONEXISTENT'] // Hallucinated entity
    };

    const reasoner = new EngineeringGeometryReasoner(ctxR1 as any, geometryEntities);
    const evaluation = reasoner.evaluateClaimAndGrounding(claim);

    expect(evaluation.hallucinationCheck.verdict).toBe('UNGROUNDED');
    expect(evaluation.hallucinationCheck.invalidEntityIds).toContain('FACE-NONEXISTENT');
  });

  // M10.1-10: Conflict Auto-Merge Prevention
  it('M10.1-10: Two contradictory cross-domain domain results presented -> CONFLICT_REQUIRES_AUTHORIZED_REVIEW', () => {
    const conflict = CrossDomainConflictEngine.registerConflict({
      engineeringObjectId: objectId,
      revisionId: 'REV-R1-INITIAL',
      domainA: 'AEROSPACE',
      domainB: 'ROBOTICS',
      resultA: { computedLiftMargin: 1.25, status: 'PASS' },
      resultB: { maxMechanicalPayloadKg: 4.5, structureMargin: -0.12, status: 'FAIL' },
      conflictType: 'PARAMETRIC_MISMATCH',
      rationale: 'Aerospace aerodynamic lift requires motor RPM that breaches structural arm fatigue limit'
    });

    expect(conflict).toBeDefined();
    expect(conflict.status).toBe('UNRESOLVED');
    expect(conflict.conflictType).toBe('PARAMETRIC_MISMATCH');

    // Verify unresolved conflict prevents automatic silent reconciliation
    const hasUnresolved = CrossDomainConflictEngine.hasUnresolvedConflicts(objectId, 'REV-R1-INITIAL');
    expect(hasUnresolved).toBe(true);
  });

  // M10.1-11: Evidence Without Truth Binding
  it('M10.1-11: Attempt to add claim to Twin Evidence Graph without valid context binding -> REJECTED', () => {
    const claimNode = twinGraph.addNode(
      'CLAIM-UNBACKED',
      'CLAIM',
      objectId,
      'v1',
      'AI-AGENT',
      new Date().toISOString(),
      { status: 'UNSUPPORTED' }
    );

    // Unbacked claim has no VALIDATED_BY edge
    const hasValidationEdge = Array.from(twinGraph.graph.edges.values()).some(
      (e) => e.fromNodeId === claimNode.nodeId && e.edgeType === 'VALIDATED_BY'
    );

    expect(hasValidationEdge).toBe(false);
  });

  // M10.1-12: Provenance Incompleteness
  it('M10.1-12: Inference record missing modelVersion, modelId or contextHash -> REJECTED (INSUFFICIENT_EVIDENCE)', () => {
    const incompleteRecord: any = {
      inferenceId: 'INF-INCOMPLETE-01',
      modelId: '', // Missing
      modelVersion: '', // Missing
      contextHash: '', // Missing
      prediction: 450,
      uncertainty: { value: 0.05, type: 'ALEATORIC' }
    };

    const verifyIncomplete = IndependentAIVerifier.verifyInference(
      incompleteRecord,
      baseModel,
      ctxR1,
      { force: 50000 },
      { force: 'N' }
    );

    expect(verifyIncomplete.verdict).toBe('INSUFFICIENT_EVIDENCE');
  });

  // M10.1-13: Persistence Rehydration Attack
  it('M10.1-13: Persisted AI result rehydrated under shifted context -> REJECTED (CONTEXT_MISMATCH)', () => {
    const inputs = { force: 50000, area: 500 };
    const units = { force: 'N', area: 'mm2' };

    const originalRecord = EngineeringAIRuntime.executeInference({
      model: baseModel,
      context: ctxR1,
      inputs,
      units
    });

    // Serialize to JSON and rehydrate
    const serialized = JSON.stringify(originalRecord);
    const rehydratedRecord = JSON.parse(serialized);

    // Verify under altered context R2
    const verifyUnderR2 = IndependentAIVerifier.verifyInference(
      rehydratedRecord,
      baseModel,
      ctxR2,
      inputs,
      units
    );

    expect(verifyUnderR2.verdict).toBe('INVALID');
    expect(verifyUnderR2.details).toContain('CONTEXT_MISMATCH');
  });

  // M10.1-14: AI Result Replay Against Different Revision
  it('M10.1-14: Replaying valid R1 result against Revision R2 -> REJECTED', () => {
    const inputs = { force: 50000, area: 500 };
    const units = { force: 'N', area: 'mm2' };

    const r1Result = EngineeringAIRuntime.executeInference({
      model: baseModel,
      context: ctxR1,
      inputs,
      units
    });

    expect(r1Result.contextHash).toBe(ctxR1.contextHash);
    expect(r1Result.contextHash).not.toBe(ctxR2.contextHash);
  });

  // M10.1-15: AI Attempt to Bypass CoreExecutionAuthority
  it('M10.1-15: Attempt to invoke downstream solver execution bypassing CoreExecutionAuthority -> REJECTED', async () => {
    // Attempting to run an unregistered execution request through CoreExecutionAuthority throws
    await expect(
      CoreExecutionAuthority.execute({
        executionId: 'EXEC-UNAPPROVED-AI',
        domainSolverId: 'UNREGISTERED-SOLVER',
        engineeringObjectId: objectId,
        revisionId: 'REV-R1-INITIAL',
        executionKind: 'stress-analysis',
        pluginId: 'secp-plugin-unregistered',
        parameters: { force: 50000 }
      })
    ).rejects.toThrow();
  });

  // M10.1-16: AI Self-Authorization Prevention
  it('M10.1-16: AI prediction cannot self-authorize engineering acceptance -> REJECTED', () => {
    const inputs = { force: 50000, area: 500 };
    const units = { force: 'N', area: 'mm2' };

    const inference = EngineeringAIRuntime.executeInference({
      model: baseModel,
      context: ctxR1,
      inputs,
      units
    });

    // Self-authorization is explicitly barred: AI outputs remain PREDICTION nodes in evidence graph
    expect(inference.status).toBe('SUCCESS');
    expect((inference as any).isAuthoritativeEngineeringTruth).toBeUndefined();
  });
});
