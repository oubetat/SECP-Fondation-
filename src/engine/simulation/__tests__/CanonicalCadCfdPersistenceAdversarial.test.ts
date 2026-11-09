import { describe, it, expect, beforeAll } from 'vitest';
import { BRepKernel } from '../../cad-kernel/brep/BRepKernel';
import { CFDAdapter } from '../../cad-kernel/cfd/CFDAdapter';
import { Fvm3DNavierStokesSolver } from '../../cfd3d/Fvm3DNavierStokesSolver';
import { CanonicalDomainBindingEngine } from '../../crossdomain/CanonicalDomainBindingEngine';
import { CfdToCoreBinding } from '../../crossdomain/CanonicalDomainBinding';
import { initializeAuthorityHandshake } from '../SimulationAuthorityInternal';
import { issueSealingCapability } from '../SimulationSealingAuthorization';
import { SimulationExecutionRegistry } from '../SimulationExecutionRegistry';
import { 
  IndependentPersistentEvidenceVerifier, 
  PersistentEvidenceChain 
} from '../../plm_evidence/IndependentPersistentEvidenceVerifier';

describe('SECP-CAD-TRUTH-PATCH-003 — Persistent Engineering Truth & Tamper Battery', () => {
  const brepKernel = BRepKernel.getCanonical();

  beforeAll(() => {
    initializeAuthorityHandshake();
    SimulationExecutionRegistry.clear();
  });

  // Helper to build a valid complete PersistentEvidenceChain object
  function buildValidChain(revId = 'REV-CAD-P003', name = 'Test_Pipe_P003'): PersistentEvidenceChain {
    const pipe = brepKernel.createCylinder(0.015, 0.12, name);
    const { mesh, brepHash, meshHash } = CFDAdapter.meshFromBRep(pipe, {
      nx: 4, ny: 2, nz: 2,
      cadRevisionHash: revId
    });

    const cap = issueSealingCapability('CAD_CFD_TRUTH_BATTERY', ['CFD'], {
      cadRevisionHash: revId,
      canonicalGeometryHash: brepHash
    });

    const binding = CanonicalDomainBindingEngine.createBinding(
      'CFD',
      name,
      revId,
      { mesh, fluid: { densityKgM3: 1.225, viscosityPaS: 1.8e-5 } },
      brepHash,
      'TOPO-P003',
      'MAT-AIR',
      'ENV-STD',
      'PHYS-CFD'
    ) as CfdToCoreBinding;

    CanonicalDomainBindingEngine.sealBinding(binding, cap, revId);

    const solverConfig = {
      maxIterations: 5,
      continuityTol: 1e-4,
      momentumTol: 1e-4
    };

    const solution = Fvm3DNavierStokesSolver.solve(binding, solverConfig);

    const chain: PersistentEvidenceChain = {
      canonicalRevision: {
        revisionHash: revId,
        entityName: name,
        timestamp: new Date().toISOString(),
        author: 'Lead Structural Engineer'
      },
      bRepGeometry: {
        geometryHash: brepHash,
        topologyType: 'CYLINDER',
        surfaceArea: 0.0113,
        volume: 0.000084,
        faceCount: 3,
        edgeCount: 2,
        topologyFaceIds: ['FACE_SIDE_1', 'FACE_CAP_TOP', 'FACE_CAP_BOT'],
        topologyEdgeIds: ['EDGE_CIRC_1', 'EDGE_CIRC_2']
      },
      meshProvenance: {
        meshHash,
        sourceGeometryHash: brepHash,
        sourceRevisionHash: revId,
        elementCount: mesh.cells.length,
        nodeCount: mesh.faces.length,
        timestamp: new Date().toISOString(),
        provenanceDigest: IndependentPersistentEvidenceVerifier.sha256(`${meshHash}:${brepHash}:${revId}`)
      },
      executionAuthority: {
        isAuthoritative: true,
        executionSealToken: binding.executionAuthority.executionSealToken,
        timestamp: binding.executionAuthority.timestamp,
        originatingCoreRevision: revId,
        domain: 'CFD',
        canonicalEntityId: name,
        executionContext: 'CAD_CFD_TRUTH_BATTERY',
        keyVersion: binding.executionAuthority.keyVersion || 'v1'
      },
      executionRecord: {
        executionId: `EXEC-${brepHash.substring(0, 8)}`,
        domain: 'CFD',
        bindingId: binding.bindingId,
        cadRevisionHash: revId,
        canonicalGeometryHash: brepHash,
        inputHash: IndependentPersistentEvidenceVerifier.sha256(JSON.stringify(solverConfig)),
        resultHash: solution.solutionHash || 'SOL_HASH_123',
        timestamp: new Date().toISOString(),
        solverConfiguration: solverConfig
      },
      cfdResult: {
        executionId: `EXEC-${brepHash.substring(0, 8)}`,
        status: solution.status || 'STABLE',
        converged: solution.converged || false,
        terminationReason: solution.numericalQualification?.terminationReason || 'MAX_ITERATIONS_REACHED',
        iterations: solution.numericalQualification?.iterations || 5,
        forceStabilityPassed: solution.numericalQualification?.forceStabilityPassed ?? false,
        provenanceIntegrity: solution.provenanceIntegrity,
        numericalQualification: solution.numericalQualification
      },
      derivedEvidence: {
        artifactDigest: solution.derivedArtifactBinding?.artifactDigest || IndependentPersistentEvidenceVerifier.sha256(`DERIVED_${revId}_${brepHash}`),
        artifactKind: 'CFD_RESULT_003',
        cadRevisionHash: revId,
        canonicalGeometryHash: brepHash
      }
    };

    chain.contentDigest = IndependentPersistentEvidenceVerifier.computeChainDigest(chain);
    return chain;
  }

  // T01: meshHash Mutation / Tampering
  it('T01: should reject reconstruction when meshHash in meshProvenance is tampered', () => {
    const chain = buildValidChain('REV-T01', 'Pipe_T01');
    chain.meshProvenance!.meshHash = 'TAMPERED_MESH_HASH_999999999999';

    const jsonStr = IndependentPersistentEvidenceVerifier.exportChainToJson(chain);
    const result = IndependentPersistentEvidenceVerifier.verifySerializedChain(jsonStr);

    expect(result.outcome).toBe('PROVENANCE_REJECTED');
    expect(result.isValid).toBe(false);
    expect(result.provenanceValid).toBe(false);
    expect(result.details.meshProvenanceVerified).toBe(false);
  });

  // T02: Geometry Swapping
  it('T02: should reject reconstruction when geometry hash is swapped with a different B-Rep', () => {
    const chain = buildValidChain('REV-T02', 'Pipe_T02');
    chain.meshProvenance!.sourceGeometryHash = 'SWAPPED_BREP_GEOMETRY_HASH_ABCDEF123456';

    const result = IndependentPersistentEvidenceVerifier.verifySerializedChain(chain);

    expect(result.outcome).toBe('PROVENANCE_REJECTED');
    expect(result.isValid).toBe(false);
    expect(result.reconstructionErrors.some(e => e.includes('GEOMETRY_HASH_MISMATCH'))).toBe(true);
  });

  // T03: Execution ID & Authority Seal Forgery
  it('T03: should reject reconstruction when execution authority seal token is forged', () => {
    const chain = buildValidChain('REV-T03', 'Pipe_T03');
    chain.executionAuthority!.executionSealToken = 'FORGED_INVALID_HMAC_SEAL_TOKEN_X999';

    const result = IndependentPersistentEvidenceVerifier.verifySerializedChain(chain);

    expect(result.outcome).toBe('PROVENANCE_REJECTED');
    expect(result.isValid).toBe(false);
    expect(result.reconstructionErrors.some(e => e.includes('AUTHORITY_SEAL_INVALID'))).toBe(true);
  });

  // T04: Record Deletion / Missing Lineage Link
  it('T04: should return PROVENANCE_INCOMPLETE when meshProvenance link is omitted', () => {
    const chain = buildValidChain('REV-T04', 'Pipe_T04');
    delete chain.meshProvenance;

    const result = IndependentPersistentEvidenceVerifier.verifySerializedChain(chain);

    expect(result.outcome).toBe('PROVENANCE_INCOMPLETE');
    expect(result.isValid).toBe(false);
    expect(result.details.missingLinks).toContain('meshProvenance');
  });

  // T05: Configuration / Input Parameter Mutation
  it('T05: should reject reconstruction when solver configuration parameters are mutated post-solve', () => {
    const chain = buildValidChain('REV-T05', 'Pipe_T05');
    chain.executionRecord!.configDigest = 'STALE_CONFIG_DIGEST_HASH_123';

    const result = IndependentPersistentEvidenceVerifier.verifySerializedChain(chain);

    expect(result.outcome).toBe('PROVENANCE_REJECTED');
    expect(result.isValid).toBe(false);
    expect(result.reconstructionErrors.some(e => e.includes('INPUT_DIGEST_MISMATCH'))).toBe(true);
  });

  // T06: Stale Revision Reuse
  it('T06: should reject reconstruction when CAD revision hash in meshProvenance is stale', () => {
    const chain = buildValidChain('REV-T06', 'Pipe_T06');
    chain.meshProvenance!.sourceRevisionHash = 'REV-OLD-STALE-000';

    const result = IndependentPersistentEvidenceVerifier.verifySerializedChain(chain);

    expect(result.outcome).toBe('PROVENANCE_REJECTED');
    expect(result.isValid).toBe(false);
    expect(result.reconstructionErrors.some(e => e.includes('STALE_REVISION_DISCREPANCY'))).toBe(true);
  });

  // T07: Missing Link Rejection (Missing Canonical Revision)
  it('T07: should return PROVENANCE_INCOMPLETE when canonicalRevision link is missing', () => {
    const chain = buildValidChain('REV-T07', 'Pipe_T07');
    delete chain.canonicalRevision;

    const result = IndependentPersistentEvidenceVerifier.verifySerializedChain(chain);

    expect(result.outcome).toBe('PROVENANCE_INCOMPLETE');
    expect(result.isValid).toBe(false);
    expect(result.details.missingLinks).toContain('canonicalRevision');
  });

  // T08: Content Digest Mutation
  it('T08: should reject reconstruction when top-level contentDigest is mutated', () => {
    const chain = buildValidChain('REV-T08', 'Pipe_T08');
    chain.contentDigest = 'MUTATED_TOP_LEVEL_DIGEST_HASH_999';

    const result = IndependentPersistentEvidenceVerifier.verifySerializedChain(chain);

    expect(result.outcome).toBe('PROVENANCE_REJECTED');
    expect(result.isValid).toBe(false);
    expect(result.reconstructionErrors.some(e => e.includes('CONTENT_DIGEST_MUTATED'))).toBe(true);
  });

  // T09: Independent Store Reload / Cold-Start Reconstruction (Raw JSON Bytes)
  it('T09: should verify evidence chain strictly from raw serialized JSON bytes after clearing in-memory registry (Cold Start)', () => {
    const chain = buildValidChain('REV-T09-COLD', 'Pipe_T09');
    const jsonStr = IndependentPersistentEvidenceVerifier.exportChainToJson(chain);
    const rawBuffer = Buffer.from(jsonStr, 'utf-8');

    // Completely purge in-memory registry singletons and clear any runtime cache
    SimulationExecutionRegistry.clear();

    // Reload strictly from raw byte buffer string without any live object references
    const reloadedJson = rawBuffer.toString('utf-8');
    const result = IndependentPersistentEvidenceVerifier.verifySerializedChain(reloadedJson);

    expect(result.isValid).toBe(true);
    expect(result.provenanceValid).toBe(true);
    expect(result.outcome).toBe('NUMERICAL_QUALIFICATION_PENDING'); // Actual live solver ran 5 max iterations (non-converged)
    expect(result.details.canonicalRevisionVerified).toBe(true);
    expect(result.details.authorityVerified).toBe(true);
  });

  // T10: Missing Element / Incomplete Topology Reference Rejection
  it('T10: should reject reconstruction when topology face IDs length does not match face count', () => {
    const chain = buildValidChain('REV-T10', 'Pipe_T10');
    chain.bRepGeometry!.faceCount = 100; // Mismatch with topologyFaceIds array length (3)

    const result = IndependentPersistentEvidenceVerifier.verifySerializedChain(chain);

    expect(result.outcome).toBe('PROVENANCE_REJECTED');
    expect(result.isValid).toBe(false);
    expect(result.reconstructionErrors.some(e => e.includes('TOPOLOGY_REFERENCE_INCOMPLETE'))).toBe(true);
  });

  // T11: Strict Prohibition of MAX_ITERATIONS_REACHED as NUMERICAL_QUALIFIED
  it('T11: should STRICTLY prohibit MAX_ITERATIONS_REACHED from being marked as NUMERICAL_QUALIFIED', () => {
    const chain = buildValidChain('REV-T11-MAXITER', 'Pipe_T11');
    chain.cfdResult = {
      executionId: 'EXEC-T11',
      status: 'STABLE',
      converged: false,
      terminationReason: 'MAX_ITERATIONS_REACHED',
      iterations: 5,
      forceStabilityPassed: false,
      numericalQualification: {
        converged: false,
        terminationReason: 'MAX_ITERATIONS_REACHED',
        iterations: 5,
        forceStabilityPassed: false
      }
    };

    const result = IndependentPersistentEvidenceVerifier.verifySerializedChain(chain);

    expect(result.provenanceValid).toBe(true);
    expect(result.outcome).toBe('NUMERICAL_QUALIFICATION_PENDING');
    expect(result.numericalQualified).toBe(false);
    expect(result.outcome).not.toBe('NUMERICAL_QUALIFIED');
  });

  // T12: Status-Gating Unit Test (Synthetic Converged Fixture)
  // NOTE: This test evaluates status classification state machine logic using a synthetic converged fixture payload.
  // It DOES NOT claim that the 5-iteration live solver converged.
  it('T12: [STATUS-GATING UNIT TEST] should transition status to NUMERICAL_QUALIFIED when provided with a converged solution fixture', () => {
    const chain = buildValidChain('REV-T12-CONVERGED', 'Pipe_T12');
    // Inject synthetic converged qualification payload for status-gating unit test
    chain.cfdResult = {
      executionId: 'EXEC-T12',
      status: 'CONVERGED',
      converged: true,
      terminationReason: 'CONVERGED',
      iterations: 24,
      forceStabilityPassed: true,
      numericalQualification: {
        converged: true,
        terminationReason: 'CONVERGED',
        iterations: 24,
        forceStabilityPassed: true
      }
    };

    const result = IndependentPersistentEvidenceVerifier.verifySerializedChain(chain);

    expect(result.provenanceValid).toBe(true);
    expect(result.outcome).toBe('PROVENANCE_VERIFIED');
    expect(result.numericalQualified).toBe(true);
    expect(result.details.numericalQualificationStatus).toBe('NUMERICAL_QUALIFIED');
  });

  // T13: Save/Read Cycles & Crash Simulation Recovery
  it('T13: should handle multi-pass verification idempotently and handle malformed JSON safely', () => {
    const chain = buildValidChain('REV-T13-RECOVERY', 'Pipe_T13');
    const jsonStr = IndependentPersistentEvidenceVerifier.exportChainToJson(chain);

    // Multi-pass verification idempotence check
    const pass1 = IndependentPersistentEvidenceVerifier.verifySerializedChain(jsonStr);
    const pass2 = IndependentPersistentEvidenceVerifier.verifySerializedChain(jsonStr);

    expect(pass1.outcome).toBe(pass2.outcome);
    expect(pass1.reconstructedChainDigest).toBe(pass2.reconstructedChainDigest);

    // Crash simulation with truncated/malformed JSON
    const malformedJson = jsonStr.substring(0, Math.floor(jsonStr.length / 2));
    const crashResult = IndependentPersistentEvidenceVerifier.verifySerializedChain(malformedJson);

    expect(crashResult.outcome).toBe('PROVENANCE_REJECTED');
    expect(crashResult.isValid).toBe(false);
    expect(crashResult.reconstructionErrors[0]).toContain('DESERIALIZATION_FAILED');
  });
});
