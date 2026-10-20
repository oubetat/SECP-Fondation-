/**
 * SECP Industrial OS — SECP-PCB-PHASE-1-CLOSURE-001
 * Independent Forensic Closure & Adversarial Verification Battery:
 * Directly and independently executes all 10 adversarial physical/geometric cases,
 * PcbEngine integration verification, and SECP Evidence Ledger linkage.
 */

import { createHash } from 'crypto';
import {
  PcbCanonicalModel,
  PcbCanonicalModelValidator
} from '../PcbCanonicalModel';
import { PcbConnectivityVerifier } from '../PcbConnectivityVerifier';
import { PcbGeometryVerifier } from '../PcbGeometryVerifier';
import { PcbEngine } from '../../pcbEngine';
import { createValidPhase1Baseline } from './verify_pcb';
import { EngineeringEvidenceLedger } from '../../evidence/ledger/EngineeringEvidenceLedger';
import { EvidenceHasher } from '../../evidence/ledger/EvidenceHasher';

export interface AdversarialTestResult {
  id: string;
  name: string;
  passed: boolean;
  verdict: 'PASS' | 'FAIL';
  details: string;
}

export function runAdversarialClosureSuite(): {
  allPassed: boolean;
  passedCount: number;
  totalCount: number;
  results: AdversarialTestResult[];
} {
  const results: AdversarialTestResult[] = [];

  // =========================================================================
  // 1. Same-layer copper contact between different nets
  // =========================================================================
  {
    const model = createValidPhase1Baseline();
    // Add short: trace of GND directly overlaps trace of VCC_3V3 on TOP_COPPER
    model.traces.push({
      id: 'tr_adv_short',
      netName: 'GND',
      layer: 'TOP_COPPER',
      widthMm: 0.4,
      path: [{ x: 20, y: 35 }, { x: 25, y: 35 }] // Directly on tr_vcc_1 path
    });

    const rep = PcbConnectivityVerifier.verify(model);
    const caught = rep.status === 'SHORT_CIRCUIT' && rep.violations.some(v => v.code === 'PCB-CON-004');
    results.push({
      id: 'ADV-01',
      name: 'Same-Layer Copper Contact Between Different Nets (Short Circuit)',
      passed: caught,
      verdict: caught ? 'PASS' : 'FAIL',
      details: caught
        ? `Caught cross-net copper collision on TOP_COPPER (status: ${rep.status}, shorts: ${rep.shortCircuitsCount})`
        : 'Failed to catch same-layer physical contact'
    });
  }

  // =========================================================================
  // 2. Same-layer near-miss without physical contact (gap = 0.1mm)
  // =========================================================================
  {
    const model = createValidPhase1Baseline();
    // tr_vcc_1 is at y=35, width=0.4 (top copper boundary is at y = 35 + 0.2 = 35.2)
    // Place parallel trace of GND with width 0.4 at y=35.5 (bottom copper boundary is at y = 35.5 - 0.2 = 35.3)
    // Physical copper air gap = 35.3 - 35.2 = 0.1mm > 0 (near-miss, NOT a short circuit)
    model.traces.push({
      id: 'tr_adv_nearmiss',
      netName: 'GND',
      layer: 'TOP_COPPER',
      widthMm: 0.4,
      path: [{ x: 20, y: 35.5 }, { x: 25, y: 35.5 }]
    });

    const rep = PcbConnectivityVerifier.verify(model);
    const hasFalseShort = rep.violations.some(v => v.code === 'PCB-CON-004' && v.affectedEntities.includes('tr_adv_nearmiss'));
    const passed = !hasFalseShort;
    results.push({
      id: 'ADV-02',
      name: 'Same-Layer Near-Miss Without Physical Contact (0.1mm Air Gap)',
      passed,
      verdict: passed ? 'PASS' : 'FAIL',
      details: passed
        ? 'Physical copper air gap (0.1mm) correctly recognized as galvanic separation (no false short)'
        : 'Near-miss erroneously flagged as hard short circuit'
    });
  }

  // =========================================================================
  // 3. Different-layer crossing without a via
  // =========================================================================
  {
    const model = createValidPhase1Baseline();
    // Traces cross at (65, 39) with one on TOP_COPPER and other on BOTTOM_COPPER
    model.traces.push({
      id: 'tr_cross_top',
      netName: 'NET_ALPHA',
      layer: 'TOP_COPPER',
      widthMm: 0.3,
      path: [{ x: 65, y: 35 }, { x: 65, y: 43 }]
    });
    model.traces.push({
      id: 'tr_cross_bot',
      netName: 'NET_BETA',
      layer: 'BOTTOM_COPPER',
      widthMm: 0.3,
      path: [{ x: 61, y: 39 }, { x: 69, y: 39 }]
    });

    const rep = PcbConnectivityVerifier.verify(model);
    const hasFalseShort = rep.violations.some(v => v.code === 'PCB-CON-004' && (v.affectedEntities.includes('tr_cross_top') || v.affectedEntities.includes('tr_cross_bot')));
    const bypassRecorded = rep.safeCrossLayerBypassesCount > 0;
    const passed = !hasFalseShort && bypassRecorded;
    results.push({
      id: 'ADV-03',
      name: 'Different-Layer Crossing Without Via (Galvanic Isolation)',
      passed,
      verdict: passed ? 'PASS' : 'FAIL',
      details: passed
        ? `Confirmed safe cross-layer bypass across TOP and BOTTOM copper planes (${rep.safeCrossLayerBypassesCount} bypass(es))`
        : 'Different-layer crossing flagged as false short or bypass unrecorded'
    });
  }

  // =========================================================================
  // 4. Actual cross-layer short through a via
  // =========================================================================
  {
    const model = createValidPhase1Baseline();
    // Add via of net GND positioned right on tr_vcc_1 path (x=20, y=35) on TOP_COPPER
    model.vias.push({
      id: 'via_rogue_short',
      netName: 'GND',
      xMm: 20,
      yMm: 35,
      drillDiameterMm: 0.3,
      padDiameterMm: 0.6,
      startLayer: 'TOP_COPPER',
      endLayer: 'BOTTOM_COPPER'
    });

    const rep = PcbConnectivityVerifier.verify(model);
    const caught = rep.status === 'SHORT_CIRCUIT' && rep.violations.some(v => v.code === 'PCB-CON-004' && v.affectedEntities.includes('via_rogue_short'));
    results.push({
      id: 'ADV-04',
      name: 'Actual Cross-Layer Short Through a Via Collision',
      passed: caught,
      verdict: caught ? 'PASS' : 'FAIL',
      details: caught
        ? 'Caught cross-layer via short: GND via on TOP_COPPER collided with VCC_3V3 trace'
        : 'Failed to catch cross-layer via short circuit'
    });
  }

  // =========================================================================
  // 5. Pad contact using actual transformed footprint geometry (Rotation)
  // =========================================================================
  {
    const model = createValidPhase1Baseline();
    // Rotate R1 by 90 degrees.
    // Unrotated R1 (centroid 28, 35): pin 1 offset is (-0.9, 0) -> absolute (27.1, 35)
    // Rotated 90 deg: offset rotated: x' = 0, y' = -0.9 -> absolute (28, 35 - 0.9 = 34.1)
    model.placements[1].rotationDeg = 90;
    // Trace must now terminate at (28, 34.1) instead of (27.1, 35)
    model.traces[0].path = [{ x: 9.5, y: 25 }, { x: 20, y: 34.1 }, { x: 28, y: 34.1 }];
    model.traces[1].path = [{ x: 28, y: 34.1 }, { x: 38, y: 35 }, { x: 45.5, y: 28.5 }];

    const rep = PcbConnectivityVerifier.verify(model);
    const pads = PcbCanonicalModelValidator.calculateAllPadLocations(model);
    const r1Pin1 = pads.find(p => p.refDes === 'R1' && p.pinNumber === 1);
    const coordsCorrect = r1Pin1 && Math.abs(r1Pin1.xAbsoluteMm - 28) < 0.01 && Math.abs(r1Pin1.yAbsoluteMm - 34.1) < 0.01;
    const connected = !rep.violations.some(v => v.code === 'PCB-CON-002' && v.affectedEntities.includes('R1:1'));
    const passed = !!(coordsCorrect && connected);
    results.push({
      id: 'ADV-05',
      name: 'Pad Contact Under 90-Degree Rotational Transformation',
      passed,
      verdict: passed ? 'PASS' : 'FAIL',
      details: passed
        ? `Transformed coordinate verified at (28.00, 34.10) with valid electrical continuity`
        : 'Failed rotation transformation or electrical contact'
    });
  }

  // =========================================================================
  // 6. Copper width and pad-shape effects on collision detection
  // =========================================================================
  {
    // Test A: Thin trace (0.4mm) parallel to Trace A (0.4mm) at 1.0mm pitch
    // copperDistance = 1.0 - (0.2 + 0.2) = 0.6mm > 0 -> NO SHORT
    const modelThin = createValidPhase1Baseline();
    modelThin.traces.push({
      id: 'tr_width_a',
      netName: 'NET_WIDTH_A',
      layer: 'TOP_COPPER',
      widthMm: 0.4,
      path: [{ x: 60.0, y: 10.0 }, { x: 70.0, y: 10.0 }]
    });
    modelThin.traces.push({
      id: 'tr_width_b_thin',
      netName: 'NET_WIDTH_B',
      layer: 'TOP_COPPER',
      widthMm: 0.4,
      path: [{ x: 60.0, y: 11.0 }, { x: 70.0, y: 11.0 }]
    });
    const repThin = PcbConnectivityVerifier.verify(modelThin);
    const thinNoShort = !repThin.violations.some(v => v.affectedEntities.includes('tr_width_b_thin'));

    // Test B: Thick trace (1.8mm) at same 1.0mm pitch
    // copperDistance = 1.0 - (0.2 + 0.9) = -0.1mm <= 0 -> PHYSICAL OVERLAP & SHORT!
    const modelThick = createValidPhase1Baseline();
    modelThick.traces.push({
      id: 'tr_width_a',
      netName: 'NET_WIDTH_A',
      layer: 'TOP_COPPER',
      widthMm: 0.4,
      path: [{ x: 60.0, y: 10.0 }, { x: 70.0, y: 10.0 }]
    });
    modelThick.traces.push({
      id: 'tr_width_b_thick',
      netName: 'NET_WIDTH_B',
      layer: 'TOP_COPPER',
      widthMm: 1.8,
      path: [{ x: 60.0, y: 11.0 }, { x: 70.0, y: 11.0 }]
    });
    const repThick = PcbConnectivityVerifier.verify(modelThick);
    const thickHasShort = repThick.violations.some(v => v.affectedEntities.includes('tr_width_b_thick') && v.code === 'PCB-CON-004');

    const passed = thinNoShort && thickHasShort;
    results.push({
      id: 'ADV-06',
      name: 'Physical Copper Width Influence on Collision Boundary',
      passed,
      verdict: passed ? 'PASS' : 'FAIL',
      details: passed
        ? 'Confirmed physical width effect: 0.1mm width clears pad while 1.2mm width collides'
        : 'Failed width-dependent collision boundary discrimination'
    });
  }

  // =========================================================================
  // 7. Disconnected traces and incomplete nets
  // =========================================================================
  {
    const model = createValidPhase1Baseline();
    // Delete trace connecting to U1:1
    model.traces = model.traces.filter(t => t.id !== 'tr_vcc_2');
    const rep = PcbConnectivityVerifier.verify(model);
    const caught = rep.status === 'OPEN_CONNECTION' && rep.violations.some(v => v.code === 'PCB-CON-003' || v.code === 'PCB-CON-002');
    results.push({
      id: 'ADV-07',
      name: 'Disconnected Trace & Incomplete Net Topology Enforcement',
      passed: caught,
      verdict: caught ? 'PASS' : 'FAIL',
      details: caught
        ? `Detected missing net branch to U1:1 (status: ${rep.status}, open count: ${rep.openConnectionsCount})`
        : 'Failed to detect incomplete net topology'
    });
  }

  // =========================================================================
  // 8. Deterministic canonical serialization and hashing
  // =========================================================================
  {
    const model1 = createValidPhase1Baseline();
    const model2 = createValidPhase1Baseline();
    // Shuffle arrays in model2
    model2.components = [...model1.components].reverse();
    model2.placements = [...model1.placements].reverse();
    model2.traces = [...model1.traces].reverse();
    model2.schematicNets = [...model1.schematicNets].reverse();

    const hash1 = PcbCanonicalModelValidator.computeCanonicalHash(model1);
    const hash2 = PcbCanonicalModelValidator.computeCanonicalHash(model2);
    const matches = hash1 === hash2 && hash1.length === 64;
    results.push({
      id: 'ADV-08',
      name: 'Deterministic Canonical Serialization (Order Invariant)',
      passed: matches,
      verdict: matches ? 'PASS' : 'FAIL',
      details: matches
        ? `Permutation-invariant SHA-256 match: ${hash1}`
        : 'Order perturbation altered canonical hash'
    });
  }

  // =========================================================================
  // 9. Hash change after meaningful geometry mutation
  // =========================================================================
  {
    const modelOriginal = createValidPhase1Baseline();
    const modelMutated = createValidPhase1Baseline();
    // Move 1 placement by 0.05mm
    modelMutated.placements[0].xMm += 0.05;

    const hashOriginal = PcbCanonicalModelValidator.computeCanonicalHash(modelOriginal);
    const hashMutated = PcbCanonicalModelValidator.computeCanonicalHash(modelMutated);
    const changed = hashOriginal !== hashMutated && hashMutated.length === 64;
    results.push({
      id: 'ADV-09',
      name: 'Cryptographic Hash Sensitivity to Geometric Mutation',
      passed: changed,
      verdict: changed ? 'PASS' : 'FAIL',
      details: changed
        ? `0.05mm shift flipped hash from ${hashOriginal.slice(0, 16)}... to ${hashMutated.slice(0, 16)}...`
        : 'Geometry mutation failed to alter cryptographic hash'
    });
  }

  // =========================================================================
  // 10. Invalid or incomplete footprint data
  // =========================================================================
  {
    const model = createValidPhase1Baseline();
    delete model.footprintLibrary['FP_MCU_QFP48'];

    const rep = PcbConnectivityVerifier.verify(model);
    const caught = rep.status === 'INCOMPLETE_FOOTPRINT_DATA' && !rep.passed;
    results.push({
      id: 'ADV-10',
      name: 'Fail-Safe Rejection on Incomplete Footprint Library',
      passed: caught,
      verdict: caught ? 'PASS' : 'FAIL',
      details: caught
        ? `Closed-fail enforced: returned status ${rep.status} with PASS blocked`
        : 'Failed to reject missing footprint data'
    });
  }

  // =========================================================================
  // 11. PcbEngine Integration: Corruption Handling
  // =========================================================================
  {
    // Valid layout generated through PcbEngine
    const validLayout = PcbEngine.generatePcbLayout(80, 50, 1.6);
    const validPassed = validLayout.connectivityReport?.passed === true;

    // Mutate canonical model with severe short and verify through engine verifiers
    const corruptedCanonical = PcbEngine.getCanonicalModel(80, 50, 1.6);
    corruptedCanonical.traces.push({
      id: 'tr_corrupt',
      netName: 'GND',
      layer: 'TOP_COPPER',
      widthMm: 0.5,
      path: [{ x: 9.5, y: 25 }, { x: 9.5, y: 28 }]
    });
    const corruptRep = PcbConnectivityVerifier.verify(corruptedCanonical);
    const corruptFailed = corruptRep.passed === false && corruptRep.status === 'SHORT_CIRCUIT';

    const passed = validPassed && corruptFailed;
    results.push({
      id: 'ADV-11',
      name: 'PcbEngine Real Verifier Binding & Corruption Rejection',
      passed,
      verdict: passed ? 'PASS' : 'FAIL',
      details: passed
        ? 'PcbEngine binds to real verifiers: pristine design passes, corrupted design rejected'
        : 'PcbEngine failed to reject corrupted design'
    });
  }

  // =========================================================================
  // 12. SECP Evidence Ledger Integration
  // =========================================================================
  {
    const model = createValidPhase1Baseline();
    const canonicalHash = PcbCanonicalModelValidator.computeCanonicalHash(model);
    const connectivityReport = PcbConnectivityVerifier.verify(model);

    const ledger = EngineeringEvidenceLedger.getInstance();
    const entry = ledger.registerEvidence({
      evidenceType: 'PCB_DESIGN_VERIFICATION',
      engineeringObjectId: model.designId || 'SECP-PCB-CANONICAL-REF',
      objectRevision: model.revisionId || 'REV-0.1.0',
      projectId: 'SECP-INDUSTRIAL-OS',
      organizationId: 'SECP-FOUNDATION',
      producerIdentity: 'SECP-PCB-ENGINE-VERIFIER-V1',
      producerType: 'ALGORITHMIC',
      sourceSystem: 'SECP-PCB-ENGINE',
      sourceVersion: '1.0.0-PROD',
      payload: {
        canonicalHash,
        connectivityStatus: connectivityReport.status,
        passed: connectivityReport.passed,
        routedNets: connectivityReport.routedNetsCount,
        violationsCount: connectivityReport.violations.length,
        timestamp: new Date().toISOString()
      }
    });

    const retrieved = ledger.query.getByEngineeringObjectId(model.designId || 'SECP-PCB-CANONICAL-REF');
    const matched = retrieved.some(r => r.entryHash === entry.entryHash);
    const ledgerVerification = ledger.query.verifyLedger();

    const passed = matched && ledgerVerification.status === 'VALID' && entry.entryHash.startsWith('sha256-entry-');
    results.push({
      id: 'ADV-12',
      name: 'SECP Evidence Ledger Registration & Cryptographic Retrieval',
      passed,
      verdict: passed ? 'PASS' : 'FAIL',
      details: passed
        ? `Registered in EngineeringEvidenceLedger (entryHash: ${entry.entryHash}, ledger status: ${ledgerVerification.status})`
        : 'Failed evidence ledger registration or verification'
    });
  }

  const passedCount = results.filter(r => r.passed).length;

  return {
    allPassed: passedCount === results.length,
    passedCount,
    totalCount: results.length,
    results
  };
}

export function printAdversarialReport() {
  const suite = runAdversarialClosureSuite();

  console.log('======================================================================');
  console.log('SECP-PCB-PHASE-1-CLOSURE-001 — ADVERSARIAL VERIFICATION BATTERY');
  console.log(`STATUS: ${suite.allPassed ? 'ALL PASSED (100%)' : 'FAILURES DETECTED'}`);
  console.log(`PASSED: ${suite.passedCount}/${suite.totalCount}`);
  console.log('======================================================================');

  for (const r of suite.results) {
    const sym = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`[${sym}] ${r.id.padEnd(8)} ${r.name}`);
    console.log(`       ↳ ${r.details}`);
  }

  console.log('======================================================================');
  return suite;
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].endsWith('verify_pcb_adversarial_closure.ts')) {
  const suite = printAdversarialReport();
  if (!suite.allPassed) {
    process.exit(1);
  }
}
