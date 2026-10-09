import { CAMBenchmarkCaseResult, CAMBenchmarkVerdict } from './types';
import { ThreeAxisToolpathEngine } from '../../../engine/cam/ThreeAxisToolpathEngine';
import { ToolpathVerificationEngine } from '../../../engine/cam/ToolpathVerificationEngine';
import { MachiningOperationConfig, StockModel } from '../../../engine/cam/ToolpathTypes';
import { generateDeterministicHash } from '../../../lib/hash';

export class CAMBenchmarkCaseRunner {
  private static createBaseConfig(strategy: any): MachiningOperationConfig {
    return {
      operationId: 'op-bench',
      name: 'Benchmark Op',
      strategy,
      topologyId: 'topo-1',
      toolAssembly: {
        assemblyId: 'a1',
        tool: {
          toolId: 't1', name: 'Endmill 10mm', type: 'FLAT_ENDMILL',
          diameterMm: 10, cornerRadiusMm: 0, fluteCount: 4, fluteLengthMm: 30, overallLengthMm: 75,
          holderDiameterMm: 10, gaugeLengthMm: 50, reachMm: 40, material: 'CARBIDE',
          fingerprint: 'tool-f1'
        },
        holder: { holderId: 'h1', name: 'Holder', gaugeDiameterMm: 30, upperDiameterMm: 30, lengthMm: 50, clearanceMarginMm: 2 },
        offsetNumber: 1, compensationLengthMm: 50, fingerprint: 'a1-f'
      },
      parameters: {
        stepoverMm: 5, stepdownMm: 2, stockToLeaveMm: 0, toleranceMm: 0.01, entryStrategy: 'PLUNGE'
      },
      feedsAndSpeeds: {
        surfaceSpeedMMin: 100, feedPerToothMm: 0.1, spindleRpm: 3183, cuttingFeedMmMin: 1273, plungeFeedMmMin: 300, rapidFeedMmMin: 5000
      },
      clearancePlaneZ: 25,
      retractPlaneZ: 10,
      fingerprint: 'config-f1'
    };
  }

  private static createStock(): StockModel {
    return {
      stockId: 's1',
      material: 'Aluminum',
      bounds: { xMin: 0, xMax: 100, yMin: 0, yMax: 100, zMin: 0, zMax: 20 },
      initialVolumeMm3: 100 * 100 * 20,
      fingerprint: 's1-f'
    };
  }

  private static async executeVerification(config: MachiningOperationConfig, stock: StockModel, partFloorZ: number) {
    const t0 = performance.now();
    const machine: any = {
      machineId: 'bench-mc',
      name: 'Benchmark Machine',
      axes: [],
      controllerType: 'GENERIC',
      fingerprint: 'mc-f'
    };
    const candidate = await ThreeAxisToolpathEngine.generateToolpathAsync(config, stock.bounds, 'topo-hash', machine);
    const verified = await ToolpathVerificationEngine.verifyToolpathAsync(candidate, partFloorZ, stock);
    const runtimeMs = performance.now() - t0;
    return { verified, runtimeMs };
  }

  // Case 01: 2.5D Pocket (Uses POCKET_MACHINING)
  public static async runCase01(): Promise<CAMBenchmarkCaseResult> {
    const config = this.createBaseConfig('POCKET_MACHINING');
    const stock = this.createStock();
    const { verified, runtimeMs } = await this.executeVerification(config, stock, 0);

    const verdict: CAMBenchmarkVerdict = verified.verificationReport.isValid ? 'PASS' : 'FAIL';
    
    return {
      caseId: 'BENCH-CAM-01',
      caseName: '2.5D Pocket Machining',
      category: 'TOOLPATH_GENERATION',
      verdict,
      metrics: {
        segmentCount: verified.verificationReport.metrics.segmentCount,
        totalLengthMm: verified.verificationReport.metrics.totalLengthMm,
        runtimeMs
      },
      details: `Generated pocket toolpath with ${verified.verificationReport.metrics.segmentCount} segments. Validity: ${verified.verificationReport.isValid}`,
      evidencePacket: verified,
      evidenceHash: verified.verificationReport.provenanceHash
    };
  }

  // Case 02: Contour Milling (Uses CONTOUR_PROFILE)
  public static async runCase02(): Promise<CAMBenchmarkCaseResult> {
    const config = this.createBaseConfig('CONTOUR_PROFILE');
    const stock = this.createStock();
    const { verified, runtimeMs } = await this.executeVerification(config, stock, 0);

    const verdict: CAMBenchmarkVerdict = verified.verificationReport.isValid ? 'PASS' : 'FAIL';
    
    return {
      caseId: 'BENCH-CAM-02',
      caseName: 'Contour Milling Profile',
      category: 'TOOLPATH_GENERATION',
      verdict,
      metrics: {
        segmentCount: verified.verificationReport.metrics.segmentCount,
        totalLengthMm: verified.verificationReport.metrics.totalLengthMm,
        runtimeMs
      },
      details: `Generated contour toolpath with ${verified.verificationReport.metrics.segmentCount} segments.`,
      evidencePacket: verified,
      evidenceHash: verified.verificationReport.provenanceHash
    };
  }

