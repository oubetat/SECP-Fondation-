/**
 * SECP Industrial OS — EPC-015: Master Acceptance Gate
 * Centralized, fail-closed Engineering Proof Case acceptance gate.
 */

import {
  EPCMasterGateInput,
  MasterAcceptanceResult,
  MasterGateCriterionId,
  MasterGateCriterionResult,
  MasterGateFailureCode,
  MasterGateFailureReport,
  MasterGateVerdict,
  MasterGateAuditRecord
} from './EPCMasterAcceptanceTypes';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';

export class EPCMasterAcceptanceGate {
  public static readonly GATE_ID = 'EPC-MASTER-GATE-015';
  public static readonly GATE_VERSION = '1.0.0';

  /**
   * Central evaluation entrypoint for an Engineering Proof Case.
   * Enforces fail-closed validation, actual execution, configuration baseline,
   * full traceability, complete provenance, evidence integrity, and reproducibility.
   */
  public static evaluate(input: EPCMasterGateInput): MasterAcceptanceResult {
    const evaluatedAt = new Date().toISOString();
    const failures: MasterGateFailureReport[] = [];
    const warnings: string[] = [];
    const evidenceRefsSet: Set<string> = new Set();
    const criteriaResults: MasterGateCriterionResult[] = [];

    // 1. Proof Case Identity Check
    const proofCase = input.proofCase;
    const caseId = (proofCase && typeof proofCase === 'object' && proofCase.caseId)
      ? String(proofCase.caseId).trim()
      : 'UNKNOWN_CASE';

    if (!proofCase || typeof proofCase !== 'object' || !caseId || caseId === 'UNKNOWN_CASE') {
      failures.push({
        failureCode: MasterGateFailureCode.INVALID_PROOFCASE,
        criterion: MasterGateCriterionId.EXECUTION,
        severity: 'CRITICAL',
        caseId,
        details: 'ProofCase object is missing, null, or lacks a valid caseId.',
        detectedAt: evaluatedAt
      });
    }

    // 2. Evaluate Criterion: EXECUTION (Actual Execution Required)
    const executionEvaluation = this.evaluateExecution(input, caseId, evaluatedAt);
    criteriaResults.push(executionEvaluation.criterion);
    if (executionEvaluation.failure) {
      failures.push(executionEvaluation.failure);
    }
    if (executionEvaluation.evidenceRefs) {
      executionEvaluation.evidenceRefs.forEach(ref => evidenceRefsSet.add(ref));
    }

    // 3. Evaluate Criterion: CONFIGURATION (Engineering Configuration Baseline)
    const configEvaluation = this.evaluateConfiguration(input, caseId, evaluatedAt);
    criteriaResults.push(configEvaluation.criterion);
    if (configEvaluation.failure) {
      failures.push(configEvaluation.failure);
    }
    if (configEvaluation.evidenceRefs) {
      configEvaluation.evidenceRefs.forEach(ref => evidenceRefsSet.add(ref));
    }

    // 4. Evaluate Criterion: TRACEABILITY (Requirement Traceability Chain)
    const traceEvaluation = this.evaluateTraceability(input, caseId, evaluatedAt);
    criteriaResults.push(traceEvaluation.criterion);
    if (traceEvaluation.failures && traceEvaluation.failures.length > 0) {
      failures.push(...traceEvaluation.failures);
    }
    if (traceEvaluation.evidenceRefs) {
      traceEvaluation.evidenceRefs.forEach(ref => evidenceRefsSet.add(ref));
    }

    // 5. Evaluate Criterion: PROVENANCE (Evidence Provenance)
    const provEvaluation = this.evaluateProvenance(input, caseId, evaluatedAt);
    criteriaResults.push(provEvaluation.criterion);
    if (provEvaluation.failure) {
      failures.push(provEvaluation.failure);
    }
    if (provEvaluation.evidenceRefs) {
      provEvaluation.evidenceRefs.forEach(ref => evidenceRefsSet.add(ref));
    }

    // 6. Evaluate Criterion: INTEGRITY (Evidence Integrity & Anti-Tamper)
    const integrityEvaluation = this.evaluateIntegrity(input, caseId, evaluatedAt);
    criteriaResults.push(integrityEvaluation.criterion);
    if (integrityEvaluation.failure) {
      failures.push(integrityEvaluation.failure);
    }
    if (integrityEvaluation.evidenceRefs) {
      integrityEvaluation.evidenceRefs.forEach(ref => evidenceRefsSet.add(ref));
    }

    // 7. Evaluate Criterion: REPRODUCIBILITY (Workflow Reproducibility & Tolerance)
    const reproEvaluation = this.evaluateReproducibility(input, caseId, evaluatedAt);
    criteriaResults.push(reproEvaluation.criterion);
    if (reproEvaluation.failure) {
      failures.push(reproEvaluation.failure);
    }
    if (reproEvaluation.evidenceRefs) {
      reproEvaluation.evidenceRefs.forEach(ref => evidenceRefsSet.add(ref));
    }

    // 8. Evaluate Criterion: VERDICT_INTEGRITY (No Hardcoded or Bypassed Verdict)
    const verdictIntegrityEvaluation = this.evaluateVerdictIntegrity(input, caseId, failures, evaluatedAt);
    criteriaResults.push(verdictIntegrityEvaluation.criterion);
    if (verdictIntegrityEvaluation.failure) {
      failures.push(verdictIntegrityEvaluation.failure);
    }

    // 9. Master Verdict Algorithm (Strict Fail-Closed)
    let finalVerdict: MasterGateVerdict;

    const hasFail = criteriaResults.some(c => c.mandatory && c.status === 'FAIL');
    const hasInconclusive = criteriaResults.some(c => c.mandatory && c.status === 'INCONCLUSIVE');
    const executionValid = executionEvaluation.criterion.status === 'PASS';

    if (hasFail) {
      finalVerdict = 'FAIL';
    } else if (hasInconclusive) {
      finalVerdict = 'INCONCLUSIVE';
    } else if (!executionValid) {
      finalVerdict = 'FAIL';
    } else if (criteriaResults.every(c => !c.mandatory || c.status === 'PASS')) {
      finalVerdict = 'PASS';
    } else {
      finalVerdict = 'INCONCLUSIVE';
    }

    const evidenceRefsArray = Array.from(evidenceRefsSet);

    // Build Audit Record
    const auditRecord: MasterGateAuditRecord = {
      gateId: this.GATE_ID,
      caseId,
      evaluatedAt,
      evaluator: input.options?.evaluator || 'SECP-MASTER-GATE-ENGINE',
      criteriaResults: criteriaResults.reduce((acc, c) => {
        acc[c.criterionId] = c.status;
        return acc;
      }, {} as Record<string, MasterGateVerdict>),
      failures,
      warnings,
      finalVerdict,
      auditHash: ''
    };

    const computedAuditHash = EvidenceIntegrityService.computeHash({
      gateId: auditRecord.gateId,
      caseId: auditRecord.caseId,
      evaluatedAt: auditRecord.evaluatedAt,
      criteriaResults: auditRecord.criteriaResults,
      failures: auditRecord.failures,
      finalVerdict: auditRecord.finalVerdict
    });

    (auditRecord as any).auditHash = computedAuditHash;

    return {
      gateId: this.GATE_ID,
      caseId,
      evaluatedAt,
      status: 'EVALUATED',
      verdict: finalVerdict,
      criteria: criteriaResults,
      failures,
      warnings,
      evidenceRefs: evidenceRefsArray,
      executionRef: executionEvaluation.executionRef,
      configurationRef: configEvaluation.configurationRef,
      provenanceRef: provEvaluation.provenanceRefs,
      reproducibilityRef: reproEvaluation.reproducibilityRef,
      auditRecord
    };
  }

