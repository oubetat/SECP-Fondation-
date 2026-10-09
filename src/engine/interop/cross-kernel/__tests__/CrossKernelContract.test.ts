import { describe, it, expect } from 'vitest';
import { NullExternalCADKernelAdapter, TestExternalCADKernelAdapter } from '../ExternalCADKernelAdapter';
import { CrossKernelFixtures } from '../__fixtures__/CrossKernelFixtures';
import { CrossKernelPipeline } from '../CrossKernelPipeline';

describe('PATCH-040: Cross-Kernel Contract & Adapter Compliance', () => {

  it('enforces that NullExternalCADKernelAdapter reports UNAVAILABLE status', () => {
    const nullAdapter = new NullExternalCADKernelAdapter();
    expect(nullAdapter.isAvailable()).toBe(false);
    expect(nullAdapter.getStatus()).toBe('UNAVAILABLE');
    expect(nullAdapter.identify().kernelName).toBe('NULL_KERNEL');
    expect(nullAdapter.identify().isTestHarness).toBe(false);

    const importRes = nullAdapter.importSTEP('ISO-10303-21;');
    expect(importRes.success).toBe(false);
    expect(importRes.errors[0]).toContain('UNAVAILABLE');
  });

  it('strictly yields UNPROVEN verdict when no external CAD kernel is available', async () => {
    const sourceDoc = CrossKernelFixtures.getValidModel();
    const nullAdapter = new NullExternalCADKernelAdapter();

    const evidencePkg = await CrossKernelPipeline.execute(sourceDoc, nullAdapter);

    expect(evidencePkg.verdict).toBe('UNPROVEN');
    expect(evidencePkg.externalKernelStatus).toBe('UNAVAILABLE');
    expect(evidencePkg.verdictReason).toContain('UNAVAILABLE');
  });

  it('correctly flags test harness adapter and yields UNPROVEN instead of fabricated PASS', async () => {
    const sourceDoc = CrossKernelFixtures.getValidModel();
    const testAdapter = new TestExternalCADKernelAdapter();

    expect(testAdapter.identify().isTestHarness).toBe(true);

    const evidencePkg = await CrossKernelPipeline.execute(sourceDoc, testAdapter);

    // Rule: Test harness adapter cannot grant genuine PASS
    expect(evidencePkg.verdict).toBe('UNPROVEN');
    expect(evidencePkg.verdictReason).toContain('Test harness adapter was used');
    expect(evidencePkg.exportEvidence.stepByteLength).toBeGreaterThan(0);
    expect(evidencePkg.roundtripEvidence.geometryValid).toBe(true);
  });
});
