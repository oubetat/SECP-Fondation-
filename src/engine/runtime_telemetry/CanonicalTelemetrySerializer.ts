import * as crypto from 'crypto';
import { RuntimeSession, TelemetryEvent, RuntimeResourceSnapshot, JobRuntimeTelemetry, RuntimeEvidence } from './types';

export class CanonicalTelemetrySerializer {
  public static sha256(data: string): string {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
  }

  public static canonicalizeRuntimeSession(session: RuntimeSession): string {
    return JSON.stringify({
      buildId: session.buildId.trim(),
      configurationHash: session.configurationHash.trim(),
      deploymentVersion: session.deploymentVersion.trim(),
      endTime: session.endTime?.trim() || null,
      environment: session.environment.trim(),
      gitCommit: session.gitCommit.trim(),
      hostId: session.hostId.trim(),
      operatorId: session.operatorId.trim(),
      runtimeSessionId: session.runtimeSessionId.trim(),
      startTime: session.startTime.trim(),
      state: session.state
    });
  }

  public static computeRuntimeIdentityHash(
    appVersion: string,
    buildId: string,
    configHash: string,
    hostId: string,
    environment: string,
    jobId: string
  ): string {
    return this.sha256([appVersion, buildId, configHash, hostId, environment, jobId].join('|'));
  }

  public static canonicalizeEventPayload(payload: any): string {
    const sortedObj: any = {};
    Object.keys(payload).sort().forEach(k => {
      const v = payload[k];
      sortedObj[k] = typeof v === 'number' ? Number(v.toFixed(6)) : v;
    });
    return JSON.stringify(sortedObj);
  }

  public static computeEventHash(
    payloadHash: string,
    metadataStr: string,
    previousEventHash: string
  ): string {
    return this.sha256([payloadHash, metadataStr, previousEventHash].join('|'));
  }

  public static canonicalizeResourceSnapshot(snap: RuntimeResourceSnapshot): string {
    return JSON.stringify({
      cpuUsage: Number(snap.cpuUsage.toFixed(6)),
      diskUsage: Number(snap.diskUsage.toFixed(6)),
      gpuMemory: Number(snap.gpuMemory.toFixed(6)),
      gpuUsage: Number(snap.gpuUsage.toFixed(6)),
      memoryUsage: Number(snap.memoryUsage.toFixed(6)),
      networkRx: Number(snap.networkRx.toFixed(6)),
      networkTx: Number(snap.networkTx.toFixed(6)),
      processes: snap.processes,
      runtimeSessionId: snap.runtimeSessionId.trim(),
      snapshotId: snap.snapshotId.trim(),
      threads: snap.threads,
      timestamp: snap.timestamp.trim()
    });
  }

  public static computeRuntimeRootHash(
    sessionHash: string,
    configurationHash: string,
    eventChainHash: string,
    resourceSnapshotHash: string,
    jobHashes: string,
    evidenceHashes: string
  ): string {
    return this.sha256([
      sessionHash,
      configurationHash,
      eventChainHash,
      resourceSnapshotHash,
      jobHashes,
      evidenceHashes
    ].join('|RUNTIME_ROOT|'));
  }
}
