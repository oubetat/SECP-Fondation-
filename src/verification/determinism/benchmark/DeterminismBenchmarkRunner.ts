
import { DeterminismEvaluator } from '../../../engine/core/DeterminismEvaluator';
import { DeterminismLevel, DeterminismBoundary, DeterminismComparison } from '../../../engine/core/DeterminismContract';
import { DeterminismBenchmarkReport, ScenarioResult, RunResult, DeterminismVerdict } from './types';
import { ForensicCFDEvidenceEngine } from '../../../engine/cfd3d/solvers/forensic/ForensicCFDEvidenceEngine';
import { MerkleEvidenceTree } from '../../../engine/cfd3d/solvers/forensic/MerkleEvidenceTree';
import { EngineeringClock } from '../../../engine/clock/EngineeringClock';

export class DeterminismBenchmarkRunner {
  private static readonly BENCHMARK_VERSION = '1.0.0';

  public static async runBenchmark(): Promise<DeterminismBenchmarkReport> {
    console.log('[DETERMINISM-BENCHMARK] Initializing Global Qualification Battery...');
    
    const scenarios: ScenarioResult[] = [];

    // Scenario 1: Input Canonicalization
    scenarios.push(this.runInputDeterminismScenario());

    // Scenario 2: Evidence Generation (Forensic Engine)
    scenarios.push(this.runEvidenceDeterminismScenario());

    // Scenario 3: Numerical Accumulation (Floating Point)
    scenarios.push(this.runNumericalDeterminismScenario());

    // Scenario 4: Ordering Impact
    scenarios.push(this.runOrderingDeterminismScenario());

    // Scenario 5: Merkle Tree Replay
    scenarios.push(this.runMerkleReplayScenario());

    const report = this.compileReport(scenarios);
    return report;
  }

  private static runInputDeterminismScenario(): ScenarioResult {
    const scenarioId = 'SCEN-DET-001';
    const input = {
      z: 3,
      a: 1,
      m: {
        y: 2,
        x: 1
      },
      arr: [10, 20, 30]
    };

    const canonicalInputHash = DeterminismEvaluator.hash(input);
    const runResults: RunResult[] = [];

    for (let i = 0; i < 3; i++) {
      runResults.push({
        runId: `run-${i}`,
        timestamp: new Date().toISOString(),
        outputHash: DeterminismEvaluator.hash(input),
        evidenceHash: 'NA',
        resultData: input
      });
    }

    const allMatch = runResults.every(r => r.outputHash === runResults[0].outputHash);

    return {
      scenarioId,
      category: 'INPUT',
      inputHash: 'DIRECT_OBJECT',
      canonicalInputHash,
      engineVersion: '2.0.0',
      environmentFingerprint: 'NODEJS_VITE',
      runResults,
      determinismStatus: allMatch ? 'DETERMINISTIC' : 'NON_DETERMINISTIC'
    };
  }

  private static runEvidenceDeterminismScenario(): ScenarioResult {
    const scenarioId = 'SCEN-DET-002';
    
    const runResults: RunResult[] = [];
    
    // Freeze time for determinism
    EngineeringClock.setFrozenTime(1724422400000); // 2024-08-23T14:13:20Z

    for (let i = 0; i < 3; i++) {
      // Re-initialize engine each run to see if it produces same IDs/Timestamps
      const localEngine = new ForensicCFDEvidenceEngine();
      localEngine.registry.registerArtifact({
        type: 'MESH',
        pathOrRef: 'mesh.msh',
        payload: { nodes: 1000, cells: 2000 },
        producer: 'BENCHMARK',
        producerVersion: '1.0.0'
      });
      
      const incident = localEngine.recordIncident({
        caseId: 'CASE-01',
        evidenceId: 'EV-01',
        category: 'UNIT_TEST',
        severity: 'INFO',
        expected: '100',
        observed: '100',
        affectedArtifacts: ['ART-001'],
        hashes: {},
        provenanceChain: [],
        reproductionNotes: 'Test'
      });

      const output = localEngine.getIncidents();
      const outputHash = DeterminismEvaluator.hash(output);

      runResults.push({
        runId: `run-${i}`,
        timestamp: new Date().toISOString(),
        outputHash,
        evidenceHash: outputHash,
        resultData: JSON.parse(JSON.stringify(output))
      });
    }

    EngineeringClock.clearFrozenTime();

    const firstHash = runResults[0].outputHash;
    const allMatch = runResults.every(r => r.outputHash === firstHash);
    
    let failureSource: string | undefined;
    if (!allMatch) {
      // Identify differences
      const diffs = DeterminismEvaluator.compare(runResults[0].resultData, runResults[1].resultData);
      failureSource = diffs.differences.join('; ');
    }

    return {
      scenarioId,
      category: 'EVIDENCE',
      inputHash: 'FIXED_INCIDENT_PARAMS',
      canonicalInputHash: 'NA',
      engineVersion: '2.0.0',
      environmentFingerprint: 'NODEJS_VITE',
      runResults,
      determinismStatus: allMatch ? 'DETERMINISTIC' : 'NON_DETERMINISTIC',
      failureSource,
      structuralDifference: !allMatch ? ['Evidence IDs contain Date.now()', 'Timestamps contain new Date()'] : []
    };
  }

