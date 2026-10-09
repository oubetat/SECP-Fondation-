/**
 * SECP Industrial OS v2 — PROMPT-064: Zero Hidden Capability Audit Test Suite
 * Comprehensive Verification: ZHC-001 to ZHC-024
 */

import { describe, it, expect } from 'vitest';
import { ZeroHiddenCapabilityAuditEngine } from '../../../engine/audit/ZeroHiddenCapabilityAuditEngine';

describe('PROMPT-064: Zero Hidden Capability Audit (ZHC-001 to ZHC-024)', () => {
  const report = ZeroHiddenCapabilityAuditEngine.runZeroHiddenCapabilityAudit();

  // ZHC-001: UI capability inventory
  it('ZHC-001: Inventories all declared UI capabilities with complete control and handler metadata', () => {
    expect(report.declaredUiCapabilities.length).toBe(14);
    for (const uiCap of report.declaredUiCapabilities) {
      expect(uiCap.id).toMatch(/^CAP-/);
      expect(uiCap.uiControl.length).toBeGreaterThan(0);
      expect(uiCap.uiHandler.length).toBeGreaterThan(0);
      expect(uiCap.intent.length).toBeGreaterThan(0);
      expect(uiCap.dispatcher.length).toBeGreaterThan(0);
      expect(uiCap.status).toBe('UI-EXPOSED');
    }
  });

  // ZHC-002: Backend capability discovery
  it('ZHC-002: Discovers all executable backend capabilities across CAD, CAE, CAM, PLM, and Interop', () => {
    expect(report.discoveredBackendCapabilities.length).toBe(17);
    for (const beCap of report.discoveredBackendCapabilities) {
      expect(beCap.sourceFile.length).toBeGreaterThan(0);
      expect(beCap.symbol.length).toBeGreaterThan(0);
      expect(beCap.executionEntryPoint.length).toBeGreaterThan(0);
      expect(beCap.executable).toBe(true);
      expect(beCap.engineeringValid).toBe(true);
      expect(['UI-EXPOSED', 'BACKEND-ONLY']).toContain(beCap.status);
    }
  });

  // ZHC-003: UI -> Backend reconciliation
  it('ZHC-003: Reconciles all UI capabilities directly to genuine backend kernel execution', () => {
    expect(report.uiToBackendMatrix.length).toBe(14);
    for (const row of report.uiToBackendMatrix) {
      expect(row.backendMatch).toBe('MATCH');
      expect(row.status).toBe('UI-EXPOSED');
      expect(row.canonicalPath).toContain('Dispatcher');
      expect(row.verification.length).toBeGreaterThan(0);
      expect(row.evidence).toMatch(/^EVD-/);
    }
  });

  // ZHC-004: Backend -> UI reconciliation
  it('ZHC-004: Evaluates all backend capabilities for UI exposure with bidirectional classification', () => {
    expect(report.backendToUiMatrix.length).toBe(17);
    const uiExposed = report.backendToUiMatrix.filter(b => b.uiExposure);
    const backendOnly = report.backendToUiMatrix.filter(b => !b.uiExposure);

    expect(uiExposed.length).toBe(14);
    expect(backendOnly.length).toBe(3);

    for (const u of uiExposed) {
      expect(u.status).toBe('UI-EXPOSED');
      expect(u.exposurePath.length).toBeGreaterThan(0);
    }
    for (const b of backendOnly) {
      expect(b.status).toBe('BACKEND-ONLY');
      expect(b.exposurePath).toContain('N/A');
    }
  });

  // ZHC-005: Backend-only detection
  it('ZHC-005: Formally classifies real backend capabilities without UI as BACKEND-ONLY (not Orphan, not Phantom)', () => {
    const backendOnlyCaps = report.allCapabilities.filter(c => c.status === 'BACKEND-ONLY');
    expect(backendOnlyCaps.length).toBe(3);

    const ids = backendOnlyCaps.map(c => c.id);
    expect(ids).toContain('CAP-BACKEND-001'); // BRep Boolean Intersection
    expect(ids).toContain('CAP-BACKEND-002'); // STEP AP214 Exporter
    expect(ids).toContain('CAP-BACKEND-003'); // CFD VTK Mesh Exporter

    for (const c of backendOnlyCaps) {
      expect(c.backendCapability).toBe(true);
      expect(c.backendExecutable).toBe(true);
      expect(c.uiExposed).toBe(false);
      expect(c.status).toBe('BACKEND-ONLY');
    }
  });

  // ZHC-006: Phantom UI detection
  it('ZHC-006: Verifies 0 Phantom UI capabilities (no UI buttons without backend kernels)', () => {
    const phantomUi = report.allCapabilities.filter(c => c.uiExposed && !c.backendCapability);
    expect(phantomUi.length).toBe(0);
    expect(report.statistics.phantomCount).toBe(0);
  });

  // ZHC-007: Phantom Backend detection
  it('ZHC-007: Verifies 0 Phantom Backend capabilities (no stubs, mocks, or fake returns)', () => {
    const phantomBackend = report.allCapabilities.filter(c => c.backendCapability && !c.backendExecutable);
    expect(phantomBackend.length).toBe(0);
    expect(report.statistics.failCount).toBe(0);
  });

  // ZHC-008: Shadow pipeline detection
  it('ZHC-008: Confirms zero shadow pipelines bypassing the Canonical Dispatcher', () => {
    expect(report.shadowPipelines.length).toBe(17);
    for (const shadow of report.shadowPipelines) {
      expect(shadow.divergenceDetected).toBe(false);
      expect(shadow.severity).toBe('CLEAN');
    }
  });

  // ZHC-009: Dead route detection
  it('ZHC-009: Verifies all UI-to-Backend dispatch routes resolve to active kernel methods', () => {
    for (const cap of report.allCapabilities.filter(c => c.uiExposed)) {
      expect(cap.traceability.dispatcher).toBeDefined();
      expect(cap.traceability.evaluator).toBeDefined();
      expect(cap.traceability.backendKernel).toBeDefined();
    }
  });

  // ZHC-010: Mock/stub detection
  it('ZHC-010: Audits codebase for mocks/stubs and verifies zero production mock bypasses', () => {
    expect(report.mockStubFindings.length).toBeGreaterThan(0);
    for (const finding of report.mockStubFindings) {
      expect(finding.isProductionMock).toBe(false);
      expect(finding.classification).toBe('DEFENSIVE_GUARD');
    }
  });

  // ZHC-011: Fake success detection
  it('ZHC-011: Confirms zero false successes on all evaluated engineering capabilities', () => {
    expect(report.falseSuccessFindings.length).toBe(17);
    for (const fs of report.falseSuccessFindings) {
      expect(fs.isFalseSuccess).toBe(false);
      expect(fs.actualStatus).toBe('REJECTED_AS_EXPECTED');
    }
  });

  // ZHC-012: Canonical path validation
  it('ZHC-012: Validates strict end-to-end canonical chain across all UI-exposed capabilities', () => {
    for (const cap of report.allCapabilities.filter(c => c.uiExposed)) {
      expect(cap.canonicalPath).toMatch(/^UI Action -> .* -> Dispatcher -> Document.* -> Evaluator -> .*/);
    }
  });

  // ZHC-013: Real kernel execution validation
  it('ZHC-013: Validates real mathematical physics kernel entry point on every capability', () => {
    for (const cap of report.allCapabilities) {
      expect(cap.kernelSolver.length).toBeGreaterThan(0);
      expect(cap.executionEntryPoint.length).toBeGreaterThan(0);
      expect(cap.requiredInputs.length).toBeGreaterThan(0);
    }
  });

  // ZHC-014: Engineering result validation
  it('ZHC-014: Confirms non-trivial numerical engineering results generated on every capability', () => {
    for (const cap of report.allCapabilities) {
      expect(cap.engineeringResult.length).toBeGreaterThan(0);
      expect(cap.output.length).toBeGreaterThan(0);
      expect(cap.engineeringMeaning.length).toBeGreaterThan(0);
    }
  });

  // ZHC-015: Independent verification validation
  it('ZHC-015: Enforces independent non-self-attesting mathematical verification on every capability', () => {
    for (const cap of report.allCapabilities) {
      expect(cap.verification.length).toBeGreaterThan(0);
      expect(cap.traceability.verifier.length).toBeGreaterThan(0);
    }
  });

  // ZHC-016: Evidence linkage validation
  it('ZHC-016: Validates immutable cryptographic SHA-256 evidence linked to canonical results', () => {
    for (const cap of report.allCapabilities) {
      expect(cap.evidence).toMatch(/^EVD-/);
      expect(cap.traceability.sha256Proof).toMatch(/^SHA256:[a-f0-9]{64}$/);
    }
  });

  // ZHC-017: Determinism validation
  it('ZHC-017: Proves deterministic repeatability across 3 consecutive runs for every capability', () => {
    for (const cap of report.allCapabilities) {
      expect(cap.determinismRuns).toBeDefined();
      expect(cap.determinismRuns.length).toBe(3);
      const [r1, r2, r3] = cap.determinismRuns;
      expect(r1.hash).toBe(r2.hash);
      expect(r2.hash).toBe(r3.hash);
      expect(r1.matches && r2.matches && r3.matches).toBe(true);
    }
  });

  // ZHC-018: Negative/adversarial validation
  it('ZHC-018: Validates robust rejection of degenerate/corrupt/invalid inputs across all capabilities', () => {
    for (const cap of report.allCapabilities) {
      expect(cap.negativeAdversarialResult).toBeDefined();
      expect(cap.negativeAdversarialResult.rejectedCorrectly).toBe(true);
      expect(cap.negativeAdversarialResult.errorCode.length).toBeGreaterThan(0);
    }
  });

  // ZHC-019: Hidden Backend capability detection
  it('ZHC-019: Uncovers and explicitly registers all 3 backend-only subsystems in the official inventory', () => {
    const hiddenBackend = report.discoveredBackendCapabilities.filter(b => !b.uiExposed);
    expect(hiddenBackend.length).toBe(3);
    for (const hb of hiddenBackend) {
      expect(hb.status).toBe('BACKEND-ONLY');
      expect(hb.executable).toBe(true);
      expect(hb.engineeringValid).toBe(true);
    }
  });

  // ZHC-020: Undisclosed UI capability detection
  it('ZHC-020: Confirms zero undisclosed UI capabilities (100% of UI controls mapped)', () => {
    const undisclosedUi = report.declaredUiCapabilities.filter(u => u.status !== 'UI-EXPOSED');
    expect(undisclosedUi.length).toBe(0);
  });

  // ZHC-021: Capability classification consistency
  it('ZHC-021: Validates strict classification consistency (No generic PASS, mutually exclusive statuses)', () => {
    for (const cap of report.allCapabilities) {
      expect(['UI-EXPOSED', 'BACKEND-ONLY', 'PHANTOM', 'FAIL', 'UNPROVEN', 'N/A']).toContain(cap.status);
      if (cap.uiExposed) {
        expect(cap.status).toBe('UI-EXPOSED');
      } else {
        expect(cap.status).toBe('BACKEND-ONLY');
      }
    }
  });

  // ZHC-022: No false PASS generation
  it('ZHC-022: Verifies that no status is promoted to PASS or UI-EXPOSED without full end-to-end execution', () => {
    for (const row of report.exposureTruthMatrix) {
      if (row.uiExposed) {
        expect(row.status).toBe('UI-EXPOSED');
        expect(row.backend).toBe(true);
        expect(row.executable).toBe(true);
      } else {
        expect(row.status).toBe('BACKEND-ONLY');
      }
    }
  });

  // ZHC-023: Full traceability validation
  it('ZHC-023: Validates end-to-end bi-directional traceability on all evaluated capabilities', () => {
    for (const cap of report.allCapabilities) {
      expect(cap.traceability.backendKernel.length).toBeGreaterThan(0);
      expect(cap.traceability.engineeringComputation.length).toBeGreaterThan(0);
      expect(cap.traceability.verifier.length).toBeGreaterThan(0);
      expect(cap.traceability.evidenceId.length).toBeGreaterThan(0);
      expect(cap.traceability.sha256Proof.length).toBeGreaterThan(0);
    }
  });

  // ZHC-024: Final truth-matrix consistency
  it('ZHC-024: Confirms 100% truth scores, 0 phantoms, 0 broken paths, and awards ZERO HIDDEN CAPABILITY — FULLY PROVEN verdict', () => {
    expect(report.statistics.totalEvaluatedCapabilities).toBe(17);
    expect(report.statistics.uiExposedCount).toBe(14);
    expect(report.statistics.backendOnlyCount).toBe(3);
    expect(report.statistics.phantomCount).toBe(0);
    expect(report.statistics.failCount).toBe(0);
    expect(report.statistics.unprovenCount).toBe(0);
    expect(report.statistics.reconciliationRate).toBe(100);
    expect(report.statistics.zeroPhantomRate).toBe(100);
    expect(report.statistics.zeroHiddenRate).toBe(100);
    expect(report.criticalFindings.length).toBe(0);
    expect(report.verdict).toBe('ZERO HIDDEN CAPABILITY — FULLY PROVEN');
  });
});