  // Case 03: Facing (Uses FACING)
  public static async runCase03(): Promise<CAMBenchmarkCaseResult> {
    const config = this.createBaseConfig('FACING');
    const stock = this.createStock();
    const { verified, runtimeMs } = await this.executeVerification(config, stock, 0);

    const verdict: CAMBenchmarkVerdict = verified.verificationReport.isValid ? 'PASS' : 'FAIL';
    
    return {
      caseId: 'BENCH-CAM-03',
      caseName: 'Facing Operation',
      category: 'TOOLPATH_GENERATION',
      verdict,
      metrics: {
        segmentCount: verified.verificationReport.metrics.segmentCount,
        totalLengthMm: verified.verificationReport.metrics.totalLengthMm,
        runtimeMs
      },
      details: `Generated facing toolpath. Points: ${verified.verificationReport.metrics.segmentCount}`,
      evidencePacket: verified,
      evidenceHash: verified.verificationReport.provenanceHash
    };
  }

  // Case 04: Drilling (Not implemented, expect NOT_SUPPORTED)
  public static async runCase04(): Promise<CAMBenchmarkCaseResult> {
    return {
      caseId: 'BENCH-CAM-04', caseName: 'Drilling Operation', category: 'TOOLPATH_GENERATION',
      verdict: 'NOT_SUPPORTED', metrics: {}, details: 'Drilling cycle engine is missing or not fully integrated into standard execution.',
      evidencePacket: {}, evidenceHash: 'NA'
    };
  }

  // Case 05: Stock Removal Simulation
  public static async runCase05(): Promise<CAMBenchmarkCaseResult> {
    return {
      caseId: 'BENCH-CAM-05', caseName: 'Stock Removal Simulation', category: 'MATERIAL_SIMULATION',
      verdict: 'NOT_SUPPORTED', metrics: {}, details: 'Full volumetric stock removal simulation not implemented.',
      evidencePacket: {}, evidenceHash: 'NA'
    };
  }

  // Case 06: Tool Collision Detection
  public static async runCase06(): Promise<CAMBenchmarkCaseResult> {
    return {
      caseId: 'BENCH-CAM-06', caseName: 'Tool Collision Detection', category: 'COLLISION',
      verdict: 'UNPROVEN', metrics: {}, details: 'Basic verification checks stock bounds, but detailed machine/holder 3D collision is unproven.',
      evidencePacket: {}, evidenceHash: 'NA'
    };
  }

  // Case 07: Gouge Detection (Part Gouge)
  public static async runCase07(): Promise<CAMBenchmarkCaseResult> {
    const config = this.createBaseConfig('CONTOUR_PROFILE');
    config.parameters.stepdownMm = 30; // Z will go to stock.zMax (20) - 30 = -10, part floor is 0
    const stock = this.createStock();
    const { verified, runtimeMs } = await this.executeVerification(config, stock, 0);

    const hasGouge = verified.verificationReport.issues.some(i => i.issueType === 'GOUGE_PART');
    const verdict: CAMBenchmarkVerdict = hasGouge ? 'PASS' : 'FAIL';

    return {
      caseId: 'BENCH-CAM-07', caseName: 'Gouge Detection', category: 'COLLISION',
      verdict, metrics: { runtimeMs, invalidSegments: verified.verificationReport.issues.length },
      details: `Detected gouge: ${hasGouge}. Toolpath generated below part floor.`,
      evidencePacket: verified, evidenceHash: verified.verificationReport.provenanceHash
    };
  }

  // Case 08: Toolpath Continuity
  public static async runCase08(): Promise<CAMBenchmarkCaseResult> {
    const config = this.createBaseConfig('POCKET_MACHINING');
    const stock = this.createStock();
    const { verified, runtimeMs } = await this.executeVerification(config, stock, 0);

    const continuityGaps = verified.verificationReport.metrics.continuityGaps;
    const verdict: CAMBenchmarkVerdict = verified.verificationReport.isValid && continuityGaps === 0 ? 'PASS' : 'FAIL';

    return {
      caseId: 'BENCH-CAM-08', caseName: 'Toolpath Continuity', category: 'TOOLPATH_ANALYSIS',
      verdict, metrics: { runtimeMs, continuityGaps },
      details: `Continuity gaps: ${continuityGaps}`,
      evidencePacket: verified, evidenceHash: verified.verificationReport.provenanceHash
    };
  }

