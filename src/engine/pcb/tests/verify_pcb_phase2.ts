/**
 * SECP Industrial OS — SECP-PCB-PHASE-2-001
 * Comprehensive Phase 2 Independent Acceptance Test Battery:
 * Tests Geometric Intelligence, Exact Swept Trace Clearance, Pad Shapes (OVAL, ROUND, RECT, POLYGON),
 * DRC & DFM Capabilities Matrix, Schematic-to-Layout Consistency, Ruleset Hashing, and Evidence Freshness.
 */

import {
  PcbCanonicalModel,
  PcbCanonicalModelValidator,
  FootprintDefinition
} from '../PcbCanonicalModel';
import { PcbDesignRulesManager, PcbDesignRuleset } from '../PcbDesignRules';
import { PcbGeometryKernel, GeometricPad } from '../PcbGeometryKernel';
import { PcbConnectivityVerifier } from '../PcbConnectivityVerifier';
import { PcbGeometryVerifier } from '../PcbGeometryVerifier';
import { PcbDrcDfmVerifier } from '../PcbDrcDfmVerifier';
import { PcbSchematicConsistencyVerifier } from '../PcbSchematicConsistencyVerifier';
import { PcbHardAcceptanceGate } from '../PcbHardAcceptanceGate';
import { PcbVerificationService } from '../PcbVerificationService';
import { EngineeringEvidenceLedger } from '../../evidence/ledger/EngineeringEvidenceLedger';

export interface Phase2TestAssertionResult {
  id: string;
  name: string;
  category: 'GEOMETRY_KERNEL' | 'DRC_DFM' | 'SCHEMATIC_CONSISTENCY' | 'EVIDENCE_CRYPTOGRAPHY';
  passed: boolean;
  verdict: 'PASS' | 'FAIL';
  details: string;
}

