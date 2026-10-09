import { CAMBenchmarkCaseRunner } from './CAMBenchmarkCase';
import { CAMBenchmarkGate } from './CAMBenchmarkGate';
import { CAMBenchmarkSuiteReport, CAMBenchmarkCaseResult } from './types';
import { generateDeterministicHash } from '../../../lib/hash';

export class CAMBenchmarkRunner {
  public static async runSuite(): Promise<CAMBenchmarkSuiteReport> {
    const caseResults: CAMBenchmarkCaseResult[] = [
      await CAMBenchmarkCaseRunner.runCase01(),
      await CAMBenchmarkCaseRunner.runCase02(),
      await CAMBenchmarkCaseRunner.runCase03(),
      await CAMBenchmarkCaseRunner.runCase04(),
      await CAMBenchmarkCaseRunner.runCase05(),
      await CAMBenchmarkCaseRunner.runCase06(),
      await CAMBenchmarkCaseRunner.runCase07(),
      await CAMBenchmarkCaseRunner.runCase08(),
      await CAMBenchmarkCaseRunner.runCase09(),
      await CAMBenchmarkCaseRunner.runCase10(),
      await CAMBenchmarkCaseRunner.runCase11(),
      await CAMBenchmarkCaseRunner.runCase12(),
      await CAMBenchmarkCaseRunner.runCase13(),
      await CAMBenchmarkCaseRunner.runCase14(),
      await CAMBenchmarkCaseRunner.runCase15(),
      await CAMBenchmarkCaseRunner.runCase16(),
      await CAMBenchmarkCaseRunner.runCase17(),
      await CAMBenchmarkCaseRunner.runCase18(),
      await CAMBenchmarkCaseRunner.runCase19(),
      await CAMBenchmarkCaseRunner.runCase20()
    ];

    const gateResult = await CAMBenchmarkGate.evaluateGate179(caseResults);

    const integrityHash = await generateDeterministicHash({
      cases: caseResults.map(c => c.evidenceHash),
      gate: gateResult.attestationSignature
    });

    return {
      timestamp: new Date().toISOString(),
      executionMode: 'VERIFICATION',
      engineVersion: 'SECP_CAM_v1.0',
      caseResults,
      gateResult,
      integrityHash
    };
  }
}