  // Case 09: 3-Axis Kinematics
  public static async runCase09(): Promise<CAMBenchmarkCaseResult> {
    return {
      caseId: 'BENCH-CAM-09', caseName: '3-Axis Kinematics', category: 'KINEMATICS',
      verdict: 'NOT_SUPPORTED', metrics: {}, details: 'Full 3-axis kinematics simulation (machine limits, acceleration) not executed.',
      evidencePacket: {}, evidenceHash: 'NA'
    };
  }

  // Case 10: 5-Axis Kinematics
  public static async runCase10(): Promise<CAMBenchmarkCaseResult> {
    return {
      caseId: 'BENCH-CAM-10', caseName: '5-Axis Kinematics', category: 'KINEMATICS',
      verdict: 'NOT_SUPPORTED', metrics: {}, details: '5-axis kinematics engine not implemented.',
      evidencePacket: {}, evidenceHash: 'NA'
    };
  }

  // Case 11: Inverse Kinematics
  public static async runCase11(): Promise<CAMBenchmarkCaseResult> {
    return {
      caseId: 'BENCH-CAM-11', caseName: 'Inverse Kinematics Verification', category: 'KINEMATICS',
      verdict: 'NOT_SUPPORTED', metrics: {}, details: 'Inverse kinematics not implemented.',
      evidencePacket: {}, evidenceHash: 'NA'
    };
  }

  // Case 12: Machine Limits
  public static async runCase12(): Promise<CAMBenchmarkCaseResult> {
    // Generate an operation WAY out of stock bounds
    const config = this.createBaseConfig('FACING');
    const stock = this.createStock();
    stock.bounds.xMax = 5000; // Large stock to generate toolpath
    const { verified, runtimeMs } = await this.executeVerification(config, stock, 0);

    // If verified checks against original machine bounds it would fail, but we only have stock limits.
    // For now, testing stock boundary violations.
    const hasLimitViolation = verified.verificationReport.metrics.stockViolations > 0;
    
    return {
      caseId: 'BENCH-CAM-12', caseName: 'Machine Limits Enforcement', category: 'KINEMATICS',
      verdict: 'UNPROVEN', metrics: { runtimeMs },
      details: 'Machine limit checking separate from stock bounds is unproven.',
      evidencePacket: verified, evidenceHash: verified.verificationReport.provenanceHash
    };
  }

  // Case 13: Post Processor
  public static async runCase13(): Promise<CAMBenchmarkCaseResult> {
    return {
      caseId: 'BENCH-CAM-13', caseName: 'Post Processor Execution', category: 'POST_PROCESSING',
      verdict: 'NOT_SUPPORTED', metrics: {}, details: 'G-code post processor not integrated into execution flow.',
      evidencePacket: {}, evidenceHash: 'NA'
    };
  }

  // Case 14: G-code Verification
  public static async runCase14(): Promise<CAMBenchmarkCaseResult> {
    return {
      caseId: 'BENCH-CAM-14', caseName: 'G-code Verification', category: 'POST_PROCESSING',
      verdict: 'NOT_SUPPORTED', metrics: {}, details: 'Independent G-code verifier not present.',
      evidencePacket: {}, evidenceHash: 'NA'
    };
  }

  // Case 15: Toolpath Determinism
  public static async runCase15(): Promise<CAMBenchmarkCaseResult> {
    const config = this.createBaseConfig('CONTOUR_PROFILE');
    const stock = this.createStock();
    const { verified: v1, runtimeMs: r1 } = await this.executeVerification(config, stock, 0);
    const { verified: v2, runtimeMs: r2 } = await this.executeVerification(config, stock, 0);

    const isDeterministic = v1.provenance.trajectoryHash === v2.provenance.trajectoryHash;
    const verdict: CAMBenchmarkVerdict = isDeterministic ? 'PASS' : 'FAIL';

    return {
      caseId: 'BENCH-CAM-15', caseName: 'Toolpath Determinism', category: 'DETERMINISM',
      verdict, metrics: { runtimeMs: r1 + r2 },
      details: `Generated identical toolpath hashes: ${isDeterministic} (${v1.provenance.trajectoryHash})`,
      evidencePacket: { h1: v1.provenance.trajectoryHash, h2: v2.provenance.trajectoryHash }, 
      evidenceHash: v1.provenance.trajectoryHash
    };
  }

