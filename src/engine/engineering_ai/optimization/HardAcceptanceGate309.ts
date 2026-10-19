import { AIOptimizationService } from './AIOptimizationService';
import { EngineeringOptimizationProblem } from './AIOptimizationTypes309';

export interface AssertionResult309 {
  id: number;
  description: string;
  passed: boolean;
  message: string;
}

export interface HardAcceptanceGate309Report {
  gateId: string;
  totalAssertions: number;
  passedCount: number;
  failedCount: number;
  successRatePercent: number;
  assertions: AssertionResult309[];
}

export class HardAcceptanceGate309 {
  public static async runGate(): Promise<HardAcceptanceGate309Report> {
    const assertions: AssertionResult309[] = [];
    let idCounter = 1;

    const addAssertion = (desc: string, passed: boolean, msg: string) => {
      assertions.push({ id: idCounter++, description: desc, passed, message: msg });
    };

    const service = new AIOptimizationService();
    const problem: EngineeringOptimizationProblem = {
      problemId: 'TEST-309',
      title: 'Mass Reduction',
      description: 'Reducing mass of motor mount',
      variables: [
        { name: 'depthMm', min: 1, max: 20 },
        { name: 'holeCount', min: 2, max: 10 }
      ],
      stoppingCriteria: { maxIterations: 5 },
      constraints: []
    } as any;
    const session = service.createSession('TEST_PROJ', 'REV_A', problem, { strategy: 'BAYESIAN_OPTIMIZATION' });

    // 1. Check Session
    addAssertion('Session creation', Boolean(session.sessionId), `Session: ${session.sessionId}`);

    // 2. Perform optimization step
    const { candidate, evaluation } = service.stepOptimization(session);
    addAssertion('Optimization step execution', Boolean(candidate && evaluation), `Step ${session.currentIteration} executed`);
    addAssertion('Candidate feasibility', ['VALIDATED', 'PARETO'].includes(candidate.status), `Candidate status: ${candidate.status}`);
    addAssertion('Metrics generated', Object.keys(candidate.metrics).length > 0, `Generated ${Object.keys(candidate.metrics).length} metrics`);

    // 3. Promote candidate
    const promotion = service.selectCandidateAndPromote(session, candidate.candidateId);
    addAssertion('Candidate promotion', Boolean(promotion.candidate), 'Candidate promoted');
    addAssertion('Evidence generation', Boolean(promotion.evidence.evidenceToken), 'Evidence token generated');

    const passedCount = assertions.filter(a => a.passed).length;
    return {
      gateId: 'HAG-309',
      totalAssertions: assertions.length,
      passedCount,
      failedCount: assertions.length - passedCount,
      successRatePercent: (passedCount / assertions.length) * 100,
      assertions
    };
  }
}
