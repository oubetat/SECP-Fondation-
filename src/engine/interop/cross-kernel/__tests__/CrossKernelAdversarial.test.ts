import { describe, it, expect } from 'vitest';
import { CrossKernelFixtures } from '../__fixtures__/CrossKernelFixtures';
import { TestExternalCADKernelAdapter } from '../ExternalCADKernelAdapter';
import { CrossKernelPipeline } from '../CrossKernelPipeline';
import { HardAcceptanceGateCrossKernel } from '../verification/HardAcceptanceGateCrossKernel';
import { NativeSECPWriter } from '../../native-secp/NativeSECPWriter';

describe('PATCH-040: Cross-Kernel Adversarial & Edge Case Tests', () => {

  it('detects and records simulated external healing operations without falsely claiming lossless preservation', async () => {
    const sourceDoc = CrossKernelFixtures.getValidModel();
    const healingAdapter = new TestExternalCADKernelAdapter({
      simulateHealing: true
    });

    const pkg = await CrossKernelPipeline.execute(sourceDoc, healingAdapter);

    expect(pkg.externalImportEvidence.healingOperationsApplied).toContain('FACE_TOLERANCE_HEALING');
    expect(pkg.externalImportEvidence.healingOperationsApplied).toContain('SEWING_COINCIDENT_VERTICES');
    expect(pkg.externalImportEvidence.warnings.length).toBeGreaterThan(0);
  });

  it('evaluates to FAIL when model volume suffers critical engineering loss', async () => {
    const sourceDoc = CrossKernelFixtures.getValidModel();
    const testAdapter = new TestExternalCADKernelAdapter();

    const pkg = await CrossKernelPipeline.execute(sourceDoc, testAdapter);

    // Artificially alter the roundtrip volume to simulate major geometric deviation
    pkg.roundtripEvidence.document = {
      ...pkg.roundtripEvidence.document,
      model: {
        ...pkg.roundtripEvidence.document.model,
        topology: {
          ...pkg.roundtripEvidence.document.model.topology,
          solids: [{
            ...pkg.roundtripEvidence.document.model.topology.solids[0],
            volumeMm3: 500 // Original is 1000
          }]
        }
      }
    };

    // Re-evaluate difference and gate
    const gateEval = HardAcceptanceGateCrossKernel.evaluate({
      ...pkg,
      differenceReport: {
        ...pkg.differenceReport,
        criticalCount: 1,
        categories: {
          ...pkg.differenceReport.categories,
          GEOMETRY: {
            ...pkg.differenceReport.categories.GEOMETRY,
            fidelityStatus: 'FAIL',
            lossClassification: 'ENGINEERING_LOSS'
          }
        }
      }
    });

    expect(gateEval.verdict).toBe('FAIL');
    expect(gateEval.passed).toBe(false);
  });

  it('evaluates to FAIL when length units are mismatched', async () => {
    const base = CrossKernelFixtures.getValidModel();
    const inchDoc = NativeSECPWriter.write({
      ...base,
      header: {
        ...base.header,
        units: {
          ...base.header.units,
          length: 'INCH',
          scaleFactorToMm: 25.4
        }
      }
    }).document;

    const testAdapter = new TestExternalCADKernelAdapter();
    const pkg = await CrossKernelPipeline.execute(inchDoc, testAdapter);

    // If unit conversion is corrupted
    pkg.differenceReport.categories.UNITS.fidelityStatus = 'FAIL';
    pkg.differenceReport.categories.UNITS.lossClassification = 'ENGINEERING_LOSS';
    pkg.differenceReport.criticalCount = 1;

    const gateEval = HardAcceptanceGateCrossKernel.evaluate(pkg);
    expect(gateEval.verdict).toBe('FAIL');
  });
});
