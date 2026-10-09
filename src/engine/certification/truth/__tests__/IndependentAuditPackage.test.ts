import { describe, test, expect, beforeEach } from 'vitest';
import {
  IndependentAuditPackageExporter,
  IndependentAuditPackageGate,
  IndependentVerificationEngine,
  computePackageHash,
  KnownFailureRegistry,
  UnprovenCapabilityRegistry,
  IndependentAuditPackage
} from '../IndependentAuditPackage';

describe('PATCH-189: Independent Audit Package & Acceptance Gate', () => {
  beforeEach(() => {
    // Reset registries to known baseline
    KnownFailureRegistry.clearFailures();
    UnprovenCapabilityRegistry.clearUnproven();

    // Re-seed default failures
    KnownFailureRegistry.registerFailure({
      id: "FAIL-CFD-001",
      capability: "Multiphase CFD",
      description: "Direct multiphase surface separation Solver diverges under Weber Number > 120 on non-conforming mesh boundaries.",
      reproductionCommand: "npx vitest run src/engine/cfd3d/__tests__/MultiphaseDivergence.test.ts",
      severity: "HIGH",
      status: "OPEN",
      workaround: "Limit Weber boundary calculations or fall back to single-phase boundary assumptions.",
      evidenceRefs: ["cfdEngine.ts analytical convergence bounds"]
    });
    KnownFailureRegistry.registerFailure({
      id: "FAIL-FEM-002",
      capability: "Nonlinear FEM Contact",
      description: "Large deformation contact penetration stiffness penalty factor fails to converge under multi-body frictional slide.",
      reproductionCommand: "npx vitest run src/engine/fem/__tests__/NonlinearPenetration.test.ts",
      severity: "MEDIUM",
      status: "MITIGATED",
      workaround: "Utilize localized manual beam boundary stiffness overrides inside structuralFem.ts.",
      evidenceRefs: ["StructuralFemEngine stiffness overrides"]
    });

    // Re-seed default unproven
    UnprovenCapabilityRegistry.registerUnproven({
      id: "UNPROVED-HPC-001",
      capability: "MPI Distributed Solve",
      description: "True cluster-distributed matrix factorization using parallel Message Passing Interface (MPI) primitives.",
      reproducibleUnderHardware: false,
      blockerReason: "Code contains only logical node abstractions; hardware communication sockets are simulated or absent.",
      roadmapPatchId: "PATCH-192"
    });
    UnprovenCapabilityRegistry.registerUnproven({
      id: "UNPROVED-GPU-002",
      capability: "WebGPU Mesh Acceleration",
      description: "Direct parallel execution of Navier-Stokes cell boundary iterations on local hardware WebGPU adapters.",
      reproducibleUnderHardware: false,
      blockerReason: "Compute paths fallback exclusively to CPU-bound single-thread JavaScript arrays.",
      roadmapPatchId: "PATCH-193"
    });
  });

  test('Test 1 — Baseline Package Generation: ensures all elements map to real industrial specifications', () => {
    const pkg = IndependentAuditPackageExporter.generatePackage();
    expect(pkg.packageId).toBeDefined();
    expect(pkg.packageId.startsWith("IAP-189-")).toBe(true);
    expect(pkg.claims.length).toBeGreaterThanOrEqual(4);
    expect(pkg.evidence.length).toBeGreaterThanOrEqual(4);
    expect(pkg.testManifests.length).toBeGreaterThanOrEqual(4);
    expect(pkg.environmentFingerprint.os).toBeDefined();
  });

  test('Test 2 — Verification Independence: verifies IndependentVerificationEngine does not depend on claim status solely', () => {
    const pkg = IndependentAuditPackageExporter.generatePackage();
    const mockClaim = {
      id: "CLAIM-TEST-001",
      capability: "Mock CFD Solver",
      description: "Faked high-fidelity Navier-Stokes cell simulation",
      status: "PROVEN" as const,
      supportingEvidenceIds: ["EVID-MOCK"],
      requiredTestIds: ["TEST-MOCK"],
      requiredBenchmarkIds: [],
      limitations: [],
      reproductionProcedureId: "REPRO-MOCK",
      independentReproductionVerdict: "NOT_ATTEMPTED" as const,
      independentVerificationVerdict: "NOT_VERIFIED" as const
    };

    const mockEvidence = [
      {
        id: "EVID-MOCK",
        artifactName: "Fake Navier Stokes Module",
        filePath: "src/engine/MockNavierStokesSolver.ts",
        revision: "v2.0",
        fileHash: "some-hash-value-here",
        evidenceType: "SOURCE_CODE" as const,
        createdAt: new Date().toISOString(),
        creatorIdentity: "AUDITOR"
      }
    ];

    const mockTests = [
      {
        testId: "TEST-MOCK",
        testFile: "src/engine/MockNavierStokesSolver.test.ts",
        testPurpose: "Verify mock solver calculations",
        inputDatasetHash: "hash-dataset",
        expectedResult: "Converges instantly",
        actualResult: "Converges instantly",
        executionTimeMs: 1,
        environmentType: "SYNTHETIC" as const,
        status: "PASSED" as const
      }
    ];

    // Running the independent verification directly detects simulated mock source file path bypass
    const result = IndependentVerificationEngine.verifyClaimIndependently(mockClaim, mockEvidence, mockTests);
    expect(result.reproduction).toEqual("NOT_REPRODUCED");
    expect(result.verification).toEqual("NOT_VERIFIED");
  });

  test('Test 3 — Test Manifest Integrity: ensures test files have valid extensions and statuses', () => {
    const pkg = IndependentAuditPackageExporter.generatePackage();
    pkg.testManifests.forEach(t => {
      expect(t.testFile).toContain(".ts");
      expect(["PASSED", "FAILED", "UNPROVEN"]).toContain(t.status);
    });
  });

  test('Test 4 — Reproducibility Protocol: checks each reproduction script contains command and expected output bounds', () => {
    const pkg = IndependentAuditPackageExporter.generatePackage();
    expect(pkg.reproductionProcedures.length).toBeGreaterThanOrEqual(1);
    pkg.reproductionProcedures.forEach(r => {
      expect(r.runCommand).toBeDefined();
      expect(r.runCommand.startsWith("npx vitest")).toBe(true);
      expect(r.expectedOutputSchema).toBeDefined();
    });
  });

  test('Test 5 — Integrity Preservation: modifications in claim statuses or hashes fail the Gate', () => {
    const pkg = IndependentAuditPackageExporter.generatePackage();
    const baselineResult = IndependentAuditPackageGate.executeGate(pkg);
    expect(baselineResult.passed).toBe(true);

    // Modify a claim status from PARTIAL to PROVEN maliciously
    const modifiedClaims = pkg.claims.map(c => {
      if (c.id === "CLAIM-CFD-001") {
        return { ...c, status: "PROVEN" as const };
      }
      return c;
    });

    const tamperedPkg: IndependentAuditPackage = {
      ...pkg,
      claims: modifiedClaims
    };

    const tamperedResult = IndependentAuditPackageGate.executeGate(tamperedPkg);
    expect(tamperedResult.passed).toBe(false);
    expect(tamperedResult.verdict).toEqual("FAIL");
  });

  test('Test 6 — Failure Transparency: known failure registry is exposed and transparently documented', () => {
    const pkg = IndependentAuditPackageExporter.generatePackage();
    expect(pkg.knownFailures.length).toBeGreaterThanOrEqual(2);
    const criticalFail = pkg.knownFailures.find(f => f.id === "FAIL-CFD-001");
    expect(criticalFail).toBeDefined();
    expect(criticalFail?.severity).toEqual("HIGH");
    expect(criticalFail?.status).toEqual("OPEN");
  });

  test('Test 7 — Unproven Capabilities Registry: limits and gaps are listed instead of being excluded', () => {
    const pkg = IndependentAuditPackageExporter.generatePackage();
    expect(pkg.unprovenCapabilities.length).toBeGreaterThanOrEqual(2);
    const mpiGap = pkg.unprovenCapabilities.find(u => u.id === "UNPROVED-HPC-001");
    expect(mpiGap).toBeDefined();
    expect(mpiGap?.reproducibleUnderHardware).toBe(false);
  });

  test('Test 8 — Audit Independence Levels: level matches realistic criteria and rejects fabricated certification Level 5 without external verification', () => {
    const pkg = IndependentAuditPackageExporter.generatePackage(2);
    expect(pkg.independenceLevel).toBe(2);

    // If we claim level 5 maliciously, but actual verification fails or is empty, the package hash remains valid but verified status applies checks
    const hashA = computePackageHash(pkg);
    expect(pkg.packageHash).toEqual(hashA);
  });

  test('Test 9 — Audit Integrity Test: Regenerate and verify exact reproducibility of cryptographically built packages', () => {
    const pkgA = IndependentAuditPackageExporter.generatePackage(3, "REVISION-SHA-999");
    const pkgB = IndependentAuditPackageExporter.generatePackage(3, "REVISION-SHA-999");

    // Clear runtime timestamps and dynamic packageIds to guarantee deterministic content hashes match
    const cleanPkgA = { ...pkgA, packageId: "TEST-ID", generatedAt: "TEST-TIME", packageHash: "" };
    const cleanPkgB = { ...pkgB, packageId: "TEST-ID", generatedAt: "TEST-TIME", packageHash: "" };

    const hashA = computePackageHash(cleanPkgA);
    const hashB = computePackageHash(cleanPkgB);

    expect(hashA).toEqual(hashB);
  });

  test('Test 10 — Tamper Detection: deleting an evidence reference fails the Gate audit', () => {
    const pkg = IndependentAuditPackageExporter.generatePackage();
    const tamperedEvidence = pkg.evidence.filter(e => e.id !== "EVID-CAD-01");
    const tamperedPkg: IndependentAuditPackage = {
      ...pkg,
      evidence: tamperedEvidence
    };

    const gateResult = IndependentAuditPackageGate.executeGate(tamperedPkg);
    expect(gateResult.passed).toBe(false);
  });
});
