import { describe, it, expect, beforeAll } from 'vitest';
import { BRepKernel } from '../../cad-kernel/brep/BRepKernel';
import { CFDAdapter } from '../../cad-kernel/cfd/CFDAdapter';
import { Fvm3DNavierStokesSolver } from '../../cfd3d/Fvm3DNavierStokesSolver';
import { CanonicalDomainBindingEngine } from '../../crossdomain/CanonicalDomainBindingEngine';
import { CfdToCoreBinding } from '../../crossdomain/CanonicalDomainBinding';
import { initializeAuthorityHandshake } from '../SimulationAuthorityInternal';
import { issueSealingCapability } from '../SimulationSealingAuthorization';
import { SimulationExecutionRegistry } from '../SimulationExecutionRegistry';
import { CanonicalDerivedArtifactBinding } from '../../topology/CanonicalDerivedArtifactBinding';

describe('SECP-CAD-TRUTH-PATCH-002 — Canonical CAD Identity -> CFD Execution -> Truth Binding', () => {
  const brepKernel = BRepKernel.getCanonical();

  beforeAll(() => {
    initializeAuthorityHandshake();
    SimulationExecutionRegistry.clear();
  });

  // CAD-01: Valid End-to-End Execution (Happy Path)
  it('CAD-01: should complete end-to-end provenance chain from CAD Revision to Truth Thread', () => {
    const pipe = brepKernel.createCylinder(0.01, 0.1, 'Pipe_Valid_CAD01');
    const cadRev = 'REV-CAD-01';

    const { mesh, brepHash, meshHash } = CFDAdapter.meshFromBRep(pipe, {
      nx: 5, ny: 3, nz: 3,
      inletVelocity: { x: 1.0, y: 0, z: 0 },
      cadRevisionHash: cadRev
    });

    const cap = issueSealingCapability('CAD_CFD_TRUTH_BATTERY', ['CFD'], {
      cadRevisionHash: cadRev,
      canonicalGeometryHash: brepHash
    });

    const binding = CanonicalDomainBindingEngine.createBinding(
      'CFD',
      'Pipe_Valid_CAD01',
      cadRev,
      { mesh, fluid: { densityKgM3: 1.225, viscosityPaS: 1.8e-5 } },
      brepHash,
      'TOPO-CAD01',
      'MAT-AIR',
      'ENV-STD',
      'PHYS-CFD'
    ) as CfdToCoreBinding;

    CanonicalDomainBindingEngine.sealBinding(binding, cap, cadRev);

    // Verify mesh provenance helper
    const provVerify = CanonicalDomainBindingEngine.verifyMeshProvenanceBinding(mesh, binding);
    expect(provVerify.valid).toBe(true);

    const config = {
      maxIterations: 10,
      continuityTol: 1e-4,
      momentumTol: 1e-4,
      underRelaxationVelocity: 0.7,
      underRelaxationPressure: 0.3,
      useTurbulenceModel: false,
      turbulenceScheme: 'LAMINAR' as const,
      upwindScheme: 'FIRST_ORDER_UPWIND' as const
    };

    const solution = Fvm3DNavierStokesSolver.solve(binding, config);

    expect(solution.provenanceIntegrity).toBeDefined();
    expect(solution.provenanceIntegrity?.valid).toBe(true);
    expect(solution.provenanceIntegrity?.cadRevisionHash).toBe(cadRev);
    expect(solution.provenanceIntegrity?.canonicalGeometryHash).toBe(brepHash);
    expect(solution.provenanceIntegrity?.meshHash).toBe(meshHash);

    expect(solution.numericalQualification).toBeDefined();
    expect(solution.numericalQualification?.terminationReason).toBe('MAX_ITERATIONS_REACHED');
  });

  // CAD-02: Tampered Geometry Hash in Domain Binding
  it('CAD-02: should reject execution when geometry hash in domain binding is tampered', () => {
    const pipe = brepKernel.createCylinder(0.01, 0.1, 'Pipe_CAD02');
    const { mesh, brepHash } = CFDAdapter.meshFromBRep(pipe, { nx: 4, ny: 2, nz: 2, cadRevisionHash: 'REV-CAD-02' });

    const tamperedHash = brepHash.replace(/^./, 'f');

    const cap = issueSealingCapability('CAD_CFD_TRUTH_BATTERY', ['CFD'], {
      cadRevisionHash: 'REV-CAD-02',
      canonicalGeometryHash: tamperedHash
    });

    const binding = CanonicalDomainBindingEngine.createBinding(
      'CFD',
      'Pipe_CAD02',
      'REV-CAD-02',
      { mesh, fluid: { densityKgM3: 1.225, viscosityPaS: 1.8e-5 } },
      tamperedHash, // Tampered geometry hash
      'TOPO-CAD02',
      'MAT-AIR',
      'ENV-STD',
      'PHYS-CFD'
    ) as CfdToCoreBinding;

    CanonicalDomainBindingEngine.sealBinding(binding, cap, 'REV-CAD-02');

    expect(() => Fvm3DNavierStokesSolver.solve(binding, { maxIterations: 5 })).toThrow(/CAD_CFD_PROVENANCE_VIOLATION|AUTHORITY_GATE_REJECTION/);
  });

  // CAD-03: Stale CAD Revision ID
  it('CAD-03: should reject execution when CAD revision ID in mesh provenance mismatches binding revision', () => {
    const pipe = brepKernel.createCylinder(0.01, 0.1, 'Pipe_CAD03');
    const { mesh, brepHash } = CFDAdapter.meshFromBRep(pipe, { nx: 4, ny: 2, nz: 2, cadRevisionHash: 'REV-STALE-99' });

    const cap = issueSealingCapability('CAD_CFD_TRUTH_BATTERY', ['CFD'], {
      cadRevisionHash: 'REV-CURRENT-100',
      canonicalGeometryHash: brepHash
    });

    const binding = CanonicalDomainBindingEngine.createBinding(
      'CFD',
      'Pipe_CAD03',
      'REV-CURRENT-100', // Mismatch with mesh provenance revision REV-STALE-99
      { mesh, fluid: { densityKgM3: 1.225, viscosityPaS: 1.8e-5 } },
      brepHash,
      'TOPO-CAD03',
      'MAT-AIR',
      'ENV-STD',
      'PHYS-CFD'
    ) as CfdToCoreBinding;

    CanonicalDomainBindingEngine.sealBinding(binding, cap, 'REV-CURRENT-100');

    expect(() => Fvm3DNavierStokesSolver.solve(binding, { maxIterations: 5 })).toThrow(/CAD_CFD_PROVENANCE_VIOLATION/);
  });

  // CAD-04: Mesh from different B-Rep passed to solver
  it('CAD-04: should reject solver when mesh was derived from a different B-Rep geometry', () => {
    const pipeA = brepKernel.createCylinder(0.01, 0.1, 'Pipe_CAD04_A');
    const pipeB = brepKernel.createCylinder(0.03, 0.1, 'Pipe_CAD04_B');

    const { mesh: meshA, brepHash: hashA } = CFDAdapter.meshFromBRep(pipeA, { nx: 4, ny: 2, nz: 2, cadRevisionHash: 'REV-CAD-04' });
    const { mesh: meshB, brepHash: hashB } = CFDAdapter.meshFromBRep(pipeB, { nx: 4, ny: 2, nz: 2, cadRevisionHash: 'REV-CAD-04' });

    const cap = issueSealingCapability('CAD_CFD_TRUTH_BATTERY', ['CFD'], {
      cadRevisionHash: 'REV-CAD-04',
      canonicalGeometryHash: hashA
    });

    // Binding claims geometry hashA, but payload contains meshB (derived from hashB)
    const binding = CanonicalDomainBindingEngine.createBinding(
      'CFD',
      'Pipe_CAD04_A',
      'REV-CAD-04',
      { mesh: meshB, fluid: { densityKgM3: 1.225, viscosityPaS: 1.8e-5 } },
      hashA,
      'TOPO-CAD04',
      'MAT-AIR',
      'ENV-STD',
      'PHYS-CFD'
    ) as CfdToCoreBinding;

    CanonicalDomainBindingEngine.sealBinding(binding, cap, 'REV-CAD-04');

    expect(() => Fvm3DNavierStokesSolver.solve(binding, { maxIterations: 5 })).toThrow(/CAD_CFD_PROVENANCE_VIOLATION/);
  });

  // CAD-05: Forged Execution Authority Seal
  it('CAD-05: should reject forged execution authority seal signature', () => {
    const pipe = brepKernel.createCylinder(0.01, 0.1, 'Pipe_CAD05');
    const { mesh, brepHash } = CFDAdapter.meshFromBRep(pipe, { nx: 4, ny: 2, nz: 2, cadRevisionHash: 'REV-CAD-05' });

    const binding = CanonicalDomainBindingEngine.createBinding(
      'CFD',
      'Pipe_CAD05',
      'REV-CAD-05',
      { mesh, fluid: { densityKgM3: 1.225, viscosityPaS: 1.8e-5 } },
      brepHash,
      'TOPO-CAD05',
      'MAT-AIR',
      'ENV-STD',
      'PHYS-CFD'
    ) as CfdToCoreBinding;

    // Forged seal signature
    binding.executionAuthority = {
      isAuthoritative: true,
      executionSealToken: 'FORGED_INVALID_HMAC_SEAL_TOKEN_12345',
      timestamp: new Date().toISOString(),
      originatingCoreRevision: 'REV-CAD-05'
    };

    expect(() => Fvm3DNavierStokesSolver.solve(binding, { maxIterations: 5 })).toThrow(/AUTHORITY_GATE_REJECTION|INVALID_SEAL_TOKEN/);
  });

  // CAD-06: Missing Mesh Provenance Metadata
  it('CAD-06: should reject CFD solve when mesh lacks explicit provenance metadata', () => {
    const pipe = brepKernel.createCylinder(0.01, 0.1, 'Pipe_CAD06');
    const { mesh, brepHash } = CFDAdapter.meshFromBRep(pipe, { nx: 4, ny: 2, nz: 2, cadRevisionHash: 'REV-CAD-06' });

    // Strip provenance metadata
    delete (mesh as any).provenance;
    delete (mesh as any).meshProvenance;

    const cap = issueSealingCapability('CAD_CFD_TRUTH_BATTERY', ['CFD'], {
      cadRevisionHash: 'REV-CAD-06',
      canonicalGeometryHash: brepHash
    });

    const binding = CanonicalDomainBindingEngine.createBinding(
      'CFD',
      'Pipe_CAD06',
      'REV-CAD-06',
      { mesh, fluid: { densityKgM3: 1.225, viscosityPaS: 1.8e-5 } },
      brepHash,
      'TOPO-CAD06',
      'MAT-AIR',
      'ENV-STD',
      'PHYS-CFD'
    ) as CfdToCoreBinding;

    CanonicalDomainBindingEngine.sealBinding(binding, cap, 'REV-CAD-06');

    expect(() => Fvm3DNavierStokesSolver.solve(binding, { maxIterations: 5 })).toThrow(/CAD_CFD_PROVENANCE_VIOLATION/);
  });

  // CAD-07: Unsealed / Unauthenticated Binding
  it('CAD-07: should reject unsealed binding without authority seal', () => {
    const pipe = brepKernel.createCylinder(0.01, 0.1, 'Pipe_CAD07');
    const { mesh, brepHash } = CFDAdapter.meshFromBRep(pipe, { nx: 4, ny: 2, nz: 2, cadRevisionHash: 'REV-CAD-07' });

    const unsealedBinding = CanonicalDomainBindingEngine.createBinding(
      'CFD',
      'Pipe_CAD07',
      'REV-CAD-07',
      { mesh, fluid: { densityKgM3: 1.225, viscosityPaS: 1.8e-5 } },
      brepHash,
      'TOPO-CAD07',
      'MAT-AIR',
      'ENV-STD',
      'PHYS-CFD'
    ) as CfdToCoreBinding;

    expect(() => Fvm3DNavierStokesSolver.solve(unsealedBinding, { maxIterations: 5 })).toThrow(/SIMULATION_AUTHORITY_VIOLATION/);
  });

  // CAD-08: Stale Binding Status
  it('CAD-08: should reject binding marked with status STALE', () => {
    const pipe = brepKernel.createCylinder(0.01, 0.1, 'Pipe_CAD08');
    const { mesh, brepHash } = CFDAdapter.meshFromBRep(pipe, { nx: 4, ny: 2, nz: 2, cadRevisionHash: 'REV-CAD-08' });

    const cap = issueSealingCapability('CAD_CFD_TRUTH_BATTERY', ['CFD'], {
      cadRevisionHash: 'REV-CAD-08',
      canonicalGeometryHash: brepHash
    });

    const binding = CanonicalDomainBindingEngine.createBinding(
      'CFD',
      'Pipe_CAD08',
      'REV-CAD-08',
      { mesh, fluid: { densityKgM3: 1.225, viscosityPaS: 1.8e-5 } },
      brepHash,
      'TOPO-CAD08',
      'MAT-AIR',
      'ENV-STD',
      'PHYS-CFD'
    ) as CfdToCoreBinding;

    CanonicalDomainBindingEngine.sealBinding(binding, cap, 'REV-CAD-08');
    binding.status = 'STALE';

    expect(() => Fvm3DNavierStokesSolver.solve(binding, { maxIterations: 5 })).toThrow(/AUTHORITY_GATE_REJECTION|Binding status is STALE/);
  });

  // CAD-09: Domain Mismatch
  it('CAD-09: should reject sealing attempt when capability domain does not authorize CFD', () => {
    const pipe = brepKernel.createCylinder(0.01, 0.1, 'Pipe_CAD09');
    const { mesh, brepHash } = CFDAdapter.meshFromBRep(pipe, { nx: 4, ny: 2, nz: 2, cadRevisionHash: 'REV-CAD-09' });

    // Capability authorized ONLY for FEA, not CFD
    const feaCap = issueSealingCapability('CAD_CFD_TRUTH_BATTERY', ['FEA'], {
      cadRevisionHash: 'REV-CAD-09',
      canonicalGeometryHash: brepHash
    });

    const binding = CanonicalDomainBindingEngine.createBinding(
      'CFD',
      'Pipe_CAD09',
      'REV-CAD-09',
      { mesh, fluid: { densityKgM3: 1.225, viscosityPaS: 1.8e-5 } },
      brepHash,
      'TOPO-CAD09',
      'MAT-AIR',
      'ENV-STD',
      'PHYS-CFD'
    ) as CfdToCoreBinding;

    expect(() => CanonicalDomainBindingEngine.sealBinding(binding, feaCap, 'REV-CAD-09')).toThrow(/SIMULATION_AUTHORITY_VIOLATION|CAPABILITY_DOMAIN_RESTRICTION_VIOLATION/);
  });

  // CAD-10: Separation of Numerical Qualification and Provenance Integrity
  it('CAD-10: should verify Provenance Integrity PASS even when numerical solver terminates without convergence (MAX_ITERATIONS_REACHED)', () => {
    const pipe = brepKernel.createCylinder(0.01, 0.1, 'Pipe_CAD10');
    const cadRev = 'REV-CAD-10';

    const { mesh, brepHash } = CFDAdapter.meshFromBRep(pipe, { nx: 6, ny: 3, nz: 3, cadRevisionHash: cadRev });

    const cap = issueSealingCapability('CAD_CFD_TRUTH_BATTERY', ['CFD'], {
      cadRevisionHash: cadRev,
      canonicalGeometryHash: brepHash
    });

    const binding = CanonicalDomainBindingEngine.createBinding(
      'CFD',
      'Pipe_CAD10',
      cadRev,
      { mesh, fluid: { densityKgM3: 1.225, viscosityPaS: 1.8e-5 } },
      brepHash,
      'TOPO-CAD10',
      'MAT-AIR',
      'ENV-STD',
      'PHYS-CFD'
    ) as CfdToCoreBinding;

    CanonicalDomainBindingEngine.sealBinding(binding, cap, cadRev);

    // Run only 3 iterations -> numerical solver will reach MAX_ITERATIONS_REACHED
    const solution = Fvm3DNavierStokesSolver.solve(binding, { maxIterations: 3 });

    // Provenance Integrity MUST be PASS
    expect(solution.provenanceIntegrity?.valid).toBe(true);
    expect(solution.provenanceIntegrity?.cadRevisionHash).toBe(cadRev);
    expect(solution.provenanceIntegrity?.canonicalGeometryHash).toBe(brepHash);

    // Numerical Qualification MUST explicitly show non-convergence without failing provenance
    expect(solution.converged).toBe(false);
    expect(solution.numericalQualification?.converged).toBe(false);
    expect(solution.numericalQualification?.terminationReason).toBe('MAX_ITERATIONS_REACHED');
    expect(solution.numericalQualification?.iterations).toBe(3);
  });

  // CAD-11: Topology Mutation Invalidation
  it('CAD-11: should demonstrate that modifying CAD B-Rep invalidates downstream mesh provenance', () => {
    const pipeInitial = brepKernel.createCylinder(0.01, 0.1, 'Pipe_CAD11');
    const { mesh: meshInitial, brepHash: hashInitial } = CFDAdapter.meshFromBRep(pipeInitial, { nx: 4, ny: 2, nz: 2, cadRevisionHash: 'REV-CAD-11-A' });

    const pipeModified = brepKernel.createCylinder(0.025, 0.15, 'Pipe_CAD11_Mutated');
    const { mesh: meshModified, brepHash: hashModified } = CFDAdapter.meshFromBRep(pipeModified, { nx: 4, ny: 2, nz: 2, cadRevisionHash: 'REV-CAD-11-B' });

    expect(hashInitial).not.toBe(hashModified);

    // Attempting to use modified mesh with initial geometry binding MUST fail provenance check
    const cap = issueSealingCapability('CAD_CFD_TRUTH_BATTERY', ['CFD'], {
      cadRevisionHash: 'REV-CAD-11-A',
      canonicalGeometryHash: hashInitial
    });

    const binding = CanonicalDomainBindingEngine.createBinding(
      'CFD',
      'Pipe_CAD11',
      'REV-CAD-11-A',
      { mesh: meshModified, fluid: { densityKgM3: 1.225, viscosityPaS: 1.8e-5 } },
      hashInitial,
      'TOPO-CAD11',
      'MAT-AIR',
      'ENV-STD',
      'PHYS-CFD'
    ) as CfdToCoreBinding;

    CanonicalDomainBindingEngine.sealBinding(binding, cap, 'REV-CAD-11-A');

    const check = CanonicalDomainBindingEngine.verifyMeshProvenanceBinding(meshModified, binding);
    expect(check.valid).toBe(false);
    expect(check.errors.some(e => e.includes('PROVENANCE_GEOMETRY_MISMATCH') || e.includes('PROVENANCE_REVISION_MISMATCH'))).toBe(true);
  });

  // CAD-12: Evidence Replay with Mismatched Result Hash or Revision
  it('CAD-12: should detect and reject result binding replay with tampered revision in SimulationExecutionRegistry', () => {
    const pipe = brepKernel.createCylinder(0.01, 0.1, 'Pipe_CAD12');
    const cadRev = 'REV-CAD-12';
    const { mesh, brepHash } = CFDAdapter.meshFromBRep(pipe, { nx: 4, ny: 2, nz: 2, cadRevisionHash: cadRev });

    const derivedBinding = CanonicalDerivedArtifactBinding.createBinding({
      cadRevisionHash: cadRev,
      canonicalGeometryHash: brepHash,
      artifactContentHash: 'HASH_CONTENT_CAD12',
      artifactKind: 'CFD_RESULT_012',
      derivationParameters: { status: 'STABLE', converged: true }
    });

    const fakeResult = {
      provenanceHash: derivedBinding.artifactDigest,
      derivedArtifactBinding: derivedBinding,
      status: 'STABLE'
    };

    // Verification before registration MUST fail
    const verifyBefore = SimulationExecutionRegistry.verifyResultBinding(fakeResult, cadRev, brepHash);
    expect(verifyBefore.isValid).toBe(false);
    expect(verifyBefore.failureReason).toBe('UNREGISTERED_RESULT_PROVENANCE');

    // Mismatched target revision verification MUST fail
    const verifyWrongRev = SimulationExecutionRegistry.verifyResultBinding(fakeResult, 'REV-WRONG-REV', brepHash);
    expect(verifyWrongRev.isValid).toBe(false);
  });
});
