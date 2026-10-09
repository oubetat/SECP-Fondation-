import { describe, it, expect } from 'vitest';
import { MmsDiscretizationVerifier } from '../MmsDiscretizationVerifier';

describe('MmsForensic — MMS Discretization Verification Audit', () => {
  it('FORENSIC: Should verify 2nd-order convergence (p~2.0) with central difference', () => {
    const report = MmsDiscretizationVerifier.verifyConvectionDiffusion1D(false);
    
    expect(report.observedOrderL2).toBeGreaterThan(1.9);
    expect(report.observedOrderL2).toBeLessThan(2.1);
    expect(report.orderVerified).toBe(true);
  });

  it('ADVERSARIAL: Should detect convergence failure (p~1.0) when stencil is intentionally degraded', () => {
    // We expect the verifier to report orderVerified: false when we break the implementation
    const report = MmsDiscretizationVerifier.verifyConvectionDiffusion1D(true);
    
    expect(report.observedOrderL2).toBeGreaterThan(0.9);
    expect(report.observedOrderL2).toBeLessThan(1.1);
    expect(report.orderVerified).toBe(false);
  });
});
