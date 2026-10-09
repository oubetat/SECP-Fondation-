/**
 * SECP Industrial OS — EPC-012: Environment Fingerprint Service
 */

import { EnvironmentFingerprint } from './ReproducibilityTypes';
import { EvidenceIntegrityService } from '../epc/evidence/EvidenceIntegrityService';

export class EnvironmentFingerprintService {
  /**
   * Captures the current execution environment fingerprint.
   */
  public static capture(solverVersion: string): EnvironmentFingerprint {
    const data = {
      os: process.platform || 'linux',
      runtime: `node-${process.version}`,
      cpu: process.arch,
      solverVersion: solverVersion,
      libraryVersions: {
        'secp-core': '1.0.0',
        'typescript': '5.0.0'
      },
      numericalBackend: 'standard-float64'
    };

    const hash = EvidenceIntegrityService.computeHash(data);

    return {
      ...data,
      hash
    };
  }
}
