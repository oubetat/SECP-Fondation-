import { describe, it, expect } from 'vitest';
import { CrossKernelFixtures } from '../__fixtures__/CrossKernelFixtures';
import { TestExternalCADKernelAdapter } from '../ExternalCADKernelAdapter';
import { CrossKernelPipeline } from '../CrossKernelPipeline';
import { HardAcceptanceGateCrossKernel } from '../verification/HardAcceptanceGateCrossKernel';

describe('PATCH-040: Cross-Kernel Tamper Evidence Verification (STEP 30)', () => {

  it('detects tampering when source artifact hash is altered or mismatched', async () => {
    const sourceDoc = CrossKernelFixtures.getValidModel();
    const testAdapter = new TestExternalCADKernelAdapter();

    const pkg = await CrossKernelPipeline.execute(sourceDoc, testAdapter);

    // Tamper source artifact hash
    const tamperedPkg = {
      ...pkg,
      sourceArtifactHash: '' // Tampered / missing
    };

    const evaluation = HardAcceptanceGateCrossKernel.evaluate(tamperedPkg);
    expect(evaluation.verdict).toBe('INVALID');
    expect(evaluation.reason).toContain('cryptographic identity verification');
  });

  it('detects tampering when roundtrip evidence or difference report is contradictory', async () => {
    const sourceDoc = CrossKernelFixtures.getValidModel();
    const testAdapter = new TestExternalCADKernelAdapter();

    const pkg = await CrossKernelPipeline.execute(sourceDoc, testAdapter);

    // Inject contradictory metrics: critical difference recorded with NO_LOSS classification
    const tamperedPkg = {
      ...pkg,
      differenceReport: {
        ...pkg.differenceReport,
        criticalCount: 2,
        overallLossClassification: 'NO_LOSS' as const
      }
    };

    const evaluation = HardAcceptanceGateCrossKernel.evaluate(tamperedPkg);
    expect(evaluation.verdict).toBe('INCONCLUSIVE');
    expect(evaluation.reason).toContain('Contradictory metrics');
  });

  it('detects tampering when essential structural sections are stripped from evidence package', async () => {
    const sourceDoc = CrossKernelFixtures.getValidModel();
    const testAdapter = new TestExternalCADKernelAdapter();

    const pkg = await CrossKernelPipeline.execute(sourceDoc, testAdapter);

    const strippedPkg = {
      ...pkg,
      exportEvidence: undefined as any
    };

    const evaluation = HardAcceptanceGateCrossKernel.evaluate(strippedPkg);
    expect(evaluation.verdict).toBe('INVALID');
    expect(evaluation.reason).toContain('missing required structural sections');
  });
});
