import { describe, it, expect } from 'vitest';
import { CrossKernelFixtures } from '../__fixtures__/CrossKernelFixtures';
import { TestExternalCADKernelAdapter } from '../ExternalCADKernelAdapter';
import { CrossKernelPipeline } from '../CrossKernelPipeline';

describe('PATCH-040: Cross-Kernel Pipeline Execution & Loss Measurement', () => {

  it('completes the 12-stage cross-kernel verification pipeline and generates full evidence package', async () => {
    const sourceDoc = CrossKernelFixtures.getValidModel();
    const testAdapter = new TestExternalCADKernelAdapter();

    const pkg = await CrossKernelPipeline.execute(sourceDoc, testAdapter);

    // Structural evidence verification
    expect(pkg.packageId).toBeDefined();
    expect(pkg.sourceCanonicalHash.length).toBe(64);
    expect(pkg.exportEvidence.stepContent).toContain('ISO-10303-21;');
    expect(pkg.externalImportEvidence.importSuccess).toBe(true);
    expect(pkg.externalExportEvidence.exportSuccess).toBe(true);
    expect(pkg.roundtripEvidence.geometryValid).toBe(true);

    // Multi-domain comparison presence
    const diffs = pkg.differenceReport;
    expect(diffs.categories.GEOMETRY.fidelityStatus).toBe('PROVEN');
    expect(diffs.categories.TOPOLOGY.fidelityStatus).toBe('PROVEN');
    expect(diffs.categories.UNITS.fidelityStatus).toBe('PROVEN');

    // Provenance transitions
    expect(pkg.provenanceChain.length).toBeGreaterThanOrEqual(6);
    expect(pkg.provenanceChain.map(p => p.step)).toContain('SOURCE_NATIVE');
    expect(pkg.provenanceChain.map(p => p.step)).toContain('STEP_EXPORT');
    expect(pkg.provenanceChain.map(p => p.step)).toContain('EXTERNAL_IMPORT');
    expect(pkg.provenanceChain.map(p => p.step)).toContain('EXTERNAL_EXPORT');
    expect(pkg.provenanceChain.map(p => p.step)).toContain('STEP_IMPORT');
    expect(pkg.provenanceChain.map(p => p.step)).toContain('ROUNDTRIP_VERIFICATION');
  });

  it('tracks capability-specific fidelity instead of single fake percentage', async () => {
    const sourceDoc = CrossKernelFixtures.getValidModel();
    const testAdapter = new TestExternalCADKernelAdapter();

    const pkg = await CrossKernelPipeline.execute(sourceDoc, testAdapter);
    const cat = pkg.differenceReport.categories;

    expect(cat.GEOMETRY.fidelityStatus).toBe('PROVEN');
    expect(cat.TOPOLOGY.fidelityStatus).toBe('PROVEN');
    expect(cat.UNITS.fidelityStatus).toBe('PROVEN');
    expect(cat.FEATURE_HISTORY.fidelityStatus).toBe('LOST'); // feature tree correctly identified as flattened across STEP boundary
  });
});