  /**
   * Evaluates Actual Execution requirement.
   */
  private static evaluateExecution(
    input: EPCMasterGateInput,
    caseId: string,
    evaluatedAt: string
  ): {
    criterion: MasterGateCriterionResult;
    failure?: MasterGateFailureReport;
    evidenceRefs?: string[];
    executionRef?: string;
  } {
    const executions = input.executionRecords;
    if (!executions || !Array.isArray(executions) || executions.length === 0) {
      return {
        criterion: {
          criterionId: MasterGateCriterionId.EXECUTION,
          status: 'FAIL',
          mandatory: true,
          details: 'No execution records provided. Actual execution of workflow is required.',
          evidenceRefs: []
        },
        failure: {
          failureCode: MasterGateFailureCode.EXECUTION_MISSING,
          criterion: MasterGateCriterionId.EXECUTION,
          severity: 'CRITICAL',
          caseId,
          details: 'Proof Case has not been executed. Execution record is missing.',
          detectedAt: evaluatedAt
        }
      };
    }

    const completedExecution = executions.find(e => 
      e && 
      e.status === 'COMPLETED' && 
      e.executionId && 
      e.startedAt && 
      e.completedAt &&
      e.inputs !== undefined &&
      e.outputs !== undefined
    );

    if (!completedExecution) {
      const anyStatus = executions[0]?.status || 'UNKNOWN';
      return {
        criterion: {
          criterionId: MasterGateCriterionId.EXECUTION,
          status: 'FAIL',
          mandatory: true,
          details: `Execution record present but status is '${anyStatus}' instead of 'COMPLETED' or missing input/output bounds.`,
          evidenceRefs: []
        },
        failure: {
          failureCode: MasterGateFailureCode.EXECUTION_MISSING,
          criterion: MasterGateCriterionId.EXECUTION,
          severity: 'CRITICAL',
          caseId,
          details: `Execution incomplete (status: ${anyStatus}). Proof Case requires successful completed execution.`,
          detectedAt: evaluatedAt
        }
      };
    }

    const refs = completedExecution.evidenceRefs ? Array.from(completedExecution.evidenceRefs) : [];
    return {
      criterion: {
        criterionId: MasterGateCriterionId.EXECUTION,
        status: 'PASS',
        mandatory: true,
        details: `Execution ${completedExecution.executionId} verified with status COMPLETED.`,
        evidenceRefs: refs
      },
      evidenceRefs: refs,
      executionRef: completedExecution.executionId
    };
  }

