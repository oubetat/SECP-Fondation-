import { describe, it, expect, beforeEach } from 'vitest';
import { generateKeyPairSync, createSign } from 'crypto';
import { EngineeringAIEvidenceBinder, AIEvidenceEnvelope } from '../evidence/EngineeringAIEvidenceBinder';
import { IndependentAIVerifier } from '../IndependentAIVerifier';
import { EngineeringAIRuntime } from '../EngineeringAIRuntime';
import { EngineeringAIModelRegistry } from '../EngineeringAIModelRegistry';
import { EngineeringAIContextEngine } from '../EngineeringAIContextEngine';
import { TwinEvidenceGraphEngine } from '../../twin_evidence/TwinEvidenceGraphEngine';
import { SimulationEngine } from '../../simulation/SimulationEngine';
import { SimulationIdentityService } from '../../simulation/SimulationIdentityService';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { RevisionLifecycleState } from '../../revision/types';
import { QualityGate } from '../../verification/QualityGate';
import { MetrologyEngine } from '../../quality-metrology/MetrologyEngine';
import { EngineeringAiEngine } from '../../ai/EngineeringAiEngine';
import { EngineeringAIModel, EngineeringAIContext, AIInferenceRecord } from '../types';

describe('M10.4 — Evidence Binding & Cross-Domain Truth Closure Suite', () => {
  let modelRegistry: EngineeringAIModelRegistry;
  let contextEngine: EngineeringAIContextEngine;
  let evidenceEngine: TwinEvidenceGraphEngine;
  let revisionEngine: RevisionEngine;

  let baseModel: EngineeringAIModel;
  let baseContext: EngineeringAIContext;
  let inferenceRecord: AIInferenceRecord;
  let inputs: Record<string, any>;
  let units: Record<string, string>;

  beforeEach(() => {
    revisionEngine = new RevisionEngine();
    SimulationIdentityService.initialize(revisionEngine);
    MetrologyEngine.clearRegistry();

    modelRegistry = new EngineeringAIModelRegistry();
    contextEngine = new EngineeringAIContextEngine();
    evidenceEngine = new TwinEvidenceGraphEngine('TWIN-M10.4-WING');

    const rawModel: Partial<EngineeringAIModel> = {
      modelId: 'SURROGATE-M10.4-WING',
      modelName: 'Aeroelastic Wing Surrogate',
      modelType: 'SURROGATE',
      version: '1.0.0',
      architecture: 'RESNET-DISSIMILAR-M10',
      trainingDatasetId: 'DATASET-2026-AERO',
      weights: { span: 14.0, sweep: 25.0, chord: 2.5 },
      configuration: { activation: 'gelu', precision: 'fp64' },
      inputContract: {
        schemaId: 'SCH-M10.4-WING',
        units: { span: 'm', sweep: 'deg', chord: 'm' },
        dimensions: { span: [1], sweep: [1], chord: [1] },
        ranges: [
          { field: 'span', min: 1.0, max: 50.0, unit: 'm' },
          { field: 'sweep', min: 0.0, max: 45.0, unit: 'deg' },
          { field: 'chord', min: 0.5, max: 10.0, unit: 'm' }
        ],
        requiredFields: ['span', 'sweep', 'chord'],
        optionalFields: [],
        coordinateSystem: 'CARTESIAN',
        referenceFrame: 'GLOBAL',
        validityRules: []
      },
      outputContract: {
        outputType: 'AERODYNAMIC_DRAG',
        unit: 'kN',
        validRange: [0, 5000],
        supportUncertainty: true,
        limitations: []
      },
      status: 'QUALIFIED'
    };

    baseModel = modelRegistry.register(rawModel);

    baseContext = EngineeringAIContextEngine.createContext('CTX-M10.4-001', {
      geometryState: {
        modelId: 'WING_PART_001',
        geometryHash: '0xGEOM_HASH_REV_A_112233445566778899AABBCCDDEEFF00',
        span: 14.0
      },
      materialState: { alloy: 'Al-7075', yieldStrengthMpa: 503 },
      physicsState: { mach: 0.78, altitudeM: 10000 },
      manufacturingState: { process: '5AXIS_MILLING' },
      assemblyState: { fastenerTorqueNm: 45 },
      telemetryState: { sensorId: 'SN-WING-44' },
      configurationState: {
        revisionId: 'REV_A',
        canonicalRevisionHash: '0xREV_A_HASH_99887766554433221100FFEEDDCCBBAA'
      },
      evidenceSnapshotHash: '0xSNAP_HASH_1234567890ABCDEF1234567890ABCDEF'
    });

    inputs = { span: 14.0, sweep: 25.0, chord: 2.5 };
    units = { span: 'm', sweep: 'deg', chord: 'm' };

    inferenceRecord = EngineeringAIRuntime.executeInference({
      model: baseModel,
      context: baseContext,
      inputs,
      units,
      seed: 42,
      determinism: 'DETERMINISTIC',
      evidenceEngine
    });
  });

  // =========================================================================
  // 1. DETERMINISTIC EVIDENCE IDENTITY & ENVELOPE BINDING (GATES M10.4-01 & 02)
  // =========================================================================
  describe('1. Deterministic Evidence Identity & Envelope Binding', () => {
    it('produces deterministic evidenceId across repeated bindings of identical inputs', () => {
      const report = IndependentAIVerifier.verifyInferenceDissimilar(
        inferenceRecord,
        baseModel,
        baseContext,
        inputs,
        units
      );

      const envelope1 = EngineeringAIEvidenceBinder.createEvidenceEnvelope(
        inferenceRecord,
        baseModel,
        baseContext,
        report
      );

      const envelope2 = EngineeringAIEvidenceBinder.createEvidenceEnvelope(
        inferenceRecord,
        baseModel,
        baseContext,
        report
      );

      expect(envelope1.evidenceId).toBe(envelope2.evidenceId);
      expect(envelope1.contentHash).toBe(envelope2.contentHash);
      expect(envelope1.evidenceId.startsWith('EV-AI-')).toBe(true);
    });

    it('alters evidence identity when canonical revision or context changes', () => {
      const report = IndependentAIVerifier.verifyInferenceDissimilar(
        inferenceRecord,
        baseModel,
        baseContext,
        inputs,
        units
      );

      const envelopeA = EngineeringAIEvidenceBinder.createEvidenceEnvelope(
        inferenceRecord,
        baseModel,
        baseContext,
        report
      );

      // Mutate canonical revision in context
      const mutatedContext = EngineeringAIContextEngine.createContext('CTX-M10.4-002', {
        ...baseContext,
        configurationState: {
          revisionId: 'REV_B',
          canonicalRevisionHash: '0xREV_B_HASH_DIFFERENT_HASH_VALUE_HERE'
        }
      });

      const mutatedRecord: AIInferenceRecord = {
        ...inferenceRecord,
        contextHash: mutatedContext.contextHash
      };

      const envelopeB = EngineeringAIEvidenceBinder.createEvidenceEnvelope(
        mutatedRecord,
        baseModel,
        mutatedContext,
        report
      );

      expect(envelopeA.evidenceId).not.toBe(envelopeB.evidenceId);
      expect(envelopeA.subject.revisionId).toBe('REV_A');
      expect(envelopeB.subject.revisionId).toBe('REV_B');
    });

    it('rejects binding when verifier report has not achieved FULLY_INDEPENDENT_DISSIMILAR classification', () => {
      const badReport: any = {
        verdict: 'VERIFIED',
        overallPassed: true,
        independenceLevel: 'PARTIALLY_INDEPENDENT', // Stale/insufficient classification
        authorityTag: 'ADVISORY_EVIDENCE',
        timestamp: new Date().toISOString()
      };

      expect(() =>
        EngineeringAIEvidenceBinder.createEvidenceEnvelope(
          inferenceRecord,
          baseModel,
          baseContext,
          badReport
        )
      ).toThrow(/EVIDENCE_BINDING_BREACH.*FULLY_INDEPENDENT_DISSIMILAR/);
    });
  });

  // =========================================================================
  // 2. AUTHORITY BOUNDARY INVARIANCE (GATES M10.4-06 & 07)
  // =========================================================================
  describe('2. Authority Boundary Invariance (Advisory Only)', () => {
    it('strictly tags evidence as ADVISORY_EVIDENCE and rejects canonical release claims', () => {
      const report = IndependentAIVerifier.verifyInferenceDissimilar(
        inferenceRecord,
        baseModel,
        baseContext,
        inputs,
        units
      );

      const envelope = EngineeringAIEvidenceBinder.createEvidenceEnvelope(
        inferenceRecord,
        baseModel,
        baseContext,
        report
      );

      expect(envelope.verification.authorityTag).toBe('ADVISORY_EVIDENCE');
      expect(envelope.isCanonicalRelease).toBe(false);

      // Rejects any attempt to forge authority tag in report
      const forgedReport: any = {
        ...report,
        authorityTag: 'CANONICAL_RELEASE' // FORBIDDEN!
      };

      expect(() =>
        EngineeringAIEvidenceBinder.createEvidenceEnvelope(
          inferenceRecord,
          baseModel,
          baseContext,
          forgedReport
        )
      ).toThrow(/EVIDENCE_BINDING_BREACH.*ADVISORY_EVIDENCE/);
    });

    it('verifies that registering evidence node into TwinEvidenceGraph maintains root integrity', () => {
      const report = IndependentAIVerifier.verifyInferenceDissimilar(
        inferenceRecord,
        baseModel,
        baseContext,
        inputs,
        units
      );

      const initialRootHash = evidenceEngine.graph.rootHash;

      const envelope = EngineeringAIEvidenceBinder.createEvidenceEnvelope(
        inferenceRecord,
        baseModel,
        baseContext,
        report,
        evidenceEngine
      );

      expect(evidenceEngine.graph.nodes.has(envelope.evidenceId)).toBe(true);
      expect(evidenceEngine.graph.rootHash).not.toBe(initialRootHash);
      expect(evidenceEngine.graph.rootHash.length).toBe(64);
    });
  });

  // =========================================================================
  // 3. PERSISTENCE & REHYDRATION WITHOUT IDENTITY DRIFT (GATE M10.4-10)
  // =========================================================================
  describe('3. Persistence & Rehydration Without Identity Drift', () => {
    it('survives serialization and rehydration preserving bit-for-bit identity', () => {
      const report = IndependentAIVerifier.verifyInferenceDissimilar(
        inferenceRecord,
        baseModel,
        baseContext,
        inputs,
        units
      );

      const originalEnvelope = EngineeringAIEvidenceBinder.createEvidenceEnvelope(
        inferenceRecord,
        baseModel,
        baseContext,
        report
      );

      // Serialize
      const serialized = EngineeringAIEvidenceBinder.serializeEnvelope(originalEnvelope);

      // Rehydrate & strictly validate against original context
      const rehydrated = EngineeringAIEvidenceBinder.rehydrateAndValidate(
        serialized,
        baseContext
      );

      expect(rehydrated.valid).toBe(true);
      expect(rehydrated.envelope.evidenceId).toBe(originalEnvelope.evidenceId);
      expect(rehydrated.envelope.contentHash).toBe(originalEnvelope.contentHash);
      expect(rehydrated.envelope.verification.independenceLevel).toBe('FULLY_INDEPENDENT_DISSIMILAR');
      expect(rehydrated.envelope.verification.authorityTag).toBe('ADVISORY_EVIDENCE');
      expect(rehydrated.envelope.isCanonicalRelease).toBe(false);
    });

    it('detects tampering during rehydration if content payload is modified', () => {
      const report = IndependentAIVerifier.verifyInferenceDissimilar(
        inferenceRecord,
        baseModel,
        baseContext,
        inputs,
        units
      );

      const envelope = EngineeringAIEvidenceBinder.createEvidenceEnvelope(
        inferenceRecord,
        baseModel,
        baseContext,
        report
      );

      const serialized = EngineeringAIEvidenceBinder.serializeEnvelope(envelope);
      const parsed = JSON.parse(serialized);

      // Inject adversarial tampering into subject
      parsed.subject.modelId = 'ATTACKER_MODEL_ID';
      const tamperedJson = JSON.stringify(parsed);

      expect(() =>
        EngineeringAIEvidenceBinder.rehydrateAndValidate(tamperedJson, baseContext)
      ).toThrow(/EVIDENCE_REHYDRATION_ERROR.*Content hash tampered/);
    });

    it('detects context mismatch during rehydration if loaded into an incompatible context', () => {
      const report = IndependentAIVerifier.verifyInferenceDissimilar(
        inferenceRecord,
        baseModel,
        baseContext,
        inputs,
        units
      );

      const envelope = EngineeringAIEvidenceBinder.createEvidenceEnvelope(
        inferenceRecord,
        baseModel,
        baseContext,
        report
      );

      const serialized = EngineeringAIEvidenceBinder.serializeEnvelope(envelope);

      // Incompatible context (different geometry/physics)
      const foreignContext = EngineeringAIContextEngine.createContext('CTX-FOREIGN', {
        ...baseContext,
        geometryState: { modelId: 'DIFFERENT_PART', geometryHash: '0xDIFFERENT_GEOM' }
      });

      expect(() =>
        EngineeringAIEvidenceBinder.rehydrateAndValidate(serialized, foreignContext)
      ).toThrow(/EVIDENCE_REHYDRATION_ERROR.*Context mismatch/);
    });
  });

  // =========================================================================
  // 4. CROSS-DOMAIN SIMULATION ↔ CAD CLOSURE (GATES M10.4-04 & 05)
  // =========================================================================
  describe('4. Cross-Domain Simulation ↔ CAD Continuity & Stale Rejection', () => {
    it('accepts simulation result when bound to current canonical geometry', () => {
      const modelId = 'CANONICAL_WING_01';
      const rev = revisionEngine.createRevision({
        revisionId: 'REV_W1',
        entityId: modelId,
        entityType: 'GEOMETRY' as any,
        revisionCode: 'A',
        revisionNumber: 1,
        lifecycleState: RevisionLifecycleState.RELEASED,
        content: { chord: 2.5 },
        revisionHash: 'GEOM_HASH_W1'
      } as any);

      const scenario = {
        id: 'SIM_W1',
        name: 'Wing Stress',
        geometry: { modelId, revision: 'REV_W1', geometryHash: rev.revisionHash, hash: rev.revisionHash },
        parameters: [],
        material: { materialId: 'STEEL_4140' },
        mesh: { meshId: 'M1', hash: 'MH1' },
        boundaryConditions: [],
        loads: [],
        solver: { solverId: 'FEA1' },
        revision: 'S1'
      };

      const result = SimulationEngine.runScenario(scenario as any);
      expect(result.status).toBe('SAFE');
      expect(result.provenanceHash).toBeDefined();

      // Downstream AI inference authorization passes
      expect(QualityGate.authorizeAiInference(result)).toBe(true);
    });

    it('rejects stale simulation result and raises STALE warning when geometry changes', () => {
      const modelId = 'CANONICAL_WING_02';
      const revA = revisionEngine.createRevision({
        revisionId: 'REV_W2_A',
        entityId: modelId,
        entityType: 'GEOMETRY' as any,
        revisionCode: 'A',
        revisionNumber: 1,
        lifecycleState: RevisionLifecycleState.RELEASED,
        content: { chord: 2.5 },
        revisionHash: 'GEOM_HASH_A'
      } as any);

      const scenario = {
        id: 'SIM_W2',
        geometry: { modelId, revision: 'REV_W2_A', geometryHash: revA.revisionHash, hash: revA.revisionHash },
        parameters: [],
        material: { materialId: 'STEEL_4140' },
        revision: 'S1'
      };

      // Run initially safe
      const resultInitial = SimulationEngine.runScenario(scenario as any);
      expect(resultInitial.status).toBe('SAFE');

      // Canonical revision updated with new geometry
      revisionEngine.createRevision({
        revisionId: 'REV_W2_B',
        entityId: modelId,
        entityType: 'GEOMETRY' as any,
        revisionCode: 'B',
        revisionNumber: 2,
        lifecycleState: RevisionLifecycleState.RELEASED,
        content: { chord: 3.0 },
        revisionHash: 'GEOM_HASH_B'
      } as any);

      // Re-running or evaluating stale scenario
      const resultStale = SimulationEngine.runScenario(scenario as any);
      expect(resultStale.status).toBe('STALE_IDENTITY');
      expect(resultStale.provenanceHash).toBe('INVALID_CHAIN');

      // QualityGate blocks downstream AI inference
      expect(() => QualityGate.authorizeAiInference(resultStale)).toThrow(/AI_INFERENCE_DENIED.*stale/);

      // EngineeringAiEngine emits explicit STALE warning
      const insights = EngineeringAiEngine.analyzeDesignContext(null, resultStale);
      const staleWarning = insights.find(i => i.message.includes('STALE'));
      expect(staleWarning).toBeDefined();
      expect(staleWarning?.type).toBe('WARNING');
    });

    it('distinguishes revision-only changes from geometry changes', () => {
      const modelId = 'CANONICAL_WING_03';
      const rev = revisionEngine.createRevision({
        revisionId: 'REV_W3_1',
        entityId: modelId,
        entityType: 'GEOMETRY' as any,
        revisionCode: 'A',
        revisionNumber: 1,
        lifecycleState: RevisionLifecycleState.RELEASED,
        content: { chord: 2.5 },
        revisionHash: 'GEOM_SAME_HASH'
      } as any);

      const scenarioRev1 = {
        id: 'SIM_W3',
        geometry: { modelId, revision: 'REV_W3_1', geometryHash: rev.revisionHash, hash: rev.revisionHash },
        parameters: [],
        material: { materialId: 'STEEL_4140' },
        revision: 'S1'
      };

      // Scenario revision increments, but geometry remains identical
      const scenarioRev2 = { ...scenarioRev1, revision: 'S2' };

      const result = SimulationEngine.runScenario(scenarioRev2 as any);
      expect(result.status).toBe('SAFE');
      expect(result.status).not.toBe('STALE_IDENTITY');
    });
  });

  // =========================================================================
  // 5. METROLOGY PROVENANCE BOUNDARY (GATES M10.4-08, 09, 13, 14, 15, 16)
  // =========================================================================
  describe('5. Metrology Provenance & Mock Certificate Hardening', () => {
    it('strictly blocks mock certificates attempting to inject SECP-PROD- provenance', () => {
      const mockCert = {
        certificateId: 'MOCK_CERT_ATTACK',
        cadRevisionHash: 'REV_A_HASH',
        disposition: 'ACCEPTED',
        provenanceHash: 'SECP-PROD-FABRICATED',
        evidenceGrade: 'LEVEL_3_PHYSICAL_TELEMETRY'
      } as any;

      expect(() => MetrologyEngine.registerMockCertificate(mockCert))
        .toThrow(/PROVENANCE_BREACH: MOCK_CERTIFICATE_CANNOT_BE_PRODUCTION/);
    });

    it('blocks old physical acquisition certificate when presented for release of new revision', () => {
      // Helper function to issue genuine production certificate
      const plan = {
        planId: 'PLAN_M10_4',
        partId: 'PART_M10_4',
        partRevision: 'REV_A',
        specifications: [{ specId: 'S1', featureId: 'F1', characteristicType: 'DIAMETER' as any, nominalMm: 50, toleranceUpperMm: 0.1, toleranceLowerMm: -0.1 }],
        pointsPerFeature: { F1: 1 },
        planHash: 'H1'
      };
      const instrument = MetrologyEngine.createInstrument('INST_M10_4', 'Zeiss CMM', 'ZEISS_CMM_PROBE');
      const driverId = 'DRIVER_M10_4';
      const connection = { driverId, connectionStatus: 'CONNECTED' as any, protocol: 'MTCONNECT' as any };

      const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'secp256k1' });
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
      MetrologyEngine.registerTrustedDriver(driverId, publicKeyPem, 'PRODUCTION');

      const envelope = {
        acquisitionId: 'acq-m10-4',
        sessionId: 'S_M10_4',
        driverId,
        instrumentId: 'INST_M10_4',
        calibrationId: instrument.calibration.calibrationId,
        acquiredAt: new Date().toISOString(),
        nonce: 1,
        points: [
          { pointId: 'pt-live-PLAN_M10_4-F1-1', measuredCoordinates: { x: 25.0005, y: 0.0, z: 0.0 } }
        ],
        signature: ''
      };

      const payloadString = [
        envelope.acquisitionId,
        envelope.sessionId,
        envelope.driverId,
        envelope.instrumentId,
        envelope.calibrationId,
        envelope.acquiredAt,
        envelope.nonce,
        envelope.points.map(p => `${p.pointId}:${p.measuredCoordinates.x},${p.measuredCoordinates.y},${p.measuredCoordinates.z}`).join('|')
      ].join(':');

      const sign = createSign('SHA256');
      sign.update(payloadString);
      envelope.signature = sign.sign(privateKey, 'hex');

      MetrologyEngine.submitAcquisitionEnvelope(envelope);

      const session = MetrologyEngine.runSession('S_M10_4', plan as any, 'SN_104', instrument, 'OP1', 'LIVE', 0, connection as any);
      const legitCert = MetrologyEngine.issueQualityCertificate(session, plan as any, 'REV_1_CANONICAL', 'JOB_104', driverId);

      // Valid release for original revision
      expect(QualityGate.authorizeRelease('PART_M10_4', 'REV_1_CANONICAL', legitCert)).toBe(true);

      // BLOCKED when old certificate is presented for new incompatible revision
      expect(() =>
        QualityGate.authorizeRelease('PART_M10_4', 'REV_2_NEW_CANONICAL', legitCert)
      ).toThrow(/RELEASE_DENIED: Certificate binds to revision REV_1_CANONICAL, but part is at REV_2_NEW_CANONICAL/);
    });

    it('rejects certificate with empty or nonphysical telemetry from release', () => {
      const badCert = {
        certificateId: 'cert-empty-m104',
        cadRevisionHash: 'REV_1_HASH',
        disposition: 'ACCEPTED',
        provenanceHash: 'SECP-PROD-EMPTY-M104',
        evidenceGrade: 'LEVEL_3_PHYSICAL_TELEMETRY',
        rawMeasurementHash: 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855' // empty hash
      } as any;

      MetrologyEngine.registerTestCertificateForAdversarialTest(badCert);

      expect(() => QualityGate.authorizeRelease('PART_EMPTY', 'REV_1_HASH', badCert))
        .toThrow(/RELEASE_DENIED: Certificate lacks authenticated telemetry/);
    });
  });
});