  private static runNumericalDeterminismScenario(): ScenarioResult {
    const scenarioId = 'SCEN-DET-003';
    
    // Test floating point accumulation order
    const values = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    
    const sum1 = values.reduce((a, b) => a + b, 0);
    const sum2 = [...values].reverse().reduce((a, b) => a + b, 0);
    
    const runResults: RunResult[] = [];
    runResults.push({ runId: 'ORDER_A', timestamp: new Date().toISOString(), outputHash: sum1.toString(), evidenceHash: 'NA', resultData: sum1 });
    runResults.push({ runId: 'ORDER_B', timestamp: new Date().toISOString(), outputHash: sum2.toString(), evidenceHash: 'NA', resultData: sum2 });

    const diff = Math.abs(sum1 - sum2);
    const tolerance = 1e-15;
    const status: DeterminismVerdict = sum1 === sum2 ? 'DETERMINISTIC' : (diff <= tolerance ? 'DETERMINISTIC_WITHIN_TOLERANCE' : 'NON_DETERMINISTIC');

    return {
      scenarioId,
      category: 'NUMERICAL',
      inputHash: 'NUMERIC_ARRAY',
      canonicalInputHash: 'NA',
      engineVersion: '2.0.0',
      environmentFingerprint: 'IEEE-754',
      runResults,
      determinismStatus: status,
      numericalDifference: diff
    };
  }

  private static runOrderingDeterminismScenario(): ScenarioResult {
    const scenarioId = 'SCEN-DET-004';
    
    const runResults: RunResult[] = [];
    
    const executeWithOrder = (keys: string[]) => {
      const obj: any = {};
      for (const k of keys) {
        obj[k] = k.length;
      }
      return DeterminismEvaluator.canonicalize(obj);
    };

    const out1 = executeWithOrder(['a', 'b', 'c']);
    const out2 = executeWithOrder(['c', 'b', 'a']);

    runResults.push({ runId: 'ASC', timestamp: new Date().toISOString(), outputHash: DeterminismEvaluator.hash(out1), evidenceHash: 'NA', resultData: out1 });
    runResults.push({ runId: 'DESC', timestamp: new Date().toISOString(), outputHash: DeterminismEvaluator.hash(out2), evidenceHash: 'NA', resultData: out2 });

    const allMatch = runResults[0].outputHash === runResults[1].outputHash;

    return {
      scenarioId,
      category: 'ORDERING',
      inputHash: 'KEYS_ABC_VS_CBA',
      canonicalInputHash: 'NA',
      engineVersion: '2.0.0',
      environmentFingerprint: 'V8_OBJECT_ITERATION',
      runResults,
      determinismStatus: allMatch ? 'DETERMINISTIC' : 'NON_DETERMINISTIC',
      failureSource: allMatch ? undefined : 'Object property insertion order affected iteration (if canonicalizer failed)'
    };
  }

  private static runMerkleReplayScenario(): ScenarioResult {
    const scenarioId = 'SCEN-DET-005';
    const leafHashes = ['h1', 'h2', 'h3', 'h4'];
    
    const tree1 = new MerkleEvidenceTree(leafHashes);
    const hash1 = tree1.getRootHash();

    const tree2 = new MerkleEvidenceTree([...leafHashes]);
    const hash2 = tree2.getRootHash();

    const runResults: RunResult[] = [];
    runResults.push({ runId: 'REPLAY_1', timestamp: new Date().toISOString(), outputHash: hash1, evidenceHash: hash1, resultData: hash1 });
    runResults.push({ runId: 'REPLAY_2', timestamp: new Date().toISOString(), outputHash: hash2, evidenceHash: hash2, resultData: hash2 });

    const allMatch = hash1 === hash2;

    return {
      scenarioId,
      category: 'REPLAY',
      inputHash: DeterminismEvaluator.hash(leafHashes),
      canonicalInputHash: DeterminismEvaluator.hash(leafHashes),
      engineVersion: '2.0.0',
      environmentFingerprint: 'CRYPTO_SHA256',
      runResults,
      determinismStatus: allMatch ? 'DETERMINISTIC' : 'REPLAY_MISMATCH'
    };
  }

  private static compileReport(scenarios: ScenarioResult[]): DeterminismBenchmarkReport {
    const statusCounts = {
      total: scenarios.length,
      det: scenarios.filter(s => s.determinismStatus === 'DETERMINISTIC').length,
      rep: scenarios.filter(s => s.determinismStatus === 'DETERMINISTIC_WITHIN_TOLERANCE').length,
      non: scenarios.filter(s => s.determinismStatus === 'NON_DETERMINISTIC' || s.determinismStatus === 'REPLAY_MISMATCH').length,
      unp: scenarios.filter(s => s.determinismStatus === 'UNPROVEN').length
    };

    let finalVerdict: DeterminismVerdict = 'DETERMINISTIC';
    if (statusCounts.non > 0) finalVerdict = 'NON_DETERMINISTIC';
    else if (statusCounts.rep > 0) finalVerdict = 'DETERMINISTIC_WITHIN_TOLERANCE';
    else if (statusCounts.unp > 0) finalVerdict = 'UNPROVEN';

    return {
      timestamp: new Date().toISOString(),
      benchmarkVersion: this.BENCHMARK_VERSION,
      executiveVerdict: finalVerdict,
      scenarios,
      summary: {
        totalScenarios: statusCounts.total,
        deterministicCount: statusCounts.det,
        reproducibleCount: statusCounts.rep,
        nonDeterministicCount: statusCounts.non,
        unprovenCount: statusCounts.unp
      }
    };
  }
}
