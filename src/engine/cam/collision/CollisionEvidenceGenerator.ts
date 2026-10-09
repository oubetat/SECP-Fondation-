/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-259 — Collision Evidence & Provenance Generator
 */

import {
  CollisionEvidencePackage,
  CollisionReport,
  FixtureGeometry,
  HolderGeometry,
  IndustrialOSEvent,
  IndustrialOSEventType,
  ToolGeometry,
  ToolPose
} from './CollisionTypes';
import { generateDeterministicHashSync } from '../../../lib/hash';

export class CollisionEvidenceGenerator {
  public static generateEvidencePackage(
    report: CollisionReport,
    tool?: ToolGeometry,
    holder?: HolderGeometry,
    fixture?: FixtureGeometry,
    poses?: ToolPose[]
  ): CollisionEvidencePackage {
    const timestamp = '2026-09-12T00:00:00.000Z';
    const toolId = tool?.toolId || report.toolId || 'TOOL_DEFAULT';
    const holderId = holder?.holderId || 'HOLDER_DEFAULT';
    const fixtureId = fixture?.fixtureId || 'FIXTURE_DEFAULT';
    const incidentsCount = report.incidents?.length ?? 0;

    const partHash = `sha256_${generateDeterministicHashSync({ type: 'PART', jobId: report.jobId || 'DEFAULT' })}`;
    const bRepHash = `sha256_${generateDeterministicHashSync({ type: 'BREP', setupId: report.setupId || 'SETUP' })}`;
    const toolHash = `sha256_${generateDeterministicHashSync({
      toolId,
      cutterDiameter: tool?.cutterDiameterMm,
      fluteLength: tool?.fluteLengthMm,
      stickout: tool?.stickoutMm
    })}`;
    const holderHash = `sha256_${generateDeterministicHashSync({
      holderId,
      gaugeLength: holder?.gaugeLengthMm,
      lowerDiameter: holder?.lowerDiameterMm,
      upperDiameter: holder?.upperDiameterMm
    })}`;
    const fixtureHash = `sha256_${generateDeterministicHashSync({
      fixtureId,
      bounds: fixture?.aabb,
      margin: fixture?.keepOutZoneMarginMm
    })}`;
    const machineHash = `sha256_${generateDeterministicHashSync({
      machineId: report.machineId || '3AXIS_CNC_MILL'
    })}`;
    const toolpathHash = `sha256_${generateDeterministicHashSync({
      totalSegments: report.totalSegmentsChecked || poses?.length || 0,
      firstPose: poses && poses.length > 0 ? poses[0] : null,
      lastPose: poses && poses.length > 0 ? poses[poses.length - 1] : null
    })}`;
    const collisionModelHash = `sha256_${generateDeterministicHashSync({
      operation: report.operationName || 'OP_COLLISION',
      mode: report.detectionMode,
      tolerances: report.tolerances
    })}`;

    const canonicalPayload = {
      jobId: report.jobId,
      setupId: report.setupId,
      operationName: report.operationName,
      overallState: report.overallState,
      isPathValid: report.isPathValid,
      isPathRejected: report.isPathRejected,
      minOverallClearanceMm: report.minOverallClearanceMm,
      maxPenetrationDepthMm: report.maxPenetrationDepthMm,
      incidentsCount,
      incidentsSummary: report.incidents?.map(i => ({
        type: i.type,
        severity: i.severity,
        depth: i.penetrationDepthMm,
        segment: i.segmentIndex
      })) || [],
      partHash,
      bRepHash,
      toolHash,
      holderHash,
      fixtureHash,
      machineHash,
      toolpathHash,
      collisionModelHash,
      tolerances: report.tolerances,
      detectionMode: report.detectionMode
    };

    const signatureHex = generateDeterministicHashSync(canonicalPayload);
    const provenanceSignature = `sha256_${signatureHex}`;
    const evidenceId = `EVID-COL-${report.jobId || 'JOB'}-${signatureHex.substring(0, 16).toUpperCase()}`;

    return {
      evidenceId,
      timestamp,
      partHash,
      bRepHash,
      toolHash,
      holderHash,
      fixtureHash,
      machineHash,
      toolpathHash,
      collisionModelHash,

      tolerances: report.tolerances,
      detectionMode: report.detectionMode,
      overallState: report.overallState,
      gatePassed: report.isPathValid,
      classification: report.coverageStatus || 'PROVEN',

      minClearanceMm: report.minOverallClearanceMm,
      maxPenetrationMm: report.maxPenetrationDepthMm,
      incidentsCount,

      provenanceSignature,
      engineVersion: '3.0.2-COLLISION-SECP'
    };
  }

  public static createOSEvent(
    eventType: IndustrialOSEventType,
    details: Record<string, any>
  ): IndustrialOSEvent {
    const eventHash = generateDeterministicHashSync({ eventType, details });
    return {
      eventId: `EVT-COL-${eventHash.substring(0, 16).toUpperCase()}`,
      eventType,
      timestamp: '2026-09-12T00:00:00.000Z',
      details
    };
  }
}

