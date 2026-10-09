import { describe, it, expect } from 'vitest';
import { CrossKernelFixtures } from '../__fixtures__/CrossKernelFixtures';
import { NullExternalCADKernelAdapter, TestExternalCADKernelAdapter } from '../ExternalCADKernelAdapter';
import { CrossKernelPipeline } from '../CrossKernelPipeline';
import { HardAcceptanceGateCrossKernel } from '../verification/HardAcceptanceGateCrossKernel';

describe('PATCH-040: Hard Acceptance Gate Cross-Kernel Evaluation', () => {

  it('evaluates to UNPROVEN when NullExternalCADKernelAdapter is provided', async () => {
    const doc = CrossKernelFixtures.getValidModel();
    const nullAdapter = new NullExternalCADKernelAdapter();

    const pkg = await CrossKernelPipeline.execute(doc, nullAdapter);
    const gateEval = HardAcceptanceGateCrossKernel.evaluate(pkg);

    expect(gateEval.passed).toBe(false);
    expect(gateEval.verdict).toBe('UNPROVEN');
    expect(gateEval.reason).toContain('UNAVAILABLE');
    expect(gateEval.metrics.genuineExternalKernelExecuted).toBe(false);
  });

  it('evaluates to UNPROVEN when TestExternalCADKernelAdapter (test harness) is provided', async () => {
    const doc = CrossKernelFixtures.getValidModel();
    const testAdapter = new TestExternalCADKernelAdapter();

    const pkg = await CrossKernelPipeline.execute(doc, testAdapter);
    const gateEval = HardAcceptanceGateCrossKernel.evaluate(pkg);

    expect(gateEval.passed).toBe(false);
    expect(gateEval.verdict).toBe('UNPROVEN');
    expect(gateEval.reason).toContain('Test harness adapter was used');
    expect(gateEval.metrics.genuineExternalKernelExecuted).toBe(false);
  });

  it('evaluates to PASS when a genuine external CAD kernel identity is present and executed', async () => {
    const doc = CrossKernelFixtures.getValidModel();
    const genuineAdapter = new TestExternalCADKernelAdapter({
      kernelName: 'OPENCASCADE_TECHNOLOGY_PROD',
      version: '7.8.0-RELEASE'
    });

    // Simulate genuine external kernel execution by overriding isTestHarness flag
    (genuineAdapter.identify() as any).isTestHarness = false;

    const pkg = await CrossKernelPipeline.execute(doc, genuineAdapter);
    const gateEval = HardAcceptanceGateCrossKernel.evaluate(pkg);

    expect(gateEval.passed).toBe(true);
    expect(gateEval.verdict).toBe('PASS');
    expect(gateEval.metrics.genuineExternalKernelExecuted).toBe(true);
    expect(gateEval.metrics.exportPassed).toBe(true);
    expect(gateEval.metrics.reimportPassed).toBe(true);
    expect(gateEval.domainStatus.geometry).toBe('PROVEN');
    expect(gateEval.domainStatus.topology).toBe('PROVEN');
    expect(gateEval.domainStatus.units).toBe('PROVEN');
  });

  it('evaluates to INVALID on malformed or empty evidence package', () => {
    const gateEval = HardAcceptanceGateCrossKernel.evaluate({} as any);
    expect(gateEval.passed).toBe(false);
    expect(gateEval.verdict).toBe('INVALID');
  });
});