  // Case 16: Parameter Sensitivity
  public static async runCase16(): Promise<CAMBenchmarkCaseResult> {
    const config1 = this.createBaseConfig('FACING');
    config1.parameters.stepoverMm = 5;
    const config2 = this.createBaseConfig('FACING');
    config2.parameters.stepoverMm = 10;
    
    const stock = this.createStock();
    const { verified: v1, runtimeMs: r1 } = await this.executeVerification(config1, stock, 0);
    const { verified: v2, runtimeMs: r2 } = await this.executeVerification(config2, stock, 0);

    const isSensitive = v1.verificationReport.metrics.totalLengthMm > v2.verificationReport.metrics.totalLengthMm && v1.verificationReport.metrics.segmentCount > v2.verificationReport.metrics.segmentCount;
    const verdict: CAMBenchmarkVerdict = isSensitive ? 'PASS' : 'FAIL';

    return {
      caseId: 'BENCH-CAM-16', caseName: 'Parameter Sensitivity', category: 'TOOLPATH_GENERATION',
      verdict, metrics: { runtimeMs: r1 + r2 },
      details: `Stepover 5mm length=${v1.verificationReport.metrics.totalLengthMm}, Stepover 10mm length=${v2.verificationReport.metrics.totalLengthMm}`,
      evidencePacket: { len1: v1.verificationReport.metrics.totalLengthMm, len2: v2.verificationReport.metrics.totalLengthMm }, 
      evidenceHash: v1.provenance.trajectoryHash
    };
  }

  // Case 17: Geometric Accuracy
  public static async runCase17(): Promise<CAMBenchmarkCaseResult> {
    return {
      caseId: 'BENCH-CAM-17', caseName: 'Geometric Accuracy', category: 'MATERIAL_SIMULATION',
      verdict: 'UNPROVEN', metrics: {}, details: 'No volumetric simulation to check geometric deviation.',
      evidencePacket: {}, evidenceHash: 'NA'
    };
  }

  // Case 18: Adversarial CAM
  public static async runCase18(): Promise<CAMBenchmarkCaseResult> {
    const config = this.createBaseConfig('CONTOUR_PROFILE');
    config.parameters.stepdownMm = NaN;
    
    const stock = this.createStock();
    const { verified, runtimeMs } = await this.executeVerification(config, stock, 0);

    const hasInvalidSegments = verified.verificationReport.metrics.invalidSegments > 0;
    // Expected behavior: verification should flag the segments
    const verdict: CAMBenchmarkVerdict = hasInvalidSegments && !verified.verificationReport.isValid ? 'PASS' : 'FAIL';

    return {
      caseId: 'BENCH-CAM-18', caseName: 'Adversarial CAM Rejection', category: 'ADVERSARIAL',
      verdict, metrics: { runtimeMs, invalidSegments: verified.verificationReport.metrics.invalidSegments },
      details: `Injected NaN stepdown. Invalid segments detected: ${hasInvalidSegments}`,
      evidencePacket: verified, evidenceHash: verified.verificationReport.provenanceHash
    };
  }

  // Case 19: CAM <-> CAD Integrity
  public static async runCase19(): Promise<CAMBenchmarkCaseResult> {
    const config = this.createBaseConfig('POCKET_MACHINING');
    const stock1 = this.createStock();
    const stock2 = this.createStock();
    stock2.bounds.xMax = 200; // Change geometry bounds
    
    const { verified: v1, runtimeMs: r1 } = await this.executeVerification(config, stock1, 0);
    const { verified: v2, runtimeMs: r2 } = await this.executeVerification(config, stock2, 0);

    const hashDiffers = v1.provenance.trajectoryHash !== v2.provenance.trajectoryHash;
    const verdict: CAMBenchmarkVerdict = hashDiffers ? 'PASS' : 'FAIL';

    return {
      caseId: 'BENCH-CAM-19', caseName: 'CAM CAD Integrity', category: 'INTEGRITY',
      verdict, metrics: { runtimeMs: r1 + r2 },
      details: `Toolpath updated with CAD changes: ${hashDiffers}`,
      evidencePacket: { h1: v1.provenance.trajectoryHash, h2: v2.provenance.trajectoryHash }, 
      evidenceHash: v1.provenance.trajectoryHash
    };
  }

  // Case 20: Manufacturing Evidence
  public static async runCase20(): Promise<CAMBenchmarkCaseResult> {
    const config = this.createBaseConfig('FACING');
    const stock = this.createStock();
    const { verified, runtimeMs } = await this.executeVerification(config, stock, 0);

    const hasEvidence = !!verified.verificationReport.provenanceHash && !!verified.provenance.trajectoryHash;
    const verdict: CAMBenchmarkVerdict = hasEvidence ? 'PASS' : 'FAIL';

    return {
      caseId: 'BENCH-CAM-20', caseName: 'Manufacturing Evidence Lineage', category: 'INTEGRITY',
      verdict, metrics: { runtimeMs },
      details: `Evidence generated: ${hasEvidence}. Provenance Hash: ${verified.verificationReport.provenanceHash}`,
      evidencePacket: verified, evidenceHash: verified.verificationReport.provenanceHash
    };
  }
}
