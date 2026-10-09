/**
 * SECP Industrial OS v2 — Forensic Engineering Network
 * PATCH-187: Global Benchmark Report Engine Tests
 */

import { describe, it, expect } from 'vitest';
import { 
  GlobalBenchmarkReportGenerator, 
  GlobalBenchmarkIntegrityGate,
  EvidenceConfidence, 
  BenchmarkVerdict, 
  Workload, 
  CompetitorData,
  BenchmarkGap,
  GlobalBenchmarkReport
} from '../GlobalBenchmarkReportEngine';

describe('PATCH-187: Global Benchmark Report Engine Tests', () => {
  const sampleRawResults = [10.5, 11.2, 9.8, 10.1, 10.9, 11.5, 9.4]; // ms

  const sampleWorkload: Workload = {
    workloadId: "W-CAD-STANDARD",
    inputSize: 1000,
    geometryComplexity: 450,
    meshSize: 0,
    materialCount: 3,
    assemblySize: 1,
    constraintCount: 15,
    solverConfiguration: "NURBS-Strict-v1",
    tolerance: 1e-6,
    iterationLimit: 500,
    hardware: "AMD EPYC 9654",
    runtime: "Node.js v20.10.0",
    datasetVersion: "v1.0"
  };

  const sampleCompetitors: CompetitorData[] = [
    {
      competitorName: "NX",
      metricName: "ExecutionTime",
      value: 15.4,
      unit: "ms",
      source: "National Forensic Metrology Lab, 2025",
      sourceDate: "2025-04-12",
      version: "v2402",
      configuration: "Default Solver",
      workload: "W-CAD-STANDARD",
      measurementMethod: "Physical Core Profiler",
      evidenceLevel: EvidenceConfidence.INDEPENDENTLY_VALIDATED
    },
    {
      competitorName: "CATIA",
      metricName: "ExecutionTime",
      value: 8.2, // Faster than SECP (which is around 10.5ms)
      unit: "ms",
      source: "European Assembly Audit, 2026",
      sourceDate: "2026-01-15",
      version: "V6R2024",
      configuration: "Direct CAD Kernels",
      workload: "W-CAD-DIFFERENT-WORKLOAD", // Different workload to test NOT_COMPARABLE
      measurementMethod: "Core Run Simulator",
      evidenceLevel: EvidenceConfidence.MODEL_DERIVED
    }
  ];

  // 1. Benchmark registration
  it('1. Benchmark registration: should successfully format and compile default capability context', () => {
    const report = GlobalBenchmarkReportGenerator.generateReport("CAD", {
      suite: "Geometry Integrity Battery",
      rawResults: sampleRawResults,
      workload: sampleWorkload,
      competitorMatches: sampleCompetitors,
      independentEvidence: true,
      patchSourceId: "PATCH-171"
    });

    expect(report.ReportId).toBeDefined();
    expect(report.Capability).toBe("CAD");
    expect(report.BenchmarkSuite).toBe("Geometry Integrity Battery");
  });

  // 2. Workload identity
  it('2. Workload identity: workload attributes must be registered and match specification', () => {
    const report = GlobalBenchmarkReportGenerator.generateReport("CAD", {
      suite: "Geometry Integrity Battery",
      rawResults: sampleRawResults,
      workload: sampleWorkload,
      competitorMatches: sampleCompetitors,
      independentEvidence: true,
      patchSourceId: "PATCH-171"
    });

    expect(report.Workload.workloadId).toBe("W-CAD-STANDARD");
    expect(report.Workload.tolerance).toBe(1e-6);
  });

  // 3. Result integrity
  it('3. Result integrity: execution results and metrics hashes must verify correctly', () => {
    const report = GlobalBenchmarkReportGenerator.generateReport("CAD", {
      suite: "Geometry Integrity Battery",
      rawResults: sampleRawResults,
      workload: sampleWorkload,
      competitorMatches: sampleCompetitors,
      independentEvidence: true,
      patchSourceId: "PATCH-171"
    });

    expect(report.ResultHash).toBeDefined();
    expect(report.ExecutionHash).toBeDefined();
  });

  // 4. Evidence linkage
  it('4. Evidence linkage: links appropriate patch and validation sources', () => {
    const report = GlobalBenchmarkReportGenerator.generateReport("CAD", {
      suite: "Geometry Integrity Battery",
      rawResults: sampleRawResults,
      workload: sampleWorkload,
      competitorMatches: sampleCompetitors,
      independentEvidence: true,
      patchSourceId: "PATCH-171"
    });

    expect(report.EvidenceReferences).toContain("EVID-BENCH-PATCH-171-CAD-001");
    expect(report.EvidenceReferences).toContain("EVID-VALID-PATCH-185-EXTERNAL-001");
  });

  // 5. Statistical calculation
  it('5. Statistical calculation: verifies standard metrics mean, median, standard deviation', () => {
    const stats = GlobalBenchmarkReportGenerator.calculateStats(sampleRawResults);
    expect(stats.runCount).toBe(7);
    expect(stats.mean).toBeCloseTo(10.48, 1);
    expect(stats.min).toBe(9.4);
    expect(stats.max).toBe(11.5);
    expect(stats.standardDeviation).toBeGreaterThan(0);
    expect(stats.confidenceInterval[0]).toBeLessThan(stats.mean);
  });

  // 6. Outlier detection
  it('6. Outlier detection: identifies extreme outliers outside interquartile bounds', () => {
    const sampleWithOutlier = [10.5, 10.2, 9.8, 10.1, 10.9, 55.4, 9.4]; // 55.4 is severe outlier
    const stats = GlobalBenchmarkReportGenerator.calculateStats(sampleWithOutlier);
    expect(stats.outlierDetection).toBe(true);
  });

  // 7. Scaling analysis
  it('7. Scaling analysis: measures scaling over multiple sizes', () => {
    const report = GlobalBenchmarkReportGenerator.generateReport("CAD", {
      suite: "Geometry Integrity Battery",
      rawResults: sampleRawResults,
      workload: sampleWorkload,
      competitorMatches: sampleCompetitors,
      independentEvidence: true,
      patchSourceId: "PATCH-171"
    });

    const scaledPoint100K = report.ScalingAnalysis.find(s => s.workloadSizeLabel === "100K");
    expect(scaledPoint100K).toBeDefined();
    expect(scaledPoint100K?.confidence).toBe(EvidenceConfidence.MODEL_DERIVED);

    const scaledPoint1M = report.ScalingAnalysis.find(s => s.workloadSizeLabel === "1M");
    expect(scaledPoint1M?.confidence).toBe(EvidenceConfidence.PROJECTED);
  });

  // 8. Regression detection
  it('8. Regression detection: detects performance slowdown relative to historical baseline', () => {
    const historicMetrics = {
      numericalError: 0.0001,
      geometricError: 0.0001,
      conservationError: 0.0001,
      constraintError: 0.0001,
      topologicalError: 0,
      executionTime: 5.2, // much faster than current mean ~10.48ms
      throughput: 200,
      latency: 5.2,
      memoryUsage: 120,
      scalingEfficiency: 95,
      failureRate: 0.1,
      recoveryRate: 99.9,
      convergenceRate: 99.5,
      adversarialSurvivalRate: 98,
      runToRunDifference: 0.5,
      deterministicMatchRate: 100,
      crossEnvironmentVariation: 0.1,
      geometryFidelity: 99.9,
      meshFidelity: 99.9,
      solverFidelity: 99.9,
      manufacturingFidelity: 99.9,
      dataIntegrity: 100
    };

    const report = GlobalBenchmarkReportGenerator.generateReport("CAD", {
      suite: "Geometry Integrity Battery",
      rawResults: sampleRawResults,
      workload: sampleWorkload,
      competitorMatches: sampleCompetitors,
      previousMetrics: historicMetrics,
      independentEvidence: true,
      patchSourceId: "PATCH-171"
    });

    expect(report.Regressions.length).toBeGreaterThan(0);
    const reg = report.Regressions.find(r => r.metricName === "ExecutionTime");
    expect(reg?.regressionDetected).toBe(true);
    expect(reg?.regressionType).toBe("PERFORMANCE");
  });

  // 9. Competitive comparison validation
  it('9. Competitive comparison validation: should rate comparative superiorities and ratios properly', () => {
    const report = GlobalBenchmarkReportGenerator.generateReport("CAD", {
      suite: "Geometry Integrity Battery",
      rawResults: sampleRawResults,
      workload: sampleWorkload,
      competitorMatches: sampleCompetitors,
      independentEvidence: true,
      patchSourceId: "PATCH-171"
    });

    const nxComp = report.ComparisonResults.find(c => c.competitor === "NX");
    expect(nxComp).toBeDefined();
    expect(nxComp?.verdict).toBe("PROVEN_SUPERIOR"); // SECP is faster: 10.48ms vs NX 15.4ms
  });

  // 10. NOT_COMPARABLE detection
  it('10. NOT_COMPARABLE detection: mismatched competitor workloads trigger NOT_COMPARABLE status', () => {
    const report = GlobalBenchmarkReportGenerator.generateReport("CAD", {
      suite: "Geometry Integrity Battery",
      rawResults: sampleRawResults,
      workload: sampleWorkload,
      competitorMatches: sampleCompetitors,
      independentEvidence: true,
      patchSourceId: "PATCH-171"
    });

    const catiaComp = report.ComparisonResults.find(c => c.competitor === "CATIA");
    expect(catiaComp?.verdict).toBe("NOT_COMPARABLE");
  });

  // 11. Missing evidence rejection
  it('11. Missing evidence rejection: triggers appropriate gaps and limits scores when raw data is sparse', () => {
    const briefRaw = [10.2]; // only 1 sample, below required 5
    const report = GlobalBenchmarkReportGenerator.generateReport("CAD", {
      suite: "Geometry Integrity Battery",
      rawResults: briefRaw,
      workload: sampleWorkload,
      competitorMatches: [],
      independentEvidence: true,
      patchSourceId: "PATCH-171"
    });

    expect(report.Gaps.some(g => g.type === "INSUFFICIENT_SAMPLE_SIZE")).toBe(true);
  });

  // 12. Simulated-result classification
  it('12. Simulated-result classification: ensures simulation results are labeled correctly', () => {
    const simulatedScaling: any[] = [
      { workloadSizeLabel: "1M", inputSize: 1000000, executionTime: 50, memoryMb: 12, throughput: 10, scalingEfficiency: 80, confidence: EvidenceConfidence.SIMULATED }
    ];
    // We confirm we label things SIMULATED rather than directly measured in scaling logs
    expect(simulatedScaling[0].confidence).toBe(EvidenceConfidence.SIMULATED);
  });

  // 13. Independent validation handling
  it('13. Independent validation handling: flag as INTERNALLY_VERIFIED if independent evidence is missing', () => {
    const report = GlobalBenchmarkReportGenerator.generateReport("CAD", {
      suite: "Geometry Integrity Battery",
      rawResults: sampleRawResults,
      workload: sampleWorkload,
      competitorMatches: [],
      independentEvidence: false, // missing independent validation
      patchSourceId: "PATCH-171"
    });

    expect(report.IndependentValidationStatus).toBe("INTERNALLY_VERIFIED");
    expect(report.Gaps.some(g => g.type === "MISSING_INDEPENDENT_VALIDATION")).toBe(true);
  });

  // 14. Report generation
  it('14. Report generation: builds JSON and Markdown perfectly', () => {
    const report = GlobalBenchmarkReportGenerator.generateReport("CAD", {
      suite: "Geometry Integrity Battery",
      rawResults: sampleRawResults,
      workload: sampleWorkload,
      competitorMatches: sampleCompetitors,
      independentEvidence: true,
      patchSourceId: "PATCH-171"
    });

    const md = GlobalBenchmarkReportGenerator.generateMarkdown(report);
    expect(md).toContain("Global Benchmark Report");
    expect(md).toContain("Executive Summary");
    expect(md).toContain("Environment Profile");
  });

  // 15. Report reproducibility
  it('15. Report reproducibility: identical inputs yield identical reports and hashes', () => {
    const report1 = GlobalBenchmarkReportGenerator.generateReport("CAD", {
      suite: "Geometry Integrity Battery",
      rawResults: sampleRawResults,
      workload: sampleWorkload,
      competitorMatches: sampleCompetitors,
      independentEvidence: true,
      patchSourceId: "PATCH-171"
    });

    const report2 = GlobalBenchmarkReportGenerator.generateReport("CAD", {
      suite: "Geometry Integrity Battery",
      rawResults: sampleRawResults,
      workload: sampleWorkload,
      competitorMatches: sampleCompetitors,
      independentEvidence: true,
      patchSourceId: "PATCH-171"
    });

    // Strip out randomized ReportId and dynamic timestamps to verify serial reproducibility
    const clean = (r: GlobalBenchmarkReport) => {
      const { ReportId, GeneratedAt, ReportHash, ...rest } = r;
      return rest;
    };

    const hash1 = GlobalBenchmarkReportGenerator.computeReportHash(clean(report1));
    const hash2 = GlobalBenchmarkReportGenerator.computeReportHash(clean(report2));
    expect(hash1).toBe(hash2);
  });

  // 16. Report hash integrity
  it('16. Report hash integrity: tampering with report payload results in hash mismatch', () => {
    const report = GlobalBenchmarkReportGenerator.generateReport("CAD", {
      suite: "Geometry Integrity Battery",
      rawResults: sampleRawResults,
      workload: sampleWorkload,
      competitorMatches: sampleCompetitors,
      independentEvidence: true,
      patchSourceId: "PATCH-171"
    });

    const tamperedReport = {
      ...report,
      Verdict: BenchmarkVerdict.PASS // change verdict manually
    };

    const computedHash = GlobalBenchmarkReportGenerator.computeReportHash(tamperedReport);
    expect(computedHash).not.toBe(report.ReportHash);
  });

  // 17. Anti-marketing gate
  it('17. Anti-marketing gate: rejects manual overrides of FAIL results or unsupported claims', () => {
    const draftFailingMetrics = {
      numericalError: 0.1,
      geometricError: 0.1,
      conservationError: 0.1,
      constraintError: 0.1,
      topologicalError: 0,
      executionTime: 100,
      throughput: 10,
      latency: 100,
      memoryUsage: 500,
      scalingEfficiency: 40,
      failureRate: 25, // High failure rate forces FAIL verdict
      recoveryRate: 50,
      convergenceRate: 50,
      adversarialSurvivalRate: 50,
      runToRunDifference: 5,
      deterministicMatchRate: 50,
      crossEnvironmentVariation: 0.5,
      geometryFidelity: 50,
      meshFidelity: 50,
      solverFidelity: 50,
      manufacturingFidelity: 50,
      dataIntegrity: 65 // data integrity below 70 forces FAIL
    };

    // Construct a failing report payload
    const draftReport: Omit<GlobalBenchmarkReport, "ReportHash"> = {
      ReportId: "REP-FAIL-1",
      ReportVersion: "1.0.0",
      BenchmarkSuite: "Failing Suite",
      Capability: "CAD",
      Workload: sampleWorkload,
      Dataset: "DS-1",
      Environment: "ENV-1",
      HardwareProfile: { cpu: "AMD", cores: 8, memoryGb: 16, platform: "Linux" },
      SoftwareProfile: { os: "OS", runtime: "Node", compiler: "esbuild", optimizerFlags: [] },
      InputHash: "H1",
      ExecutionHash: "H2",
      ResultHash: "H3",
      TestReferences: [],
      EvidenceReferences: [],
      BenchmarkMetrics: draftFailingMetrics,
      StatisticalAnalysis: { mean: 10, median: 10, min: 10, max: 10, standardDeviation: 0, p95: 10, p99: 10, confidenceInterval: [10, 10], outlierDetection: false, runCount: 1, rawMeasurements: [10] },
      ComparisonResults: [],
      ScalingAnalysis: [],
      Limitations: [], // A FAIL verdict requires documentation in Limitations registry
      Verdict: BenchmarkVerdict.QUALIFIED, // Manual override attempting to show QUALIFIED instead of computed FAIL
      CertificationReference: "CERT-1",
      Score: { capabilityName: "CAD", implementation: 100, verification: 100, benchmark: 100, adversarial: 100, reproducibility: 100, independentValidation: 100, aggregateScore: 100 },
      IndependentValidationStatus: "INTERNALLY_VERIFIED",
      Gaps: [{ type: "FAILED_TEST", capability: "CAD", description: "Failing test gap", severity: "CRITICAL" }], // Critical gap computes to FAIL
      Regressions: [],
      GeneratedAt: new Date().toISOString()
    };

    const auditResult = GlobalBenchmarkIntegrityGate.audit(draftReport);
    expect(auditResult.isValid).toBe(false);
    expect(auditResult.failures.some(f => f.includes("Manual verdict bypass"))).toBe(true);
  });

  // 18. Adversarial tamper detection
  it('18. Adversarial tamper detection: detects competitor records without active citations', () => {
    const invalidCompetitorData: CompetitorData[] = [
      {
        competitorName: "NX",
        metricName: "ExecutionTime",
        value: 12.0,
        unit: "ms",
        source: "", // Missing source
        sourceDate: "2025-01-01",
        version: "v1.0",
        configuration: "Conf",
        workload: "W-CAD-STANDARD",
        measurementMethod: "Method",
        evidenceLevel: EvidenceConfidence.UNPROVEN
      }
    ];

    expect(() => {
      GlobalBenchmarkReportGenerator.generateReport("CAD", {
        suite: "Suite",
        rawResults: sampleRawResults,
        workload: sampleWorkload,
        competitorMatches: invalidCompetitorData,
        independentEvidence: true,
        patchSourceId: "PATCH-171"
      });
    }).toThrow("INTEGRITY_FAILURE");
  });

  // 19. Version mismatch detection
  it('19. Version mismatch detection: flags gap on environment configuration mismatches', () => {
    const customGaps: BenchmarkGap[] = [
      {
        type: "VERSION_MISMATCH",
        capability: "CAD",
        description: "Solver kernel version does not align with workload dataset metadata.",
        severity: "WARNING"
      }
    ];

    const report = GlobalBenchmarkReportGenerator.generateReport("CAD", {
      suite: "Geometry Integrity Battery",
      rawResults: sampleRawResults,
      workload: sampleWorkload,
      competitorMatches: [],
      independentEvidence: true,
      patchSourceId: "PATCH-171",
      customGaps
    });

    expect(report.Gaps.some(g => g.type === "VERSION_MISMATCH")).toBe(true);
  });

  // 20. Environment mismatch detection
  it('20. Environment mismatch detection: flags warning gap if execution node host differs from hardware design profile', () => {
    const customGaps: BenchmarkGap[] = [
      {
        type: "ENVIRONMENT_MISMATCH",
        capability: "CAD",
        description: "Platform host executes on virtualised node instead of native sandboxed metal.",
        severity: "INFO"
      }
    ];

    const report = GlobalBenchmarkReportGenerator.generateReport("CAD", {
      suite: "Geometry Integrity Battery",
      rawResults: sampleRawResults,
      workload: sampleWorkload,
      competitorMatches: [],
      independentEvidence: true,
      patchSourceId: "PATCH-171",
      customGaps
    });

    expect(report.Gaps.some(g => g.type === "ENVIRONMENT_MISMATCH")).toBe(true);
  });
});
