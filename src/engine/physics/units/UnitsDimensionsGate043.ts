/**
 * SECP Industrial OS v2 — Units & Dimensions Gate
 * PATCH-043: Units & Dimensions Engine
 */

import { UnitRegistry } from './Unit';
import { UnitValidator } from './UnitValidator';
import { Quantity } from './Quantity';
import { Dimension } from './Dimension';

export type UnitsGateVerdict = 'PASS' | 'FAIL' | 'UNPROVEN' | 'INCONCLUSIVE' | 'INVALID';

export interface UnitsGateResult {
  status: UnitsGateVerdict;
  capabilities: {
    UNIT_REGISTRY: boolean;
    DIMENSION_ENGINE: boolean;
    UNIT_CONVERSION: boolean;
    QUANTITY_ARITHMETIC: boolean;
    DIMENSIONAL_ANALYSIS: boolean;
  };
  verdict: UnitsGateVerdict;
  evidence: string[];
}

export class UnitsDimensionsGate043 {
  public static evaluate(): UnitsGateResult {
    const evidence: string[] = [];
    let pass = true;

    // 1. Registry Check
    const hasBaseUnits = UnitRegistry.has('m') && UnitRegistry.has('kg') && UnitRegistry.has('s');
    evidence.push(`Unit Registry initialized: ${hasBaseUnits}`);
    if (!hasBaseUnits) pass = false;

    // 2. Conversion Check (m -> mm)
    const convM2MM = UnitValidator.verifyConversion(1, 'm', 'mm', 1000);
    evidence.push(`Unit Conversion (m -> mm) verified: ${convM2MM}`);
    if (!convM2MM) pass = false;

    // 3. Dimensional Compatibility (m vs s)
    const incompatible = !UnitValidator.areCompatible('m', 's');
    evidence.push(`Dimensional Incompatibility (m vs s) detected: ${incompatible}`);
    if (!incompatible) pass = false;

    // 4. Quantity Arithmetic (1m + 500mm = 1.5m)
    const q1 = new Quantity(1, UnitRegistry.get('m'));
    const q2 = new Quantity(500, UnitRegistry.get('mm'));
    const sum = q1.add(q2);
    const sumValid = sum.value === 1.5 && sum.unit.symbol === 'm';
    evidence.push(`Quantity Arithmetic (1m + 500mm = 1.5m) verified: ${sumValid}`);
    if (!sumValid) pass = false;

    // 5. Dimensional Analysis (Force = M * L / T^2)
    const m = new Quantity(1, UnitRegistry.get('kg'));
    const l = new Quantity(1, UnitRegistry.get('m'));
    const t = new Quantity(1, UnitRegistry.get('s'));
    const force = m.multiply(l).divide(t).divide(t);
    const forceValid = force.dimension.equals(Dimension.FORCE);
    evidence.push(`Dimensional Analysis (M*L/T^2 = Force) verified: ${forceValid}`);
    if (!forceValid) pass = false;

    const verdict: UnitsGateVerdict = pass ? 'PASS' : 'FAIL';

    return {
      status: verdict,
      capabilities: {
        UNIT_REGISTRY: hasBaseUnits,
        DIMENSION_ENGINE: true,
        UNIT_CONVERSION: convM2MM,
        QUANTITY_ARITHMETIC: sumValid,
        DIMENSIONAL_ANALYSIS: forceValid
      },
      verdict,
      evidence
    };
  }
}