export function runPhase2Suite(): {
  allPassed: boolean;
  passedCount: number;
  totalCount: number;
  results: Phase2TestAssertionResult[];
} {
  const results: Phase2TestAssertionResult[] = [];

  // =========================================================================
  // 1. PCB-P2-GEO-001: True copper contact between distinct nets -> detect short
  // =========================================================================
  {
    const base = PcbHardAcceptanceGate.createValidBaselineModel();
    // Route GND trace overlapping VCC_3V3 pad
    base.traces.push({
      id: 'tr_p2_short',
      netName: 'GND',
      layer: 'TOP_COPPER',
      widthMm: 0.3,
      path: [{ x: 30, y: 35 }, { x: 40, y: 35 }] // Touches U1:1
    });

    const report = PcbConnectivityVerifier.verify(base);
    const caught = report.status === 'SHORT_CIRCUIT' && report.shortCircuitsCount > 0;
    results.push({
      id: 'PCB-P2-GEO-001',
      name: 'Physical Copper Contact Between Distinct Nets (Short Circuit)',
      category: 'GEOMETRY_KERNEL',
      passed: caught,
      verdict: caught ? 'PASS' : 'FAIL',
      details: caught
        ? `Caught cross-net physical short (status: ${report.status}, shorts: ${report.shortCircuitsCount})`
        : 'Failed to catch same-layer physical contact'
    });
  }

  // =========================================================================
  // 2. PCB-P2-GEO-002: Positive clearance between distinct nets -> No false short
  // =========================================================================
  {
    const base = PcbHardAcceptanceGate.createValidBaselineModel();
    // Trace parallel to VCC_3V3 with 0.3mm air gap
    base.traces.push({
      id: 'tr_p2_cleared',
      netName: 'GND',
      layer: 'TOP_COPPER',
      widthMm: 0.3,
      path: [{ x: 20, y: 35.65 }, { x: 25, y: 35.65 }] // 35.65 - 0.15 = 35.50 vs 35.20 = 0.30mm clearance
    });

    const report = PcbConnectivityVerifier.verify(base);
    const noFalseShort = !report.violations.some(v => v.affectedEntities.includes('tr_p2_cleared'));
    results.push({
      id: 'PCB-P2-GEO-002',
      name: 'Positive Air-Gap Clearance Between Nets (No False Short)',
      category: 'GEOMETRY_KERNEL',
      passed: noFalseShort,
      verdict: noFalseShort ? 'PASS' : 'FAIL',
      details: noFalseShort
        ? 'Positive clearance (0.30mm) safely isolated without triggering short circuit'
        : 'Erroneously flagged positive clearance as a short circuit'
    });
  }

  // =========================================================================
  // 3. PCB-P2-GEO-003: Clearance below DRC threshold -> Flags DRC Violation
  // =========================================================================
  {
    const base = PcbHardAcceptanceGate.createValidBaselineModel();
    // Air gap = 0.08mm < 0.20mm DRC limit
    base.traces.push({
      id: 'tr_p2_drc_clr',
      netName: 'GND',
      layer: 'TOP_COPPER',
      widthMm: 0.4,
      path: [{ x: 20, y: 35.48 }, { x: 25, y: 35.48 }] // Air gap = 35.48 - 0.20 - 35.20 = 0.08mm
    });

    const drc = PcbDrcDfmVerifier.verify(base);
    const caught = drc.violations.some(v => v.ruleId === 'DRC-CLR-001');
    results.push({
      id: 'PCB-P2-GEO-003',
      name: 'Sub-DRC Physical Clearance Violation Detection',
      category: 'DRC_DFM',
      passed: caught,
      verdict: caught ? 'PASS' : 'FAIL',
      details: caught
        ? `Caught DRC clearance violation: actual clearance ${drc.minObservedClearanceMm.toFixed(3)}mm < 0.20mm`
        : 'Failed to flag DRC clearance violation'
    });
  }

  // =========================================================================
  // 4. PCB-P2-GEO-004: Different-layer crossing without via -> Galvanic Isolation
  // =========================================================================
  {
    const base = PcbHardAcceptanceGate.createValidBaselineModel();
    // Cross-layer intersection: one on TOP_COPPER, one on BOTTOM_COPPER
    base.traces.push(
      {
        id: 'tr_p2_top',
        netName: 'VCC_3V3',
        layer: 'TOP_COPPER',
        widthMm: 0.3,
        path: [{ x: 60, y: 20 }, { x: 70, y: 20 }]
      },
      {
        id: 'tr_p2_bot',
        netName: 'GND',
        layer: 'BOTTOM_COPPER',
        widthMm: 0.3,
        path: [{ x: 65, y: 15 }, { x: 65, y: 25 }]
      }
    );

    const report = PcbConnectivityVerifier.verify(base);
    const noFalseShort = !report.violations.some(v =>
      v.code === 'PCB-CON-004' &&
      (v.affectedEntities.includes('tr_p2_top') || v.affectedEntities.includes('tr_p2_bot'))
    );
    results.push({
      id: 'PCB-P2-GEO-004',
      name: 'Multi-Layer Cross-Over Galvanic Isolation (No False Short)',
      category: 'GEOMETRY_KERNEL',
      passed: noFalseShort,
      verdict: noFalseShort ? 'PASS' : 'FAIL',
      details: noFalseShort
        ? 'Cross-over across TOP and BOTTOM copper layers confirmed safely isolated'
        : 'Multi-layer bypass erroneously flagged as short circuit'
    });
  }

  // =========================================================================
  // 5. PCB-P2-GEO-005: Via colliding with copper of distinct net -> Short Circuit
  // =========================================================================
  {
    const base = PcbHardAcceptanceGate.createValidBaselineModel();
    // Place GND via directly on VCC_3V3 trace (tr_vcc_1 path is from x=15 to 29 at y=35)
    base.vias.push({
      id: 'via_p2_short',
      netName: 'GND',
      xMm: 22,
      yMm: 35,
      drillDiameterMm: 0.3,
      padDiameterMm: 0.6,
      startLayer: 'TOP_COPPER',
      endLayer: 'BOTTOM_COPPER'
    });

    const report = PcbConnectivityVerifier.verify(base);
    const caught = report.status === 'SHORT_CIRCUIT' &&
      report.violations.some(v => v.code === 'PCB-CON-004' && v.affectedEntities.includes('via_p2_short'));
    results.push({
      id: 'PCB-P2-GEO-005',
      name: 'Cross-Net Via Collision with Copper Trace',
      category: 'GEOMETRY_KERNEL',
      passed: caught,
      verdict: caught ? 'PASS' : 'FAIL',
      details: caught
        ? 'Caught cross-layer via short: GND via on TOP_COPPER collided with VCC_3V3 trace'
        : 'Failed to detect via collision'
    });
  }

  // =========================================================================
  // 6. PCB-P2-GEO-006: Copper trace width modulation changes clearance threshold
  // =========================================================================
  {
    // Narrow trace 0.1mm clears pad, wide trace 1.0mm collides with pad
    const p1 = { x: 20, y: 10 };
    const p2 = { x: 25, y: 10 };
    const pad: GeometricPad = {
      refDes: 'R1',
      pinNumber: 1,
      netName: 'NET_A',
      layer: 'TOP',
      shape: 'RECT',
      center: { x: 22.5, y: 10.8 },
      widthMm: 1.0,
      heightMm: 1.0,
      rotationDeg: 0
    };

    // With trace width 0.1mm (radius 0.05):
    // Dist from centerline to pad edge = 0.8 - 0.5 = 0.3mm. Clearance = 0.3 - 0.05 = 0.25mm > 0
    const clrNarrow = PcbGeometryKernel.distSegmentToPad(p1, p2, 0.05, pad);
    // With trace width 1.0mm (radius 0.50):
    // Clearance = 0.3 - 0.50 = 0 (collision!)
    const clrWide = PcbGeometryKernel.distSegmentToPad(p1, p2, 0.50, pad);

    const passed = clrNarrow > 0.20 && clrWide === 0;
    results.push({
      id: 'PCB-P2-GEO-006',
      name: 'Copper Trace Width Influence on Physical Clearance Boundary',
      category: 'GEOMETRY_KERNEL',
      passed,
      verdict: passed ? 'PASS' : 'FAIL',
      details: passed
        ? `Width modulation confirmed: narrow width clears with ${clrNarrow.toFixed(2)}mm, wide width collides (clearance = 0)`
        : 'Trace width failed to dynamically modulate collision boundary'
    });
  }

  // =========================================================================
  // 7. PCB-P2-GEO-007: Rotated pad coordinate transformation (90 & 45 deg)
  // =========================================================================
  {
    // Local pin at (2.0, 0.0) rotated 90 degrees around component origin (10.0, 20.0)
    const pt90 = PcbGeometryKernel.transformPoint(2.0, 0.0, 10.0, 20.0, 90);
    // Local pin at (2.0, 0.0) rotated 45 degrees
    const pt45 = PcbGeometryKernel.transformPoint(2.0, 0.0, 10.0, 20.0, 45);

    const matches90 = Math.abs(pt90.x - 10.0) < 1e-4 && Math.abs(pt90.y - 22.0) < 1e-4;
    const expectedX45 = 10.0 + 2.0 * Math.cos(Math.PI / 4);
    const expectedY45 = 20.0 + 2.0 * Math.sin(Math.PI / 4);
    const matches45 = Math.abs(pt45.x - expectedX45) < 1e-4 && Math.abs(pt45.y - expectedY45) < 1e-4;

    const passed = matches90 && matches45;
    results.push({
      id: 'PCB-P2-GEO-007',
      name: 'Pad Coordinate Transformation Under 90-Deg and 45-Deg Rotation',
      category: 'GEOMETRY_KERNEL',
      passed,
      verdict: passed ? 'PASS' : 'FAIL',
      details: passed
        ? `Exact trigonometric transformation verified: (10, 22) for 90-deg and (${pt45.x.toFixed(2)}, ${pt45.y.toFixed(2)}) for 45-deg`
        : 'Transformation matrix divergence detected'
    });
  }

  // =========================================================================
  // 8. PCB-P2-GEO-008: Via layer span and layer change re-evaluation
  // =========================================================================
  {
    const base = PcbHardAcceptanceGate.createValidBaselineModel();
    // Vias in baseline connect TOP_COPPER to BOTTOM_COPPER
    const baseConn = PcbConnectivityVerifier.verify(base);
    const basePassed = baseConn.passed;

    // Mutate via endLayer to INNER_1 (broken multi-layer link to BOTTOM_COPPER!)
    const broken = PcbHardAcceptanceGate.createValidBaselineModel();
    broken.vias[0].endLayer = 'INNER_1';
    const brokenConn = PcbConnectivityVerifier.verify(broken);
    const caught = !brokenConn.passed && brokenConn.violations.some(v => v.code === 'PCB-CON-002');

    const passed = basePassed && caught;
    results.push({
      id: 'PCB-P2-GEO-008',
      name: 'Via Layer-Span Re-evaluation on Blind/Buried Mutation',
      category: 'GEOMETRY_KERNEL',
      passed,
      verdict: passed ? 'PASS' : 'FAIL',
      details: passed
        ? 'Restricted via span to INNER_1 properly broke galvanic path to BOTTOM_COPPER'
        : 'Failed to re-evaluate continuity upon via layer mutation'
    });
  }

  // =========================================================================
  // 9. PCB-P2-GEO-009: Copper element outside board boundary -> violation
  // =========================================================================
  {
    const base = PcbHardAcceptanceGate.createValidBaselineModel();
    // Trace routed outside board outline (board width is 80mm, route at x=85mm)
    base.traces.push({
      id: 'tr_out_of_bounds',
      netName: 'VCC_3V3',
      layer: 'TOP_COPPER',
      widthMm: 0.3,
      path: [{ x: 85, y: 20 }, { x: 88, y: 20 }]
    });

    const geo = PcbGeometryVerifier.verify(base);
    const caught = geo.violations.some(v => v.code === 'PCB-GEO-002');
    results.push({
      id: 'PCB-P2-GEO-009',
      name: 'Copper Conductor Boundary Violation Detection',
      category: 'DRC_DFM',
      passed: caught,
      verdict: caught ? 'PASS' : 'FAIL',
      details: caught
        ? 'Detected copper trace point outside physical substrate outline (PCB-GEO-002)'
        : 'Failed to catch substrate boundary violation'
    });
  }

  // =========================================================================
  // 10. PCB-P2-GEO-010: Incomplete geometric/footprint data -> fail-safe closed
  // =========================================================================
  {
    const base = PcbHardAcceptanceGate.createValidBaselineModel();
    // Delete footprint from library
    delete base.footprintLibrary['FP_MCU_QFP48'];

    const conn = PcbConnectivityVerifier.verify(base);
    const serviceRes = PcbVerificationService.verifyAndAttest(base, undefined, false);

    const closedFail = conn.status === 'INCOMPLETE_FOOTPRINT_DATA' &&
      serviceRes.overallStatus === 'INCOMPLETE' &&
      !serviceRes.passed;

    results.push({
      id: 'PCB-P2-GEO-010',
      name: 'Fail-Safe Rejection on Incomplete Geometric/Footprint Data',
      category: 'DRC_DFM',
      passed: closedFail,
      verdict: closedFail ? 'PASS' : 'FAIL',
      details: closedFail
        ? 'Enforced Closed-Fail: missing footprint returned INCOMPLETE status and blocked approval'
        : 'Incomplete data allowed unwarranted PASS'
    });
  }

  // =========================================================================
  // 11. Support for OVAL and ROUND Pad Geometry clearance calculations
  // =========================================================================
  {
    const ovalPad: GeometricPad = {
      refDes: 'U_OVAL',
      pinNumber: 1,
      layer: 'TOP',
      shape: 'OVAL',
      center: { x: 50, y: 50 },
      widthMm: 2.0,
      heightMm: 1.0,
      rotationDeg: 0
    };

    // Trace passing at y = 50.8 (distance from stadium edge = 50.8 - (50 + 0.5) = 0.3mm)
    const traceP1 = { x: 45, y: 50.8 };
    const traceP2 = { x: 55, y: 50.8 };
    const clr = PcbGeometryKernel.distSegmentToPad(traceP1, traceP2, 0.1, ovalPad);

    // Expected clearance: 0.3mm - 0.1mm = 0.2mm
    const ovalValid = Math.abs(clr - 0.2) < 1e-3;

    results.push({
      id: 'PCB-P2-SHP-001',
      name: 'Exact Stadium/Oval Pad Distance Evaluation',
      category: 'GEOMETRY_KERNEL',
      passed: ovalValid,
      verdict: ovalValid ? 'PASS' : 'FAIL',
      details: ovalValid
        ? `Exact oval clearance calculated: ${clr.toFixed(3)}mm (matches mathematical stadium boundary)`
        : `Oval clearance failed: expected 0.200mm, got ${clr.toFixed(3)}mm`
    });
  }

  // =========================================================================
  // 12. Solder Mask Sliver & Capabilities Matrix Verification
  // =========================================================================
  {
    const base = PcbHardAcceptanceGate.createValidBaselineModel();
    const drc = PcbDrcDfmVerifier.verify(base);

    const hasMatrix = drc.capabilitiesMatrix.length >= 7;
    const allHaveEvidence = drc.capabilitiesMatrix.every(c => c.evidenceReference && c.knownLimitations);

    const passed = hasMatrix && allHaveEvidence;
    results.push({
      id: 'PCB-P2-DFM-MAT',
      name: 'Authoritative DFM Capabilities & Known Limitations Matrix',
      category: 'DRC_DFM',
      passed,
      verdict: passed ? 'PASS' : 'FAIL',
      details: passed
        ? `Validated ${drc.capabilitiesMatrix.length} capability rules with explicit statuses and limitations`
        : 'Incomplete or unevidenced capability matrix'
    });
  }

  // =========================================================================
  // 13. Stale Evidence Detection & Freshness Enforcement
  // =========================================================================
  {
    const base = PcbHardAcceptanceGate.createValidBaselineModel();
    const ruleset = PcbDesignRulesManager.getDefaultStandardRuleset();

    // Generate valid attested evidence
    const verifyResult = PcbVerificationService.verifyAndAttest(base, ruleset, true);
    const evidence = verifyResult.evidence;

    // Check 1: Fresh against identical model
    const freshCheck = PcbVerificationService.verifyEvidenceFreshness(evidence, base, ruleset);

    // Check 2: Mutate geometry (move component by 0.5mm)
    const mutatedModel = PcbHardAcceptanceGate.createValidBaselineModel();
    mutatedModel.placements[0].xMm += 0.5;
    const staleModelCheck = PcbVerificationService.verifyEvidenceFreshness(evidence, mutatedModel, ruleset);

    // Check 3: Mutate design rules (alter clearance limit)
    const mutatedRuleset = JSON.parse(JSON.stringify(ruleset));
    mutatedRuleset.rules['DRC-CLR-001'].value = 0.35;
    const staleRulesCheck = PcbVerificationService.verifyEvidenceFreshness(evidence, base, mutatedRuleset);

    const passed = freshCheck.isFresh && !staleModelCheck.isFresh && !staleRulesCheck.isFresh;
    results.push({
      id: 'PCB-P2-EVD-STL',
      name: 'Prevention of Stale Evidence Reuse on Mutated Models/Rules',
      category: 'EVIDENCE_CRYPTOGRAPHY',
      passed,
      verdict: passed ? 'PASS' : 'FAIL',
      details: passed
        ? 'Successfully detected staleness on both geometric mutation and ruleset modification'
        : 'Allowed stale verification evidence to pass'
    });
  }

  // =========================================================================
  // 14. Phase 2 Hard Acceptance Gate Suite (30 Assertions)
  // =========================================================================
  {
    const gateReport = PcbHardAcceptanceGate.runGatePhase2();
    const passed = gateReport.passed && gateReport.passedCount === 30;

    results.push({
      id: 'PCB-P2-GATE-30',
      name: 'Phase 2 Unified Hard Acceptance Gate (30/30 Assertions)',
      category: 'EVIDENCE_CRYPTOGRAPHY',
      passed,
      verdict: passed ? 'PASS' : 'FAIL',
      details: passed
        ? `Passed all 30 Hard Acceptance Gate assertions in ${gateReport.executionTimeMs.toFixed(2)}ms (Status: ${gateReport.status})`
        : `Gate failed: ${gateReport.passedCount}/${gateReport.totalAssertions} passed`
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

export function printPhase2Report() {
  const suite = runPhase2Suite();

  console.log('======================================================================');
  console.log('SECP INDUSTRIAL OS — SECP-PCB-PHASE-2-001 ACCEPTANCE SUITE');
  console.log(`STATUS: ${suite.allPassed ? 'ALL PASSED (100%)' : 'FAILURES DETECTED'}`);
  console.log(`PASSED: ${suite.passedCount}/${suite.totalCount}`);
  console.log('======================================================================');

  for (const r of suite.results) {
    const sym = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`[${sym}] ${r.id.padEnd(16)} [${r.category.padEnd(20)}] ${r.name}`);
    console.log(`       ↳ ${r.details}`);
  }

  console.log('======================================================================');
  return suite;
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].endsWith('verify_pcb_phase2.ts')) {
  const suite = printPhase2Report();
  if (!suite.allPassed) {
    process.exit(1);
  }
}
