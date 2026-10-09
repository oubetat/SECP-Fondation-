/**
 * SECP Industrial OS — EPC-014: Proof Case Score Engine
 */

import { 
  ProofCaseScore, 
  ProofCaseDimensionScore, 
  ProofCaseScorePolicy, 
  ScoreDimensionId, 
  DimensionStatus, 
  ScoreBand,
  DimensionSubScore,
  ScoreExplanation
} from './ProofCaseScoreTypes';
import { ProofCaseProject } from '../ProofCaseTypes';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';

export class ProofCaseScoreEngine {
  /**
   * Calculates the overall Proof Case Score based on a project and policy.
   */
  public calculateScore(project: ProofCaseProject, policy: ProofCaseScorePolicy): ProofCaseScore {
    const dimensionScores: ProofCaseDimensionScore[] = [];
    const explanations: ScoreExplanation[] = [];
    let overallScore = 0;

    for (const dimensionId of Object.values(ScoreDimensionId)) {
      const weight = policy.weights[dimensionId] || 0;
      const dimScore = this.evaluateDimension(project, dimensionId, weight);
      dimensionScores.push(dimScore);
      overallScore += dimScore.weightedScore;
      
      explanations.push(this.generateExplanation(dimScore));
    }

    // Apply Critical Requirement Cap
    const criticalFailures = this.checkCriticalRequirements(project);
    if (criticalFailures.length > 0) {
      overallScore = Math.min(overallScore, policy.criticalRequirementCap);
    }

    const band = this.determineBand(overallScore, policy);

    const scoreResult: ProofCaseScore = {
      proofCaseId: project.caseId,
      overallScore: Number(overallScore.toFixed(2)),
      band,
      dimensionScores,
      criticalFailures,
      evidenceGaps: this.identifyEvidenceGaps(dimensionScores),
      verificationGaps: this.identifyVerificationGaps(dimensionScores),
      explanations,
      scoreVersion: '1.0.0',
      policyVersion: policy.version,
      timestamp: new Date().toISOString(),
      scoreHash: ''
    };

    // Calculate integrity hash of the score record
    scoreResult.scoreHash = EvidenceIntegrityService.computeHash({
      caseId: scoreResult.proofCaseId,
      overallScore: scoreResult.overallScore,
      dimensionScores: scoreResult.dimensionScores.map(d => ({ id: d.dimensionId, score: d.score })),
      criticalFailures: scoreResult.criticalFailures
    });

    return scoreResult;
  }

  private evaluateDimension(
    project: ProofCaseProject, 
    dimensionId: ScoreDimensionId, 
    weight: number
  ): ProofCaseDimensionScore {
    const subScores = this.calculateSubScores(project, dimensionId);
    
    // Each sub-score is 25% of the dimension total
    const score = (
      subScores.coverage * 0.25 + 
      subScores.execution * 0.25 + 
      subScores.verification * 0.25 + 
      subScores.evidence * 0.25
    );

    const weightedScore = (score * weight);

    return {
      dimensionId,
      name: dimensionId.replace(/_/g, ' '),
      weight,
      score: Number(score.toFixed(2)),
      weightedScore: Number(weightedScore.toFixed(2)),
      status: this.determineDimensionStatus(project, dimensionId),
      subScores,
      evidenceStatus: subScores.evidence > 80 ? 'COMPLETE' : subScores.evidence > 40 ? 'PARTIAL' : 'INCOMPLETE',
      limitations: [],
      evidenceReferences: this.gatherEvidenceRefs(project, dimensionId)
    };
  }

