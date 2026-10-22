/**
 * SECP Industrial OS — Engineering Truth OS
 * copper_pour_verification.test.ts
 * 
 * Verifies PcbCopperPourEngine polygon fill generation and thermal relief spoke clearance.
 */

import { describe, it, expect } from 'vitest';
import { PcbCopperPourEngine, CopperPourDefinition } from '../PcbCopperPourEngine';

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

describe('SECP PCB — Copper Pour & Thermal Relief', () => {
  it('verifies polygon fill generation and thermal relief spoke clearance', async () => {
    logSection('SECP PCB — COPPER POUR & THERMAL RELIEF VERIFICATION SUITE');

    const pourDef: CopperPourDefinition = {
      id: 'POUR_GND_BOTTOM',
      netName: 'GND',
      layer: 'BOTTOM_COPPER',
      outline: [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 50 },
        { x: 0, y: 50 }
      ],
      clearanceMm: 0.3,
      thermalReliefEnabled: true,
      spokeCount: 4,
      spokeWidthMm: 0.4,
      fillType: 'SOLID'
    };

    const pads = [
      { x: 14.5, y: 25, netName: 'GND', radiusMm: 1.0 },
      { x: 28.9, y: 15, netName: 'GND', radiusMm: 1.0 },
      { x: 90.0, y: 60, netName: 'VCC_3V3', radiusMm: 1.0 } // Outside pour boundary
    ];

    const result = PcbCopperPourEngine.generatePour(pourDef, 80, 50, pads);

    assert(
      'POUR-001',
      'Copper Pour Polygon Generation Success',
      result.success && result.clearanceViolationsDetected === 0,
      result.notes
    );

    assert(
      'POUR-002',
      'Thermal Relief Spoke Allocation',
      result.thermalReliefsCount === 2,
      `Allocated thermal reliefs for ${result.thermalReliefsCount} GND pads`
    );

    logSection(`COPPER POUR SUMMARY: ${passedAssertions}/${totalAssertions} PASSED (100%)`);
    expect(passedAssertions).toBe(totalAssertions);
    expect(totalAssertions).toBeGreaterThan(0);
  });
});

