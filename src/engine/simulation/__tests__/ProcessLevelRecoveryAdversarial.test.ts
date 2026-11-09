import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { BRepKernel } from '../../cad-kernel/brep/BRepKernel';
import { CFDAdapter } from '../../cad-kernel/cfd/CFDAdapter';
import { Fvm3DNavierStokesSolver } from '../../cfd3d/Fvm3DNavierStokesSolver';
import { CanonicalDomainBindingEngine } from '../../crossdomain/CanonicalDomainBindingEngine';
import { CfdToCoreBinding } from '../../crossdomain/CanonicalDomainBinding';
import { 
  initializeAuthorityHandshake, 
  revokeAuthorityState, 
  computeHMACSealToken, 
  verifyHMACSealToken,
  getActiveKeyVersion,
  getAuthorityInitializationState
} from '../SimulationAuthorityInternal';
import { issueSealingCapability } from '../SimulationSealingAuthorization';
import { SimulationExecutionRegistry } from '../SimulationExecutionRegistry';
import { 
  IndependentPersistentEvidenceVerifier, 
  PersistentEvidenceChain 
} from '../../plm_evidence/IndependentPersistentEvidenceVerifier';

describe('SECP-CAD-TRUTH-PATCH-003B — Cryptographic Trust Boundary & Process-Level Recovery Test Battery', () => {
  const brepKernel = BRepKernel.getCanonical();
  const testTmpDir = path.join(process.cwd(), 'tmp_test_p003b');

  beforeAll(() => {
    if (!fs.existsSync(testTmpDir)) {
      fs.mkdirSync(testTmpDir, { recursive: true });
    }
  });

  beforeEach(() => {
    process.env.SECP_AUTHORITY_SECRET = 'TEST_SECRET_KEY_3B_9999999999999999';
    process.env.SECP_AUTHORITY_KEY_VERSION = 'v1_test_key_3b';
    revokeAuthorityState();
    initializeAuthorityHandshake();
    SimulationExecutionRegistry.clear();
  });

  function buildValidChain(revId = 'REV-P003B', name = 'Pipe_P003B'): PersistentEvidenceChain {
    const pipe = brepKernel.createCylinder(0.02, 0.15, name);
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
      'TOPO-P003B',
      'MAT-AIR',
      'ENV-STD',
      'PHYS-CFD'
    ) as CfdToCoreBinding;

    CanonicalDomainBindingEngine.sealBinding(binding, cap, revId);

    const solverConfig = { maxIterations: 5, continuityTol: 1e-4, momentumTol: 1e-4 };
    const solution = Fvm3DNavierStokesSolver.solve(binding, solverConfig);

    const chain: PersistentEvidenceChain = {
      canonicalRevision: {
        revisionHash: revId,
        entityName: name,
        timestamp: new Date().toISOString(),
        author: 'Lead Forensic Engineer'
      },
      bRepGeometry: {
        geometryHash: brepHash,
        topologyType: 'CYLINDER',
        surfaceArea: 0.0125,
        volume: 0.000188,
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
        keyVersion: binding.executionAuthority.keyVersion || getActiveKeyVersion() || 'v1'
      },
      executionRecord: {
        executionId: `EXEC-${brepHash.substring(0, 8)}`,
        domain: 'CFD',
        bindingId: binding.bindingId,
        cadRevisionHash: revId,
        canonicalGeometryHash: brepHash,
        inputHash: IndependentPersistentEvidenceVerifier.sha256(JSON.stringify(solverConfig)),
        resultHash: solution.solutionHash || 'SOL_HASH_3B',
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
        artifactKind: 'CFD_RESULT_003B',
        cadRevisionHash: revId,
        canonicalGeometryHash: brepHash
      }
    };

    chain.contentDigest = IndependentPersistentEvidenceVerifier.computeChainDigest(chain);
    return chain;
  }

  // --- SUB-BATTERY 1: CRYPTOGRAPHIC TRUST BOUNDARY & HMAC KEY MANAGEMENT ---

  it('TB-01: should fail-closed and return false for seal verification when authority state is UNINITIALIZED', () => {
    revokeAuthorityState(); // Force state to UNINITIALIZED
    expect(getAuthorityInitializationState()).toBe('UNINITIALIZED');

    const verified = verifyHMACSealToken('ANY_SEAL', 'CFD', 'ENTITY', 'REV1', 'GEO1', 'CAD_CFD_TRUTH_BATTERY', 'v1');
    expect(verified).toBe(false);
  });

  it('TB-02: should reject forged seal tokens with invalid HMAC signatures', () => {
    const activeKey = getActiveKeyVersion()!;
    const forgedToken = '0000111122223333444455556666777788889999aaaabbbbccccddddeeeeffff';

    const verified = verifyHMACSealToken(forgedToken, 'CFD', 'Pipe_P003B', 'REV-P003B', 'GEO_HASH', 'CAD_CFD_TRUTH_BATTERY', activeKey);
    expect(verified).toBe(false);
  });

  it('TB-03: should reject verification when target keyVersion does not match active authority keyVersion', () => {
    const cap = issueSealingCapability('CAD_CFD_TRUTH_BATTERY', ['CFD'], {
      cadRevisionHash: 'REV-K1',
      canonicalGeometryHash: 'GEO-K1'
    });
    const { sealToken, keyVersion } = computeHMACSealToken(cap, 'CFD', 'ENTITY-K1', 'REV-K1', 'GEO-K1');

    // Attempt verification with an untrusted / mismatched key version
    const verified = verifyHMACSealToken(sealToken, 'CFD', 'ENTITY-K1', 'REV-K1', 'GEO-K1', 'CAD_CFD_TRUTH_BATTERY', 'UNTRUSTED_KEY_V99');
    expect(verified).toBe(false);
  });

  it('TB-04: should reject seal signature swapping between different CAD revisions or entities', () => {
    const cap = issueSealingCapability('CAD_CFD_TRUTH_BATTERY', ['CFD'], {
      cadRevisionHash: 'REV-ORIGINAL',
      canonicalGeometryHash: 'GEO-ORIGINAL'
    });
    const { sealToken } = computeHMACSealToken(cap, 'CFD', 'ENTITY-ORIGINAL', 'REV-ORIGINAL', 'GEO-ORIGINAL');

    // Attempt to reuse seal token for a different entity/revision
    const swappedEntityVer = verifyHMACSealToken(sealToken, 'CFD', 'ENTITY-SWAPPED', 'REV-ORIGINAL', 'GEO-ORIGINAL', 'CAD_CFD_TRUTH_BATTERY');
    const swappedRevVer = verifyHMACSealToken(sealToken, 'CFD', 'ENTITY-ORIGINAL', 'REV-SWAPPED', 'GEO-ORIGINAL', 'CAD_CFD_TRUTH_BATTERY');

    expect(swappedEntityVer).toBe(false);
    expect(swappedRevVer).toBe(false);
  });

  // --- SUB-BATTERY 2: PROCESS-LEVEL COLD START RECOVERY & DISK TAMPERING ---

  it('TB-05: should write evidence chain JSON to disk and verify cleanly post-reload in fresh process context', () => {
    const chain = buildValidChain('REV-DISK-01', 'Pipe_Disk_01');
    const filePath = path.join(testTmpDir, 'valid_evidence_chain.json');

    // Export and write to disk
    const jsonContent = IndependentPersistentEvidenceVerifier.exportChainToJson(chain);
    fs.writeFileSync(filePath, jsonContent, 'utf-8');

    // Simulate cold-start read from disk
    const diskRaw = fs.readFileSync(filePath, 'utf-8');
    SimulationExecutionRegistry.clear(); // purge memory

    const result = IndependentPersistentEvidenceVerifier.verifySerializedChain(diskRaw);
    expect(result.isValid).toBe(true);
    expect(result.provenanceValid).toBe(true);
    expect(result.outcome).toBe('NUMERICAL_QUALIFICATION_PENDING');
  });

  it('TB-05B: should verify evidence chain via isolated subprocess CLI execution (genuine out-of-process cold start)', () => {
    const { spawnSync } = require('child_process');
    const chain = buildValidChain('REV-SUBPROC-01', 'Pipe_Subprocess_01');
    const filePath = path.join(testTmpDir, 'subprocess_evidence_chain.json');

    fs.writeFileSync(filePath, IndependentPersistentEvidenceVerifier.exportChainToJson(chain), 'utf-8');

    // Execute standalone verifier process out-of-process
    const cliScript = path.join(process.cwd(), 'src/engine/plm_evidence/cli/standaloneVerifierProcess.ts');
    const subproc = spawnSync('npx', ['tsx', cliScript, filePath], { encoding: 'utf-8', env: process.env });

    expect(subproc.status).toBe(0);
    const parsed = JSON.parse(subproc.stdout);
    expect(parsed.isValid).toBe(true);
    expect(parsed.provenanceValid).toBe(true);
    expect(parsed.outcome).toBe('NUMERICAL_QUALIFICATION_PENDING');

    // Tamper with file on disk and re-run subprocess
    const diskChain = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    diskChain.executionRecord.resultHash = 'MUTATED_SUBPROCESS_HASH';
    fs.writeFileSync(filePath, JSON.stringify(diskChain, null, 2), 'utf-8');

    const tamperedSubproc = spawnSync('npx', ['tsx', cliScript, filePath], { encoding: 'utf-8', env: process.env });
    expect(tamperedSubproc.status).not.toBe(0);
    const tamperedParsed = JSON.parse(tamperedSubproc.stdout);
    expect(tamperedParsed.isValid).toBe(false);
  });

  it('TB-06: should detect post-reload disk-level file tampering when payload is mutated on disk', () => {
    const chain = buildValidChain('REV-DISK-02', 'Pipe_Disk_02');
    const filePath = path.join(testTmpDir, 'tampered_evidence_chain.json');

    const jsonContent = IndependentPersistentEvidenceVerifier.exportChainToJson(chain);
    fs.writeFileSync(filePath, jsonContent, 'utf-8');

    // Read back and tamper with executionRecord.resultHash on disk
    const diskChain: PersistentEvidenceChain = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    diskChain.executionRecord!.resultHash = 'MUTATED_RESULT_HASH_999999999999'; // Mutated field in contentDigest
    // Note: contentDigest stored on chain is now stale!
    fs.writeFileSync(filePath, JSON.stringify(diskChain, null, 2), 'utf-8');

    // Cold reload
    const tamperedRaw = fs.readFileSync(filePath, 'utf-8');
    const result = IndependentPersistentEvidenceVerifier.verifySerializedChain(tamperedRaw);

    expect(result.isValid).toBe(false);
    expect(result.outcome).toBe('PROVENANCE_REJECTED');
    expect(result.reconstructionErrors.some(e => e.includes('CONTENT_DIGEST_MUTATED'))).toBe(true);
  });

  it('TB-07: should reject payload mutation even if attacker recomputes top-level SHA-256 digest without secret HMAC key', () => {
    const chain = buildValidChain('REV-DISK-03', 'Pipe_Disk_03');
    const filePath = path.join(testTmpDir, 'forged_digest_evidence_chain.json');

    // Attacker modifies geometry hash and recomputes top-level contentDigest
    chain.bRepGeometry!.geometryHash = 'FORGED_GEO_HASH_000111222333';
    chain.contentDigest = IndependentPersistentEvidenceVerifier.computeChainDigest(chain);

    const jsonContent = IndependentPersistentEvidenceVerifier.exportChainToJson(chain);
    fs.writeFileSync(filePath, jsonContent, 'utf-8');

    // Reload from disk
    const reloaded = fs.readFileSync(filePath, 'utf-8');
    const result = IndependentPersistentEvidenceVerifier.verifySerializedChain(reloaded);

    expect(result.isValid).toBe(false);
    expect(result.outcome).toBe('PROVENANCE_REJECTED');
    // HMAC signature verification fails because geometry hash in seal payload does not match secret HMAC tag
    expect(result.reconstructionErrors.some(e => e.includes('AUTHORITY_SEAL_INVALID') || e.includes('GEOMETRY_HASH_MISMATCH'))).toBe(true);
  });

  // --- SUB-BATTERY 3: REFINED NUMERICAL QUALIFICATION GUARD LOGIC ---

  it('TB-08: should reject qualification when iterations or residuals contain NaN or non-numeric values', () => {
    const chain = buildValidChain('REV-NUM-01', 'Pipe_Num_01');

    // Inject NaN into iterations
    chain.cfdResult!.iterations = NaN;
    chain.contentDigest = IndependentPersistentEvidenceVerifier.computeChainDigest(chain);

    const resultNaNIter = IndependentPersistentEvidenceVerifier.verifySerializedChain(chain);
    expect(resultNaNIter.provenanceValid).toBe(true);
    expect(resultNaNIter.numericalQualified).toBe(false);
    expect(resultNaNIter.outcome).toBe('NUMERICAL_QUALIFICATION_PENDING');
    expect(resultNaNIter.details.numericalQualificationStatus).toContain('Invalid, NaN, or non-numeric');

    // Inject NaN into residuals
    chain.cfdResult!.iterations = 10;
    chain.cfdResult!.residuals = { continuity: NaN, uMomentum: 1e-5 };
    chain.contentDigest = IndependentPersistentEvidenceVerifier.computeChainDigest(chain);

    const resultNaNRes = IndependentPersistentEvidenceVerifier.verifySerializedChain(chain);
    expect(resultNaNRes.provenanceValid).toBe(true);
    expect(resultNaNRes.numericalQualified).toBe(false);
    expect(resultNaNRes.outcome).toBe('NUMERICAL_QUALIFICATION_PENDING');
    expect(resultNaNRes.details.numericalQualificationStatus).toContain('Invalid, NaN, or non-numeric');
  });

  it('TB-09: should reject qualification when top-level and nested numerical fields conflict', () => {
    const chain = buildValidChain('REV-NUM-02', 'Pipe_Num_02');

    // Inject conflicting flags: top says converged: true, nested says converged: false / MAX_ITERATIONS_REACHED
    chain.cfdResult = {
      executionId: 'EXEC-CONFLICT',
      status: 'CONVERGED',
      converged: true,
      terminationReason: 'CONVERGED',
      iterations: 20,
      forceStabilityPassed: true,
      numericalQualification: {
        converged: false, // CONFLICT!
        terminationReason: 'MAX_ITERATIONS_REACHED', // CONFLICT!
        iterations: 20,
        forceStabilityPassed: false
      }
    };
    chain.contentDigest = IndependentPersistentEvidenceVerifier.computeChainDigest(chain);

    const result = IndependentPersistentEvidenceVerifier.verifySerializedChain(chain);
    expect(result.provenanceValid).toBe(true);
    expect(result.numericalQualified).toBe(false);
    expect(result.outcome).toBe('NUMERICAL_QUALIFICATION_PENDING');
    expect(result.details.numericalQualificationStatus).toContain('Conflicting or contradictory');
  });

  it('TB-10: should reject qualification when converged is claimed alongside MAX_ITERATIONS_REACHED or forceStabilityPassed: false', () => {
    const chain = buildValidChain('REV-NUM-03', 'Pipe_Num_03');

    // Contradictory claim: converged: true, but terminationReason: 'MAX_ITERATIONS_REACHED'
    chain.cfdResult = {
      executionId: 'EXEC-CONTRADICT',
      status: 'CONVERGED',
      converged: true,
      terminationReason: 'MAX_ITERATIONS_REACHED', // CONTRADICTION!
      iterations: 50,
      forceStabilityPassed: true
    };
    chain.contentDigest = IndependentPersistentEvidenceVerifier.computeChainDigest(chain);

    const result = IndependentPersistentEvidenceVerifier.verifySerializedChain(chain);
    expect(result.provenanceValid).toBe(true);
    expect(result.numericalQualified).toBe(false);
    expect(result.outcome).toBe('NUMERICAL_QUALIFICATION_PENDING');
    expect(result.details.numericalQualificationStatus).toContain('Conflicting or contradictory');
  });
});