  private calculateSubScores(project: ProofCaseProject, dimensionId: ScoreDimensionId): DimensionSubScore {
    switch (dimensionId) {
      case ScoreDimensionId.REQUIREMENTS:
        return {
          coverage: project.requirements.length > 0 ? 100 : 0,
          execution: project.requirements.every(r => r.status === 'ACTIVE' || r.status === 'VERIFIED' || r.status === 'PASS') ? 100 : 50,
          verification: project.requirements.filter(r => r.status === 'VERIFIED' || r.status === 'PASS').length / (project.requirements.length || 1) * 100,
          evidence: project.evidence.filter(e => e.evidenceType === 'REQUIREMENT').length > 0 ? 100 : 0
        };

      case ScoreDimensionId.CAD:
        const cadModels = project.models.filter(m => m.modelType === 'CAD');
        return {
          coverage: cadModels.length > 0 ? 100 : 0,
          execution: cadModels.every(m => !!m.checksum) ? 100 : 50,
          verification: cadModels.every(m => m.metadata?.verified === true) ? 100 : 0,
          evidence: project.evidence.filter(e => e.evidenceType === 'CAD').length > 0 ? 100 : 0
        };

      case ScoreDimensionId.ASSEMBLY:
        const assemblyModels = project.models.filter(m => m.modelType === 'ASSEMBLY' || m.metadata?.type === 'ASSEMBLY');
        return {
          coverage: assemblyModels.length > 0 ? 100 : 0,
          execution: assemblyModels.length > 0 ? 100 : 0,
          verification: assemblyModels.every(m => m.metadata?.verified === true) ? 100 : 0,
          evidence: project.evidence.filter(e => e.evidenceType === 'ASSEMBLY').length > 0 ? 100 : 0
        };

      case ScoreDimensionId.PHYSICS:
        const hasPhysics = project.metadata?.physicsModel !== undefined || project.simulations.length > 0;
        return {
          coverage: hasPhysics ? 100 : 0,
          execution: hasPhysics ? 100 : 0,
          verification: project.metadata?.physicsVerified === true ? 100 : 0,
          evidence: project.evidence.filter(e => e.evidenceType === 'PHYSICS').length > 0 ? 100 : 0
        };

      case ScoreDimensionId.SIMULATION:
        return {
          coverage: project.simulations.length > 0 ? 100 : 0,
          execution: project.simulations.filter(s => s.status === 'COMPLETED').length / (project.simulations.length || 1) * 100,
          verification: project.simulations.every(s => !!s.resultHash) ? 100 : 50,
          evidence: project.evidence.filter(e => e.evidenceType === 'SIMULATION').length > 0 ? 100 : 0
        };

      case ScoreDimensionId.VERIFICATION:
        return {
          coverage: project.tests.length > 0 ? 100 : 0,
          execution: project.tests.filter(t => t.status === 'COMPLETED').length / (project.tests.length || 1) * 100,
          verification: project.tests.filter(t => t.result === 'PASS').length / (project.tests.length || 1) * 100,
          evidence: project.evidence.filter(e => e.evidenceType === 'TEST').length > 0 ? 100 : 0
        };

      case ScoreDimensionId.MANUFACTURING:
        return {
          coverage: project.manufacturing.length > 0 ? 100 : 0,
          execution: project.manufacturing.every(m => m.status === 'DEFINED' || m.status === 'COMPLETED') ? 100 : 50,
          verification: project.manufacturing.every(m => m.metadata?.inspected === true) ? 100 : 0,
          evidence: project.evidence.filter(e => e.evidenceType === 'MANUFACTURING').length > 0 ? 100 : 0
        };

      case ScoreDimensionId.PLM:
        const hasLifecycle = project.status !== 'DRAFT';
        return {
          coverage: hasLifecycle ? 100 : 0,
          execution: project.revision !== undefined ? 100 : 0,
          verification: project.metadata?.baselineVerified === true ? 100 : 0,
          evidence: project.evidence.filter(e => e.evidenceType === 'PLM' || e.evidenceType === 'BASELINE').length > 0 ? 100 : 0
        };

      case ScoreDimensionId.DIGITAL_THREAD:
        const hasTraceability = project.metadata?.traceabilityHash !== undefined;
        return {
          coverage: hasTraceability ? 100 : 0,
          execution: hasTraceability ? 100 : 0,
          verification: hasTraceability ? 100 : 0,
          evidence: hasTraceability ? 100 : 0
        };

      case ScoreDimensionId.PHYSICAL_VALIDATION:
        const physicalTests = project.tests.filter(t => t.testType === 'PHYSICAL' || t.metadata?.physical === true);
        return {
          coverage: physicalTests.length > 0 ? 100 : 0,
          execution: physicalTests.filter(t => t.status === 'COMPLETED').length / (physicalTests.length || 1) * 100,
          verification: physicalTests.filter(t => t.result === 'PASS').length / (physicalTests.length || 1) * 100,
          evidence: project.evidence.filter(e => e.evidenceType === 'PHYSICAL_TEST').length > 0 ? 100 : 0
        };

      default:
        return { coverage: 0, execution: 0, verification: 0, evidence: 0 };
    }
  }

