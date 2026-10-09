import { describe, expect, it } from "vitest";
import { 
  TemperatureConverter, 
  TemperatureUnit, 
  InterpolationEngine,
  TemperaturePropertyResolver,
  HardAcceptanceGate091,
  generateReports091,
  InterpolationPolicy,
  ExtrapolationPolicy,
  ResolutionStatus
} from "../index";

describe("PATCH-091: Temperature-Dependent Properties", () => {
  it("1. Temperature Converter handles K/C/F correctly", () => {
    expect(TemperatureConverter.toKelvin(0, TemperatureUnit.CELSIUS)).toBe(273.15);
    expect(TemperatureConverter.fromKelvin(273.15, TemperatureUnit.CELSIUS)).toBe(0);
    expect(TemperatureConverter.toKelvin(32, TemperatureUnit.FAHRENHEIT)).toBe(273.15);
  });

  it("2. Linear Interpolation is deterministic", () => {
    const p1 = { normalizedTemperature: 300, value: 100 } as any;
    const p2 = { normalizedTemperature: 400, value: 200 } as any;
    
    expect(InterpolationEngine.interpolateLinear(350, p1, p2)).toBe(150);
    expect(InterpolationEngine.interpolateLinear(300, p1, p2)).toBe(100);
    expect(InterpolationEngine.interpolateLinear(400, p1, p2)).toBe(200);
  });

  it("3. Resolver respects validity domains and extrapolation policy", () => {
    const prop = {
      points: [
        { normalizedTemperature: 300, value: 10 },
        { normalizedTemperature: 400, value: 20 }
      ],
      validityDomain: { tMin: 300, tMax: 400 },
      interpolationPolicy: InterpolationPolicy.LINEAR,
      extrapolationPolicy: ExtrapolationPolicy.DISALLOW
    } as any;

    const resInRange = TemperaturePropertyResolver.resolve(prop, 350);
    expect(resInRange.value).toBe(150 / 10); // Wait, (10+20)/2 = 15. Let me check the logic.
    // 10 + (20-10)*(350-300)/(400-300) = 10 + 10 * 50 / 100 = 10 + 5 = 15.
    expect(resInRange.value).toBe(15);
    expect(resInRange.status).toBe(ResolutionStatus.INTERPOLATED);

    const resOut = TemperaturePropertyResolver.resolve(prop, 500);
    expect(resOut.status).toBe(ResolutionStatus.OUTSIDE_DOMAIN);
  });

  it("4. HardAcceptanceGate091 achieves PASS verdict", () => {
    const report = HardAcceptanceGate091.evaluateGate();
    expect(report.verdict).toBe("PASS");
  });

  it("5. generateReports091 executes without error", () => {
    expect(() => generateReports091()).not.toThrow();
  });
});