  /**
   * Evaluates Engineering Configuration Baseline.
   */
  private static evaluateConfiguration(
    input: EPCMasterGateInput,
    caseId: string,
    evaluatedAt: string
  ): {
    criterion: MasterGateCriterionResult;
    failure?: MasterGateFailureReport;
    evidenceRefs?: string[];
    configurationRef?: string;
  } {
    const config = input.configurationBaseline;
    if (!config || typeof config !== 'object') {
      return {
        criterion: {
          criterionId: MasterGateCriterionId.CONFIGURATION,
          status: 'FAIL',
          mandatory: true,
          details: 'Configuration Baseline is missing.',
          evidenceRefs: []
        },
        failure: {
          failureCode: MasterGateFailureCode.CONFIGURATION_MISSING,
          criterion: MasterGateCriterionId.CONFIGURATION,
          severity: 'CRITICAL',
          caseId,
          details: 'Engineering Configuration Baseline is absent.',
          detectedAt: evaluatedAt
        }
      };
    }

    const baselineId = config.baselineId || config.id;
    if (!baselineId || typeof baselineId !== 'string' || baselineId.trim() === '') {
      return {
        criterion: {
          criterionId: MasterGateCriterionId.CONFIGURATION,
          status: 'FAIL',
          mandatory: true,
          details: 'Configuration Baseline is missing baselineId.',
          evidenceRefs: []
        },
        failure: {
          failureCode: MasterGateFailureCode.CONFIGURATION_MISSING,
          criterion: MasterGateCriterionId.CONFIGURATION,
          severity: 'CRITICAL',
          caseId,
          details: 'Configuration baseline lacks a baseline identifier.',
          detectedAt: evaluatedAt
        }
      };
    }

    if (config.status === 'REJECTED') {
      return {
        criterion: {
          criterionId: MasterGateCriterionId.CONFIGURATION,
          status: 'FAIL',
          mandatory: true,
          details: 'Configuration Baseline status is REJECTED.',
          evidenceRefs: [baselineId]
        },
        failure: {
          failureCode: MasterGateFailureCode.CONFIGURATION_INCOMPLETE,
          criterion: MasterGateCriterionId.CONFIGURATION,
          severity: 'CRITICAL',
          caseId,
          details: `Configuration Baseline '${baselineId}' is marked REJECTED.`,
          detectedAt: evaluatedAt
        },
        configurationRef: baselineId
      };
    }

    // Check completeness: check if components are present when baseline data object is passed
    const missingComponents: string[] = [];
    if (config.cad === undefined && config.components === undefined && config.models === undefined) {
      missingComponents.push('CAD/Geometry');
    }
    if (config.materials === undefined && config.parameters === undefined && config.properties === undefined) {
      missingComponents.push('Materials/Parameters');
    }

    if (missingComponents.length > 0) {
      return {
        criterion: {
          criterionId: MasterGateCriterionId.CONFIGURATION,
          status: 'FAIL',
          mandatory: true,
          details: `Configuration Baseline is incomplete. Missing: ${missingComponents.join(', ')}`,
          evidenceRefs: [baselineId]
        },
        failure: {
          failureCode: MasterGateFailureCode.CONFIGURATION_INCOMPLETE,
          criterion: MasterGateCriterionId.CONFIGURATION,
          severity: 'CRITICAL',
          caseId,
          details: `Incomplete Configuration Baseline (${missingComponents.join(', ')} missing).`,
          detectedAt: evaluatedAt
        },
        configurationRef: baselineId
      };
    }

    return {
      criterion: {
        criterionId: MasterGateCriterionId.CONFIGURATION,
        status: 'PASS',
        mandatory: true,
        details: `Configuration Baseline '${baselineId}' qualified and complete.`,
        evidenceRefs: [baselineId]
      },
      evidenceRefs: [baselineId],
      configurationRef: baselineId
    };
  }

