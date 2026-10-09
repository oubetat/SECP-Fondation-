import { AssemblyBenchmarkCaseResult, AssemblyBenchmarkGateResult, AssemblyBenchmarkVerdict } from './types';
import { generateDeterministicHash } from '../../../lib/hash';

export class AssemblyBenchmarkGate {
  public static async evaluateGate180(caseResults: AssemblyBenchmarkCaseResult[]): Promise<AssemblyBenchmarkGateResult> {
    const criteriaResults = [];
    let score = 0;
    let hasFail = false;
    let hasPass = false;
    
    for (const res of caseResults) {
      if (res.verdict === 'PASS') hasPass = true;
      if (res.verdict === 'FAIL') hasFail = true;
      
      const scoreAdd = res.verdict === 'PASS' ? 10 : (res.verdict === 'UNPROVEN' || res.verdict === 'NOT_SUPPORTED' ? 2 : 0);
      score += scoreAdd;

      criteriaResults.push({
        id: `CRIT-180-${res.caseId}`,
        name: res.caseName,
        passed: res.verdict === 'PASS' || res.verdict === 'UNPROVEN' || res.verdict === 'NOT_SUPPORTED',
        verdict: res.verdict,
        score: scoreAdd,
        details: res.details
      });
    }

    const totalCriteria = caseResults.length;
    const finalScore = (score / (totalCriteria * 10)) * 100;
    
    let finalVerdict: AssemblyBenchmarkVerdict = 'PASS';
    if (hasFail && hasPass) {
      finalVerdict = 'PARTIAL';
    } else if (hasFail && !hasPass) {
      finalVerdict = 'FAIL';
    } else if (!hasFail && !hasPass) {
      finalVerdict = 'UNPROVEN';
    }

    const attestationPayload = `${finalVerdict}|${finalScore}|${caseResults.length}|${new Date().toISOString()}`;
    const attestationSignature = `ATTEST-GATE180-${await generateDeterministicHash({ payload: attestationPayload })}`.substring(0, 24);

    return {
      gateId: 'PATCH180_ASSEMBLY_BENCHMARK_GATE',
      passed: finalVerdict === 'PASS' || finalVerdict === 'PARTIAL',
      score: finalScore,
      finalVerdict,
      criteriaResults,
      attestationSignature,
      timestamp: new Date().toISOString()
    };
  }
}
