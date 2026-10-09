import { describe, it, expect } from 'vitest';
import {
  QuantitativeLossProfiler,
  StageLossMeasurement
} from '../QuantitativeLossProfiler';
import { LifecycleStage } from '../CyberPhysicalLossAccountingEngine';
import { EvidenceProvenanceAntiSpoofEngine } from '../EvidenceProvenanceAntiSpoofEngine';

describe('PHASE3-LOSS-ACCOUNTING-001 — QUANTITATIVE LOSS PROPAGATION & BOTTLENECK DISCOVERY', () => {

  it('TEST-01: Profiles loss propagation curve and detects dominant bottleneck (User Exemplar Case)', () => {
    // Exact user test scenario:
    // Requirement -> 0.00 -> CAD -> 0.00 -> Simulation -> 0.02 -> CAM -> 0.07 -> Machine -> 0.01 -> Measurement -> 0.00 -> QIF
    const losses: StageLossMeasurement[] = [
      {
        fromStage: LifecycleStage.STAGE_01_REQUIREMENT,
        toStage: LifecycleStage.STAGE_02_CANONICAL_CAD,
        stageName: 'CAD Nominal Generation',
        lossMagnitudeMm: 0.000,
        lossCategory: 'SOLVER_PRECISION',
        physicalRootCause: 'Lossless exact B-Rep geometry'
      },
      {
        fromStage: LifecycleStage.STAGE_02_CANONICAL_CAD,
        toStage: LifecycleStage.STAGE_04_PHYSICS_SIMULATION,
        stageName: 'FEA Mesh Discretization',
        lossMagnitudeMm: 0.000,
        lossCategory: 'SOLVER_PRECISION',
        physicalRootCause: 'Adaptive quadratic tetrahedral elements preserve surface'
      },
      {
        fromStage: LifecycleStage.STAGE_04_PHYSICS_SIMULATION,
        toStage: LifecycleStage.STAGE_06_CAM_TOOLPATH,
        stageName: 'CAM Toolpath Discretization',
        lossMagnitudeMm: 0.020, // 20 um chordal deviation
        lossCategory: 'DISCRETIZATION',
        physicalRootCause: 'Linear G01 point interpolation along curved blade airfoil'
      },
      {
        fromStage: LifecycleStage.STAGE_06_CAM_TOOLPATH,
        toStage: LifecycleStage.STAGE_08_PHYSICAL_CUTTING,
        stageName: 'Machine Dynamic Cutting & Kinematics',
        lossMagnitudeMm: 0.070, // 70 um servo lag and thermal tool deflection
        lossCategory: 'KINEMATIC_TRACKING',
        evidenceClassification: 'SUPPORTED_BY_PHYSICAL_TELEMETRY',
        claimedPhysicalCause: 'High acceleration cornering overshoot and spindle thermal growth',
        causalEvidence: {
          controllerTelemetryId: 'TELEM_HEIDENHAIN_LOG_8841',
          axisFollowingErrorMm: 0.068,
          feedrateMmPerMin: 14000,
          curvatureRadiusMm: 3.2
        },
        verifiableTelemetryBundle: EvidenceProvenanceAntiSpoofEngine.createGenuinePhysicalTelemetryBundle()
      },
      {
        fromStage: LifecycleStage.STAGE_08_PHYSICAL_CUTTING,
        toStage: LifecycleStage.STAGE_09_PHYSICAL_MEASUREMENT,
        stageName: 'CMM Touch Probing Acquisition',
        lossMagnitudeMm: 0.010, // 10 um measurement uncertainty
        lossCategory: 'SENSOR_REPEATABILITY',
        physicalRootCause: 'Probe tip lobing error and ambient temperature gradient'
      },
      {
        fromStage: LifecycleStage.STAGE_09_PHYSICAL_MEASUREMENT,
        toStage: LifecycleStage.STAGE_10_QIF_INTERCHANGE,
        stageName: 'QIF Digital Interchange',
        lossMagnitudeMm: 0.000,
        lossCategory: 'SOLVER_PRECISION',
        physicalRootCause: 'Lossless IEEE floating-point XML serialization'
      }
    ];

    // Part tolerance is 80 um (0.080 mm)
    const report = QuantitativeLossProfiler.profileLossThread(losses, 0.080);

    expect(report.totalCumulativeLossMm).toBe(0.100); // 0.00 + 0.00 + 0.02 + 0.07 + 0.01 + 0.00 = 0.100 mm
    expect(report.toleranceConsumptionPercent).toBe(125.0); // 125% of tolerance consumed
    expect(report.willBreachTolerance).toBe(true);

    // Earliest breach detected at STAGE_08 (cutting) where cumulative loss reached 0.090 mm (> 0.080 mm)
    expect(report.earliestBreachStage).toBe(LifecycleStage.STAGE_08_PHYSICAL_CUTTING);

    // Dominant bottleneck must be CAM -> Cutting (70 um, representing 70% of total error)
    expect(report.dominantBottleneck.isDominantBottleneck).toBe(true);
    expect(report.dominantBottleneck.lossMagnitudeMm).toBe(0.070);
    expect(report.dominantBottleneck.percentageOfTotalLoss).toBe(70.0);
    expect(report.dominantBottleneck.remediationRecommendation).toContain('look-ahead contour control');

    // Prognostic action must HALT before cutting to prevent making a scrap part
    expect(report.prognosticAction).toBe('HALT_REVISE_PROCESS');
    expect(report.mathematicalProofHash).toContain('SHA256_PROFILER');
  });

  it('TEST-02: Authorizes execution when cumulative loss is well within safe tolerance budget', () => {
    const safeLosses: StageLossMeasurement[] = [
      {
        fromStage: LifecycleStage.STAGE_02_CANONICAL_CAD,
        toStage: LifecycleStage.STAGE_06_CAM_TOOLPATH,
        stageName: 'High-Precision CAM',
        lossMagnitudeMm: 0.005, // 5 um chordal tolerance
        lossCategory: 'DISCRETIZATION',
        evidenceClassification: 'COMPUTED_FROM_SYNTHETIC_DATA',
        claimedPhysicalCause: 'Fine NURBS interpolation'
      },
      {
        fromStage: LifecycleStage.STAGE_06_CAM_TOOLPATH,
        toStage: LifecycleStage.STAGE_08_PHYSICAL_CUTTING,
        stageName: 'Finishing Pass Machining',
        lossMagnitudeMm: 0.012, // 12 um deflection
        lossCategory: 'KINEMATIC_TRACKING',
        evidenceClassification: 'COMPUTED_FROM_SYNTHETIC_DATA',
        claimedPhysicalCause: 'Light finishing cut with chilled spindle'
      },
      {
        fromStage: LifecycleStage.STAGE_08_PHYSICAL_CUTTING,
        toStage: LifecycleStage.STAGE_09_PHYSICAL_MEASUREMENT,
        stageName: 'Calibrated CMM',
        lossMagnitudeMm: 0.003, // 3 um uncertainty
        lossCategory: 'SENSOR_REPEATABILITY',
        evidenceClassification: 'COMPUTED_FROM_SYNTHETIC_DATA',
        claimedPhysicalCause: 'Zeiss Prismo scanning probe'
      }
    ];

    // Part tolerance 50 um
    const report = QuantitativeLossProfiler.profileLossThread(safeLosses, 0.050);

    expect(report.totalCumulativeLossMm).toBe(0.020);
    expect(report.toleranceConsumptionPercent).toBe(40.0); // Only 40% of tolerance consumed
    expect(report.willBreachTolerance).toBe(false);
    expect(report.earliestBreachStage).toBeNull();
    expect(report.prognosticAction).toBe('PROCEED');
  });

  it('TEST-03: Triggers optimization warning when tolerance consumption reaches danger zone (>70%)', () => {
    const dangerLosses: StageLossMeasurement[] = [
      {
        fromStage: LifecycleStage.STAGE_02_CANONICAL_CAD,
        toStage: LifecycleStage.STAGE_06_CAM_TOOLPATH,
        stageName: 'CAM Toolpath',
        lossMagnitudeMm: 0.015,
        lossCategory: 'DISCRETIZATION',
        evidenceClassification: 'COMPUTED_FROM_SYNTHETIC_DATA',
        claimedPhysicalCause: 'Standard chordal tolerance'
      },
      {
        fromStage: LifecycleStage.STAGE_06_CAM_TOOLPATH,
        toStage: LifecycleStage.STAGE_08_PHYSICAL_CUTTING,
        stageName: 'Cutting Pass',
        lossMagnitudeMm: 0.022,
        lossCategory: 'KINEMATIC_TRACKING',
        evidenceClassification: 'COMPUTED_FROM_SYNTHETIC_DATA',
        claimedPhysicalCause: 'High feedrate on corners'
      }
    ];

    // Total = 0.037 mm on a 0.050 mm tolerance -> 74% consumption
    const report = QuantitativeLossProfiler.profileLossThread(dangerLosses, 0.050);

    expect(report.totalCumulativeLossMm).toBe(0.037);
    expect(report.toleranceConsumptionPercent).toBe(74.0);
    expect(report.willBreachTolerance).toBe(false);
    expect(report.prognosticAction).toBe('OPTIMIZE_BEFORE_CUTTING');
  });
});