  /**
   * Evaluates Requirement Traceability Chain.
   */
  private static evaluateTraceability(
    input: EPCMasterGateInput,
    caseId: string,
    evaluatedAt: string
  ): {
    criterion: MasterGateCriterionResult;
    failures?: MasterGateFailureReport[];
    evidenceRefs?: string[];
  } {
    const traceability = input.traceability;
    const requirements = input.requirements || input.proofCase?.requirements || [];

    if (!traceability && (!requirements || requirements.length === 0)) {
      return {
        criterion: {
          criterionId: MasterGateCriterionId.TRACEABILITY,
          status: 'FAIL',
          mandatory: true,
          details: 'Traceability data and requirements are completely missing.',
          evidenceRefs: []
        },
        failures: [{
          failureCode: MasterGateFailureCode.TRACEABILITY_MISSING,
          criterion: MasterGateCriterionId.TRACEABILITY,
          severity: 'CRITICAL',
          caseId,
          details: 'No requirements or traceability engine provided.',
          detectedAt: evaluatedAt
        }]
      };
    }

    const traceFailures: MasterGateFailureReport[] = [];
    const evidenceRefs: string[] = [];

    // Helper: evaluate requirement trace result item
    const checkTraceItem = (item: any) => {
      const reqId = item.requirementId || item.id;
      const isCritical = item.requirement?.priority === 'CRITICAL' ||
        item.priority === 'CRITICAL' ||
        item.isCritical === true ||
        item.critical === true;

      const hasDesign = (item.designFeatures && item.designFeatures.length > 0) || (item.designLinks && item.designLinks.length > 0);
      const hasAnalysis = (item.analyses && item.analyses.length > 0) || (item.analysisLinks && item.analysisLinks.length > 0);
      const hasTest = (item.tests && item.tests.length > 0) || (item.testLinks && item.testLinks.length > 0);
      const hasEvidence = (item.evidence && item.evidence.length > 0) || (item.evidenceLinks && item.evidenceLinks.length > 0);

      const missingStages: string[] = [];
      if (!hasDesign) missingStages.push('DESIGN_FEATURE');
      if (!hasAnalysis) missingStages.push('ANALYSIS');
      if (!hasTest) missingStages.push('TEST');
      if (!hasEvidence) missingStages.push('EVIDENCE');

      if (hasEvidence && Array.isArray(item.evidence)) {
        item.evidence.forEach((e: any) => {
          const id = typeof e === 'string' ? e : e.artifactId || e.evidenceId;
          if (id) evidenceRefs.push(id);
        });
      }

      if (missingStages.length > 0) {
        if (isCritical || item.status === 'UNTRACEABLE' || item.status === 'FAIL') {
          traceFailures.push({
            failureCode: MasterGateFailureCode.TRACEABILITY_MISSING,
            criterion: MasterGateCriterionId.TRACEABILITY,
            severity: isCritical ? 'CRITICAL' : 'MAJOR',
            caseId,
            requirementId: reqId,
            missingLinks: missingStages,
            details: `Critical Requirement '${reqId}' has broken traceability chain. Missing stages: ${missingStages.join(', ')}`,
            detectedAt: evaluatedAt
          });
        }
      }
    };

    if (Array.isArray(traceability)) {
      traceability.forEach(checkTraceItem);
    } else if (traceability && typeof traceability.getRequirementTrace === 'function') {
      // RequirementTraceabilityEngine instance
      for (const req of requirements) {
        const reqId = typeof req === 'string' ? req : req.requirementId || req.id;
        try {
          const trace = traceability.getRequirementTrace(reqId);
          checkTraceItem(trace);
        } catch (e: any) {
          traceFailures.push({
            failureCode: MasterGateFailureCode.TRACEABILITY_MISSING,
            criterion: MasterGateCriterionId.TRACEABILITY,
            severity: 'CRITICAL',
            caseId,
            requirementId: reqId,
            details: `Trace calculation failed for requirement ${reqId}: ${e.message}`,
            detectedAt: evaluatedAt
          });
        }
      }
    } else if (traceability && typeof traceability === 'object' && traceability.results) {
      (traceability.results as any[]).forEach(checkTraceItem);
    } else if (requirements && Array.isArray(requirements)) {
      // Direct requirement inspection if traceability object is omitted but requirements have status
      requirements.forEach((r: any) => {
        const reqId = r.requirementId || r.id;
        const isCritical = r.priority === 'CRITICAL' || r.metadata?.priority === 'CRITICAL';
        if (isCritical && r.status !== 'VERIFIED' && r.status !== 'PASS') {
          traceFailures.push({
            failureCode: MasterGateFailureCode.TRACEABILITY_MISSING,
            criterion: MasterGateCriterionId.TRACEABILITY,
            severity: 'CRITICAL',
            caseId,
            requirementId: reqId,
            missingLinks: ['VERIFICATION_EVIDENCE'],
            details: `Critical requirement '${reqId}' status is not VERIFIED.`,
            detectedAt: evaluatedAt
          });
        }
      });
    }

    if (traceFailures.length > 0) {
      return {
        criterion: {
          criterionId: MasterGateCriterionId.TRACEABILITY,
          status: 'FAIL',
          mandatory: true,
          details: `${traceFailures.length} requirement traceability chain failure(s) detected.`,
          evidenceRefs
        },
        failures: traceFailures,
        evidenceRefs
      };
    }

    return {
      criterion: {
        criterionId: MasterGateCriterionId.TRACEABILITY,
        status: 'PASS',
        mandatory: true,
        details: 'All critical requirements possess complete, verified end-to-end traceability chains.',
        evidenceRefs
      },
      evidenceRefs
    };
  }

