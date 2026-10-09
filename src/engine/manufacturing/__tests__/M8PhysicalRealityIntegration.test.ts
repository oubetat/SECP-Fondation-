import { describe, it, expect, beforeEach } from 'vitest';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { RevisionLifecycleState } from '../../revision/types';
import { ProvenanceGraph } from '../../provenance/ProvenanceGraph';
import { PhysicalRealityContinuityEngine } from '../PhysicalRealityContinuityEngine';

describe('SECP — POST-PLUGIN-MATURITY-008R: Physical Reality Integration & Closed-Loop Continuity', () => {
  let revisionEngine: RevisionEngine;
  let continuityEngine: PhysicalRealityContinuityEngine;
  const entityId = 'PART-AERO-BRACKET-900';

  beforeEach(() => {
    revisionEngine = new RevisionEngine();
    const provenanceGraph = new ProvenanceGraph();
    continuityEngine = new PhysicalRealityContinuityEngine(revisionEngine, provenanceGraph);

    // Bootstrap Canonical Design Revision (Rev A)
    const revA = revisionEngine.createRevision({
      revisionId: 'REV-BRACKET-A',
      entityId,
      entityType: 'CAD_MODEL' as any,
      revisionCode: 'A',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdBy: 'CHIEF_DESIGN_ENGINEER',
      content: { geometry: 'BREP_NOMINAL', nominalVolumeMm3: 45000 },
      snapshot: {
        geometryState: {
          parameters: { lengthMm: 120, widthMm: 60, heightMm: 40 },
          features: ['BASE_PLATE', 'MOUNTING_LUGS', 'REINFORCING_RIB'],
          topologyHash: 'TOPO-BRACKET-A-100',
          geometryHash: 'GEOM-BRACKET-A-100'
        }
      }
    } as any);

    revisionEngine.setValidationState(revA.revisionId, 'SIMULATED');
    revisionEngine.addApproval(revA.revisionId, {
      approvalId: 'APP-REV-A-01',
      revisionId: revA.revisionId,
      role: 'LEAD_ENGINEER',
      actorId: 'LEAD_DESIGNER',
      decision: 'APPROVED',
      timestamp: new Date().toISOString(),
      reason: 'Nominal design approved for additive manufacturing qualification'
    });

    revisionEngine.transitionState(revA.revisionId, RevisionLifecycleState.IN_REVIEW, 'BYPASS', 'Review');
    revisionEngine.transitionState(revA.revisionId, RevisionLifecycleState.APPROVED, 'BYPASS', 'Approve');
    revisionEngine.releaseRevision(revA.revisionId, 'BYPASS', 'Release');
  });

  it('Phase 1: Generates Additive Manufacturing Intent with strict physical constraints', () => {
    // 1. Valid Additive Intent Generation
    const intent = continuityEngine.generateAdditiveManufacturingIntent({
      engineeringObjectId: entityId,
      canonicalRevisionId: 'REV-BRACKET-A',
      geometryHash: 'GEOM-BRACKET-A-100',
      layerHeightMm: 0.2,
      infillPercent: 40,
      nozzleDiameterMm: 0.4,
      materialType: 'AEROSPACE_PEKK_CARBON',
      printSpeedMmS: 50,
      extruderTempC: 380,
      bedTempC: 120
    });

    expect(intent.toolpathId).toMatch(/^TP-ADD-/);
    expect(intent.gcodeHash).toBeDefined();
    expect(intent.layerCount).toBeGreaterThan(0);
    expect(intent.estimatedMassGrams).toBeGreaterThan(0);
    expect(intent.isDerivedArtifact).toBe(true);
    expect(intent.isCanonicalTruth).toBe(false);

    // 2. Physical Constraint Rejection: Negative layer height
    expect(() => {
      continuityEngine.generateAdditiveManufacturingIntent({
        engineeringObjectId: entityId,
        canonicalRevisionId: 'REV-BRACKET-A',
        geometryHash: 'GEOM-BRACKET-A-100',
        layerHeightMm: -0.2,
        infillPercent: 40,
        nozzleDiameterMm: 0.4,
        materialType: 'PLA',
        printSpeedMmS: 50,
        extruderTempC: 200,
        bedTempC: 60
      });
    }).toThrow(/PHYSICAL_CONSTRAINT_VIOLATION.*layer height/);

    // 3. Physical Constraint Rejection: Infill > 100%
    expect(() => {
      continuityEngine.generateAdditiveManufacturingIntent({
        engineeringObjectId: entityId,
        canonicalRevisionId: 'REV-BRACKET-A',
        geometryHash: 'GEOM-BRACKET-A-100',
        layerHeightMm: 0.2,
        infillPercent: 150,
        nozzleDiameterMm: 0.4,
        materialType: 'PLA',
        printSpeedMmS: 50,
        extruderTempC: 200,
        bedTempC: 60
      });
    }).toThrow(/PHYSICAL_CONSTRAINT_VIOLATION.*infill percentage/);
  });

  it('Phase 2: Records Physical Realization & Manufacturing Attestation (PMA)', () => {
    const intent = continuityEngine.generateAdditiveManufacturingIntent({
      engineeringObjectId: entityId,
      canonicalRevisionId: 'REV-BRACKET-A',
      geometryHash: 'GEOM-BRACKET-A-100',
      layerHeightMm: 0.2,
      infillPercent: 50,
      nozzleDiameterMm: 0.4,
      materialType: 'ULTEM_9085',
      printSpeedMmS: 45,
      extruderTempC: 360,
      bedTempC: 130
    });

    const pma = continuityEngine.recordPhysicalRealization({
      toolpathId: intent.toolpathId,
      canonicalRevisionId: 'REV-BRACKET-A',
      serialNumber: 'SN-AERO-2026-0042',
      machineId: 'STRATASYS-F900-BAY-03',
      operatorId: 'MFG_TECH_07',
      sensorLogs: {
        avgExtruderTempC: 360.2,
        avgBedTempC: 129.8,
        ambientTempC: 24.5,
        totalPrintDurationSeconds: 4320,
        layerDiscrepancyCount: 0
      }
    });

    expect(pma.attestationId).toMatch(/^PMA-SN-AERO-2026-0042-/);
    expect(pma.buildStatus).toBe('COMPLETED_NOMINAL');
    expect(pma.pmaSignature).toHaveLength(64);

    // Fails closed on layer discrepancy anomaly
    expect(() => {
      continuityEngine.recordPhysicalRealization({
        toolpathId: intent.toolpathId,
        canonicalRevisionId: 'REV-BRACKET-A',
        serialNumber: 'SN-AERO-FAIL-01',
        machineId: 'STRATASYS-F900-BAY-03',
        operatorId: 'MFG_TECH_07',
        sensorLogs: {
          avgExtruderTempC: 360.0,
          avgBedTempC: 130.0,
          ambientTempC: 25.0,
          totalPrintDurationSeconds: 4000,
          layerDiscrepancyCount: 12
        }
      });
    }).toThrow(/PHYSICAL_REALIZATION_REJECTED.*Layer discrepancy/);
  });

  it('Phase 3: Ingests Metrology Scan with Instrument Calibration Validation', () => {
    const rawPoints = [
      { x: 0, y: 0, z: 0 },
      { x: 119.4, y: 0, z: 0 },   // Slight thermal shrinkage along X (Nominal 120 -> 119.4)
      { x: 119.4, y: 59.7, z: 0 }, // Slight shrinkage along Y (Nominal 60 -> 59.7)
      { x: 0, y: 59.7, z: 0 },
      { x: 0, y: 0, z: 39.8 },    // Slight shrinkage along Z (Nominal 40 -> 39.8)
      { x: 119.4, y: 59.7, z: 39.8 }
    ];

    // Valid Scan Ingestion
    const validExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString();
    const scan = continuityEngine.ingestMetrologyScan({
      serialNumber: 'SN-AERO-2026-0042',
      instrumentId: 'GOM_ATOS_Q_OPTICAL_SCANNER_04',
      instrumentCalibrationValid: true,
      calibrationExpiryDate: validExpiry,
      measurementUncertaintyMm: 0.005,
      acquisitionType: '3D_OPTICAL_SCAN',
      points: rawPoints
    });

    expect(scan.scanId).toMatch(/^SCAN-SN-AERO-2026-0042-/);
    expect(scan.isMeasuredReality).toBe(true);
    expect(scan.isReconstructedGeometry).toBe(false);
    expect(scan.pointCount).toBe(6);

    // Rejects uncalibrated instrument
    expect(() => {
      continuityEngine.ingestMetrologyScan({
        serialNumber: 'SN-AERO-2026-0042',
        instrumentId: 'UNCALIBRATED_SCANNER',
        instrumentCalibrationValid: false,
        calibrationExpiryDate: validExpiry,
        measurementUncertaintyMm: 0.01,
        acquisitionType: '3D_OPTICAL_SCAN',
        points: rawPoints
      });
    }).toThrow(/METROLOGY_ERROR.*calibration is invalid/);

    // Rejects expired calibration
    const pastExpiry = '2023-01-01T00:00:00.000Z';
    expect(() => {
      continuityEngine.ingestMetrologyScan({
        serialNumber: 'SN-AERO-2026-0042',
        instrumentId: 'EXPIRED_CMM',
        instrumentCalibrationValid: true,
        calibrationExpiryDate: pastExpiry,
        measurementUncertaintyMm: 0.005,
        acquisitionType: 'CMM_CONTACT_PROBE',
        points: rawPoints
      });
    }).toThrow(/METROLOGY_ERROR.*calibration expired/);
  });

  it('Phase 4: Reverse Engineering Reconstructs Geometry and Evaluates Deviation', () => {
    const validExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString();
    const scan = continuityEngine.ingestMetrologyScan({
      serialNumber: 'SN-AERO-2026-0042',
      instrumentId: 'GOM_ATOS_Q_OPTICAL_SCANNER_04',
      instrumentCalibrationValid: true,
      calibrationExpiryDate: validExpiry,
      measurementUncertaintyMm: 0.005,
      acquisitionType: '3D_OPTICAL_SCAN',
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 119.4, y: 59.7, z: 39.8 }
      ]
    });

    // 1. Reverse Engineering Reconstruction
    const recon = continuityEngine.executeReverseEngineering({
      scanId: scan.scanId,
      nominalGeometryHash: 'GEOM-BRACKET-A-100',
      nominalCadRevisionId: 'REV-BRACKET-A',
      reconstructionType: 'NURBS_BREP',
      filterOutliers: true,
      icpRegistration: true
    });

    expect(recon.reconstructionId).toMatch(/^RECON-/);
    expect(recon.isMeasuredReality).toBe(false);
    expect(recon.isReconstructedGeometry).toBe(true);
    expect(recon.reconstructionConfidence).toBeGreaterThan(0.95);

    // 2. Deviation Analysis (Nominal: 120 x 60 x 40, Measured: 119.4 x 59.7 x 39.8 -> ~0.5% shrinkage)
    const deviation = continuityEngine.evaluateDeviation({
      nominalCadRevisionId: 'REV-BRACKET-A',
      reconstructionId: recon.reconstructionId,
      scanId: scan.scanId,
      nominalDimensionsMm: { length: 120, width: 60, height: 40 },
      measuredDimensionsMm: { length: 119.4, width: 59.7, height: 39.8 },
      toleranceBandMm: 0.2 // Tight ±0.2mm tolerance
    });

    expect(deviation.analysisId).toMatch(/^DEV-REV-BRACKET-A-/);
    expect(deviation.maxDeviationMm).toBe(0.6); // 120 - 119.4 = 0.6mm
    expect(deviation.complianceVerdict).toBe('OUT_OF_SPEC_COMPENSABLE');
    expect(deviation.shrinkageRatioX).toBeCloseTo(0.995, 3);
  });

  it('Phase 5: Full Closed Loop: Inverts Deviation into Compensated Revision (Rev B) with Cryptographic Evidence', () => {
    const validExpiry = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString();
    const scan = continuityEngine.ingestMetrologyScan({
      serialNumber: 'SN-AERO-2026-0042',
      instrumentId: 'GOM_ATOS_Q_OPTICAL_SCANNER_04',
      instrumentCalibrationValid: true,
      calibrationExpiryDate: validExpiry,
      measurementUncertaintyMm: 0.005,
      acquisitionType: '3D_OPTICAL_SCAN',
      points: [{ x: 0, y: 0, z: 0 }, { x: 119.4, y: 59.7, z: 39.8 }]
    });

    const recon = continuityEngine.executeReverseEngineering({
      scanId: scan.scanId,
      nominalGeometryHash: 'GEOM-BRACKET-A-100',
      nominalCadRevisionId: 'REV-BRACKET-A',
      reconstructionType: 'NURBS_BREP'
    });

    const deviation = continuityEngine.evaluateDeviation({
      nominalCadRevisionId: 'REV-BRACKET-A',
      reconstructionId: recon.reconstructionId,
      scanId: scan.scanId,
      nominalDimensionsMm: { length: 120, width: 60, height: 40 },
      measuredDimensionsMm: { length: 119.4, width: 59.7, height: 39.8 },
      toleranceBandMm: 0.2
    });

    // Execute Closed-Loop Compensation
    const result = continuityEngine.createClosedLoopCompensationRevision({
      sourceRevisionId: 'REV-BRACKET-A',
      entityId,
      deviationReport: deviation,
      newRevisionCode: 'B',
      actorId: 'LEAD_METROLOGIST_01',
      reason: 'Compensate for 0.5% anisotropic thermal shrinkage observed in PEKK additive build'
    });

    expect(result.newRevisionCode).toBe('B');
    expect(result.previousRevisionId).toBe('REV-BRACKET-A');
    expect(result.compensationVector.scaleX).toBeGreaterThan(1.0); // Scaled up to compensate shrinkage (~1.00503)
    expect(result.merkleRoot).toBeDefined();
    expect(result.state).toBe(RevisionLifecycleState.APPROVED);

    // Verify RevisionEngine State & Lineage
    const revB = revisionEngine.getRevision(result.newRevisionId);
    expect(revB).toBeDefined();
    expect(revB?.revisionCode).toBe('B');
    expect(revB?.dependencies.some(d => d.revisionId === 'REV-BRACKET-A' && d.type === 'DERIVES_FROM')).toBe(true);

    // Verify Provenance Graph Completeness
    const graph = continuityEngine.getProvenanceGraph();
    expect(graph.hasNode(result.provenanceNodeId)).toBe(true);
    expect(graph.hasNode(`NODE-GEOM-${recon.reconstructionId}`)).toBe(true);
    expect(graph.hasNode(`NODE-INSP-${scan.scanId}`)).toBe(true);
  });
});
