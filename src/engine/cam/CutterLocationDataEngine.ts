/**
 * PATCH-SECP-057 — Cutter Location (CL) Data Packaging Engine
 * Aggregates multi-operation toolpaths into an immutable CutterLocationDataPackage
 * with cryptographic SHA-256 provenance hashing and trajectory metrics.
 */

import { 
  MachiningOperationConfig, 
  VerifiedToolpathTrajectory, 
  CutterLocationDataPackage,
  DigitalThreadTraceabilityNode 
} from './ToolpathTypes';
import { CanonicalDerivedArtifactBinding } from '../topology/CanonicalDerivedArtifactBinding';

export class CutterLocationDataEngine {
  /**
   * Builds a deterministic CL Data package from verified operation trajectories and digital thread links
   */
  public static async createCLPackage(
    partId: string,
    operations: MachiningOperationConfig[],
    trajectories: VerifiedToolpathTrajectory[],
    traceabilityNodes: DigitalThreadTraceabilityNode[] = [],
    targetCadRevisionHash?: string,
    targetGeometryHash?: string
  ): Promise<CutterLocationDataPackage> {
    const timestamp = new Date().toISOString();

    // Fail-closed enforcement: verify derived artifact bindings for all candidate trajectories
    if (targetCadRevisionHash) {
      for (const t of trajectories) {
        if (!t.provenance?.derivedArtifactBinding) {
          throw new Error(`[SECP CAM] Cannot build CL package: Trajectory for operation '${t.operationId || 'UNKNOWN'}' lacks required derivedArtifactBinding for target revision '${targetCadRevisionHash}'.`);
        }
        const verifyRes = CanonicalDerivedArtifactBinding.verifyBinding(
          t.provenance.derivedArtifactBinding,
          targetCadRevisionHash,
          targetGeometryHash
        );
        if (!verifyRes.isValid) {
          throw new Error(`[SECP CAM] Cannot build CL package: Trajectory for operation '${t.operationId || 'UNKNOWN'}' binding rejected: ${verifyRes.failureReason}`);
        }
      }
    }

    let totalPoints = 0;
    let totalTime = 0;
    let totalVolume = 0;

    trajectories.forEach(t => {
      totalPoints += t.points.length;
      totalTime += t.estimatedTimeSec;
      // totalVolume += t.nominalVolumeMm3;
    });

    // Create deterministic cryptographic hash payload
    const payload = JSON.stringify({
      partId,
      opCount: operations.length,
      trajCount: trajectories.length,
      totalPoints,
      totalTime: Number(totalTime.toFixed(1)),
      totalVolume: Number(totalVolume.toFixed(2)),
      samplePoints: trajectories.map(t => t.points.slice(0, 3)),
      traceabilityNodes
    });

    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const clDataHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const provenanceSignature = `SECP-057-CL-PROVENANCE-${clDataHash.slice(0, 16).toUpperCase()}`;

    return {
      patch: 'SECP-057',
      partId,
      timestamp,
      operations,
      trajectories,
      totalPointsCount: totalPoints,
      totalMachiningTimeSec: Number(totalTime.toFixed(1)),
      totalMaterialRemovedMm3: Number(totalVolume.toFixed(2)),
      clDataHash,
      provenanceSignature,
      traceabilityNodes
    };
  }
}

