/**
 * SECP Industrial OS — Engineering Truth OS
 * structural_deflection_verification.test.ts
 * 
 * Verifies PcbStructuralDeflectionEngine substrate deflection, bending stress,
 * and fundamental natural frequency under static and dynamic loading.
 */

import { describe, it, expect } from 'vitest';
import { PcbStructuralDeflectionEngine, PcbSubstrateProperties } from '../PcbStructuralDeflectionEngine';

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

describe('SECP PCB — Structural Substrate Deflection', () => {
  it('verifies substrate deflection, stress, and natural frequency', async () => {

  logSection('SECP PCB — STRUCTURAL SUBSTRATE DEFLECTION & STRESS VERIFICATION SUITE');

  const substrate: PcbSubstrateProperties = {
    lengthMm: 80,
    widthMm: 50,
    thicknessMm: 1.6, // Standard 1.6mm FR4
    youngModulusGpa: 24.0, // FR4 Young's modulus
    poissonRatio: 0.14,
    densityKgM3: 1850.0,
    totalMassKg: 0.045, // 45 grams ECU assembly
    mountingType: 'FOUR_CORNERS_SUPPORTED'
  };

  const result = PcbStructuralDeflectionEngine.evaluateStructuralIntegrity(substrate, 80.0); // 80 Pa load

  assert(
    'STRUC-DEF-001',
    'Substrate Maximum Center Deflection',
    result.maxDeflectionMm >= 0 && result.maxDeflectionMm < (substrate.lengthMm / 500),
    `Max deflection = ${result.maxDeflectionMm} mm (Allowable limit: ${(substrate.lengthMm / 500).toFixed(3)} mm)`
  );

  assert(
    'STRUC-STR-001',
    'Substrate Maximum Bending Stress',
    result.maxBendingStressMpa >= 0 && result.maxBendingStressMpa < 100.0,
    `Max bending stress = ${result.maxBendingStressMpa} MPa (Yield safety limit: 100 MPa)`
  );

  assert(
    'STRUC-FREQ-001',
    'Fundamental Natural Frequency ($f_n$)',
    result.fundamentalFrequencyHz > 10.0,
    `Fundamental frequency = ${result.fundamentalFrequencyHz} Hz`
  );

  assert(
    'STRUC-STABLE-001',
    'Structural Stability Verdict',
    result.isMechanicallyStable,
    result.notes
  );

    logSection(`STRUCTURAL DEFLECTION SUMMARY: ${passedAssertions}/${totalAssertions} PASSED (100%)`);
    expect(passedAssertions).toBe(totalAssertions);
    expect(totalAssertions).toBeGreaterThan(0);
  });
});

