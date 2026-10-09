import { 
  TemperatureDependentProperty, 
  TemperatureUnit, 
  InterpolationPolicy, 
  ExtrapolationPolicy,
  ResolutionStatus
} from "./types";
import { TemperaturePropertyResolver } from "./TemperaturePropertyResolver";
import { IndependentTemperaturePropertyAuditor } from "./IndependentTemperaturePropertyAuditor";
import { PropertySourceType, MaterialFamily, MaterialStatus } from "../types";
import { MaterialDBStatus } from "../dbTypes";

export interface Gate091Report {
  verdict: string;
  totalChecks: number;
  passedChecks: number;
  checks: { id: string; passed: boolean; details: string }[];
}

export class HardAcceptanceGate091 {
  public static evaluateGate(): Gate091Report {
    const checks: { id: string; passed: boolean; details: string }[] = [];

    // Mock Property: Young's Modulus for Steel vs Temperature
    const mockProperty: TemperatureDependentProperty = {
      propertyId: 'PROP-E-STEEL-001',
      materialId: 'STEEL-S235',
      revision: 1,
      propertyName: 'YOUNGS_MODULUS',
      valueUnit: 'Pa',
      validityDomain: { tMin: 273.15, tMax: 1000.0, unit: TemperatureUnit.KELVIN },
      interpolationPolicy: InterpolationPolicy.LINEAR,
      extrapolationPolicy: ExtrapolationPolicy.DISALLOW,
      points: [
        { temperature: 20, unit: TemperatureUnit.CELSIUS, normalizedTemperature: 293.15, value: 210e9, valueUnit: 'Pa' },
        { temperature: 500, unit: TemperatureUnit.CELSIUS, normalizedTemperature: 773.15, value: 160e9, valueUnit: 'Pa' }
      ],
      provenance: { reference: 'EN 1993-1-2', sourceType: PropertySourceType.STANDARD, sourceId: 'MIL-HDBK-5', timestamp: '2026-08-20T11:00:00Z', author: 'system', hash: 'hash' },
      validationStatus: MaterialStatus.VERIFIED
    };

    // 1. EXACT_POINT_RESOLVE
    const res1 = TemperaturePropertyResolver.resolve(mockProperty, 293.15);
    checks.push({ 
      id: "EXACT_POINT_RESOLVE", 
      passed: res1.status === ResolutionStatus.EXACT_DATA_POINT && res1.value === 210e9, 
      details: "Verified exact temperature point resolution" 
    });

    // 2. LINEAR_INTERPOLATION_CHECK
    // Midpoint between 293.15 and 773.15 is 533.15
    // Value should be (210 + 160) / 2 = 185e9
    const res2 = TemperaturePropertyResolver.resolve(mockProperty, 533.15);
    checks.push({ 
      id: "LINEAR_INTERPOLATION_CHECK", 
      passed: res2.status === ResolutionStatus.INTERPOLATED && Math.abs(res2.value - 185e9) < 1, 
      details: "Verified deterministic linear interpolation" 
    });

    // 3. DOMAIN_PROTECTION_CHECK
    const res3 = TemperaturePropertyResolver.resolve(mockProperty, 1100.0);
    checks.push({ 
      id: "DOMAIN_PROTECTION_CHECK", 
      passed: res3.status === ResolutionStatus.OUTSIDE_DOMAIN, 
      details: "Verified domain boundary protection (DISALLOW extrapolation)" 
    });

    // 4. INDEPENDENT_AUDIT_PASS
    const audit = IndependentTemperaturePropertyAuditor.auditProperty(mockProperty);
    checks.push({ 
      id: "INDEPENDENT_AUDIT_PASS", 
      passed: audit.verdict === "VALID", 
      details: "Verified property metadata and unit integrity via independent auditor" 
    });

    const passedChecks = checks.filter(c => c.passed).length;
    const verdict = passedChecks === checks.length ? "PASS" : "FAIL";

    return {
      verdict,
      totalChecks: checks.length,
      passedChecks,
      checks
    };
  }
}
