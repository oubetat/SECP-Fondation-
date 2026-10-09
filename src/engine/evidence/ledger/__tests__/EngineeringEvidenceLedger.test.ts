/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-161: Engineering Evidence Ledger Unit & Determinism Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EngineeringEvidenceLedger } from '../EngineeringEvidenceLedger';
import { EvidenceHasher } from '../EvidenceHasher';
import { EvidenceCanonicalizer } from '../EvidenceCanonicalizer';
import { EvidenceIntegrityChecker } from '../EvidenceIntegrityChecker';
import { EngineeringEvidenceLedgerVerifier } from '../EngineeringEvidenceLedgerVerifier';
import { HardAcceptanceGate161 } from '../HardAcceptanceGate161';

describe('PATCH-161: Engineering Evidence Ledger', () => {
  let ledger: EngineeringEvidenceLedger;

  beforeEach(() => {
    ledger = new EngineeringEvidenceLedger();
  });

  it('registers genesis and subsequent entries with proper SHA-256 hash linking', () => {
    const entry0 = ledger.registerEvidence({
      evidenceType: 'CAD',
      engineeringObjectId: 'PART-001',
      objectRevision: 'REV-1',
      projectId: 'PROJ-ALPHA',
      organizationId: 'SECP-ORG',
      producerIdentity: 'ENGINEER-1',
      producerType: 'HUMAN',
      sourceSystem: 'SECP-CAD',
      sourceVersion: '1.0.0',
      payload: { featureCount: 12, boundingBox: [100, 50, 20] }
    });

    expect(entry0.sequenceNumber).toBe(0);
    expect(entry0.previousEntryHash).toBe(EvidenceHasher.GENESIS_PREVIOUS_HASH);
    expect(entry0.entryHash).toBeDefined();

    const entry1 = ledger.registerEvidence({
      evidenceType: 'MESH',
      engineeringObjectId: 'PART-001',
      objectRevision: 'REV-1',
      projectId: 'PROJ-ALPHA',
      organizationId: 'SECP-ORG',
      producerIdentity: 'SOLVER-1',
      producerType: 'SOLVER',
      sourceSystem: 'SECP-MESH',
      sourceVersion: '1.0.0',
      parentEvidence: entry0.evidenceId,
      payload: { elements: 15000, nodes: 4000 }
    });

    expect(entry1.sequenceNumber).toBe(1);
    expect(entry1.previousEntryHash).toBe(entry0.entryHash);

    const report = ledger.query.verifyLedger();
    expect(report.status).toBe('VALID');
    expect(report.totalEntries).toBe(2);
    expect(report.verifiedEntries).toBe(2);
  });

  it('guarantees deterministic canonicalization and hashing regardless of key order', () => {
    const objA = { z: 100, a: 'test', m: { k2: true, k1: false } };
    const objB = { a: 'test', m: { k1: false, k2: true }, z: 100 };

    const canonA = EvidenceCanonicalizer.canonicalize(objA);
    const canonB = EvidenceCanonicalizer.canonicalize(objB);

    expect(canonA).toBe(canonB);
    expect(EvidenceHasher.hashObject(objA)).toBe(EvidenceHasher.hashObject(objB));
  });

  it('reconstructs complete engineering lineage hierarchy and detects cycles', () => {
    const cad = ledger.registerEvidence({
      evidenceType: 'CAD',
      engineeringObjectId: 'TURBINE-BLADE-01',
      objectRevision: 'REV-0',
      projectId: 'PROJ-AERO',
      organizationId: 'AERO-INC',
      producerIdentity: 'CAD-DESIGNER',
      producerType: 'HUMAN',
      sourceSystem: 'SECP-CAD',
      sourceVersion: '2.0.0',
      payload: { airfoil: 'NACA-6409' }
    });

    const mesh = ledger.registerEvidence({
      evidenceType: 'MESH',
      engineeringObjectId: 'TURBINE-BLADE-01',
      objectRevision: 'REV-0',
      projectId: 'PROJ-AERO',
      organizationId: 'AERO-INC',
      producerIdentity: 'MESH-SOLVER',
      producerType: 'SOLVER',
      sourceSystem: 'SECP-MESH',
      sourceVersion: '2.0.0',
      parentEvidence: cad.evidenceId,
      payload: { cellCount: 500000 }
    });

    const cfd = ledger.registerEvidence({
      evidenceType: 'CFD',
      engineeringObjectId: 'TURBINE-BLADE-01',
      objectRevision: 'REV-0',
      projectId: 'PROJ-AERO',
      organizationId: 'AERO-INC',
      producerIdentity: 'CFD-SOLVER',
      producerType: 'SOLVER',
      sourceSystem: 'SECP-CFD',
      sourceVersion: '2.0.0',
      parentEvidence: mesh.evidenceId,
      payload: { pressureDrop: 14.5, efficiency: 0.94 }
    });

    const lineage = ledger.query.getEvidenceLineage(cfd.evidenceId);
    expect(lineage.depth).toBe(2);
    expect(lineage.parentEvidence).toBe(mesh.evidenceId);

    const chain = ledger.query.getEvidenceChain(cad.evidenceId, cfd.evidenceId);
    expect(chain.length).toBe(3);
    expect(chain[0].evidenceId).toBe(cad.evidenceId);
    expect(chain[2].evidenceId).toBe(cfd.evidenceId);
  });

  it('enforces object and revision binding', () => {
    const entry = ledger.registerEvidence({
      evidenceType: 'FEM',
      engineeringObjectId: 'SHAFT-09',
      objectRevision: 'REV-B',
      projectId: 'DRIVE-SYS',
      organizationId: 'SECP-CORP',
      producerIdentity: 'FEM-ENGINEER',
      producerType: 'HUMAN',
      sourceSystem: 'SECP-FEM',
      sourceVersion: '1.0.0',
      payload: { maxStressMpa: 240, yieldStrength: 350 }
    });

    const checkValid = EvidenceIntegrityChecker.verifyBinding(entry.record, 'SHAFT-09', 'REV-B');
    expect(checkValid.verdict).toBe('VALID');

    const checkWrongRev = EvidenceIntegrityChecker.verifyBinding(entry.record, 'SHAFT-09', 'REV-C');
    expect(checkWrongRev.verdict).toBe('REVISION_MISMATCH');

    const checkWrongObj = EvidenceIntegrityChecker.verifyBinding(entry.record, 'OTHER-SHAFT', 'REV-B');
    expect(checkWrongObj.verdict).toBe('OBJECT_MISMATCH');
  });

  it('executes HardAcceptanceGate161 and returns PASS with all 15 checks green', () => {
    const report = HardAcceptanceGate161.evaluate();
    expect(report.verdict).toBe('PASS');
    expect(report.passedChecks).toBe(report.totalChecks);
    expect(report.checks.length).toBe(15);
  });
});