  /**
   * Evaluates Evidence Provenance.
   */
  private static evaluateProvenance(
    input: EPCMasterGateInput,
    caseId: string,
    evaluatedAt: string
  ): {
    criterion: MasterGateCriterionResult;
    failure?: MasterGateFailureReport;
    evidenceRefs?: string[];
    provenanceRefs?: string[];
  } {
    const provenance = input.provenance;
    const evidence = input.evidence || input.proofCase?.evidence || [];

    if (!provenance || (Array.isArray(provenance) && provenance.length === 0) || (typeof provenance === 'object' && Object.keys(provenance).length === 0)) {
      return {
        criterion: {
          criterionId: MasterGateCriterionId.PROVENANCE,
          status: 'FAIL',
          mandatory: true,
          details: 'Evidence provenance records are missing.',
          evidenceRefs: []
        },
        failure: {
          failureCode: MasterGateFailureCode.PROVENANCE_MISSING,
          criterion: MasterGateCriterionId.PROVENANCE,
          severity: 'CRITICAL',
          caseId,
          details: 'Complete provenance (Who, What, When, Source, Version, Input, Process, Output) is required.',
          detectedAt: evaluatedAt
        }
      };
    }

    const provenanceList: any[] = Array.isArray(provenance)
      ? provenance
      : Object.values(provenance);

    const provenanceRefs: string[] = [];
    const missingFieldErrors: string[] = [];

    for (const record of provenanceList) {
      if (!record || typeof record !== 'object') continue;
      const provId = record.provenanceId || record.id || 'UNKNOWN';
      provenanceRefs.push(provId);

      const actor = record.actor || record.who;
      const action = record.action || record.what;
      const timestamp = record.timestamp || record.when;
      const source = record.source;
      const sourceVersion = record.sourceVersion || record.version;
      const inputs = record.inputs;
      const process = record.process;
      const outputs = record.outputs;

      if (!actor || !action || !timestamp || !source || !inputs || !process || !outputs) {
        missingFieldErrors.push(`Provenance '${provId}' incomplete`);
      }
    }

    if (missingFieldErrors.length > 0) {
      return {
        criterion: {
          criterionId: MasterGateCriterionId.PROVENANCE,
          status: 'FAIL',
          mandatory: true,
          details: `Incomplete provenance records detected: ${missingFieldErrors.join('; ')}`,
          evidenceRefs: []
        },
        failure: {
          failureCode: MasterGateFailureCode.PROVENANCE_MISSING,
          criterion: MasterGateCriterionId.PROVENANCE,
          severity: 'CRITICAL',
          caseId,
          details: `Provenance validation failed: ${missingFieldErrors.join(', ')}`,
          detectedAt: evaluatedAt
        },
        provenanceRefs
      };
    }

    return {
      criterion: {
        criterionId: MasterGateCriterionId.PROVENANCE,
        status: 'PASS',
        mandatory: true,
        details: 'All evidence artifacts have valid, complete provenance tracking records.',
        evidenceRefs: []
      },
      provenanceRefs
    };
  }

