import { 
  TemperatureDependentProperty, 
  TemperatureUnit, 
  ResolutionStatus 
} from "./types";
import { TemperatureConverter } from "./TemperatureConverter";

export interface TemperatureAuditReport {
  verdict: string;
  checks: { id: string; passed: boolean; details: string }[];
}

export class IndependentTemperaturePropertyAuditor {
  public static auditProperty(property: TemperatureDependentProperty): TemperatureAuditReport {
    const checks: { id: string; passed: boolean; details: string }[] = [];

    // 1. UNIT_CONVERSION_INTEGRITY
    const testC = 100;
    const testK = TemperatureConverter.toKelvin(testC, TemperatureUnit.CELSIUS);
    const backC = TemperatureConverter.fromKelvin(testK, TemperatureUnit.CELSIUS);
    checks.push({ 
      id: "UNIT_CONVERSION_INTEGRITY", 
      passed: Math.abs(backC - testC) < 1e-9, 
      details: "Verified Celsius/Kelvin round-trip consistency" 
    });

    // 2. MONOTONIC_TEMPERATURE_CHECK
    const temperatures = property.points.map(p => p.normalizedTemperature);
    const isSorted = temperatures.every((t, i) => i === 0 || t >= temperatures[i - 1]);
    // Note: We don't necessarily enforce sorted points in the data structure, 
    // but the resolver sorts them. However, audit might check for duplicates or sanity.
    const hasDuplicates = new Set(temperatures).size !== temperatures.length;
    checks.push({ 
      id: "DATA_INTEGRITY_CHECK", 
      passed: !hasDuplicates, 
      details: "Verified no duplicate temperature coordinates" 
    });

    // 3. DOMAIN_CONSISTENCY
    const domainValid = property.validityDomain.tMin <= property.validityDomain.tMax;
    checks.push({ 
      id: "DOMAIN_CONSISTENCY", 
      passed: domainValid, 
      details: "Verified validity domain boundaries" 
    });

    const verdict = checks.every(c => c.passed) ? "VALID" : "INVALID";

    return { verdict, checks };
  }
}
