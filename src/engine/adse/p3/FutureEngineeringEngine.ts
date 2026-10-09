/**
 * SECP — ADSE-P3 Future Engineering & Scenario Engine
 * Establishes the foundational contracts for Future Engineering / Engineering Time Machine.
 *
 * Core Principle:
 * «SECP does not predict the future as fact. It constructs explicit engineering futures
 * and evaluates what becomes possible under their assumptions.»
 *
 * Invariant:
 * Future Scenario ≠ Engineering Fact.
 * Future Scenarios MUST remain strictly isolated from Current Canonical State.
 */

import { 
  FutureScenario, 
  FutureAssumptionSet, 
  FutureScenarioType, 
  CandidateArchitecture 
} from './types';
import { createHash } from 'crypto';

export class FutureEngineeringEngine {
  public static readonly FOUNDATIONAL_CONTRACT: string = 
    'SECP does not predict the future as fact. SECP explores engineering futures as hypothesis spaces.';

  private assumptionSets: Map<string, FutureAssumptionSet> = new Map();
  private scenarios: Map<string, FutureScenario> = new Map();

  public registerAssumptionSet(assumptionSet: FutureAssumptionSet): FutureAssumptionSet {
    if (this.assumptionSets.has(assumptionSet.assumptionSetId)) {
      throw new Error(`FUTURE_ASSUMPTION_ERROR: Assumption set '${assumptionSet.assumptionSetId}' already exists.`);
    }

    this.assumptionSets.set(assumptionSet.assumptionSetId, assumptionSet);
    return assumptionSet;
  }

  public createFutureScenario(params: {
    scenarioId: string;
    title: string;
    scenarioType: FutureScenarioType;
    timeHorizonYears: number;
    technologyMaturity: string;
    assumptionSetId: string;
    candidateArchitectures?: CandidateArchitecture[];
    confidence?: number;
    uncertaintyLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'SPECULATIVE';
    configurationId: string;
  }): FutureScenario {
    if (this.scenarios.has(params.scenarioId)) {
      throw new Error(`FUTURE_SCENARIO_ERROR: Scenario '${params.scenarioId}' already exists.`);
    }

    const assumptionSet = this.assumptionSets.get(params.assumptionSetId);
    if (!assumptionSet) {
      throw new Error(`FUTURE_SCENARIO_ERROR: Referenced assumption set '${params.assumptionSetId}' not found.`);
    }

    const provenanceId = `PROV-SCENARIO-${createHash('sha256').update(params.scenarioId + params.title).digest('hex').substring(0, 12)}`;

    const scenario: FutureScenario = {
      scenarioId: params.scenarioId,
      title: params.title,
      scenarioType: params.scenarioType,
      timeHorizonYears: params.timeHorizonYears,
      technologyMaturity: params.technologyMaturity,
      assumptionSet,
      candidateArchitectures: params.candidateArchitectures || [],
      simulationState: 'UNSIMULATED',
      verificationState: 'UNVERIFIED',
      confidence: params.confidence ?? 0.5,
      uncertaintyLevel: params.uncertaintyLevel || 'MEDIUM',
      isIsolatedFromCanonical: true, // Strict Isolation Invariant
      provenanceId,
      configurationId: params.configurationId
    };

    this.scenarios.set(params.scenarioId, scenario);
    return scenario;
  }

  /**
   * Evaluates architectural feasibility of candidate architectures within this future scenario.
   */
  public evaluateScenarioFeasibility(scenarioId: string): {
    scenarioId: string;
    scenarioType: FutureScenarioType;
    totalCandidates: number;
    verifiedCandidates: number;
    feasible: boolean;
    uncertaintyRating: string;
  } {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) {
      throw new Error(`FUTURE_SCENARIO_ERROR: Scenario '${scenarioId}' not found.`);
    }

    const total = scenario.candidateArchitectures.length;
    const verified = scenario.candidateArchitectures.filter(c => c.verificationState === 'VERIFIED').length;

    scenario.simulationState = 'COMPLETED';
    scenario.verificationState = verified > 0 ? 'SCENARIO_VERIFIED' : 'UNVERIFIED';