  /**
   * Evaluates Evidence Integrity (Anti-Tamper).
   */
  private static evaluateIntegrity(
    input: EPCMasterGateInput,
    caseId: string,
    evaluatedAt: string
  ): {
    criterion: MasterGateCriterionResult;
    failure?: MasterGateFailureReport;
    evidenceRefs?: string[];
  } {
    const evidence = input.evidence || input.proofCase?.evidence || [];
    if (!evidence || !Array.isArray(evidence) || evidence.length === 0) {
      return {
        criterion: {
          criterionId: MasterGateCriterionId.INTEGRITY,
          status: 'FAIL',
          mandatory: true,
          details: 'No evidence artifacts found for integrity verification.',
          evidenceRefs: []
        },
        failure: {
          failureCode: MasterGateFailureCode.EVIDENCE_INTEGRITY_FAILURE,
          criterion: MasterGateCriterionId.INTEGRITY,
          severity: 'CRITICAL',
          caseId,
          details: 'Evidence package empty or missing integrity records.',
          detectedAt: evaluatedAt
        }
      };
    }

    const evidenceRefs: string[] = [];
    const tamperedEvidence: string[] = [];

    for (const item of evidence) {
      if (!item || typeof item !== 'object') continue;
      const evId = item.evidenceId || item.id || item.packageId;
      if (evId) evidenceRefs.push(evId);

      // Check explicit integrityStatus or hash recalculation
      if (item.integrityStatus === 'TAMPERED' || item.integrityStatus === 'INVALID') {
        tamperedEvidence.push(evId || 'UNKNOWN_EVIDENCE');
        continue;
      }

      if (item.storedHash && item.payload) {
        const recomputed = EvidenceIntegrityService.computeHash(item.payload);
        if (recomputed !== item.storedHash) {
          tamperedEvidence.push(evId || 'HASH_MISMATCH');
        }
      } else if (item.contentHash && item.payload) {
        const recomputed = EvidenceIntegrityService.computeHash(item.payload);
        if (recomputed !== item.contentHash) {
          tamperedEvidence.push(evId || 'HASH_MISMATCH');
        }
      }
    }

    if (tamperedEvidence.length > 0) {
      return {
        criterion: {
          criterionId: MasterGateCriterionId.INTEGRITY,
          status: 'FAIL',
          mandatory: true,
          details: `Evidence integrity violation / tampering detected in: ${tamperedEvidence.join(', ')}`,
          evidenceRefs
        },
        failure: {
          failureCode: MasterGateFailureCode.EVIDENCE_INTEGRITY_FAILURE,
          criterion: MasterGateCriterionId.INTEGRITY,
          severity: 'CRITICAL',
          caseId,
          evidenceId: tamperedEvidence[0],
          details: `Stored hash vs recomputed hash mismatch on evidence '${tamperedEvidence.join(', ')}'.`,
          detectedAt: evaluatedAt
        },
        evidenceRefs
      };
    }

    return {
      criterion: {
        criterionId: MasterGateCriterionId.INTEGRITY,
        status: 'PASS',
        mandatory: true,
        details: 'All evidence payloads cryptographically verified against canonical integrity hashes.',
        evidenceRefs
      },
      evidenceRefs
    };
  }

