/**
 * SECP Industrial OS v2 — Cross-Kernel Test Fixtures
 * PATCH-040: Industrial CAD Interoperability & Loss Measurement
 */

import { NativeSECPDocument } from '../../native-secp/NativeSECPTypes';
import { NativeSECPFixtures } from '../../native-secp/__fixtures__/NativeSECPFixtures';
import { CrossKernelCorpus, CorpusItem } from '../CrossKernelCorpus';
import { TestExternalCADKernelAdapter } from '../ExternalCADKernelAdapter';

export class CrossKernelFixtures {

  public static getValidModel(): NativeSECPDocument {
    return NativeSECPFixtures.createValidCubeDocument();
  }

  public static getCorpus(): CorpusItem[] {
    return CrossKernelCorpus.getAllModels();
  }

  public static createTestAdapter(options?: {
    simulateHealing?: boolean;
    simulateLoss?: boolean;
  }): TestExternalCADKernelAdapter {
    return new TestExternalCADKernelAdapter(options);
  }
}
