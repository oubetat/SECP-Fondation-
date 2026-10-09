import { AssemblyBenchmarkCaseRunner } from './AssemblyBenchmarkCase';
import { AssemblyBenchmarkGate } from './AssemblyBenchmarkGate';
import { AssemblyBenchmarkSuiteReport, AssemblyBenchmarkCaseResult } from './types';
import { generateDeterministicHash } from '../../../lib/hash';

export class AssemblyBenchmarkRunner {
  public static async runSuite(): Promise<AssemblyBenchmarkSuiteReport> {
    const caseResults: AssemblyBenchmarkCaseResult[] = [
      await AssemblyBenchmarkCaseRunner.runCase01(),
      await AssemblyBenchmarkCaseRunner.runCase02(),
      await AssemblyBenchmarkCaseRunner.runCase03(),
      await AssemblyBenchmarkCaseRunner.runCase04(),
      await AssemblyBenchmarkCaseRunner.runCase05(),
      await AssemblyBenchmarkCaseRunner.runCase06(),
      await AssemblyBenchmarkCaseRunner.runCase07(),
      await AssemblyBenchmarkCaseRunner.runCase08(),
      await AssemblyBenchmarkCaseRunner.runCase09(),
      await AssemblyBenchmarkCaseRunner.runCase10()
    ];

    const gateResult = await AssemblyBenchmarkGate.evaluateGate180(caseResults);

    const integrityHash = await generateDeterministicHash({
      cases: caseResults.map(c => c.evidenceHash),
      gate: gateResult.attestationSignature
    });

    return {
      timestamp: new Date().toISOString(),
      executionMode: 'VERIFICATION',
      engineVersion: 'SECP_ASSEMBLY_v1.0',
      caseResults,
      gateResult,
      integrityHash
    };
  }
}
