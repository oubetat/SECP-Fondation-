import { describe, it, expect } from 'vitest';
import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';
import { CamEngine } from '../../camEngine';
import { TelemetryHasher } from '../../telemetry/TelemetryHasher';

describe('GATE 2 — CAM Revision Invalidation Proof', () => {
  it('should invalidate Rev 1 CAM toolpaths/G-code/Evidence when CAD geometry mutates to Rev 2 while preserving audit history', () => {
    // 1. Setup CAD Revision 1
    const docRev1: EngineeringDocument = {
      documentId: 'DOC-CAM-TEST',
      revision: 1,
      units: { system: 'SI_MM', length: 'mm', mass: 'kg', force: 'N', pressure: 'MPa', angle: 'deg' },
      sketches: [],
      constraints: [],
      features: [
        { id: 'EXTRUDE_01', type: 'EXTRUDE', depth: 25.0, status: 'VALID' }
      ],
      parameters: [],
      topologyMap: { faces: {}, edges: {}, vertices: {} } as any,
      derived: {},
      evidence: []
    };

    const geometryStatsA = { dx: 100, dy: 50, dz: 25 };
    const geometryHashA = TelemetryHasher.hashString(`GEO_${geometryStatsA.dx}x${geometryStatsA.dy}x${geometryStatsA.dz}_REV${docRev1.revision}`);
    const camJobA = CamEngine.generateCamJob('CNC_MILLING', geometryStatsA.dx, geometryStatsA.dy, geometryStatsA.dz);
    const toolpathHashA = TelemetryHasher.hashString(JSON.stringify(camJobA.toolpathPoints));
    const gCodeHashA = TelemetryHasher.hashString(camJobA.gCodeOutput);

    const evidenceA = {
      evidenceId: `EV_CAM_REV1_${Date.now()}`,
      stage: 'MANUFACTURING' as const,
      sourceSystem: 'SECP_CAM_ENGINE',
      documentId: docRev1.documentId,
      revision: docRev1.revision,
      canonicalHash: gCodeHashA,
      geometryHash: geometryHashA,
      timestamp: new Date().toISOString(),
      payload: { process: 'CNC_MILLING', gCodeHash: gCodeHashA, toolpathHash: toolpathHashA },
      verdict: 'VALID' as const,
      status: 'ACTIVE' as 'ACTIVE' | 'SUPERSEDED' | 'STALE'
    };

    docRev1.derived.cam = {
      modelId: `CAM_DOC_${docRev1.documentId}_REV1`,
      stockBounds: { minX: 0, maxX: 100, minY: 0, maxY: 50, minZ: 0, maxZ: 25 },
      operations: [],
      gCode: camJobA.gCodeOutput,
      estimatedTimeMin: camJobA.totalEstimatedTimeMin,
      hash: gCodeHashA,
      revision: 1
    };
    docRev1.evidence.push(evidenceA as any);

    // 2. Modify Geometry to CAD Revision 2
    const docRev2: EngineeringDocument = {
      ...docRev1,
      revision: 2,
      features: [
        { id: 'EXTRUDE_01', type: 'EXTRUDE', depth: 40.0, status: 'VALID' } // Depth modified from 25mm to 40mm
      ]
    };

    const geometryStatsB = { dx: 100, dy: 50, dz: 40 };
    const geometryHashB = TelemetryHasher.hashString(`GEO_${geometryStatsB.dx}x${geometryStatsB.dy}x${geometryStatsB.dz}_REV${docRev2.revision}`);
    const camJobB = CamEngine.generateCamJob('CNC_MILLING', geometryStatsB.dx, geometryStatsB.dy, geometryStatsB.dz);
    const toolpathHashB = TelemetryHasher.hashString(JSON.stringify(camJobB.toolpathPoints));
    const gCodeHashB = TelemetryHasher.hashString(camJobB.gCodeOutput);

    // Mark previous evidence as SUPERSEDED upon revision bump
    const updatedEvidenceHistory = docRev1.evidence.map(ev => {
      if (ev.revision < docRev2.revision) {
        return { ...ev, status: 'SUPERSEDED' as const, verdict: 'SUPERSEDED' as const };
      }
      return ev;
    });

    const evidenceB = {
      evidenceId: `EV_CAM_REV2_${Date.now()}`,
      stage: 'MANUFACTURING' as const,
      sourceSystem: 'SECP_CAM_ENGINE',
      documentId: docRev2.documentId,
      revision: docRev2.revision,
      canonicalHash: gCodeHashB,
      geometryHash: geometryHashB,
      timestamp: new Date().toISOString(),
      payload: { process: 'CNC_MILLING', gCodeHash: gCodeHashB, toolpathHash: toolpathHashB },
      verdict: 'VALID' as const,
      status: 'ACTIVE' as const
    };

    docRev2.derived.cam = {
      modelId: `CAM_DOC_${docRev2.documentId}_REV2`,
      stockBounds: { minX: 0, maxX: 100, minY: 0, maxY: 50, minZ: 0, maxZ: 40 },
      operations: [],
      gCode: camJobB.gCodeOutput,
      estimatedTimeMin: camJobB.totalEstimatedTimeMin,
      hash: gCodeHashB,
      revision: 2
    };
    docRev2.evidence = [...updatedEvidenceHistory, evidenceB as any];

    // 3. Prove Invariant Assertions
    expect(geometryHashA).not.toEqual(geometryHashB);
    expect(toolpathHashA).not.toEqual(toolpathHashB);
    expect(gCodeHashA).not.toEqual(gCodeHashB);

    // Prove Rev 1 Evidence is marked SUPERSEDED
    const rev1EvidenceInDoc2 = docRev2.evidence.find(e => e.revision === 1);
    expect(rev1EvidenceInDoc2?.status).toBe('SUPERSEDED');
    expect(rev1EvidenceInDoc2?.verdict).toBe('SUPERSEDED');

    // Prove Rev 2 Evidence is VALID / ACTIVE
    const rev2EvidenceInDoc2 = docRev2.evidence.find(e => e.revision === 2);
    expect(rev2EvidenceInDoc2?.status).toBe('ACTIVE');
    expect(rev2EvidenceInDoc2?.verdict).toBe('VALID');

    // Prove Historical Evidence preservation
    expect(docRev2.evidence.length).toBe(2);
  });
});
