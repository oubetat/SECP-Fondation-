import { HardwareAccelerationEvidenceRecord } from './HardwareAccelerationTypes305';
import { pureSha256 } from '../../polyfills/crypto';

export class HardwareAccelerationEvidenceGenerator {
  public static generateEvidence(payload: any): HardwareAccelerationEvidenceRecord {
    const payloadStr = JSON.stringify(payload || {});
    const canonicalHash = pureSha256(payloadStr);
    return {
      evidenceId: `EVID-HW-${canonicalHash.substring(0, 12).toUpperCase()}`,
      timestamp: new Date().toISOString(),
      proofLevel: 'LEVEL_7' as any,
      payload,
      hash: `SHA256-${canonicalHash}`
    } as any;
  }
}
