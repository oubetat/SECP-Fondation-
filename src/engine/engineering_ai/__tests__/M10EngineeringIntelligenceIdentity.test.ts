import { describe, it, expect, beforeEach } from 'vitest';
import { EngineeringAIRuntime } from '../EngineeringAIRuntime';
import { EngineeringAIModelRegistry } from '../EngineeringAIModelRegistry';
import { EngineeringAIContextEngine } from '../EngineeringAIContextEngine';
import { IndependentAIVerifier } from '../IndependentAIVerifier';
import { CanonicalAISerializer } from '../CanonicalAISerializer';
import { TwinEvidenceGraphEngine } from '../../twin_evidence/TwinEvidenceGraphEngine';
import { EngineeringAIModel, EngineeringAIContext, AIInferenceRecord } from '../types';

describe('M10.2 — Model Identity, Context Binding & Inference Provenance Hardening Suite', () => {
  let registry: EngineeringAIModelRegistry;
  let modelA: EngineeringAIModel;
  let modelB: EngineeringAIModel;
  let ctxBase: EngineeringAIContext;
  let twinGraph: TwinEvidenceGraphEngine;

  const objectId = 'OBJ-M10-AERO-002';
  const validInputs = { force: 25000, area: 350 };
  const validUnits = { force: 'N', area: 'mm2' };

  beforeEach(() => {
    registry = new EngineeringAIModelRegistry();

    modelA = {
      modelId: 'SURROGATE-WING-STRESS',
      modelName: 'Aero Wing Stress Predictor',
      modelType: 'SURROGATE_MODEL',
      version: '1.0.0',
      domain: 'AEROSPACE',
      architecture: 'MLP_DENSE_3',
      trainingDatasetId: 'DS-AERO-2026',
      featureSchemaId: 'FEAT-AERO-V1',
      status: 'QUALIFIED',
      configuration: { hiddenLayers: [64, 32], activation: 'relu' },
      modelBinaryHash: 'BIN-AERO-SHA256-AAAA',
      weights: { force: 0.04, area: -0.02 },
      inputContract: {
        schemaId: 'SCH-IN-01',
        units: { force: 'N', area: 'mm2' },
        dimensions: { force: [1], area: [1] },
        ranges: [
          { field: 'force', min: 0, max: 100000, unit: 'N' },
          { field: 'area', min: 1, max: 5000, unit: 'mm2' }
        ],
        requiredFields: ['force', 'area'],
        optionalFields: [],
        coordinateSystem: 'CARTESIAN',
        referenceFrame: 'GLOBAL',
        validityRules: []
      },
      outputContract: {
        outputType: 'STRESS',
        unit: 'MPa',
        validRange: [0, 2000],
        supportUncertainty: true,
        limitations: []
      },
      parameterHash: 'PARAM-HASH-A',
      modelHash: '',
      createdAt: '2026-08-20T00:00:00Z'
    };
    modelA.modelHash = CanonicalAISerializer.computeModelHash(modelA);
    modelA = registry.register(modelA);
    registry.activate(modelA.modelId, modelA.version);

    modelB = {
      ...modelA,
      modelId: 'SURROGATE-FUSELAGE-FATIGUE',
      modelName: 'Fuselage Fatigue Predictor',
      status: 'QUALIFIED',
      modelHash: '',
      weights: { force: 0.015, area: -0.005 }
    };
    modelB.modelHash = CanonicalAISerializer.computeModelHash(modelB);
    modelB = registry.register(modelB);
    registry.activate(modelB.modelId, modelB.version);

    ctxBase = EngineeringAIContextEngine.createContext('CTX-M10-BASE', {
      geometryState: { length: 1500, span: 450, geometryHash: 'GEOM-HASH-ALPHA-01' },
      materialState: { materialId: 'AL-7075-T6', yieldMpa: 503, density: 2810 },
      physicsState: {
        boundaryConditions: 'CANTILEVER_FIXED',
        operatingTempC: 22,
        loads: { gustFactor: 1.25 }
      },
      configurationState: {
        revisionId: 'REV-R1-CANONICAL',
        canonicalRevisionHash: 'REV-HASH-100-ALPHA',
        objectId,
        crossDomainDependencies: { roboticsArmHandoffHash: 'ROBOT-HANDOFF-101' }
      },
      evidenceSnapshotHash: 'EVID-SNAP-001'
    });

    twinGraph = new TwinEvidenceGraphEngine(`TWIN-${objectId}`);
  });

  // =========================================================================
  // LAYER 1: MODEL IDENTITY & SUBSTITUTION DEFENSE (M10.2-01 to M10.2-06)
  // =========================================================================

  it('M10.2-01: Changing model weights causes identity mismatch', () => {
    const alteredModel: EngineeringAIModel = {
      ...modelA,
      weights: { force: 0.04005, area: -0.02 } // altered weight
    };
    const hashOriginal = CanonicalAISerializer.computeModelHash(modelA);
    const hashAltered = CanonicalAISerializer.computeModelHash(alteredModel);

    expect(hashOriginal).not.toBe(hashAltered);

    const inference = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits
    });

    const verifyAltered = IndependentAIVerifier.verifyInference(
      inference,
      alteredModel,
      ctxBase,
      validInputs,
      validUnits
    );

    expect(verifyAltered.verdict).toBe('MODEL_INTEGRITY_FAILURE');
  });

  it('M10.2-02: Changing model configuration causes identity mismatch when configuration is engineering-significant', () => {
    const configAlteredModel: EngineeringAIModel = {
      ...modelA,
      configuration: { hiddenLayers: [128, 64], activation: 'gelu' } // changed hyperparams
    };
    const hashOriginal = CanonicalAISerializer.computeModelHash(modelA);
    const hashAltered = CanonicalAISerializer.computeModelHash(configAlteredModel);

    expect(hashOriginal).not.toBe(hashAltered);

    const inference = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits
    });

    const verifyAltered = IndependentAIVerifier.verifyInference(
      inference,
      configAlteredModel,
      ctxBase,
      validInputs,
      validUnits
    );

    expect(verifyAltered.verdict).toBe('MODEL_INTEGRITY_FAILURE');
  });

  it('M10.2-03: Changing model binary causes identity mismatch', () => {
    const binaryAlteredModel: EngineeringAIModel = {
      ...modelA,
      modelBinaryHash: 'BIN-AERO-SHA256-TAMPERED-ZZZZ'
    };
    const hashOriginal = CanonicalAISerializer.computeModelHash(modelA);
    const hashAltered = CanonicalAISerializer.computeModelHash(binaryAlteredModel);

    expect(hashOriginal).not.toBe(hashAltered);
  });

  it('M10.2-04: Replacing a registered model with another model under the same logical model ID is rejected', () => {
    const candidateReplacement: EngineeringAIModel = {
      ...modelA,
      weights: { force: 0.99, area: 0.05 }
    };
    // Cannot register under same ID and version
    expect(() => registry.register(candidateReplacement)).toThrow();

    const substitutionCheck = registry.detectSubstitution(modelA.modelId, modelA.version, candidateReplacement);
    expect(substitutionCheck.isSubstituted).toBe(true);
    expect(substitutionCheck.reason).toContain('MODEL_ARTIFACT_SUBSTITUTION');
  });

  it('M10.2-05: Tampering with a stored model hash is detected', () => {
    const tamperedModel: EngineeringAIModel = {
      ...modelA,
      modelHash: 'FAKED00000000000000000000000000000000000000000000000000000000000'
    };
    const check = registry.verifyModelIntegrity(tamperedModel);
    expect(check.valid).toBe(false);
    expect(check.details).toContain('MODEL_HASH_MISMATCH');

    const checkVerifier = IndependentAIVerifier.verifyModelIdentity(tamperedModel);
    expect(checkVerifier.valid).toBe(false);
    expect(checkVerifier.details).toContain('MODEL_INTEGRITY_FAILURE');
  });

  it('M10.2-06: A result generated by Model A cannot be falsely attributed to Model B', () => {
    const inference = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits
    });

    const verifyOnModelB = IndependentAIVerifier.verifyInference(
      inference,
      modelB, // False attribution to Model B
      ctxBase,
      validInputs,
      validUnits
    );

    expect(verifyOnModelB.verdict).toBe('MODEL_INTEGRITY_FAILURE');
    expect(verifyOnModelB.details).toContain('MODEL_IDENTITY_MISMATCH');
  });

  // =========================================================================
  // LAYER 2: CONTEXT IDENTITY & CANONICALIZATION (M10.2-07 to M10.2-15)
  // =========================================================================

  it('M10.2-07: Canonical revision hash changed → stale context rejected', () => {
    const inference = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits
    });

    const ctxRevAdvanced = EngineeringAIContextEngine.createContext('CTX-M10-BASE', {
      geometryState: ctxBase.geometryState,
      materialState: ctxBase.materialState,
      physicsState: ctxBase.physicsState,
      configurationState: {
        ...ctxBase.configurationState,
        canonicalRevisionHash: 'REV-HASH-200-ADVANCED' // Revision changed
      }
    });

    expect(ctxBase.contextHash).not.toBe(ctxRevAdvanced.contextHash);

    const verify = IndependentAIVerifier.verifyInference(
      inference,
      modelA,
      ctxRevAdvanced,
      validInputs,
      validUnits
    );
    expect(verify.verdict).toBe('INVALID');
    expect(verify.details).toContain('CONTEXT_MISMATCH');
  });

  it('M10.2-08: Geometry hash changed → stale inference rejected', () => {
    const inference = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits
    });

    const ctxGeomMutated = EngineeringAIContextEngine.createContext('CTX-M10-BASE', {
      ...ctxBase,
      geometryState: { ...ctxBase.geometryState, geometryHash: 'GEOM-HASH-BETA-02' }
    });

    const verify = IndependentAIVerifier.verifyInference(
      inference,
      modelA,
      ctxGeomMutated,
      validInputs,
      validUnits
    );
    expect(verify.verdict).toBe('INVALID');
    expect(verify.details).toContain('CONTEXT_MISMATCH');
  });

  it('M10.2-09: Material property changed → context identity changes', () => {
    const ctxMaterialChanged = EngineeringAIContextEngine.createContext('CTX-M10-BASE', {
      ...ctxBase,
      materialState: { ...ctxBase.materialState, yieldMpa: 650 }
    });

    expect(ctxBase.contextHash).not.toBe(ctxMaterialChanged.contextHash);
  });

  it('M10.2-10: Boundary condition changed → context identity changes', () => {
    const ctxBcChanged = EngineeringAIContextEngine.createContext('CTX-M10-BASE', {
      ...ctxBase,
      physicsState: { ...ctxBase.physicsState, boundaryConditions: 'PINNED_ROLLER_SUPPORT' }
    });

    expect(ctxBase.contextHash).not.toBe(ctxBcChanged.contextHash);
  });

  it('M10.2-11: Operating condition changed → context identity changes', () => {
    const ctxOpChanged = EngineeringAIContextEngine.createContext('CTX-M10-BASE', {
      ...ctxBase,
      physicsState: { ...ctxBase.physicsState, operatingTempC: 85 }
    });

    expect(ctxBase.contextHash).not.toBe(ctxOpChanged.contextHash);
  });

  it('M10.2-12: Cross-domain dependency changed → context identity changes', () => {
    const ctxCrossDomainChanged = EngineeringAIContextEngine.createContext('CTX-M10-BASE', {
      ...ctxBase,
      configurationState: {
        ...ctxBase.configurationState,
        crossDomainDependencies: { roboticsArmHandoffHash: 'ROBOT-HANDOFF-202-MUTATED' }
      }
    });

    expect(ctxBase.contextHash).not.toBe(ctxCrossDomainChanged.contextHash);
  });

  it('M10.2-13: Context hash manually substituted → rejection', () => {
    const inference = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits
    });

    const tamperedInference: AIInferenceRecord = {
      ...inference,
      contextHash: 'BADCAFE000000000000000000000000000000000000000000000000000000000'
    };

    const verify = IndependentAIVerifier.verifyInference(
      tamperedInference,
      modelA,
      ctxBase,
      validInputs,
      validUnits
    );
    expect(verify.verdict).toBe('INVALID');
    expect(verify.details).toContain('CONTEXT_MISMATCH');
  });

  it('M10.2-14: Context fields reordered → identity remains invariant if engineering content is identical', () => {
    // Nested object key reordering
    const ctx1 = EngineeringAIContextEngine.createContext('CTX-SAME', {
      geometryState: { length: 1500, span: 450, features: { fillet: 10, chamfer: 5 } },
      materialState: { grade: 'Titanium', density: 4430 }
    });

    const ctx2 = EngineeringAIContextEngine.createContext('CTX-SAME', {
      geometryState: { span: 450, length: 1500, features: { chamfer: 5, fillet: 10 } },
      materialState: { density: 4430, grade: 'Titanium' }
    });

    expect(ctx1.contextHash).toBe(ctx2.contextHash);
  });

  it('M10.2-15: Non-engineering metadata changed → pure engineering identity remains invariant', () => {
    const ctxWithMeta1 = EngineeringAIContextEngine.createContext('CTX-META', {
      geometryState: { length: 1000 },
      materialState: { id: 'STEEL' },
      nonEngineeringMetadata: { theme: 'DARK_MODE', viewportZoom: 1.2, userSession: 'SESSION-A' }
    });

    const ctxWithMeta2 = EngineeringAIContextEngine.createContext('CTX-META', {
      geometryState: { length: 1000 },
      materialState: { id: 'STEEL' },
      nonEngineeringMetadata: { theme: 'LIGHT_MODE', viewportZoom: 3.5, userSession: 'SESSION-B' }
    });

    expect(ctxWithMeta1.contextHash).toBe(ctxWithMeta2.contextHash);
  });

  // =========================================================================
  // LAYER 3: INFERENCE EXECUTION IDENTITY & DRIFT MATRIX (M10.2-16 to M10.2-23)
  // =========================================================================

  it('M10.2-16: Same input, same model, same seed → identical result identity', () => {
    const run1 = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits,
      determinism: 'DETERMINISTIC',
      seed: 42
    });

    const run2 = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits,
      determinism: 'DETERMINISTIC',
      seed: 42
    });

    expect(run1.prediction).toBe(run2.prediction);
    expect(run1.outputHash).toBe(run2.outputHash);
    expect(run1.executionHash).toBe(run2.executionHash);
    expect(run1.resultDigest).toBe(run2.resultDigest);
  });

  it('M10.2-17: Different seed produces different execution identity', () => {
    const runSeed42 = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits,
      seed: 42
    });

    const runSeed999 = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits,
      seed: 999
    });

    expect(runSeed42.executionHash).not.toBe(runSeed999.executionHash);
  });

  it('M10.2-18: Model version change → identity mismatch', () => {
    const modelV2: EngineeringAIModel = {
      ...modelA,
      version: '2.0.0',
      modelHash: ''
    };
    modelV2.modelHash = CanonicalAISerializer.computeModelHash(modelV2);

    expect(modelA.modelHash).not.toBe(modelV2.modelHash);
  });

  it('M10.2-19: Weights change → execution identity mismatch', () => {
    const run = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits
    });

    const alteredModel: EngineeringAIModel = {
      ...modelA,
      weights: { force: 0.12, area: -0.05 }
    };
    alteredModel.modelHash = CanonicalAISerializer.computeModelHash(alteredModel);

    const recomputedExec = CanonicalAISerializer.computeExecutionHash(
      alteredModel.modelHash,
      run.contextHash,
      run.inputHash,
      run.outputHash,
      run.seed
    );

    expect(recomputedExec).not.toBe(run.executionHash);
  });

  it('M10.2-20: Configuration change → identity mismatch where significant', () => {
    const alteredConfigModel: EngineeringAIModel = {
      ...modelA,
      configuration: { hiddenLayers: [256, 128], dropout: 0.2 }
    };
    alteredConfigModel.modelHash = CanonicalAISerializer.computeModelHash(alteredConfigModel);

    expect(alteredConfigModel.modelHash).not.toBe(modelA.modelHash);
  });

  it('M10.2-21: Canonical revision change → old inference rejected', () => {
    const inferenceR1 = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits
    });

    const ctxR2 = EngineeringAIContextEngine.createContext('CTX-R2', {
      geometryState: ctxBase.geometryState,
      configurationState: { revisionId: 'REV-R2-NEXT', objectId }
    });

    const verify = IndependentAIVerifier.verifyInference(
      inferenceR1,
      modelA,
      ctxR2,
      validInputs,
      validUnits
    );
    expect(verify.verdict).toBe('INVALID');
    expect(verify.details).toContain('CONTEXT_MISMATCH');
  });

  it('M10.2-22: Engineering context change → old inference rejected', () => {
    const inferenceOriginal = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits
    });

    const ctxModifiedLoad = EngineeringAIContextEngine.createContext('CTX-M10-BASE', {
      ...ctxBase,
      physicsState: { ...ctxBase.physicsState, loads: { gustFactor: 3.5 } } // extreme load
    });

    const verify = IndependentAIVerifier.verifyInference(
      inferenceOriginal,
      modelA,
      ctxModifiedLoad,
      validInputs,
      validUnits
    );
    expect(verify.verdict).toBe('INVALID');
  });

  it('M10.2-23: Timestamp-only change → pure result identity remains stable', () => {
    const run1 = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits,
      seed: 100
    });

    // Simulate different occurrence invocation with delay
    const run2 = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits,
      seed: 100
    });

    // Occurrence IDs and timestamps differ
    expect(run1.occurrenceId).not.toBe(run2.occurrenceId);
    // But pure result identity is 100% stable
    expect(run1.outputHash).toBe(run2.outputHash);
    expect(run1.executionHash).toBe(run2.executionHash);
    expect(run1.resultDigest).toBe(run2.resultDigest);
    expect(run1.prediction).toBe(run2.prediction);
  });

  // =========================================================================
  // LAYER 4: INFERENCE PROVENANCE ATTACK MATRIX (M10.2-24 to M10.2-32)
  // =========================================================================

  it('M10.2-24: Remove model identity → provenance rejected', () => {
    const inference = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits
    });

    const strippedRecord: AIInferenceRecord = { ...inference, modelId: '' };
    const verify = IndependentAIVerifier.verifyInference(
      strippedRecord,
      modelA,
      ctxBase,
      validInputs,
      validUnits
    );
    expect(verify.verdict).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('M10.2-25: Remove revision identity → provenance rejected', () => {
    const inference = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits
    });

    const strippedRecord: AIInferenceRecord = { ...inference, modelVersion: '' };
    const verify = IndependentAIVerifier.verifyInference(
      strippedRecord,
      modelA,
      ctxBase,
      validInputs,
      validUnits
    );
    expect(verify.verdict).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('M10.2-26: Remove context identity → provenance rejected', () => {
    const inference = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits
    });

    const strippedRecord: AIInferenceRecord = { ...inference, contextHash: '' };
    const verify = IndependentAIVerifier.verifyInference(
      strippedRecord,
      modelA,
      ctxBase,
      validInputs,
      validUnits
    );
    expect(verify.verdict).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('M10.2-27: Replace execution identity → provenance mismatch', () => {
    const inference = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits
    });

    const forgedRecord: AIInferenceRecord = {
      ...inference,
      executionHash: 'FORGED-EXEC-HASH-000000000000000000000000000000000000000000000000'
    };

    const verify = IndependentAIVerifier.verifyInference(
      forgedRecord,
      modelA,
      ctxBase,
      validInputs,
      validUnits
    );
    expect(verify.verdict).toBe('REPRODUCIBILITY_FAILURE');
  });

  it('M10.2-28: Replace result digest → provenance mismatch', () => {
    const inference = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits
    });

    const forgedDigestRecord: AIInferenceRecord = {
      ...inference,
      resultDigest: 'FORGED-DIGEST-SHA256'
    };

    const verify = IndependentAIVerifier.verifyInference(
      forgedDigestRecord,
      modelA,
      ctxBase,
      validInputs,
      validUnits
    );
    expect(verify.verdict).toBe('INVALID');
    expect(verify.details).toContain('OUTPUT_HASH_MISMATCH');
  });

  it('M10.2-29: Attach inference from Revision R1 to Revision R2 → rejected', () => {
    const inferenceR1 = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase, // R1
      inputs: validInputs,
      units: validUnits
    });

    const ctxR2 = EngineeringAIContextEngine.createContext('CTX-R2', {
      geometryState: { length: 2000 },
      configurationState: { revisionId: 'REV-R2', objectId }
    });

    const verify = IndependentAIVerifier.verifyContextBinding(inferenceR1, ctxR2);
    expect(verify.valid).toBe(false);
    expect(verify.details).toContain('CONTEXT_MISMATCH');
  });

  it('M10.2-30: Attach inference from Model A to Model B → rejected', () => {
    const inferenceA = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits
    });

    const verify = IndependentAIVerifier.verifyInference(
      inferenceA,
      modelB, // Attempt to attach to Model B
      ctxBase,
      validInputs,
      validUnits
    );
    expect(verify.verdict).toBe('MODEL_INTEGRITY_FAILURE');
  });

  it('M10.2-31: Strip provenance metadata from a previously valid inference → downgrade/reject', () => {
    const inference = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits
    });

    expect(inference.provenanceRecord).toBeDefined();

    const tamperedProvenanceRecord: AIInferenceRecord = {
      ...inference,
      provenanceRecord: {
        ...inference.provenanceRecord!,
        modelId: 'TAMPERED-MODEL-ID'
      }
    };

    const check = IndependentAIVerifier.verifyProvenanceChain(
      tamperedProvenanceRecord,
      modelA,
      ctxBase
    );
    expect(check.valid).toBe(false);
    expect(check.details).toContain('PROVENANCE_RECORD_TAMPERED');
  });

  it('M10.2-32: Replay a valid inference against a modified context → rejected', () => {
    const originalInference = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits
    });

    const modifiedContext = EngineeringAIContextEngine.createContext('CTX-MOD', {
      ...ctxBase,
      physicsState: { ...ctxBase.physicsState, boundaryConditions: 'FREE_FREE' }
    });

    const verify = IndependentAIVerifier.verifyInference(
      originalInference,
      modelA,
      modifiedContext,
      validInputs,
      validUnits
    );
    expect(verify.verdict).toBe('INVALID');
    expect(verify.details).toContain('CONTEXT_MISMATCH');
  });

  // =========================================================================
  // POSITIVE VALIDATION SUITE (P1 to P7)
  // =========================================================================

  it('P1: Valid model → valid context → valid inference', () => {
    const inference = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits
    });

    expect(inference.status).toBe('SUCCESS');
    expect(inference.prediction).toBeGreaterThan(0);
    expect(inference.executionHash.length).toBe(64);
  });

  it('P2: Same deterministic inputs → reproducible result identity', () => {
    const run1 = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits,
      seed: 777
    });

    const run2 = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits,
      seed: 777
    });

    expect(run1.prediction).toBe(run2.prediction);
    expect(run1.outputHash).toBe(run2.outputHash);
    expect(run1.executionHash).toBe(run2.executionHash);
  });

  it('P3: Valid inference → valid provenance chain', () => {
    const inference = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits
    });

    const chain = IndependentAIVerifier.verifyProvenanceChain(inference, modelA, ctxBase);
    expect(chain.valid).toBe(true);
    expect(chain.details).toBe('PROVENANCE_CHAIN_VERIFIED');
  });

  it('P4: Valid inference → valid evidence in Twin Evidence Graph', () => {
    const inference = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits,
      evidenceEngine: twinGraph
    });

    const inferenceNode = twinGraph.graph.nodes.get(`AI-INF-${inference.inferenceId}`);
    expect(inferenceNode).toBeDefined();
    expect(inferenceNode?.nodeType).toBe('PREDICTION');

    const edges = Array.from(twinGraph.graph.edges.values());
    const derivedEdge = edges.find((e) => e.fromNodeId === inferenceNode?.nodeId && e.edgeType === 'DERIVED_FROM');
    expect(derivedEdge).toBeDefined();
  });

  it('P5: Valid inference → correct Truth Thread binding', () => {
    const inference = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits
    });

    const verification = IndependentAIVerifier.verifyInference(
      inference,
      modelA,
      ctxBase,
      validInputs,
      validUnits
    );

    expect(verification.verdict).toBe('VERIFIED');
    expect(verification.recomputedModelHash).toBe(modelA.modelHash);
    expect(verification.recomputedContextHash).toBe(ctxBase.contextHash);
  });

  it('P6: Persist → rehydrate → identity remains valid', () => {
    const inference = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxBase,
      inputs: validInputs,
      units: validUnits
    });

    // Simulate serialization & rehydration
    const serializedJson = JSON.stringify(inference);
    const rehydratedRecord: AIInferenceRecord = JSON.parse(serializedJson);

    const verifyRehydrated = IndependentAIVerifier.verifyInference(
      rehydratedRecord,
      modelA,
      ctxBase,
      validInputs,
      validUnits
    );

    expect(verifyRehydrated.verdict).toBe('VERIFIED');
    expect(verifyRehydrated.recomputedExecutionHash).toBe(inference.executionHash);
  });

  it('P7: Cross-domain valid dependency → valid AI inference', () => {
    const ctxCrossDomainValid = EngineeringAIContextEngine.createContext('CTX-XD-01', {
      geometryState: { length: 1200 },
      materialState: { id: 'COMPOSITE-CFRP' },
      configurationState: {
        revisionId: 'REV-XD-01',
        crossDomainDependencies: { roboticsPayloadHandoff: 'PAYLOAD-5KG-VERIFIED' }
      }
    });

    const inference = EngineeringAIRuntime.executeInference({
      model: modelA,
      context: ctxCrossDomainValid,
      inputs: validInputs,
      units: validUnits
    });

    expect(inference.status).toBe('SUCCESS');
    expect(inference.contextHash).toBe(ctxCrossDomainValid.contextHash);
  });
});
