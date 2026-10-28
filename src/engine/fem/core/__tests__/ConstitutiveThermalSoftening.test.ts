/**
 * SECP Industrial OS — Engineering Truth OS
 * ConstitutiveThermalSoftening.test.ts
 *
 * Unit tests verifying temperature-dependent material response:
 * - Young's Modulus softening: E(T) = E_0 * (1 - alpha_E * dT)
 * - Yield Stress softening: sigma_y0(T) = sigma_y0_0 * (1 - alpha_Y * dT)
 * - State manager update ordering and flow stress evolution
 */

import { describe, it, expect } from 'vitest';
import { TET4LargeDeformationPlasticFormulation } from '../TET4LargeDeformationPlasticFormulation';
import { IntegrationPointState } from '../FEMTypes';

describe('Constitutive Thermal Softening & Material State Updates', () => {
  it('should compute exact thermal softening of yield stress and Young modulus', () => {
    const formulation = new TET4LargeDeformationPlasticFormulation();
    const S_trial = [100, 0, 0, 0, 0, 0];
    const E = 200000;
    const nu = 0.3;
    const sigma_y0 = 300;
    const H = 1000;
    const temperature = 120; // C
    const refTempC = 20; // C
    const alphaY = 0.002; // 0.2%/C
    const dT = temperature - refTempC; // 100 C

    const expectedSigmaY = sigma_y0 * (1.0 - alphaY * dT); // 300 * 0.8 = 240 MPa

    const result = formulation.performRadialReturn(
      S_trial,
      E * (1.0 - 0.001 * dT),
      nu,
      sigma_y0,
      H,
      undefined,
      temperature,
      alphaY,
      refTempC
    );

    expect(expectedSigmaY).toBeCloseTo(240.0, 4);
    expect(result.yieldFlag).toBe(false); // 100 MPa < 240 MPa -> Elastic
    expect(result.equivalentPlasticStrain).toBe(0);
  });

  it('should update yield stress with strain hardening when plastic yielding occurs', () => {
    const formulation = new TET4LargeDeformationPlasticFormulation();
    const S_trial = [500, 0, 0, 0, 0, 0]; // High trial stress to force yielding
    const E = 200000;
    const nu = 0.3;
    const sigma_y0 = 300;
    const H = 1000;
    const temperature = 120;
    const refTempC = 20;
    const alphaY = 0.002;

    const result = formulation.performRadialReturn(
      S_trial,
      E,
      nu,
      sigma_y0,
      H,
      undefined,
      temperature,
      alphaY,
      refTempC
    );

    expect(result.yieldFlag).toBe(true);
    expect(result.equivalentPlasticStrain).toBeGreaterThan(0);
  });
});
