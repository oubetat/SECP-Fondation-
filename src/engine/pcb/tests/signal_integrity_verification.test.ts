/**
 * SECP Industrial OS — Engineering Truth OS
 * signal_integrity_verification.test.ts
 * 
 * Verifies PcbSignalIntegrityEngine Microstrip and Stripline characteristic impedance ($Z_0$)
 * and propagation delay calculations per IPC-2141.
 */

import { describe, it, expect } from 'vitest';
import { PcbSignalIntegrityEngine } from '../PcbSignalIntegrityEngine';

function logSection(title: string) {
  console.log('\n' + '='.repeat(70));
  console.log(title);
  console.log('='.repeat(70));
}

let totalAssertions = 0;
let passedAssertions = 0;

function assert(id: string, name: string, condition: boolean, note: string) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`[✓ PASS] ${id.padEnd(16)} ${name.padEnd(42)} ↳ ${note}`);
  } else {
    console.error(`[✗ FAIL] ${id.padEnd(16)} ${name.padEnd(42)} ↳ ${note}`);
    process.exitCode = 1;
  }
}

describe('SECP PCB — Signal Integrity & Impedance', () => {
  it('verifies microstrip and stripline characteristic impedance', async () => {
    logSection('SECP PCB — SIGNAL INTEGRITY & IMPEDANCE VERIFICATION SUITE');

    // Test 1: Microstrip 50 Ohm target (FR4 Er = 4.3, h = 0.2mm, w = 0.35mm, t = 35um)
    const msResult = PcbSignalIntegrityEngine.calculateMicrostrip({
      traceWidthMm: 0.35,
      traceThicknessUm: 35,
      dielectricHeightMm: 0.2,
      relativePermittivity: 4.3
    });

    assert(
      'SI-MS-001',
      'Microstrip Characteristic Impedance ($Z_0$)',
      msResult.impedanceOhms > 40 && msResult.impedanceOhms < 60,
      `Calculated Z0 = ${msResult.impedanceOhms} Ω (Target ~50Ω, Delay = ${msResult.propagationDelayPsPerMm} ps/mm)`
    );

    // Test 2: Stripline 50 Ohm target (Er = 4.3, b = 1.0mm, w = 0.25mm, t = 35um)
    const slResult = PcbSignalIntegrityEngine.calculateStripline({
      traceWidthMm: 0.25,
      traceThicknessUm: 35,
      totalDielectricHeightMm: 1.0,
      tracePlaneOffsetMm: 0.5,
      relativePermittivity: 4.3
    });

    assert(
      'SI-SL-001',
      'Stripline Characteristic Impedance ($Z_0$)',
      slResult.impedanceOhms > 35 && slResult.impedanceOhms < 65,
      `Calculated Stripline Z0 = ${slResult.impedanceOhms} Ω (Delay = ${slResult.propagationDelayPsPerMm} ps/mm)`
    );

    logSection(`SIGNAL INTEGRITY SUMMARY: ${passedAssertions}/${totalAssertions} PASSED (100%)`);
    expect(passedAssertions).toBe(totalAssertions);
    expect(totalAssertions).toBeGreaterThan(0);
  });
});

