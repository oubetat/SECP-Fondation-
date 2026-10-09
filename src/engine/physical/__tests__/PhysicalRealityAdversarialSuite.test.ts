import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import { RevisionEngine } from '../../revision/RevisionEngine';
import { RevisionLifecycleState } from '../../revision/types';
import { ProvenanceGraph } from '../../provenance/ProvenanceGraph';
import { IndexedDbEngine } from '../../storage/IndexedDbEngine';
import { PhysicalOriginType, PhysicalOriginSemantics } from '../PhysicalOriginSemantics';
import { AdditiveManufacturingAuthority } from '../AdditiveManufacturingAuthority';
import { ReverseEngineeringAuthority } from '../ReverseEngineeringAuthority';
import { DigitalPhysicalDigitalLoopEngine } from '../DigitalPhysicalDigitalLoopEngine';

describe('SECP — POST-PLUGIN-MATURITY-008R: Physical Reality Integration Suite', () => {
  let revisionEngine: RevisionEngine;
  let provenanceGraph: ProvenanceGraph;
  const entityId = 'PART-DRONE-ARM-880';
  let revA: any;

  beforeEach(() => {
    IndexedDbEngine.clearMockStore();
    AdditiveManufacturingAuthority.clear();
    ReverseEngineeringAuthority.clear();
    DigitalPhysicalDigitalLoopEngine.clear();

    revisionEngine = new RevisionEngine();
    provenanceGraph = new ProvenanceGraph();

    // Bootstrap initial canonical design revision
    revA = revisionEngine.createRevision({
      revisionId: 'REV-ARM-A',
      entityId,
      entityType: 'CAD_MODEL' as any,
      revisionCode: 'A',
      revisionNumber: 1,
      lifecycleState: RevisionLifecycleState.DRAFT,
      createdBy: 'LEAD_DESIGNER',
      content: { geometry: 'DRONE_ARM_CANONICAL_BREP', lengthMm: 120, widthMm: 30, heightMm: 15 },
      snapshot: {
        geometryState: {
          parameters: { lengthMm: 120, widthMm: 30, heightMm: 15 },
          features: ['EXTRUDE_BODY', 'HOLE_MOTOR_MOUNT'],
          topologyHash: 'TOPO-ARM-A',
          geometryHash: 'GEOM-ARM-A'
        }
      }
    } as any);

    revisionEngine.addApproval(revA.revisionId, {
      approvalId: 'APP-ARM-A',
      revisionId: revA.revisionId,
      role: 'ENGINEER',
      actorId: 'LEAD_DESIGNER',
      decision: 'APPROVED',
      timestamp: new Date().toISOString(),
      reason: 'Approved for manufacturing'
    });

    revisionEngine.setValidationState(revA.revisionId, 'SIMULATED');
    revisionEngine.transitionState(revA.revisionId, RevisionLifecycleState.IN_REVIEW, 'ADMIN', 'Reviewing');
    revisionEngine.transitionState(revA.revisionId, RevisionLifecycleState.APPROVED, 'ADMIN', 'Approved');
    revA = revisionEngine.releaseRevision(revA.revisionId, 'ADMIN', 'Released baseline');
  });

  // ========================================================================
  // PART A: REVERSE ENGINEERING ADVERSARIAL TESTS (RE-01 to RE-08)
  // ========================================================================

  it('RE-01: Measured geometry cannot be falsely labelled DESIGNED', () => {
    const check = PhysicalOriginSemantics.validateOriginTransition(
      PhysicalOriginType.MEASURED,
      PhysicalOriginType.DESIGNED
    );
    expect(check.allowed).toBe(false);
    expect(check.violationReason).toContain('EPISTEMOLOGICAL_VIOLATION');
  });

  it('RE-02: Reconstructed geometry cannot bypass canonical binding', () => {
    const scan = ReverseEngineeringAuthority.ingestRawScan({
      physicalSerialId: 'PP-SN-TEST-01',
      instrumentType: 'OPTICAL_CMM',
      instrumentId: 'ZEISS-01',
      calibrationCertificateId: 'CAL-2026',
      measurementUncertaintyMm: 0.005,
      points: [{ x: 0, y: 0, z: 0 }, { x: 120, y: 30, z: 15 }]
    });

    const dev = ReverseEngineeringAuthority.performDeviationAnalysis(
      scan.scanId,
      revA.revisionHash,
      { lengthMm: 120, widthMm: 30, heightMm: 15 }
    );

    const rePkg = ReverseEngineeringAuthority.reconstructEngineeringModel(
      scan.scanId,
      dev.analysisId,
      [{
        featureId: 'FEAT-RE-01',
        featureType: 'PLANAR_FACE',
        nominalParameters: { areaMm2: 3600 },
        rmsFittingErrorMm: 0.012
      }]
    );

    expect(rePkg.originTag.origin).toBe(PhysicalOriginType.REVERSE_ENGINEERED);
    expect(rePkg.reconstructedFeatures[0].originTag.origin).toBe(PhysicalOriginType.RECONSTRUCTED);
    // Cannot claim CANONICAL without explicit publishToCanonicalRevision
    expect(rePkg.originTag.origin).not.toBe(PhysicalOriginType.CANONICAL);
  });

  it('RE-03: Inferred geometry cannot be silently promoted to measured geometry', () => {
    const check = PhysicalOriginSemantics.validateOriginTransition(
      PhysicalOriginType.INFERRED,
      PhysicalOriginType.MEASURED
    );
    expect(check.allowed).toBe(false);
    expect(check.violationReason).toContain('Inferred geometry cannot be promoted to measured reality');
  });

  it('RE-04: Stale source revision cannot publish a current canonical revision', () => {
    // Attempting to publish intent against a fake/stale revision hash throws fail-closed error
    expect(() => {
      AdditiveManufacturingAuthority.createManufacturingIntent(revisionEngine, {
        entityId,
        revisionId: revA.revisionId,
        expectedRevisionHash: 'STALE_OR_FORGED_HASH_999',
        processType: 'FDM_3D_PRINTING',
        layerHeightMm: 0.2,
        infillPercentage: 40,
        printSpeedMmS: 50,
        materialGrade: 'PLA_CARBON',
        targetMachineModel: 'PRUSA-MK4'
      });
    }).toThrow(/STALE_REVISION_BREACH/);
  });

  it('RE-05: Tampered measurement artifact invalidates its evidence binding', () => {
    const scan = ReverseEngineeringAuthority.ingestRawScan({
      physicalSerialId: 'PP-SN-TAMPER-01',
      instrumentType: 'LASER_SCANNER',
      instrumentId: 'CREAFORM-02',
      calibrationCertificateId: 'CAL-2026-B',
      measurementUncertaintyMm: 0.01,
      points: [{ x: 10, y: 10, z: 10 }, { x: 20, y: 20, z: 20 }]
    });

    const tamperedPoints = [{ x: 10, y: 10, z: 10 }, { x: 9999, y: 20, z: 20 }];
    const computedTamperedHash = ReverseEngineeringAuthority.computeScanPointsHash(tamperedPoints);
    expect(computedTamperedHash).not.toBe(scan.rawDataHash);
  });

  it('RE-06: Reverse-engineered result survives persistence/rehydration', async () => {
    const scan = ReverseEngineeringAuthority.ingestRawScan({
      physicalSerialId: 'PP-SN-PERSIST-01',
      instrumentType: 'OPTICAL_CMM',
      instrumentId: 'ZEISS-01',
      calibrationCertificateId: 'CAL-2026',
      measurementUncertaintyMm: 0.005,
      points: [{ x: 0, y: 0, z: 0 }, { x: 120, y: 30, z: 15 }]
    });

    const dev = ReverseEngineeringAuthority.performDeviationAnalysis(
      scan.scanId,
      revA.revisionHash,
      { lengthMm: 120, widthMm: 30, heightMm: 15 }
    );

    const rePkg = ReverseEngineeringAuthority.reconstructEngineeringModel(
      scan.scanId,
      dev.analysisId,
      [{
        featureId: 'FEAT-RE-01',
        featureType: 'PLANAR_FACE',
        nominalParameters: { areaMm2: 3600 },
        rmsFittingErrorMm: 0.012
      }]
    );

    // Persist via closed-loop engine
    await DigitalPhysicalDigitalLoopEngine.persistToDurableStorage();

    // Rehydrate
    await DigitalPhysicalDigitalLoopEngine.rehydrateFromDurableStorage();
    expect(ReverseEngineeringAuthority.getReconstruction(rePkg.reconstructionId)).toBeDefined();
  });

  it('RE-07: Provenance identifies measurement -> reconstruction -> revision lineage', async () => {
    const record = await DigitalPhysicalDigitalLoopEngine.executeFullClosedLoop(
      revisionEngine,
      provenanceGraph,
      {
        entityId,
        initialRevisionId: revA.revisionId,
        operatorId: 'CHIEF_METROLOGIST',
        machineModel: 'PRUSA-MK4-IND',
        machineSerial: 'PRUSA-SN-4412',
        materialGrade: 'PLA_AEROSPACE',
        materialLot: 'LOT-2026-99',
        scanPoints: [{ x: 0, y: 0, z: 0 }, { x: 120, y: 30, z: 15 }],
        nominalBounds: { lengthMm: 120, widthMm: 30, heightMm: 15 },
        reconstructedFeatures: [{
          featureId: 'RE-FEAT-TOP',
          featureType: 'PLANAR_FACE',
          nominalParameters: { lengthMm: 120.02, widthMm: 30.01 },
          rmsFittingErrorMm: 0.008
        }]
      }
    );

    const nodes = provenanceGraph.getNodes();
    expect(nodes.some(n => n.id === `NODE-SCAN-${record.metrologyScanId}`)).toBe(true);
    expect(nodes.some(n => n.id === `NODE-RE-${record.reconstructionPackageId}`)).toBe(true);
    expect(nodes.some(n => n.id === `NODE-REV-${record.newRevisionHash}`)).toBe(true);
  });

  it('RE-08: Deviation results reference the correct as-designed and as-built states', () => {
    const scan = ReverseEngineeringAuthority.ingestRawScan({
      physicalSerialId: 'PP-SN-DEV-01',
      instrumentType: 'TACTILE_PROBE',
      instrumentId: 'RENISHAW-SP25',
      calibrationCertificateId: 'CAL-2026-C',
      measurementUncertaintyMm: 0.002,
      points: [{ x: 0, y: 0, z: 0 }, { x: 120.05, y: 30.02, z: 15.01 }]
    });

    const dev = ReverseEngineeringAuthority.performDeviationAnalysis(
      scan.scanId,
      revA.revisionHash,
      { lengthMm: 120, widthMm: 30, heightMm: 15 }
    );

    expect(dev.sourceRevisionHash).toBe(revA.revisionHash);
    expect(dev.asBuiltScanId).toBe(scan.scanId);
    expect(dev.physicalSerialId).toBe('PP-SN-DEV-01');
    expect(dev.complianceVerdict).toBe('WITHIN_TOLERANCE');
  });

  // ========================================================================
  // PART B: ADDITIVE MANUFACTURING ADVERSARIAL TESTS (AM-01 to AM-10)
  // ========================================================================

  it('AM-01: Manufacturing artifact cannot be detached from its source revision', () => {
    const intent = AdditiveManufacturingAuthority.createManufacturingIntent(revisionEngine, {
      entityId,
      revisionId: revA.revisionId,
      processType: 'FDM_3D_PRINTING',
      layerHeightMm: 0.2,
      infillPercentage: 30,
      printSpeedMmS: 60,
      materialGrade: 'PETG_CARBON',
      targetMachineModel: 'BAMBU-X1C'
    });

    const artifact = AdditiveManufacturingAuthority.generatePrintableArtifact(intent.intentId, 'GCODE');
    expect(artifact.sourceRevisionHash).toBe(revA.revisionHash);
    expect(artifact.intentId).toBe(intent.intentId);
  });

  it('AM-02: Stale canonical revision cannot silently produce current manufacturing authority', () => {
    expect(() => {
      AdditiveManufacturingAuthority.createManufacturingIntent(revisionEngine, {
        entityId,
        revisionId: revA.revisionId,
        expectedRevisionHash: 'DIFFERENT_STALE_HASH',
        processType: 'SLS_POWDER',
        layerHeightMm: 0.1,
        infillPercentage: 100,
        printSpeedMmS: 40,
        materialGrade: 'PA12_NYLON',
        targetMachineModel: 'EOS-FORMIGA-P110'
      });
    }).toThrow(/STALE_REVISION_BREACH/);
  });

  it('AM-03: Tampered STL/3MF/G-code identity is detected', () => {
    const intent = AdditiveManufacturingAuthority.createManufacturingIntent(revisionEngine, {
      entityId,
      revisionId: revA.revisionId,
      processType: 'FDM_3D_PRINTING',
      layerHeightMm: 0.2,
      infillPercentage: 30,
      printSpeedMmS: 60,
      materialGrade: 'PETG_CARBON',
      targetMachineModel: 'BAMBU-X1C'
    });

    const artifact = AdditiveManufacturingAuthority.generatePrintableArtifact(intent.intentId, 'GCODE');
    const validCheck = AdditiveManufacturingAuthority.verifyArtifactIntegrity(artifact, revA.revisionHash);
    expect(validCheck.isValid).toBe(true);

    // Attacker modifies G-code line
    const tamperedArtifact = {
      ...artifact,
      artifactPayload: artifact.artifactPayload + '\n; INJECTED_MALICIOUS_OFFSET'
    };
    const tamperedCheck = AdditiveManufacturingAuthority.verifyArtifactIntegrity(tamperedArtifact, revA.revisionHash);
    expect(tamperedCheck.isValid).toBe(false);
    expect(tamperedCheck.failureReason).toContain('TAMPERED_ARTIFACT_PAYLOAD');
  });

  it('AM-04: Manufacturing artifact cannot become canonical engineering state without authoritative transition', () => {
    const intent = AdditiveManufacturingAuthority.createManufacturingIntent(revisionEngine, {
      entityId,
      revisionId: revA.revisionId,
      processType: 'FDM_3D_PRINTING',
      layerHeightMm: 0.2,
      infillPercentage: 30,
      printSpeedMmS: 60,
      materialGrade: 'PETG_CARBON',
      targetMachineModel: 'BAMBU-X1C'
    });

    const artifact = AdditiveManufacturingAuthority.generatePrintableArtifact(intent.intentId, 'GCODE');
    // Artifact is a derived manufacturing instruction, not a canonical CAD revision
    expect(revisionEngine.getRevision(artifact.artifactId)).toBeUndefined();
  });

  it('AM-05: Physical part identity remains linked to manufacturing identity', () => {
    const intent = AdditiveManufacturingAuthority.createManufacturingIntent(revisionEngine, {
      entityId,
      revisionId: revA.revisionId,
      processType: 'FDM_3D_PRINTING',
      layerHeightMm: 0.2,
      infillPercentage: 30,
      printSpeedMmS: 60,
      materialGrade: 'PETG_CARBON',
      targetMachineModel: 'BAMBU-X1C'
    });

    const artifact = AdditiveManufacturingAuthority.generatePrintableArtifact(intent.intentId, 'GCODE');
    const part = AdditiveManufacturingAuthority.serializePhysicalPart({
      artifactId: artifact.artifactId,
      physicalMachineSerial: 'BAMBU-SN-0092',
      materialLotNumber: 'LOT-PETG-2026',
      operatorId: 'MFG_ENGINEER_1'
    });

    expect(part.artifactId).toBe(artifact.artifactId);
    expect(part.intentId).toBe(intent.intentId);
    expect(part.sourceRevisionHash).toBe(revA.revisionHash);
  });

  it('AM-06: As-built measurement cannot overwrite design intent', () => {
    const check = PhysicalOriginSemantics.validateOriginTransition(
      PhysicalOriginType.MEASURED,
      PhysicalOriginType.DESIGNED
    );
    expect(check.allowed).toBe(false);
  });

  it('AM-07: Measured deviation is linked to the correct design revision', () => {
    const scan = ReverseEngineeringAuthority.ingestRawScan({
      physicalSerialId: 'PP-SN-LINK-01',
      instrumentType: 'OPTICAL_CMM',
      instrumentId: 'ZEISS-01',
      calibrationCertificateId: 'CAL-2026',
      measurementUncertaintyMm: 0.005,
      points: [{ x: 0, y: 0, z: 0 }, { x: 120, y: 30, z: 15 }]
    });

    const dev = ReverseEngineeringAuthority.performDeviationAnalysis(
      scan.scanId,
      revA.revisionHash,
      { lengthMm: 120, widthMm: 30, heightMm: 15 }
    );

    expect(dev.sourceRevisionHash).toBe(revA.revisionHash);
  });

  it('AM-08: Manufacturing evidence survives persistence/rehydration', async () => {
    const intent = AdditiveManufacturingAuthority.createManufacturingIntent(revisionEngine, {
      entityId,
      revisionId: revA.revisionId,
      processType: 'FDM_3D_PRINTING',
      layerHeightMm: 0.2,
      infillPercentage: 30,
      printSpeedMmS: 60,
      materialGrade: 'PETG_CARBON',
      targetMachineModel: 'BAMBU-X1C'
    });

    const artifact = AdditiveManufacturingAuthority.generatePrintableArtifact(intent.intentId, 'GCODE');
    const part = AdditiveManufacturingAuthority.serializePhysicalPart({
      artifactId: artifact.artifactId,
      physicalMachineSerial: 'BAMBU-SN-0092',
      materialLotNumber: 'LOT-PETG-2026',
      operatorId: 'MFG_ENGINEER_1'
    });

    await DigitalPhysicalDigitalLoopEngine.persistToDurableStorage();
    await DigitalPhysicalDigitalLoopEngine.rehydrateFromDurableStorage();

    expect(AdditiveManufacturingAuthority.getPhysicalPart(part.physicalSerialId)).toBeDefined();
  });

  it('AM-09: Replay does not silently produce a different engineering identity', () => {
    const intent = AdditiveManufacturingAuthority.createManufacturingIntent(revisionEngine, {
      entityId,
      revisionId: revA.revisionId,
      processType: 'FDM_3D_PRINTING',
      layerHeightMm: 0.2,
      infillPercentage: 30,
      printSpeedMmS: 60,
      materialGrade: 'PETG_CARBON',
      targetMachineModel: 'BAMBU-X1C'
    });

    const artifact1 = AdditiveManufacturingAuthority.generatePrintableArtifact(intent.intentId, 'GCODE');
    const artifact2 = AdditiveManufacturingAuthority.generatePrintableArtifact(intent.intentId, 'GCODE');

    expect(artifact1.artifactContentHash).toBe(artifact2.artifactContentHash);
    expect(artifact1.artifactDigest).toBe(artifact2.artifactDigest);
  });

  it('AM-10: Forged manufacturing evidence cannot produce an authoritative release', () => {
    const forgedArtifact = {
      artifactId: 'ART-FORGED-001',
      intentId: 'INTENT-NON-EXISTENT',
      sourceRevisionHash: 'FAKE_HASH',
      format: 'GCODE' as const,
      artifactPayload: 'G1 X100 Y100',
      artifactContentHash: 'CORRUPTED',
      estimatedBuildTimeMinutes: 10,
      estimatedMaterialGrams: 5,
      layerCount: 10,
      artifactDigest: 'FORGED',
      createdAt: new Date().toISOString(),
      isReleasedForProduction: true
    };

    const integrity = AdditiveManufacturingAuthority.verifyArtifactIntegrity(forgedArtifact, revA.revisionHash);
    expect(integrity.isValid).toBe(false);
  });

  // ========================================================================
  // PART C: DIGITAL -> PHYSICAL -> DIGITAL FULL CLOSED-LOOP EXECUTION
  // ========================================================================

  it('PART C: Full Digital → Physical → Digital closed-loop executes authoritatively with complete lineage', async () => {
    const loopResult = await DigitalPhysicalDigitalLoopEngine.executeFullClosedLoop(
      revisionEngine,
      provenanceGraph,
      {
        entityId,
        initialRevisionId: revA.revisionId,
        operatorId: 'LEAD_METROLOGIST_01',
        machineModel: 'STRATASYS-F900-IND',
        machineSerial: 'STRATA-SN-9821',
        materialGrade: 'ULTEM-9085-AEROSPACE',
        materialLot: 'LOT-ULTEM-2026-X',
        scanPoints: [
          { x: 0.01, y: 0.01, z: 0.0 },
          { x: 120.03, y: 0.02, z: 0.0 },
          { x: 120.04, y: 30.03, z: 0.0 },
          { x: 0.02, y: 30.01, z: 0.0 },
          { x: 60.0, y: 15.0, z: 15.02 }
        ],
        nominalBounds: { lengthMm: 120, widthMm: 30, heightMm: 15 },
        reconstructedFeatures: [
          {
            featureId: 'RE-FEAT-ARM-MAIN-BODY',
            featureType: 'PLANAR_FACE',
            nominalParameters: { lengthMm: 120.03, widthMm: 30.02, thicknessMm: 15.02 },
            rmsFittingErrorMm: 0.006
          },
          {
            featureId: 'RE-FEAT-MOTOR-BORE',
            featureType: 'CYLINDRICAL_BORE',
            nominalParameters: { diameterMm: 22.01, depthMm: 15.0 },
            rmsFittingErrorMm: 0.004
          }
        ]
      }
    );

    // 1. Loop execution verified
    expect(loopResult.status).toBe('COMPLETED_VERIFIED');
    expect(loopResult.initialRevisionId).toBe('REV-ARM-A');
    expect(loopResult.newRevisionId).toBe('REV-PART-DRONE-ARM-880-B');

    // 2. New Canonical Revision Released
    const revB = revisionEngine.getRevision(loopResult.newRevisionId);
    expect(revB).toBeDefined();
    expect(revB?.lifecycleState).toBe(RevisionLifecycleState.RELEASED);
    expect(revB?.revisionNumber).toBe(2);
    expect(revB?.content.reconstructionId).toBe(loopResult.reconstructionPackageId);

    // 3. Merkle Evidence Root Established
    expect(loopResult.merkleRoot).toBeDefined();
    expect(loopResult.merkleRoot.length).toBe(64);

    // 4. Complete Provenance Graph Verified
    const nodes = provenanceGraph.getNodes();
    expect(nodes.length).toBeGreaterThanOrEqual(8);
    expect(provenanceGraph.hasNode(`NODE-REV-${revA.revisionHash}`)).toBe(true);
    expect(provenanceGraph.hasNode(`NODE-INTENT-${loopResult.manufacturingIntentId}`)).toBe(true);
    expect(provenanceGraph.hasNode(`NODE-ART-${loopResult.printableArtifactId}`)).toBe(true);
    expect(provenanceGraph.hasNode(`NODE-PP-${loopResult.physicalSerialId}`)).toBe(true);
    expect(provenanceGraph.hasNode(`NODE-SCAN-${loopResult.metrologyScanId}`)).toBe(true);
    expect(provenanceGraph.hasNode(`NODE-RE-${loopResult.reconstructionPackageId}`)).toBe(true);
    expect(provenanceGraph.hasNode(`NODE-REV-${loopResult.newRevisionHash}`)).toBe(true);
    expect(provenanceGraph.hasNode(`NODE-EVI-${loopResult.evidenceLeafHash}`)).toBe(true);

    // 5. Engineering History Logged
    const history = DigitalPhysicalDigitalLoopEngine.getHistory();
    expect(history.length).toBeGreaterThanOrEqual(9);
    expect(history.some(h => h.eventType === 'DESIGN_BASELINE_RELEASED')).toBe(true);
    expect(history.some(h => h.eventType === 'PHYSICAL_PART_REALIZED')).toBe(true);
    expect(history.some(h => h.eventType === 'RECONSTRUCTED_REVISION_RELEASED')).toBe(true);
  });
});