  private determineDimensionStatus(project: ProofCaseProject, dimensionId: ScoreDimensionId): DimensionStatus {
    if (dimensionId === ScoreDimensionId.PHYSICAL_VALIDATION) {
      const physicalTests = project.tests.filter(t => t.testType === 'PHYSICAL' || t.metadata?.physical === true);
      if (physicalTests.length === 0) return DimensionStatus.NOT_ESTABLISHED;
    }

    // Applicability rules based on project metadata or domain if needed
    if (project.metadata?.notApplicableDimensions && Array.isArray(project.metadata.notApplicableDimensions)) {
      if (project.metadata.notApplicableDimensions.includes(dimensionId)) {
        return DimensionStatus.NOT_APPLICABLE;
      }
    }

    return DimensionStatus.REQUIRED;
  }

  private gatherEvidenceRefs(project: ProofCaseProject, dimensionId: ScoreDimensionId): string[] {
    return project.evidence
      .filter(e => e.evidenceType === dimensionId || e.metadata?.dimension === dimensionId)
      .map(e => e.evidenceId);
  }

  private checkCriticalRequirements(project: ProofCaseProject): string[] {
    const failures: string[] = [];
    for (const req of project.requirements) {
      if (req.metadata?.priority === 'CRITICAL' && req.status !== 'VERIFIED' && req.status !== 'PASS') {
        failures.push(`Critical Requirement Failed: ${req.requirementId}`);
      }
    }
    return failures;
  }

  private determineBand(score: number, policy: ProofCaseScorePolicy): ScoreBand {
    for (const [band, range] of Object.entries(policy.scoreBands)) {
      if (score >= range[0] && score <= range[1]) {
        return band as ScoreBand;
      }
    }
    return ScoreBand.INSUFFICIENT;
  }

  private identifyEvidenceGaps(dimensionScores: ProofCaseDimensionScore[]): string[] {
    return dimensionScores
      .filter(d => d.subScores.evidence < 50)
      .map(d => `Evidence gap in ${d.name}`);
  }

  private identifyVerificationGaps(dimensionScores: ProofCaseDimensionScore[]): string[] {
    return dimensionScores
      .filter(d => d.subScores.verification < 50)
      .map(d => `Verification gap in ${d.name}`);
  }

  private generateExplanation(dimScore: ProofCaseDimensionScore): ScoreExplanation {
    const strengths: string[] = [];
    const gaps: string[] = [];

    if (dimScore.subScores.coverage > 80) strengths.push('High coverage established');
    if (dimScore.subScores.verification > 80) strengths.push('Strong verification records');
    if (dimScore.subScores.evidence > 80) strengths.push('Complete evidence documentation');

    if (dimScore.subScores.coverage < 40) gaps.push('Insufficient coverage of requirements/features');
    if (dimScore.subScores.verification < 40) gaps.push('Lack of independent verification');
    if (dimScore.subScores.evidence < 40) gaps.push('Missing engineering evidence records');

    return {
      dimensionId: dimScore.dimensionId,
      summary: `Dimension ${dimScore.name} score is ${dimScore.score}/100.`,
      strengths,
      gaps,
      impactOnOverallScore: dimScore.weightedScore
    };
  }
}
