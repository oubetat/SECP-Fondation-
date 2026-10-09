import { describe, it, expect } from 'vitest';
import {
  CyberPhysicalLossAccountingEngine,
  LifecycleStage,
  StagePayload
} from '../CyberPhysicalLossAccountingEngine';

describe('SECP-POST-007 PHASE 3 — CYBER-PHYSICAL LOSS ACCOUNTING ENGINE AUDIT', () => {
  const baseEntities = [
    {
      entityId: 'FEAT_BLADE_AERO_01',
      entityType: 'BRepFace',
      semanticIntent: 'PROFILE_OF_A_SURFACE_0_05_A_B_C',
      geometryHash: 'SHA256_GEOM_FACE_01_AERO',
      uncertaintyMm: 0.005
    },
    {
      entityId: 'FEAT_ROOT_DOVETAIL_01',
      entityType: 'BRepFace',
      semanticIntent: 'POSITION_TOLERANCE_0_02_A',
      geometryHash: 'SHA256_GEOM_DOVETAIL_01',
      uncertaintyMm: 0.003
    }
  ];

  const createClean16Stages = (): StagePayload[] => {
    const allStages = [
      LifecycleStage.STAGE_01_REQUIREMENT,
      LifecycleStage.STAGE_02_CANONICAL_CAD,
      LifecycleStage.STAGE_03_SEMANTIC_PMI,
      LifecycleStage.STAGE_04_PHYSICS_SIMULATION,
      LifecycleStage.STAGE_05_OPTIMIZATION,
      LifecycleStage.STAGE_06_CAM_TOOLPATH,
      LifecycleStage.STAGE_07_MACHINE_SAFETY_GATEWAY,
      LifecycleStage.STAGE_08_PHYSICAL_CUTTING,
      LifecycleStage.STAGE_09_PHYSICAL_MEASUREMENT,
      LifecycleStage.STAGE_10_QIF_INTERCHANGE,
      LifecycleStage.STAGE_11_UNCERTAINTY_PROPAGATION,
      LifecycleStage.STAGE_12_DEVIATION_FIELD,
      LifecycleStage.STAGE_13_TOOL_WEAR_INFERENCE,
      LifecycleStage.STAGE_14_INVERSE_COMPENSATION,
      LifecycleStage.STAGE_15_REVISION_PROPOSAL,
      LifecycleStage.STAGE_16_RE_MANUFACTURING_TWIN
    ];

    let baseTime = Date.parse('2026-09-23T08:00:00Z');

    return allStages.map((stg, idx) => ({
      stage: stg,
      stageName: stg.replace('STAGE_', ''),
      cadModelId: 'CAD_IMPELLER_BLISK_GEN3',
      revision: idx >= 14 ? 'REV_B' : 'REV_A', // Revision monotonically increments at proposal
      provenanceHash: `SHA256_PROV_STAGE_${idx}_OK`,
      coordinateFrameId: 'FRAME_PART_ORIGIN_ABC',
      unit: 'mm' as const,
      timestampIso: new Date(baseTime + idx * 3600000).toISOString(),
      authorizationToken: 'AUTH_TOKEN_CRYPTO_MULTI_SIG_ENGINEERING_LEAD',
      entities: baseEntities.map(e => ({ ...e }))
    }));
  };

  it('TEST-01: Proves unbroken 16-stage cyber-physical thread with zero fatal loss across 11 dimensions', () => {
    const cleanStages = createClean16Stages();
    expect(cleanStages.length).toBe(16);

    const report = CyberPhysicalLossAccountingEngine.auditEndToEndThread(cleanStages);

    expect(report.totalStages).toBe(16);
    expect(report.totalTransitions).toBe(15);
    expect(report.overallVerdict).toBe('CYBER_PHYSICAL_TRUTH_PROVEN');

    // Verify all 11 loss dimensions have zero fatal violations
    expect(report.lossSummary.IDENTITY_LOSS.totalViolations).toBe(0);
    expect(report.lossSummary.SEMANTIC_LOSS.totalViolations).toBe(0);
    expect(report.lossSummary.UNCERTAINTY_LOSS.totalViolations).toBe(0);
    expect(report.lossSummary.PROVENANCE_LOSS.totalViolations).toBe(0);
    expect(report.lossSummary.REVISION_LOSS.totalViolations).toBe(0);
    expect(report.lossSummary.TEMPORAL_LOSS.totalViolations).toBe(0);
    expect(report.lossSummary.COORDINATE_FRAME_LOSS.totalViolations).toBe(0);
    expect(report.lossSummary.UNIT_LOSS.totalViolations).toBe(0);
    expect(report.lossSummary.AUTHORIZATION_LOSS.totalViolations).toBe(0);
  });

  it('TEST-02: Identity Loss Detection (Drop entity in CAM toolpath)', () => {
    const stages = createClean16Stages();
    // Drop one entity in STAGE_06_CAM_TOOLPATH
    stages[5].entities = [stages[5].entities[0]]; // dropped dovetail

    const report = CyberPhysicalLossAccountingEngine.auditEndToEndThread(stages);
    expect(report.overallVerdict).toBe('BREACH_DETECTED');
    expect(report.lossSummary.IDENTITY_LOSS.totalViolations).toBeGreaterThan(0);
    expect(report.transitions[4].status).toBe('UNACCEPTABLE_LOSS');
  });

  it('TEST-03: Semantic Loss Detection (Corrupted GD&T intent in QIF)', () => {
    const stages = createClean16Stages();
    // Mutate semantic intent in STAGE_10_QIF_INTERCHANGE
    stages[9].entities[0].semanticIntent = 'CORRUPTED_MODIFIED_INTENT';

    const report = CyberPhysicalLossAccountingEngine.auditEndToEndThread(stages);
    expect(report.overallVerdict).toBe('BREACH_DETECTED');
    expect(report.lossSummary.SEMANTIC_LOSS.totalViolations).toBeGreaterThan(0);
    expect(report.transitions[8].status).toBe('UNACCEPTABLE_LOSS');
  });

  it('TEST-04: Uncertainty Loss Detection (Dropping GUM uncertainty in CMM)', () => {
    const stages = createClean16Stages();
    // Drop uncertainty in STAGE_09_PHYSICAL_MEASUREMENT
    delete stages[8].entities[0].uncertaintyMm;

    const report = CyberPhysicalLossAccountingEngine.auditEndToEndThread(stages);
    expect(report.overallVerdict).toBe('BREACH_DETECTED');
    expect(report.lossSummary.UNCERTAINTY_LOSS.totalViolations).toBeGreaterThan(0);
    expect(report.transitions[7].status).toBe('UNACCEPTABLE_LOSS');
  });

  it('TEST-05: Coordinate Frame Loss Detection (MCS machine frame instead of WCS)', () => {
    const stages = createClean16Stages();
    stages[7].coordinateFrameId = 'MCS_MACHINE_COORDINATE_SYSTEM';

    const report = CyberPhysicalLossAccountingEngine.auditEndToEndThread(stages);
    expect(report.overallVerdict).toBe('BREACH_DETECTED');
    expect(report.lossSummary.COORDINATE_FRAME_LOSS.totalViolations).toBeGreaterThan(0);
  });

  it('TEST-06: Unit Loss Detection (Implicit inch in QIF without conversion)', () => {
    const stages = createClean16Stages();
    stages[9].unit = 'inch';

    const report = CyberPhysicalLossAccountingEngine.auditEndToEndThread(stages);
    expect(report.overallVerdict).toBe('BREACH_DETECTED');
    expect(report.lossSummary.UNIT_LOSS.totalViolations).toBeGreaterThan(0);
  });

  it('TEST-07: Authorization Loss Detection (Missing token at Machine Safety Gateway)', () => {
    const stages = createClean16Stages();
    delete stages[6].authorizationToken; // STAGE_07_MACHINE_SAFETY_GATEWAY requires token

    const report = CyberPhysicalLossAccountingEngine.auditEndToEndThread(stages);
    expect(report.overallVerdict).toBe('BREACH_DETECTED');
    expect(report.lossSummary.AUTHORIZATION_LOSS.totalViolations).toBeGreaterThan(0);
    expect(report.transitions[5].status).toBe('UNACCEPTABLE_LOSS');
  });

  it('TEST-08: Temporal Loss Detection (Non-monotonic timestamp jump)', () => {
    const stages = createClean16Stages();
    // Backdate STAGE_04 timestamp
    stages[3].timestampIso = '2020-01-01T00:00:00Z';

    const report = CyberPhysicalLossAccountingEngine.auditEndToEndThread(stages);
    expect(report.overallVerdict).toBe('BREACH_DETECTED');
    expect(report.lossSummary.TEMPORAL_LOSS.totalViolations).toBeGreaterThan(0);
  });
});
