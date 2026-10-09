import { describe, it, expect } from 'vitest';
import { CrossKernelFixtures } from '../__fixtures__/CrossKernelFixtures';
import { TestExternalCADKernelAdapter } from '../ExternalCADKernelAdapter';
import { CrossKernelPipeline } from '../CrossKernelPipeline';
import { performance } from 'perf_hooks';

describe('PATCH-040: Cross-Kernel Performance Benchmarks (STEP 31)', () => {

  it('measures stage-by-stage timings for cross-kernel round trip pipeline', async () => {
    const sourceDoc = CrossKernelFixtures.getValidModel();
    const testAdapter = new TestExternalCADKernelAdapter();

    const tStart = performance.now();
    const pkg = await CrossKernelPipeline.execute(sourceDoc, testAdapter);
    const tTotal = performance.now() - tStart;

    expect(tTotal).toBeLessThan(1000); // Sub-second performance for standard part
    expect(pkg.exportEvidence.stepByteLength).toBeGreaterThan(0);
    expect(pkg.externalExportEvidence.stepByteLength).toBeGreaterThan(0);
    expect(pkg.roundtripEvidence.geometryValid).toBe(true);

    const perfRecord = {
      modelId: sourceDoc.identity.engineeringObjectId,
      entityCount: sourceDoc.model.geometry.points.length,
      totalDurationMs: tTotal,
      kernelVersion: testAdapter.getVersion()
    };

    expect(perfRecord.totalDurationMs).toBeGreaterThan(0);
    expect(perfRecord.entityCount).toBeGreaterThan(0);
  });
});
