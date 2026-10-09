import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { IndependentAIVerifier } from '../IndependentAIVerifier';
import { IndependentVerificationSerializer } from '../verification/IndependentVerificationSerializer';
import { IndependentPhysicsValidator } from '../verification/IndependentPhysicsValidator';
import { IndependentDomainValidator } from '../verification/IndependentDomainValidator';
import { CanonicalAISerializer } from '../CanonicalAISerializer';
import { EngineeringAIRuntime } from '../EngineeringAIRuntime';
import { EngineeringAIModelRegistry } from '../EngineeringAIModelRegistry';
import { EngineeringAIContextEngine } from '../EngineeringAIContextEngine';
import { TwinEvidenceGraphEngine } from '../../twin_evidence/TwinEvidenceGraphEngine';
import { EngineeringAIModel, EngineeringAIContext, AIInferenceRecord } from '../types';

describe('M10.3 — Independent Verification Hardening & Dissimilarity Suite', () => {
  let modelRegistry: EngineeringAIModelRegistry;
  let contextEngine: EngineeringAIContextEngine;
  let runtime: EngineeringAIRuntime;
  let evidenceEngine: TwinEvidenceGraphEngine;

  let baseModel: EngineeringAIModel;
  let baseContext: EngineeringAIContext;

  beforeEach(() => {
    modelRegistry = new EngineeringAIModelRegistry();
    contextEngine = new EngineeringAIContextEngine();
    runtime = new EngineeringAIRuntime('2.0.0-M10.3');
    evidenceEngine = new TwinEvidenceGraphEngine();

    const rawModel: Partial<EngineeringAIModel> = {
      modelId: 'SURROGATE-M10.3-AERO',
      modelName: 'Aerodynamic Wing Surrogate',
      modelType: 'SURROGATE',
      version: '1.0.0',
      architecture: 'MLP-RESNET-DISSIMILAR',
      trainingDatasetId: 'DATA-AERO-2026-Q1',
      weights: { chord: 1.25, span: 0.85, aoa: 2.15, reynolds: 0.0004 },
      configuration: { activation: 'gelu', layers: 4, precision: 'fp64' },
      inputContract: {
        schemaId: 'SCH-M10.3-AERO',
        units: { chord: 'm', span: 'm', aoa: 'deg', reynolds: 'unitless', temperatureKelvin: 'K' },
        dimensions: { chord: [1], span: [1] },
        ranges: [
          { field: 'chord', min: 0.1, max: 20.0, unit: 'm' },
          { field: 'span', min: 0.5, max: 80.0, unit: 'm' }
        ],
        requiredFields: ['chord', 'span'],
        optionalFields: ['aoa', 'reynolds', 'temperatureKelvin'],
        coordinateSystem: 'CARTESIAN',
        referenceFrame: 'GLOBAL',
        validityRules: []
      },
      outputContract: {
        outputType: 'AERODYNAMIC_LOAD',
        unit: 'kN',
        validRange: [0, 50000],
        supportUncertainty: true,
        limitations: []
      },
      status: 'QUALIFIED'
    };

    baseModel = modelRegistry.register(rawModel);

    baseContext = EngineeringAIContextEngine.createContext('CTX-M10.3-AERO', {
      geometryState: { chordLength: 2.5, wingspan: 14.0, airfoil: 'NACA0012' },
      materialState: { alloy: 'Al7075-T6', yieldStrengthMpa: 503 },
      physicsState: { machNumber: 0.65, altitudeM: 10000 },
      manufacturingState: { process: 'CNC_5AXIS_MILLING' },
      assemblyState: { rootRibJoint: 'BOLTED_TORQUE_45NM' },
      telemetryState: { windTunnelSensorId: 'WT-SENSOR-44' },
      configurationState: {
        revisionId: 'REV-M10.3-001',
        canonicalRevisionHash: '0x99AABBCCDDEEFF00112233445566778899AABBCCDDEEFF001122334455667788'
      },
      evidenceSnapshotHash: '0x1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF'
    });
  });

  // =========================================================================
  // 1. ARCHITECTURAL DECOUPLING & ZERO DEPENDENCY PROOF
  // =========================================================================
  describe('1. Architectural Decoupling & Common-Mode Source Analysis', () => {
    it('verifies that IndependentAIVerifier has ZERO imports of CanonicalAISerializer', () => {
      const verifierFilePath = path.resolve(__dirname, '../IndependentAIVerifier.ts');
      const verifierSource = fs.readFileSync(verifierFilePath, 'utf8');

      // Strict check: CanonicalAISerializer must not be imported
      expect(verifierSource).not.toMatch(/from\s+['"].*CanonicalAISerializer['"]/);
      expect(verifierSource).not.toMatch(/import\s+.*CanonicalAISerializer/);
    });

    it('verifies that IndependentVerificationSerializer has ZERO imports of CanonicalAISerializer', () => {
      const serializerFilePath = path.resolve(__dirname, '../verification/IndependentVerificationSerializer.ts');
      const serializerSource = fs.readFileSync(serializerFilePath, 'utf8');

      expect(serializerSource).not.toMatch(/from\s+['"].*CanonicalAISerializer['"]/);
      expect(serializerSource).not.toMatch(/import\s+.*CanonicalAISerializer/);
    });

    it('confirms the verifier reports FULLY_INDEPENDENT_DISSIMILAR classification', () => {
      expect(IndependentAIVerifier.INDEPENDENCE_CLASSIFICATION).toBe('FULLY_INDEPENDENT_DISSIMILAR');

      const metrics = IndependentAIVerifier.getIndependenceMetrics();
      expect(metrics.commonModeVulnerabilityScore).toBe(0.0);
      expect(metrics.dissimilarityRatio).toBe(1.0);
      expect(metrics.sharedCodeLines).toBe(0);
      expect(metrics.zeroRuntimeMemoizationTrust).toBe(true);
      expect(metrics.physicsConservationEnforced).toBe(true);
    });
  });

  // =========================================================================
  // 2. DISSIMILAR EQUIVALENCE ON CANONICAL DATA
  // =========================================================================
  describe('2. Dissimilar Implementation Equivalence on Valid Data', () => {
    it('yields identical model hash when comparing CanonicalAISerializer and IndependentVerificationSerializer', () => {
      const runtimeHash = CanonicalAISerializer.computeModelHash(baseModel);
      const independentHash = IndependentVerificationSerializer.computeModelHash(baseModel);

      expect(runtimeHash).toBe(baseModel.modelHash);
      expect(independentHash).toBe(runtimeHash);
    });

    it('yields identical context hash when comparing CanonicalAISerializer and IndependentVerificationSerializer', () => {
      const runtimeHash = CanonicalAISerializer.computeContextHash(baseContext);
      const independentHash = IndependentVerificationSerializer.computeContextHash(baseContext);

      expect(runtimeHash).toBe(baseContext.contextHash);
      expect(independentHash).toBe(runtimeHash);
    });

    it('yields identical input, output, and execution hashes on valid execution payload', () => {
      const inputs = { chord: 2.5, span: 14.0, aoa: 4.5, reynolds: 5e6 };
      const units = { chord: 'm', span: 'm', aoa: 'deg', reynolds: 'unitless' };

      const runtimeInHash = CanonicalAISerializer.computeInputHash(inputs, units);
      const independentInHash = IndependentVerificationSerializer.computeInputHash(inputs, units);
      expect(independentInHash).toBe(runtimeInHash);

      const prediction = 125.45;
      const uncertainty = 0.05;
      const runtimeOutHash = CanonicalAISerializer.computeOutputHash(prediction, uncertainty);
      const independentOutHash = IndependentVerificationSerializer.computeOutputHash(prediction, uncertainty);
      expect(independentOutHash).toBe(runtimeOutHash);

      const runtimeExecHash = CanonicalAISerializer.computeExecutionHash(
        baseModel.modelHash,
        baseContext.contextHash,
        runtimeInHash,
        runtimeOutHash,
        42
      );
      const independentExecHash = IndependentVerificationSerializer.computeExecutionHash(
        baseModel.modelHash,
        baseContext.contextHash,
        independentInHash,
        independentOutHash,
        42
      );
      expect(independentExecHash).toBe(runtimeExecHash);
    });
  });

  // =========================================================================
  // 3. COMMON-MODE FAILURE (CMF) DETECTION & RESILIENCE
  // =========================================================================
  describe('3. Common-Mode Failure (CMF) Detection & Resilience', () => {
    it('detects and rejects inference when runtime serializer omits or tampers a model weight', () => {
      const inputs = { chord: 2.5, span: 14.0, aoa: 4.5 };
      const units = { chord: 'm', span: 'm', aoa: 'deg' };

      const record = EngineeringAIRuntime.executeInference({
        model: baseModel,
        context: baseContext,
        inputs,
        units,
        seed: 42,
        determinism: 'DETERMINISTIC'
      });

      // Adversarial scenario: An altered model where a subtle weight changed, but an attacker
      // attempted to preserve the old modelHash
      const corruptedModel: EngineeringAIModel = {
        ...baseModel,
        weights: { ...baseModel.weights, aoa: 2.1500001 } // floating point injection
      };

      const result = IndependentAIVerifier.verifyInference(
        record,
        corruptedModel,
        baseContext,
        inputs,
        units
      );

      expect(result.verdict).toBe('MODEL_INTEGRITY_FAILURE');
      expect(result.details).toContain('MODEL_INTEGRITY_FAILURE');
    });

    it('detects when runtime serializer uses corrupted execution hash formatting', () => {
      const inputs = { chord: 2.5, span: 14.0 };
      const units = { chord: 'm', span: 'm' };

      const record = EngineeringAIRuntime.executeInference({
        model: baseModel,
        context: baseContext,
        inputs,
        units,
        seed: 100,
        determinism: 'DETERMINISTIC'
      });

      // Simulate a runtime serializer bug that dropped the SEED component
      const buggyExecutionHash = IndependentVerificationSerializer.hash(
        `EXEC|${baseModel.modelHash}|${baseContext.contextHash}|${record.inputHash}|${record.outputHash}|NO_SEED`
      );

      const tamperedRecord: AIInferenceRecord = {
        ...record,
        executionHash: buggyExecutionHash
      };

      const result = IndependentAIVerifier.verifyInference(
        tamperedRecord,
        baseModel,
        baseContext,
        inputs,
        units
      );

      expect(result.verdict).toBe('REPRODUCIBILITY_FAILURE');
      expect(result.details).toContain('EXECUTION_HASH_MISMATCH');
    });

    it('produces a dissimilar verification report with cross-check digest', () => {
      const inputs = { chord: 2.5, span: 14.0 };
      const units = { chord: 'm', span: 'm' };

      const record = EngineeringAIRuntime.executeInference({
        model: baseModel,
        context: baseContext,
        inputs,
        units,
        seed: 77,
        determinism: 'DETERMINISTIC'
      });

      const report = IndependentAIVerifier.verifyInferenceDissimilar(
        record,
        baseModel,
        baseContext,
        inputs,
        units,
        {
          trainingDatasetTimestamp: '2026-01-01T00:00:00Z',
          evaluationTimestamp: '2026-02-01T00:00:00Z'
        }
      );

      expect(report.overallPassed).toBe(true);
      expect(report.verdict).toBe('VERIFIED');
      expect(report.independenceLevel).toBe('FULLY_INDEPENDENT_DISSIMILAR');
      expect(report.authorityTag).toBe('ADVISORY_EVIDENCE');
      expect(report.stages.length).toBe(9);
      expect(report.dissimilarDigest).toBeDefined();
      expect(report.dissimilarDigest?.length).toBe(64);
    });
  });

  // =========================================================================
  // 4. INDEPENDENT PHYSICAL CONSERVATION & BOUNDARY LAWS
  // =========================================================================
  describe('4. Independent Physical Conservation & Thermodynamic Invariants', () => {
    it('rejects inference asserting negative thermodynamic absolute temperature', () => {
      const inputs = { chord: 2.5, span: 14.0, temperatureKelvin: -15.0 }; // Violates 3rd law of thermodynamics
      const units = { chord: 'm', span: 'm', temperatureKelvin: 'K' };

      const record = EngineeringAIRuntime.executeInference({
        model: baseModel,
        context: baseContext,
        inputs,
        units,
        seed: 12,
        determinism: 'DETERMINISTIC'
      });

      const result = IndependentAIVerifier.verifyInference(
        record,
        baseModel,
        baseContext,
        inputs,
        units
      );

      expect(result.verdict).toBe('PHYSICS_FAILURE');
      expect(result.details).toContain('Negative thermodynamic temperature');
    });

    it('rejects inference exceeding material ultimate stress limits in dissimilar verification', () => {
      const inputs = { chord: 2.5, span: 14.0 };
      const units = { chord: 'm', span: 'm' };

      const record = EngineeringAIRuntime.executeInference({
        model: baseModel,
        context: baseContext,
        inputs,
        units,
        seed: 42,
        determinism: 'DETERMINISTIC'
      });

      // Wing predicted load is 15.02 MPa, but allowable stress limit set to 10 MPa
      const report = IndependentAIVerifier.verifyInferenceDissimilar(
        record,
        baseModel,
        baseContext,
        inputs,
        units,
        {
          maxAllowableStressMpa: 10.0 // Stress exceeds limit
        }
      );

      expect(report.overallPassed).toBe(false);
      expect(report.verdict).toBe('PHYSICS_FAILURE');
      expect(report.details).toContain('exceeds material ultimate strength');
    });

    it('rejects mass/flux conservation imbalance in independent physics validator', () => {
      const inputs = { flowRate: 100 };
      const prediction = 100;
      const uncertainty = { value: 0.05, confidenceInterval: [95, 105] as [number, number] };

      const check = IndependentPhysicsValidator.validatePhysicsInvariants(
        inputs,
        prediction,
        uncertainty,
        {
          enforceMassConservation: true,
          massInflow: 100.0,
          massOutflow: 92.5 // 7.5% discrepancy (exceeds 0.1% tolerance)
        }
      );

      expect(check.valid).toBe(false);
      expect(check.verdict).toBe('PHYSICS_VIOLATION');
      expect(check.violations[0]).toContain('Mass conservation violated');
    });

    it('rejects negative or non-finite uncertainty values', () => {
      const checkNegative = IndependentPhysicsValidator.validatePhysicsInvariants(
        {},
        100,
        { value: -0.05 }
      );
      expect(checkNegative.valid).toBe(false);
      expect(checkNegative.violations[0]).toContain('Invalid uncertainty value');

      const checkNaN = IndependentPhysicsValidator.validatePhysicsInvariants(
        {},
        100,
        { value: NaN }
      );
      expect(checkNaN.valid).toBe(false);
      expect(checkNaN.violations[0]).toContain('Invalid uncertainty value');
    });

    it('rejects inverted confidence intervals (low > high)', () => {
      const checkInverted = IndependentPhysicsValidator.validatePhysicsInvariants(
        {},
        100,
        { value: 0.05, confidenceInterval: [110, 90] }
      );
      expect(checkInverted.valid).toBe(false);
      expect(checkInverted.violations[0]).toContain('Inverted confidence interval');
    });
  });

  // =========================================================================
  // 5. INDEPENDENT DOMAIN & NUMERICAL SANITY VALIDATION
  // =========================================================================
  describe('5. Independent Domain & Numerical Sanity Validation', () => {
    it('rejects non-finite IEEE-754 floats (NaN, Infinity, -Infinity) in inputs', () => {
      const checkNaN = IndependentDomainValidator.validateDomainAdmissibility({
        velocity: NaN,
        pressure: 101.3
      });
      expect(checkNaN.valid).toBe(false);
      expect(checkNaN.verdict).toBe('INVALID_NUMERICS');
      expect(checkNaN.details).toContain('non-finite');

      const checkInf = IndependentDomainValidator.validateDomainAdmissibility({
        velocity: Infinity,
        pressure: 101.3
      });
      expect(checkInf.valid).toBe(false);
      expect(checkInf.verdict).toBe('INVALID_NUMERICS');
    });

    it('rejects out-of-domain values when contract is enforced', () => {
      const contract = {
        ranges: [
          { field: 'mach', min: 0.1, max: 0.9, unit: 'Mach' }
        ]
      };

      const checkOOD = IndependentDomainValidator.validateDomainAdmissibility(
        { mach: 1.4 }, // Exceeds 0.9
        contract
      );

      expect(checkOOD.valid).toBe(false);
      expect(checkOOD.verdict).toBe('OUT_OF_DOMAIN');
      expect(checkOOD.oodStatus).toBe('OUT_OF_DISTRIBUTION');
      expect(checkOOD.details).toContain('exceeds valid qualification envelope');
    });

    it('flags near-boundary conditions accurately', () => {
      const contract = {
        ranges: [
          { field: 'mach', min: 0.0, max: 1.0, unit: 'Mach' }
        ]
      };

      const checkNearBoundary = IndependentDomainValidator.validateDomainAdmissibility(
        { mach: 0.98 }, // Within 2% of max limit
        contract
      );

      expect(checkNearBoundary.valid).toBe(true);
      expect(checkNearBoundary.verdict).toBe('DOMAIN_PASS');
      expect(checkNearBoundary.oodStatus).toBe('NEAR_BOUNDARY');
    });
  });

  // =========================================================================
  // 6. INDEPENDENT TEMPORAL CAUSALITY & CONTAMINATION GATES
  // =========================================================================
  describe('6. Independent Temporal Causality & Contamination Gates', () => {
    it('detects future data leakage when training timestamp is newer than evaluation timestamp', () => {
      const leakCheck = IndependentDomainValidator.validateTemporalInvariants(
        '2026-06-01T00:00:00Z', // Training in June
        '2026-02-01T00:00:00Z'  // Evaluation in February
      );

      expect(leakCheck.valid).toBe(false);
      expect(leakCheck.details).toContain('FUTURE_DATA_LEAKAGE');
    });

    it('rejects malformed temporal timestamps', () => {
      const invalidDateCheck = IndependentDomainValidator.validateTemporalInvariants(
        'not-a-date',
        '2026-02-01T00:00:00Z'
      );

      expect(invalidDateCheck.valid).toBe(false);
      expect(invalidDateCheck.details).toContain('TEMPORAL_INVALID');
    });

    it('passes strictly valid chronological evaluation order', () => {
      const validChronology = IndependentDomainValidator.validateTemporalInvariants(
        '2025-12-15T00:00:00Z',
        '2026-02-01T00:00:00Z'
      );

      expect(validChronology.valid).toBe(true);
    });
  });

  // =========================================================================
  // 7. AUTHORITY BOUNDARY & EVIDENCE GRAPH INTEGRATION
  // =========================================================================
  describe('7. Authority Boundary & Twin Evidence Graph Integration', () => {
    it('enforces that verified inference remains strictly ADVISORY_EVIDENCE without canonical release', () => {
      const inputs = { chord: 2.5, span: 14.0 };
      const units = { chord: 'm', span: 'm' };

      const record = EngineeringAIRuntime.executeInference({
        model: baseModel,
        context: baseContext,
        inputs,
        units,
        seed: 55,
        determinism: 'DETERMINISTIC'
      });

      const report = IndependentAIVerifier.verifyInferenceDissimilar(
        record,
        baseModel,
        baseContext,
        inputs,
        units
      );

      expect(report.overallPassed).toBe(true);
      expect(report.authorityTag).toBe('ADVISORY_EVIDENCE');

      // Attempting to treat verification report as canonical release MUST fail
      const isCanonicalRelease = (report as any).isCanonicalRelease === true;
      expect(isCanonicalRelease).toBe(false);
    });

    it('registers independent verification results into TwinEvidenceGraph without corrupting root hash', () => {
      const inputs = { chord: 2.5, span: 14.0 };
      const units = { chord: 'm', span: 'm' };

      const record = EngineeringAIRuntime.executeInference({
        model: baseModel,
        context: baseContext,
        inputs,
        units,
        seed: 42,
        determinism: 'DETERMINISTIC',
        evidenceEngine
      });

      const report = IndependentAIVerifier.verifyInferenceDissimilar(
        record,
        baseModel,
        baseContext,
        inputs,
        units
      );

      // Add verification evidence node
      const verifierNodeId = `AI-VERIF-${record.inferenceId}`;
      evidenceEngine.addNode(
        verifierNodeId,
        'VERIFICATION_PACKAGE',
        record.inferenceId,
        'v1',
        'IndependentAIVerifier',
        report.timestamp,
        {
          verdict: report.verdict,
          independenceLevel: report.independenceLevel,
          dissimilarDigest: report.dissimilarDigest,
          metrics: report.metrics
        }
      );

      evidenceEngine.addEdge(
        `E-VERIF-${record.inferenceId}`,
        verifierNodeId,
        `AI-INF-${record.inferenceId}`,
        'VERIFIES'
      );

      expect(evidenceEngine.graph.nodes.has(verifierNodeId)).toBe(true);
      expect(evidenceEngine.graph.edges.has(`E-VERIF-${record.inferenceId}`)).toBe(true);
      expect(evidenceEngine.graph.rootHash).toBeDefined();
      expect(evidenceEngine.graph.rootHash.length).toBe(64);
    });
  });
});
