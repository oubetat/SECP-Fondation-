/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-188: Competitive Capability Matrix Unit & Adversarial Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CompetitiveCapabilityMatrixEngine,
  CompetitiveCapabilityMatrixGate,
  computeEvidenceHash,
  computeSnapshotHashes,
  CapabilityStatus,
  CompetitiveCapabilityEvidence
} from '../CompetitiveCapabilityMatrix';

describe('PATCH-188: Competitive Capability Matrix & Acceptance Gate', () => {

  beforeEach(() => {
    CompetitiveCapabilityMatrixEngine.clearOverrides();
  });

  // Test 1 — Status Integrity
  it('Test 1 — Status Integrity: ensures all capabilities fall under PROVEN, PARTIAL, UNPROVEN, or ABSENT', () => {
    const caps = CompetitiveCapabilityMatrixEngine.getCapabilities();
    const allowed = ["PROVEN", "PARTIAL", "UNPROVEN", "ABSENT"];
    for (const c of caps) {
      expect(allowed).toContain(c.status);
    }
  });

  // Test 2 — Evidence Requirement
  it('Test 2 — Evidence Requirement: PROVEN capabilities must have a non-empty evidence payload', () => {
    const caps = CompetitiveCapabilityMatrixEngine.getCapabilities();
    const provenCaps = caps.filter(c => c.status === "PROVEN");
    expect(provenCaps.length).toBeGreaterThan(0);
    for (const c of provenCaps) {
      expect(c.evidence).toBeDefined();
      expect(c.evidence.length).toBeGreaterThan(0);
    }
  });

  // Test 3 — Simulation Detection
  it('Test 3 — Simulation Detection: prevents simulated HPC/GPU/MPI from being claimed as PROVEN on SECP', () => {
    const caps = CompetitiveCapabilityMatrixEngine.getCapabilities();
    const simulatedHpc = ["GPU", "WebGPU", "Native HPC", "MPI", "Distributed CFD", "Distributed FEM", "Cloud Compute", "Multi-GPU", "HPC Scheduler Integration"];
    
    const secpSimProven = caps.filter(c =>
      c.platform === "SECP" &&
      simulatedHpc.includes(c.capability) &&
      c.status === "PROVEN"
    );
    expect(secpSimProven.length).toBe(0);
  });

  // Test 4 — Evidence Hash Integrity
  it('Test 4 — Evidence Hash Integrity: any modification in evidence or status results in a different record and root hash', () => {
    const caps = CompetitiveCapabilityMatrixEngine.getCapabilities();
    const originalSnapshot = CompetitiveCapabilityMatrixEngine.generateSnapshot();

    // Register an override to simulate modification
    CompetitiveCapabilityMatrixEngine.registerOverride(
      "AUDITOR_01",
      "SECP",
      "GPU",
      "PARTIAL",
      "Authorized override for testing GPU shaders on WebGL layer",
      ["Shader evidence added"]
    );

    const modifiedSnapshot = CompetitiveCapabilityMatrixEngine.generateSnapshot();
    expect(modifiedSnapshot.evidenceRootHash).not.toEqual(originalSnapshot.evidenceRootHash);
    expect(modifiedSnapshot.matrixHash).not.toEqual(originalSnapshot.matrixHash);
  });

  // Test 5 — Competitor Data Integrity
  it('Test 5 — Competitor Data Integrity: prevents competitor capabilities from having empty/fabricated claims', () => {
    const caps = CompetitiveCapabilityMatrixEngine.getCapabilities();
    const competitorProven = caps.filter(c => c.platform !== "SECP" && c.status === "PROVEN");
    
    expect(competitorProven.length).toBeGreaterThan(0);
    for (const c of competitorProven) {
      expect(c.evidence).toBeDefined();
      expect(c.evidence.length).toBeGreaterThan(0);
      expect(c.evidence[0]).toMatch(/Parasolid|CGM|Nastran|Abaqus|ShapeManager|Fluent|Granta/i);
    }
  });

  // Test 6 — Unknown ≠ Absent
  it('Test 6 — Unknown ≠ Absent: ensures lack of verified information maps to UNPROVEN instead of ABSENT', () => {
    const caps = CompetitiveCapabilityMatrixEngine.getCapabilities();
    
    // Check an unproven multidiscipline benchmark
    const testCap = caps.find(c => c.platform === "SECP" && c.capability === "PATCH-191 Multidiscipline Simulation");
    expect(testCap).toBeDefined();
    expect(testCap!.status).toEqual("UNPROVEN");
  });

  // Test 7 — UI/Data Consistency
  it('Test 7 — UI/Data Consistency: verifies generated snapshot represents the active model accurately', () => {
    const caps = CompetitiveCapabilityMatrixEngine.getCapabilities();
    const snapshot = CompetitiveCapabilityMatrixEngine.generateSnapshot();

    expect(snapshot.capabilities.length).toEqual(caps.length);
    for (let i = 0; i < caps.length; i++) {
      expect(snapshot.capabilities[i].status).toEqual(caps[i].status);
    }
  });

  // Test 8 — Snapshot Reproducibility
  it('Test 8 — Snapshot Reproducibility: rebuilding matrix snapshot on identical evidence reproduces same root hashes', () => {
    const snapshotA = CompetitiveCapabilityMatrixEngine.generateSnapshot();
    const snapshotB = CompetitiveCapabilityMatrixEngine.generateSnapshot();

    expect(snapshotA.evidenceRootHash).toEqual(snapshotB.evidenceRootHash);
    expect(snapshotA.matrixHash).toEqual(snapshotB.matrixHash);
  });

  // Adversarial / Attack / Gate Tests
  describe('Adversarial & Attack Scenarios', () => {
    
    it('Adversarial Test 1 — rejects override with empty or short justification', () => {
      expect(() => {
        CompetitiveCapabilityMatrixEngine.registerOverride(
          "ATTACKER",
          "SECP",
          "GPU",
          "PROVEN",
          "Short" // < 10 characters
        );
      }).toThrow();
    });

    it('Adversarial Test 2 — rejects override with invalid status string', () => {
      expect(() => {
        CompetitiveCapabilityMatrixEngine.registerOverride(
          "ATTACKER",
          "SECP",
          "GPU",
          "SUPER_FABRICATED" as any,
          "This is a very long justification to bypass length check"
        );
      }).toThrow();
    });

    it('Adversarial Test 3 — Gate fails if simulated capability is overridden to PROVEN without direct hardware evidence', () => {
      // Intentionally malicious override attempting to claim WebGPU as PROVEN with mock/fake evidence
      CompetitiveCapabilityMatrixEngine.registerOverride(
        "MALICIOUS_ACTOR",
        "SECP",
        "WebGPU",
        "PROVEN",
        "Faking implementation with mock fallback shaders",
        ["Simulated fallback file WebGPUMock.ts"]
      );

      const snapshot = CompetitiveCapabilityMatrixEngine.generateSnapshot();
      const gateResult = CompetitiveCapabilityMatrixGate.executeGate(snapshot);
      
      expect(gateResult.passed).toBe(false);
      expect(gateResult.verdict).toBe("FAIL");
    });

    it('Adversarial Test 4 — Gate fails if a PROVEN capability has its evidence array wiped out', () => {
      const snapshot = CompetitiveCapabilityMatrixEngine.generateSnapshot();
      
      // Let's manually corrupt a snapshot record to simulate direct tamper
      const corruptedCaps = snapshot.capabilities.map(c => {
        if (c.platform === "SECP" && c.capability === "B-Rep") {
          return { ...c, evidence: [] }; // wipe evidence
        }
        return c;
      });

      const corruptedSnapshot = {
        ...snapshot,
        capabilities: corruptedCaps
      };

      const gateResult = CompetitiveCapabilityMatrixGate.executeGate(corruptedSnapshot);
      expect(gateResult.passed).toBe(false);
    });

    it('Adversarial Test 5 — Gate fails if a PARTIAL capability has its limitations wiped out', () => {
      const snapshot = CompetitiveCapabilityMatrixEngine.generateSnapshot();
      
      // Manually corrupt PARTIAL limitations to simulate direct tamper
      const corruptedCaps = snapshot.capabilities.map(c => {
        if (c.platform === "SECP" && c.capability === "Finite Volume") {
          return { ...c, limitations: [] }; // wipe limitations
        }
        return c;
      });

      const corruptedSnapshot = {
        ...snapshot,
        capabilities: corruptedCaps
      };

      const gateResult = CompetitiveCapabilityMatrixGate.executeGate(corruptedSnapshot);
      expect(gateResult.passed).toBe(false);
    });

    it('Adversarial Test 6 — Gate detects tampered cell hashes', () => {
      const snapshot = CompetitiveCapabilityMatrixEngine.generateSnapshot();
      
      // Corrupt a hash
      const corruptedCaps = snapshot.capabilities.map((c, idx) => {
        if (idx === 0) {
          return { ...c, evidenceHash: "BAD_FABRICATED_HASH_001" };
        }
        return c;
      });

      const corruptedSnapshot = {
        ...snapshot,
        capabilities: corruptedCaps
      };

      const gateResult = CompetitiveCapabilityMatrixGate.executeGate(corruptedSnapshot);
      expect(gateResult.passed).toBe(false);
    });
  });
});