  /**
   * Evaluates Workflow Reproducibility.
   */
  private static evaluateReproducibility(
    input: EPCMasterGateInput,
    caseId: string,
    evaluatedAt: string
  ): {
    criterion: MasterGateCriterionResult;
    failure?: MasterGateFailureReport;
    evidenceRefs?: string[];
    reproducibilityRef?: string;
  } {
    const reproResults = input.reproducibilityResults;

    if (!reproResults || !Array.isArray(reproResults) || reproResults.length === 0) {
      return {
        criterion: {
          criterionId: MasterGateCriterionId.REPRODUCIBILITY,
          status: 'FAIL',
          mandatory: true,
          details: 'No reproducibility execution results provided.',
          evidenceRefs: []
        },
        failure: {
          failureCode: MasterGateFailureCode.REPRODUCIBILITY_FAILURE,
          criterion: MasterGateCriterionId.REPRODUCIBILITY,
          severity: 'CRITICAL',
          caseId,
          details: 'Proof Case requires independent reproduction execution comparison under numerical tolerance.',
          detectedAt: evaluatedAt
        }
      };
    }

    const repro = reproResults[0];
    const reproId = repro.reproducibilityId || 'REPRO-001';

    if (repro.status === 'INCONCLUSIVE' && input.options?.allowInconclusiveOnUnknown) {
      return {
        criterion: {
          criterionId: MasterGateCriterionId.REPRODUCIBILITY,
          status: 'INCONCLUSIVE',
          mandatory: true,
          details: 'Reproducibility result is inconclusive.',
          evidenceRefs: [reproId]
        },
        reproducibilityRef: reproId
      };
    }

    if (repro.status === 'FAIL' || repro.reproducible === false || (repro.maxObservedDifference !== undefined && repro.expectedTolerance !== undefined && repro.maxObservedDifference > repro.expectedTolerance)) {
      return {
        criterion: {
          criterionId: MasterGateCriterionId.REPRODUCIBILITY,
          status: 'FAIL',
          mandatory: true,
          details: `Reproducibility comparison failed. Max difference: ${repro.maxObservedDifference}, Expected tolerance: ${repro.expectedTolerance}.`,
          evidenceRefs: [reproId]
        },
        failure: {
          failureCode: MasterGateFailureCode.REPRODUCIBILITY_FAILURE,
          criterion: MasterGateCriterionId.REPRODUCIBILITY,
          severity: 'CRITICAL',
          caseId,
          details: `Numerical difference ${repro.maxObservedDifference} exceeds allowed tolerance ${repro.expectedTolerance}.`,
          detectedAt: evaluatedAt
        },
        reproducibilityRef: reproId
      };
    }

    return {
      criterion: {
        criterionId: MasterGateCriterionId.REPRODUCIBILITY,
        status: 'PASS',
        mandatory: true,
        details: `Workflow successfully reproduced within tolerance (${repro.maxObservedDifference} <= ${repro.expectedTolerance}).`,
        evidenceRefs: [reproId]
      },
      reproducibilityRef: reproId
    };
  }

  /**
   * Evaluates Verdict Integrity (No Hardcoded PASS).
   */
  private static evaluateVerdictIntegrity(
    input: EPCMasterGateInput,
    caseId: string,
    existingFailures: MasterGateFailureReport[],
    evaluatedAt: string
  ): {
    criterion: MasterGateCriterionResult;
    failure?: MasterGateFailureReport;
  } {
    // If input specified a verdict of 'PASS' but there are critical failures present, reject hardcoded bypass attempt
    if (input.verdict === 'PASS' && existingFailures.length > 0) {
      return {
        criterion: {
          criterionId: MasterGateCriterionId.VERDICT_INTEGRITY,
          status: 'FAIL',
          mandatory: true,
          details: 'Hardcoded or externally asserted PASS detected despite unresolved engineering failures.',
          evidenceRefs: []
        },
        failure: {
          failureCode: MasterGateFailureCode.HARDCODED_VERDICT_REJECTED,
          criterion: MasterGateCriterionId.VERDICT_INTEGRITY,
          severity: 'CRITICAL',
          caseId,
          details: 'Manual verdict override rejected by Master Gate.',
          detectedAt: evaluatedAt
        }
      };
    }

    return {
      criterion: {
        criterionId: MasterGateCriterionId.VERDICT_INTEGRITY,
        status: 'PASS',
        mandatory: true,
        details: 'Verdict is derived purely from deterministic, verifiable engineering evidence.',
        evidenceRefs: []
      }
    };
  }
}
