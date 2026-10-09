import { describe, it, expect } from 'vitest';
import { CrossKernelCorpus } from '../CrossKernelCorpus';
import { TestExternalCADKernelAdapter } from '../ExternalCADKernelAdapter';
import { CrossKernelPipeline } from '../CrossKernelPipeline';

describe('PATCH-040: Cross-Kernel Corpus Execution (Categories A through H)', () => {

  const corpus = CrossKernelCorpus.getAllModels();
  const testAdapter = new TestExternalCADKernelAdapter();

  it('contains all 8 defined engineering workload categories', () => {
    expect(corpus.length).toBe(8);
    const categories = corpus.map(c => c.category);
    expect(categories).toContain('A_BASIC_GEOM');
    expect(categories).toContain('B_BREP');
    expect(categories).toContain('C_NURBS');
    expect(categories).toContain('D_TOPOLOGY');
    expect(categories).toContain('E_FEATURE_HISTORY');
    expect(categories).toContain('F_ASSEMBLY');
    expect(categories).toContain('G_PMI');
    expect(categories).toContain('H_ADVERSARIAL');
  });

  for (const item of corpus) {
    it(`executes cross-kernel pipeline for ${item.id} (${item.name})`, async () => {
      const pkg = await CrossKernelPipeline.execute(item.document, testAdapter);
      expect(pkg.packageId).toBeDefined();
      expect(pkg.sourceCanonicalHash).toBeDefined();
      expect(pkg.exportEvidence.stepByteLength).toBeGreaterThan(0);
      expect(pkg.roundtripEvidence.structuralValid).toBe(true);

      // Verify category-specific metrics
      if (item.category === 'E_FEATURE_HISTORY') {
        // Feature history is flattened upon neutral STEP interchange
        expect(pkg.differenceReport.categories.FEATURE_HISTORY.fidelityStatus).toBe('LOST');
        expect(pkg.differenceReport.categories.FEATURE_HISTORY.lossClassification).toBe('DATA_LOSS');
      }

      if (item.category === 'C_NURBS') {
        expect(pkg.sourceBaseline.nurbsFingerprint.surfacesDegree.length).toBeGreaterThan(0);
      }
    });
  }
});
