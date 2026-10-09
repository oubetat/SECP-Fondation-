import { describe, it, expect } from 'vitest';
import { MmsDiscretizationVerifier } from '../MmsDiscretizationVerifier';

describe('MmsDiscretizationVerifier — Method of Manufactured Solutions Discretization Verifier', () => {
  it('should verify formal 2nd-order spatial accuracy (p = 2.00 +/- 0.05) for 1D Convection-Diffusion PDE', () => {
    const report = MmsDiscretizationVerifier.verifyConvectionDiffusion1D();

    expect(report.pdeType).toBe('CONVECTION_DIFFUSION_1D');
    expect(report.theoreticalOrder).toBe(2.0);
    expect(report.observedOrderL2).toBeGreaterThanOrEqual(1.95);
    expect(report.observedOrderL2).toBeLessThanOrEqual(2.05);
    expect(report.orderVerified).toBe(true);
    expect(report.gridLevels.length).toBe(4);
  });

  it('should verify formal 2nd-order spatial accuracy for 2D Navier-Stokes momentum equations', () => {
    const report = MmsDiscretizationVerifier.verifyNavierStokes2D();

    expect(report.pdeType).toBe('NAVIER_STOKES_2D');
    expect(report.observedOrderL2).toBeGreaterThanOrEqual(1.95);
    expect(report.observedOrderL2).toBeLessThanOrEqual(2.05);
    expect(report.orderVerified).toBe(true);
  });
});
