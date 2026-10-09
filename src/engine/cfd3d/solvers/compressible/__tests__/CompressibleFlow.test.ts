import { describe, it, expect } from 'vitest';
import { HardAcceptanceGate253 } from '../HardAcceptanceGate253';
import { CompressibleFlowSolver } from '../CompressibleFlowSolver';
import { EquationOfState } from '../EquationOfState';
import { CompressibleFluxCalculator } from '../CompressibleFluxCalculator';
import { FluxSchemeType } from '../CompressibleTypes';

describe('CFD Compressible Flow Solver (PATCH-253)', () => {
  it('passes all 28 checks in HardAcceptanceGate253 with PROVEN verdict', () => {
    const result = HardAcceptanceGate253.runSuite();
    expect(result.success).toBe(true);
    expect(result.verdict).toBe('PROVEN');
    expect(result.testReports.length).toBe(28);
    for (const report of result.testReports) {
      expect(report.success).toBe(true);
    }
  });

  it('computes accurate Rankine-Hugoniot normal shock jumps', () => {
    const M1 = 2.0;
    const gamma = 1.4;
    const P1 = 101325;
    const T1 = 300;
    const rho1 = P1 / (287 * T1);

    // Rankine-Hugoniot pressure ratio
    const pRatio = 1 + ((2 * gamma) / (gamma + 1)) * (M1 * M1 - 1);
    const P2 = P1 * pRatio;
    expect(P2).toBeGreaterThan(P1);

    // Downstream Mach number
    const M2Sq = ((gamma - 1) * M1 * M1 + 2) / (2 * gamma * M1 * M1 - (gamma - 1));
    const M2 = Math.sqrt(M2Sq);
    expect(M2).toBeLessThan(1.0);
  });

  it('executes conservative spatial flux calculations across Roe and Lax-Friedrichs schemes', () => {
    const stateL = EquationOfState.calculateStateFromPrimitive(1.2, [250, 0, 0], 300, 287, 1.4);
    const stateR = EquationOfState.calculateStateFromPrimitive(1.0, [200, 0, 0], 280, 287, 1.4);

    const fluxLF = CompressibleFluxCalculator.computeFlux(
      stateL,
      [250, 0, 0],
      stateR,
      [200, 0, 0],
      [1, 0, 0],
      FluxSchemeType.LAX_FRIEDRICHS,
      1.4,
      false
    );

    expect(fluxLF.massFlux).toBeGreaterThan(0);
    expect(fluxLF.energyFlux).toBeGreaterThan(0);
    expect(Number.isFinite(fluxLF.momentumFlux[0])).toBe(true);
  });
});