    return {
      scenarioId,
      scenarioType: scenario.scenarioType,
      totalCandidates: total,
      verifiedCandidates: verified,
      feasible: verified > 0,
      uncertaintyRating: scenario.uncertaintyLevel
    };
  }

  /**
   * Promotes a future scenario candidate into current canonical truth.
   * STRICT GUARD: AI cannot promote future scenarios.
   * Must have Human Engineering Approval + Verification proof.
   */
  public promoteScenarioCandidate(params: {
    scenarioId: string;
    candidateId: string;
    authorizedBy: string;
    justification: string;
  }): CandidateArchitecture {
    const isAI = params.authorizedBy.toLowerCase().includes('ai') || 
                 params.authorizedBy.toLowerCase().includes('copilot') || 
                 params.authorizedBy.toLowerCase().includes('assistant');

    if (isAI) {
      throw new Error(`SCENARIO_ISOLATION_VIOLATION: AI actor '${params.authorizedBy}' cannot promote Future Scenario candidates to Canonical State.`);
    }

    const scenario = this.scenarios.get(params.scenarioId);
    if (!scenario) {
      throw new Error(`FUTURE_SCENARIO_ERROR: Scenario '${params.scenarioId}' not found.`);
    }

    const candidate = scenario.candidateArchitectures.find(c => c.candidateId === params.candidateId);
    if (!candidate) {
      throw new Error(`FUTURE_SCENARIO_ERROR: Candidate '${params.candidateId}' not found in scenario '${params.scenarioId}'.`);
    }

    if (candidate.verificationState !== 'VERIFIED') {
      throw new Error(`SCENARIO_ISOLATION_VIOLATION: Candidate '${params.candidateId}' has not passed verification. Cannot promote speculative future state.`);
    }

    candidate.isPromotedToCanonical = true;
    candidate.promotedRevisionId = `REV-PROMOTED-${params.scenarioId}-${candidate.candidateId}`;

    return candidate;
  }

  /**
   * Enforces zero cross-contamination between parallel future scenarios.
   */
  public validateScenarioIsolation(scenarioIdA: string, scenarioIdB: string): boolean {
    const scA = this.scenarios.get(scenarioIdA);
    const scB = this.scenarios.get(scenarioIdB);
    if (!scA || !scB) {
      throw new Error(`FUTURE_SCENARIO_ERROR: Scenario comparison requires valid scenario IDs.`);
    }

    if (scA.scenarioId === scB.scenarioId) return true;

    // Must have disjoint candidate instance spaces
    const candidateIdsA = new Set(scA.candidateArchitectures.map(c => c.candidateId));
    const overlap = scB.candidateArchitectures.filter(c => candidateIdsA.has(c.candidateId));
    if (overlap.length > 0) {
      throw new Error(`SCENARIO_ISOLATION_VIOLATION: Cross-scenario candidate leakage detected between '${scenarioIdA}' and '${scenarioIdB}'.`);
    }

    return true;
  }

  /**
   * Asserts that an assumption set represents purely hypothetical conditions and never canonical truth.
   */
  public assertHypothesisNotFact(assumptionSetId: string): { isHypothesis: boolean; status: string } {
    const assumptions = this.assumptionSets.get(assumptionSetId);
    if (!assumptions) {
      throw new Error(`FUTURE_ASSUMPTION_ERROR: Assumption set '${assumptionSetId}' not found.`);
    }

    return {
      isHypothesis: true,
      status: 'HYPOTHESIS_SPACE_ONLY'
    };
  }

  /**
   * Explicitly blocks direct modifications to the Canonical Engineering Core from inside a Future Scenario.
   */
  public guardCanonicalDirectMutation(callerContext: string): void {
    if (callerContext.includes('FUTURE_SCENARIO') || callerContext.includes('SCENARIO_EXPLORER')) {
      throw new Error(`FUTURE_MUTATION_RESTRICTED: Future Scenario context cannot directly mutate Canonical Model without SECP Core Promotion & RevisionEngine authorization.`);
    }
  }

  /**
   * Prevents self-certified evidence generation within speculative scenarios.
   */
  public guardSelfCertifiedEvidence(scenarioId: string, certifier: string): void {
    if (certifier.includes(scenarioId) || certifier.toLowerCase().includes('scenario_agent') || certifier.toLowerCase().includes('ai')) {
      throw new Error(`EVIDENCE_AUTHORITY_VIOLATION: Future scenario cannot self-certify its own verification evidence.`);
    }
  }

  public getScenario(scenarioId: string): FutureScenario | undefined {
    return this.scenarios.get(scenarioId);
  }

  public getAllScenarios(): FutureScenario[] {
    return Array.from(this.scenarios.values());
  }

  public getAssumptionSet(assumptionSetId: string): FutureAssumptionSet | undefined {
    return this.assumptionSets.get(assumptionSetId);
  }

  public getAllAssumptionSets(): FutureAssumptionSet[] {
    return Array.from(this.assumptionSets.values());
  }

  public clear(): void {
    this.assumptionSets.clear();
    this.scenarios.clear();
  }
}
