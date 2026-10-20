/**
 * SECP Industrial OS - PCB Mechanical MCAD Co-Design Acceptance Test
 * Direct test runner verifying enclosure cavity containment, vertical lid clearance,
 * and standoff mounting alignment.
 */

import { PcbHardAcceptanceGate } from '../PcbHardAcceptanceGate';
import { PcbMechanicalVerifier } from '../PcbMechanicalVerifier';

export function runMechanicalSuite() {
  console.log('======================================================================');
  console.log('SECP INDUSTRIAL OS — PCB MCAD MECHANICAL VERIFIER TEST');
  console.log('======================================================================');

  const baseline = PcbHardAcceptanceGate.createValidBaselineModel();
  const baseReport = PcbMechanicalVerifier.verify(baseline);

  console.log(`[Baseline Fit Status]: ${baseReport.boardFitStatus} (Passed: ${baseReport.passed})`);
  console.log(`- Wall Clearance: ${baseReport.minWallClearanceMm.toFixed(2)}mm`);
  console.log(`- Vertical Lid Clearance: ${baseReport.minVerticalClearanceMm.toFixed(2)}mm`);
  console.log(`- Standoffs Matched: ${baseReport.matchedStandoffsCount}/${baseReport.matchedStandoffsCount + baseReport.unmatchedStandoffsCount}`);

  // Test Defect 1: Wall clash
  const wallClashModel = PcbHardAcceptanceGate.createValidBaselineModel();
  wallClashModel.boardWidthMm = 100; // Enclosure internal cavity is 90mm
  const wallReport = PcbMechanicalVerifier.verify(wallClashModel);
  const wallCaught = wallReport.violations.some(v => v.code === 'PCB-MEC-001');
  console.log(`[Defect PCB-MEC-001] Internal Cavity Breach Caught: ${wallCaught ? '✓ PASS' : '✗ FAIL'}`);

  // Test Defect 2: Lid vertical collision
  const lidClashModel = PcbHardAcceptanceGate.createValidBaselineModel();
  lidClashModel.placements[0].height3dMm = 20; // 5 + 1.6 + 20 = 26.6mm > 20mm
  const lidReport = PcbMechanicalVerifier.verify(lidClashModel);
  const lidCaught = lidReport.violations.some(v => v.code === 'PCB-MEC-002');
  console.log(`[Defect PCB-MEC-002] Lid Vertical Clearance Clash Caught: ${lidCaught ? '✓ PASS' : '✗ FAIL'}`);

  // Test Defect 3: Standoff misalignment
  const standoffModel = PcbHardAcceptanceGate.createValidBaselineModel();
  standoffModel.mountingHoles[1].x = 60; // Expected at 75
  const standoffReport = PcbMechanicalVerifier.verify(standoffModel);
  const standoffCaught = standoffReport.violations.some(v => v.code === 'PCB-MEC-003');
  console.log(`[Defect PCB-MEC-003] Standoff Misalignment Caught: ${standoffCaught ? '✓ PASS' : '✗ FAIL'}`);

  const allPassed = baseReport.passed && wallCaught && lidCaught && standoffCaught;
  console.log('----------------------------------------------------------------------');
  console.log(`MECHANICAL SUITE OVERALL: ${allPassed ? 'ALL PASSED (100%)' : 'FAILED'}`);
  console.log('======================================================================');

  return {
    passed: allPassed,
    baseReport,
    wallReport,
    lidReport,
    standoffReport
  };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1] && process.argv[1].endsWith('verify_pcb_mechanical.ts')) {
  const result = runMechanicalSuite();
  if (!result.passed) {
    process.exit(1);
  }
}
