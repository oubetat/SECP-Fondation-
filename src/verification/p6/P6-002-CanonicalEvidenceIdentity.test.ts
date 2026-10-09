/**
 * P6-002: Canonical Evidence Identity, Normalization & Hash Chain Integrity Proof
 * 
 * MISSION & CORE THESIS:
 * "Engineering Truth can be converted into trustworthy evidence without losing identity,
 * causality, revision, provenance, reproducibility, or integrity — and no stale, tampered,
 * unverified, or misbound result can be promoted as certified engineering truth."
 * 
 * STRICT ENGINEERING CONSTRAINTS:
 * - No `any`, no `unknown`, no `@ts-ignore`, no unsafe casts.
 * - No `Date.now()`, `Math.random()`, or nondeterministic timestamps in cryptographic identity.
 * - No synthetic hash bypasses or fake attestations.
 * - 100% bit-for-bit three-run determinism.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EngineeringDocument } from '../../engine/cad-kernel/document/CADDocument';
import { DocumentEvaluator, DocumentEvaluationResult } from '../../engine/cad-kernel/document/DocumentEvaluator';
import { EvidenceIntegrityEngine } from '../../engine/evidence/integrity/EvidenceIntegrityEngine';
import { IndependentEvidenceIntegrityVerifier } from '../../engine/evidence/integrity/IndependentEvidenceIntegrityVerifier';
import {
  CanonicalEvidenceRecord,
  EngineeringResultRecord,
  ValidationRecord,
  IndependentVerificationRecord
} from '../../engine/evidence/integrity/EvidenceIntegrityTypes';
import { EngineeringHashChain } from '../../engine/evidence/EngineeringHashChain';
import { EngineeringHashChainGate } from '../../engine/evidence/EngineeringHashChainGate';
import { EngineeringIdentityFactory } from '../../engine/identity/EngineeringIdentityFactory';
import { EngineeringObjectType } from '../../engine/identity/CanonicalEngineeringIdentity';
import { CryptographicAttestationEngine } from '../../engine/attestation/CryptographicAttestationEngine';
import { SigningKeyPair } from '../../engine/attestation/types';
import { SimulationCertificateEngine } from '../../engine/certification/SimulationCertificateEngine';
import {
  SimulationCertificationPolicy,
  SimulationInputManifest,
  SimulationExecutionManifest,
  SimulationResultManifest,
  SimulationVerificationMatrix
} from '../../engine/certification/simulationTypes';

function createCanonicalCADDocument(docId: string, depth: number, rev: number = 1): EngineeringDocument {
  return {
    documentId: docId,
    revision: rev,
    type: 'PART',
    units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
    sketches: [
      {
        id: `SK_${docId}`,
        name: 'SK_PROFILE',
        plane: 'XY',
        closedProfile: true,
        entities: [
          { id: 'L1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
          { id: 'L2', type: 'LINE', points: [{ x: 100, y: 0 }, { x: 100, y: 40 }] },
          { id: 'L3', type: 'LINE', points: [{ x: 100, y: 40 }, { x: 0, y: 40 }] },
          { id: 'L4', type: 'LINE', points: [{ x: 0, y: 40 }, { x: 0, y: 0 }] }
        ]
      }
    ],
    constraints: [],
    features: [
      {
        id: 'EXT_01',
        featureId: 'EXT_01',
        type: 'EXTRUDE',
        name: 'Main Extrusion',
        parameters: { depth, profileId: `SK_${docId}` },
        dependencyIds: []
      }
    ],
    parameters: [{ id: 'P_DEPTH', name: 'depth', expression: String(depth), value: depth }],
    topologyMap: { version: rev },
    derived: {},
    evidence: []
  };
}

describe('P6-002 — Canonical Evidence Identity, Normalization & Hash Chain Integrity Proof', () => {
  beforeEach(() => {
    SimulationCertificateEngine.getInstance().resetRegistry();
  });

  it('P6-002-A — 100% Bit-for-Bit Deterministic Evidence Identity Across 3 Independent Runs', () => {
    const runResults: Array<{
      bRepHash: string;
      canonicalJson: string;
      integrityHash: string;
      evidenceId: string;
    }> = [];

    for (let run = 1; run <= 3; run++) {
      const doc = createCanonicalCADDocument('DOC-DETERMINISM-P6', 30, 1);
      const evalResult: DocumentEvaluationResult = DocumentEvaluator.evaluate(doc);

      expect(evalResult.success).toBe(true);
      const bRepHash = evalResult.derivedArtifacts?.bRepHash || '';
      expect(bRepHash.length).toBeGreaterThan(0);

      const resultRecord: EngineeringResultRecord = {
        resultId: 'RES-DETERMINISTIC-001',
        domain: 'CAD',
        executionId: 'EXEC-FIXED-001',
        outputMetrics: {
          volume: 100 * 40 * 30,
          faceCount: evalResult.evaluatedShape?.outerShell?.orientedFaces?.length || 6,
          bRepHash
        },
        bRepHash,
        kernelVersion: '3.5.2',
        isFabricated: false
      };

      const validation: ValidationRecord = {
        validationId: 'VAL-FIXED-001',
        checks: [{ code: 'MANIFOLD', description: '2-manifold', passed: true }],
        passed: true
      };

      const verification: IndependentVerificationRecord = {
        verificationId: 'VERIF-FIXED-001',
        verifierIdentity: 'SECP-INDEPENDENT-INTEGRITY-AUDITOR',
        independentVerdict: 'PASS'
      };

      const evidence = EvidenceIntegrityEngine.generateEvidence({
        domain: 'CAD',
        documentId: doc.documentId,
        documentRevision: doc.revision,
        actionId: 'EXTRUDE_SOLID',
        executionId: resultRecord.executionId,
        capabilityId: 'BRepExtrude',
        featureId: 'EXT_01',
        result: resultRecord,
        validation,
        verification,
        sourceOrigin: 'REAL_KERNEL'
      });

      const canonicalJson = EvidenceIntegrityEngine.canonicalize(evidence.canonicalPayload);

      runResults.push({
        bRepHash,
        canonicalJson,
        integrityHash: evidence.integrityHash,
        evidenceId: evidence.evidenceId
      });
    }

    // Assert 100% bit-for-bit equality between run 1, run 2, and run 3
    expect(runResults[0].bRepHash).toBe(runResults[1].bRepHash);
    expect(runResults[1].bRepHash).toBe(runResults[2].bRepHash);

    expect(runResults[0].canonicalJson).toBe(runResults[1].canonicalJson);
    expect(runResults[1].canonicalJson).toBe(runResults[2].canonicalJson);

    expect(runResults[0].integrityHash).toBe(runResults[1].integrityHash);
    expect(runResults[1].integrityHash).toBe(runResults[2].integrityHash);

    expect(runResults[0].evidenceId).toBe(runResults[1].evidenceId);
    expect(runResults[1].evidenceId).toBe(runResults[2].evidenceId);
  });

  it('P6-002-B — Canonical Serialization & Numerical Normalization (IEEE-754 Stabilization)', () => {
    // 1. Key ordering invariance
    const objA = { z: 10, a: 'alpha', m: true };
    const objB = { a: 'alpha', m: true, z: 10 };
    expect(EvidenceIntegrityEngine.canonicalize(objA)).toBe(EvidenceIntegrityEngine.canonicalize(objB));

    // 2. Negative zero (-0) normalization
    const valNegZero = { value: -0 };
    const valPosZero = { value: 0 };
    expect(EvidenceIntegrityEngine.canonicalize(valNegZero)).toBe('{"value":0}');
    expect(EvidenceIntegrityEngine.canonicalize(valNegZero)).toBe(EvidenceIntegrityEngine.canonicalize(valPosZero));

    // 3. Float stabilization to 8 decimal places
    const floatPrecisionA = { val: 3.141592653589793 };
    const floatExpected = { val: 3.14159265 };
    expect(EvidenceIntegrityEngine.canonicalize(floatPrecisionA)).toBe(EvidenceIntegrityEngine.canonicalize(floatExpected));

    // 4. Rejection of non-finite numbers (NaN, Infinity, -Infinity)
    expect(() => EvidenceIntegrityEngine.canonicalize({ bad: NaN })).toThrow(/Non-finite number/);
    expect(() => EvidenceIntegrityEngine.canonicalize({ bad: Infinity })).toThrow(/Non-finite number/);
    expect(() => EvidenceIntegrityEngine.canonicalize({ bad: -Infinity })).toThrow(/Non-finite number/);
  });

  it('P6-002-C — Engineering Hash Chain Acceptance Gate (12/12 Cryptographic Checks PASS)', () => {
    const gateResult = EngineeringHashChainGate.evaluate();

    expect(gateResult.gateId).toBe('GATE-ENGINEERING-HASH-CHAIN');
    expect(gateResult.verdict).toBe('PASS');
    expect(gateResult.evidence.tamperDetected).toBe(false);
    expect(gateResult.checks.length).toBe(12);
    expect(gateResult.checks.every(c => c.passed)).toBe(true);
    expect(gateResult.findings.length).toBe(0);
  });

  it('P6-002-D — Tamper-Evident Merkle Chain Invalidation on Intermediate Node Mutation', () => {
    // 1. Construct authentic 3-stage chain: DESIGN -> GEOMETRY -> SIMULATION
    const content1 = { model: 'Blade', chordLengthMm: 120.0, spanMm: 350.0 };
    const identityDesign = EngineeringIdentityFactory.createIdentity({
      objectType: EngineeringObjectType.DESIGN,
      projectId: 'PRJ-TURBINE-001',
      revisionId: 'REV-01',
      createdBy: 'ENGINEER-01',
      seed: 'DESIGN-TURBINE-BLADE-01',
      timestamp: '2026-08-22T00:00:00.000Z'
    }, content1);

    const node1 = EngineeringHashChain.append({
      stage: 'DESIGN',
      artifact: content1,
      identity: identityDesign,
      createdAt: '2026-08-22T00:00:00.000Z'
    });

    const content2 = { bRepHash: 'HASH-BREP-TURBINE-01', volumeMm3: 420000.0 };
    const identityGeom = EngineeringIdentityFactory.createIdentity({
      objectType: EngineeringObjectType.PART,
      projectId: 'PRJ-TURBINE-001',
      revisionId: 'REV-01',
      createdBy: 'ENGINEER-01',
      seed: 'GEOM-TURBINE-BLADE-01',
      timestamp: '2026-08-22T00:00:00.000Z'
    }, content2);

    const node2 = EngineeringHashChain.append({
      stage: 'GEOMETRY',
      artifact: content2,
      identity: identityGeom,
      previousNode: node1,
      createdAt: '2026-08-22T00:01:00.000Z'
    });

    const content3 = { solver: 'CFD-RANS', liftCoefficient: 1.45, dragCoefficient: 0.082 };
    const identitySim = EngineeringIdentityFactory.createIdentity({
      objectType: EngineeringObjectType.SIMULATION,
      projectId: 'PRJ-TURBINE-001',
      revisionId: 'REV-01',
      createdBy: 'ENGINEER-01',
      seed: 'SIM-TURBINE-BLADE-01',
      timestamp: '2026-08-22T00:00:00.000Z'
    }, content3);

    const node3 = EngineeringHashChain.append({
      stage: 'SIMULATION',
      artifact: content3,
      identity: identitySim,
      previousNode: node2,
      createdAt: '2026-08-22T00:02:00.000Z'
    });

    // 2. Verify pristine chain -> PASS
    const verifyPristine = EngineeringHashChain.verify([node1, node2, node3]);
    expect(verifyPristine.valid).toBe(true);
    expect(verifyPristine.checkedNodes).toBe(3);

    // 3. Tamper with intermediate node (node2 canonicalHash altered)
    const tamperedNode2 = {
      ...node2,
      canonicalHash: '0000000000000000000000000000000000000000000000000000000000000000'
    };

    const verifyTampered = EngineeringHashChain.verify([node1, tamperedNode2, node3]);
    expect(verifyTampered.valid).toBe(false);
    expect(verifyTampered.firstBrokenIndex).toBe(1);
    expect(verifyTampered.failureReason).toBe('HASH_MISMATCH');

    // 4. Tamper with previous link
    const brokenLinkNode3 = {
      ...node3,
      previousHash: 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'
    };

    const verifyBrokenLink = EngineeringHashChain.verify([node1, node2, brokenLinkNode3]);
    expect(verifyBrokenLink.valid).toBe(false);
    expect(verifyBrokenLink.firstBrokenIndex).toBe(2);
    expect(verifyBrokenLink.failureReason).toBe('BROKEN_PREVIOUS_LINK');
  });

  it('P6-002-E — Adversarial Payload Mutation Detection (Anti-Tamper Integrity Failure)', () => {
    const doc = createCanonicalCADDocument('DOC-TAMPER-TEST', 25, 1);
    const evalResult = DocumentEvaluator.evaluate(doc);

    const actualResult: EngineeringResultRecord = {
      resultId: 'RES-STRESS-001',
      domain: 'CAD',
      executionId: 'EXEC-STRESS-001',
      outputMetrics: {
        volume: 100000,
        maxVonMisesMpa: 142.5
      },
      bRepHash: evalResult.derivedArtifacts?.bRepHash || 'BREP-001',
      kernelVersion: '3.5.2',
      isFabricated: false
    };

    const validation: ValidationRecord = {
      validationId: 'VAL-STRESS-001',
      checks: [{ code: 'YIELD', description: 'Stress below yield', passed: true }],
      passed: true
    };

    const verification: IndependentVerificationRecord = {
      verificationId: 'VERIF-STRESS-001',
      verifierIdentity: 'SECP-INDEPENDENT-INTEGRITY-AUDITOR',
      independentVerdict: 'PASS'
    };

    const evidence = EvidenceIntegrityEngine.generateEvidence({
      domain: 'CAD',
      documentId: doc.documentId,
      documentRevision: 1,
      actionId: 'FEA_SOLVE',
      executionId: actualResult.executionId,
      capabilityId: 'LinearElastic',
      featureId: 'EXT_01',
      result: actualResult,
      validation,
      verification,
      sourceOrigin: 'REAL_KERNEL'
    });

    // Pristine verification passes
    const auditClean = IndependentEvidenceIntegrityVerifier.verifyEvidence(evidence, {
      currentDocumentRevision: 1,
      actualResult
    });
    expect(auditClean.passed).toBe(true);

    // Adversary mutates maxVonMisesMpa from 142.5 to 42.5 in canonicalPayload without updating integrityHash
    const tamperedPayload = {
      ...evidence.canonicalPayload,
      metrics: {
        ...evidence.canonicalPayload.metrics,
        maxVonMisesMpa: 42.5 // Falsified stress metric!
      }
    };

    const tamperedEvidence: CanonicalEvidenceRecord = {
      ...evidence,
      canonicalPayload: tamperedPayload
    };

    const auditTampered = IndependentEvidenceIntegrityVerifier.verifyEvidence(tamperedEvidence, {
      currentDocumentRevision: 1,
      actualResult
    });

    expect(auditTampered.passed).toBe(false);
    expect(auditTampered.verdict).toBe('INTEGRITY_FAILURE');
    expect(auditTampered.checks.some(c => c.checkCode === 'CHK-002-HASH-INTEGRITY' && !c.passed)).toBe(true);
    expect(auditTampered.failureReasons).toContain('Integrity hash mismatch: payload has been tampered or corrupted');
  });

  it('P6-002-F — Cryptographic Attestation Signature Integrity', () => {
    const keyPair: SigningKeyPair = {
      keyId: 'KEY-TEST-001',
      publicKey: 'SECRET_SIGNING_KEY_XYZ_12345',
      privateKey: 'SECRET_SIGNING_KEY_XYZ_12345',
      algorithm: 'HMAC-SHA256'
    };

    const attestationResult = CryptographicAttestationEngine.createAttestation({
      subject: {
        subjectId: 'PART-WING-RIB',
        subjectType: 'PART_RESULT',
        revision: 'REV-01',
        artifactHash: 'HASH-AUTHENTIC-ARTIFACT-01'
      },
      evidence: {
        evidenceId: 'EVD-ATT-001',
        evidenceType: 'STRUCTURAL_EVIDENCE',
        payload: { deflectionMm: 0.12, safetyMargin: 2.1 },
        resultHash: 'HASH-AUTHENTIC-ARTIFACT-01'
      },
      executionContext: {
        executionId: 'EXEC-ATT-001',
        solverIdentity: 'FEA-KERNEL-V3',
        solverVersion: '3.0.1',
        engineeringIdentity: 'SECP-CHIEF-ENGINEER',
        inputs: { loadKn: 50.0 },
        outputs: { deflectionMm: 0.12 },
        inputHash: 'HASH-LOAD-50KN',
        outputHash: 'HASH-AUTHENTIC-ARTIFACT-01'
      },
      keyPair
    });

    expect(attestationResult.attestation).toBeDefined();

    // Verify pristine attestation
    const verifyClean = CryptographicAttestationEngine.verifyAttestation(
      attestationResult.attestation,
      {
        trustedPublicKeys: {
          [keyPair.keyId]: keyPair.publicKey
        }
      }
    );
    expect(verifyClean.verdict).toBe('VALID');
    expect(verifyClean.integrityVerified).toBe(true);
    expect(verifyClean.signatureVerified).toBe(true);

    // Tamper with attestation signature
    const tamperedAttestation = {
      ...attestationResult.attestation,
      signature: 'INVALID_FORGED_SIGNATURE_BYTES'
    };

    const verifyTampered = CryptographicAttestationEngine.verifyAttestation(
      tamperedAttestation,
      {
        trustedPublicKeys: {
          [keyPair.keyId]: keyPair.publicKey
        }
      }
    );
    expect(verifyTampered.signatureVerified).toBe(false);
    expect(verifyTampered.verdict).toBe('SIGNATURE_INVALID');
  });

  it('P6-002-G — Downstream Certification Truth Promotion Gate: Unconverged Result Strictly Rejected', () => {
    const simEngine = SimulationCertificateEngine.getInstance();
    simEngine.resetRegistry();

    const simId = 'SIM-UNCONVERGED-001';

    const inputManifest: SimulationInputManifest = simEngine.buildSimulationInputManifest({
      simulationId: simId,
      simulationType: 'FEM',
      projectId: 'PRJ-AERO-02',
      engineeringObjectId: 'DOC-BRACKET-01',
      objectRevision: 'REV-01',
      modelHash: 'HASH-CAD-BRACKET',
      geometryHash: 'HASH-CAD-BRACKET',
      meshHash: 'HASH-TET-MESH',
      materialHash: 'HASH-TITANIUM-6AL4V',
      boundaryConditionHash: 'HASH-BC-FIXED',
      initialConditionHash: 'HASH-IC-ZERO',
      solverConfigurationHash: 'HASH-SOLV-NONLINEAR',
      feaParameters: {
        analysisType: 'NONLINEAR_STATIC',
        elementOrder: 'quadratic',
        materials: {},
        loads: {},
        constraints: {},
        meshSettings: {},
        solverSettings: {},
        convergenceTolerance: 1e-5,
        maxIterations: 100
      }
    });

    const executionManifest: SimulationExecutionManifest = simEngine.buildSimulationExecutionManifest({
      executionId: 'EXEC-FEM-FAIL',
      simulationId: simId,
      solverIdentity: 'FEM-NONLINEAR-SOLVER',
      solverVersion: '3.1.0',
      runtime: 'Node.js',
      platform: 'Linux-x86_64',
      configuration: { threads: 16 },
      startTime: '2026-08-22T01:00:00Z',
      endTime: '2026-08-22T01:30:00Z',
      iterationCount: 100,
      terminationReason: 'MAX_ITERATIONS_REACHED' // Iteration cap reached without convergence!
    });

    const resultManifest: SimulationResultManifest = simEngine.buildSimulationResultManifest({
      resultId: 'RES-FEM-UNCONVERGED',
      resultHash: 'HASH-NON-CONVERGED-RES',
      fieldHashes: {},
      scalarResults: { maxStress: 850.0 },
      residualHistory: [{ equilibriumResidual: 0.12 }],
      conservationMetrics: { energyError: 0.05, isConserved: false }, // Energy not conserved!
      convergenceMetrics: { isConverged: false, residualTolerance: 1e-5, finalResiduals: { equilibrium: 0.12 } },
      solverTerminationState: 'DIVERGED'
    });

    const matrix: SimulationVerificationMatrix = simEngine.buildSimulationVerificationMatrix({
      verificationId: 'MAT-FEM-UNCONVERGED',
      simulationId: simId,
      resultId: resultManifest.resultId,
      claims: [
        { claimId: 'CLM-01', claimType: 'CONVERGENCE', description: 'Equilibrium convergence', passed: false, evidenceReference: 'RES-FEM-UNCONVERGED' },
        { claimId: 'CLM-02', claimType: 'CONSERVATION', description: 'Energy conservation', passed: false, evidenceReference: 'RES-FEM-UNCONVERGED' }
      ]
    });

    const keyPair: SigningKeyPair = {
      keyId: 'KEY-AUTH-02',
      publicKey: 'PUBLIC_KEY_PEM_02',
      privateKey: 'PRIVATE_KEY_PEM_02',
      algorithm: 'ECDSA_SHA256'
    };

    const attestationResult = CryptographicAttestationEngine.createAttestation({
      subject: {
        subjectId: 'DOC-BRACKET-01',
        subjectType: 'FEM_RESULT',
        revision: 'REV-01',
        artifactHash: resultManifest.resultHash
      },
      evidence: {
        evidenceId: matrix.verificationId,
        evidenceType: 'SIMULATION_MATRIX',
        payload: { claims: matrix.claims },
        resultHash: resultManifest.resultHash
      },
      executionContext: {
        executionId: executionManifest.executionId,
        solverIdentity: executionManifest.solverIdentity,
        solverVersion: executionManifest.solverVersion,
        engineeringIdentity: 'SECP-SIMULATION-AUTHORITY',
        inputs: inputManifest,
        outputs: resultManifest,
        inputHash: inputManifest.inputHash,
        outputHash: resultManifest.resultHash
      },
      keyPair
    });

    const strictPolicy: SimulationCertificationPolicy = {
      policyId: 'POL-CRITICAL-FLIGHT',
      policyVersion: '1.0.0',
      requiredClaims: ['CONVERGENCE', 'CONSERVATION'],
      minCertificationLevel: 4,
      requiredSolverIdentity: 'FEM-NONLINEAR-SOLVER',
      requiredSolverVersion: '3.1.0',
      requireConvergence: true,
      requireConservation: true,
      requireStability: true
    };

    const certOutcome = simEngine.createSimulationCertificate({
      input: inputManifest,
      execution: executionManifest,
      result: resultManifest,
      matrix,
      attestation: attestationResult.attestation,
      policy: strictPolicy,
      issuer: 'SECP-AEROSPACE-AUTHORITY',
      keyPair
    });

    // Promotion to CERTIFIED status must be STRICTLY REJECTED
    expect(certOutcome.success).toBe(false);
    expect(certOutcome.certificate?.certificationStatus).toBe('REJECTED');
    expect(certOutcome.certificate?.certificationLevel).toBe(0);
  });
});
