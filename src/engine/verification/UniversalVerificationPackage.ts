/**
 * SECP Engineering Core — Universal Verification Package (EPC-032)
 *
 * Implements a unified, fully traceable, and evidence-backed engineering verification package.
 * Aggregates Requirements, Design, Analysis, Simulation, Manufacturing, and Tests
 * to generate rigorous verdicts (PASS, FAIL, INCONCLUSIVE) with real cryptographic/hash checks.
 */

import * as crypto from 'crypto';

export type PackageStatus = 'COMPLETE' | 'INCOMPLETE' | 'INVALID' | 'UNDER_REVIEW' | 'VERIFIED';
export type VerificationVerdict = 'PASS' | 'FAIL' | 'INCONCLUSIVE';

export interface RequirementEvidence {
  requirementId: string;
  description: string;
  parameter: string;
  unit: string;
  targetValue: number;
  tolerance: number;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  verificationMethod: string;
  validationMethod: string;
  linkedDesignId?: string;
  linkedAnalysisId?: string;
  linkedSimulationId?: string;
  linkedTestId?: string;
  linkedEvidenceId?: string;
}

export interface DesignEvidence {
  cadModelId: string;
  cadRevision: string;
  parametricFeatures: string[];
  material: string;
  assemblyId: string;
  massProperties: {
    mass: number;
    cg: { x: number; y: number; z: number };
    inertiaTensor: number[][];
  };
  designParameters: Record<string, any>;
}

export interface AnalysisEvidence {
  analysisId: string;
  modelId: string;
  configurationId: string;
  input: Record<string, any>;
  solver: string;
  parameters: Record<string, any>;
  executionId: string;
  result: any;
  units: string;
  tolerance: number;
  verdict: VerificationVerdict;
}

export interface SimulationEvidence {
  scenarioId: string;
  geometryRevision: string;
  materialRevision: string;
  parameterSet: Record<string, any>;
  loads: Record<string, any>;
  boundaryConditions: Record<string, any>;
  solver: string;
  mesh: {
    nodeCount: number;
    elementCount: number;
    quality: number;
  };
  controls: Record<string, any>;
  executionTimestamp: string;
  result: any;
  resultHash: string;
  status: string;
}

export interface ManufacturingEvidence {
  mfgDefinitionId: string;
  partDefinition: {
    partId: string;
    name: string;
  };
  material: string;
  process: string[];
  bomId: string;
  camOperation: string;
  toolpathId: string;
  ncCode?: string;
  mfgRevision: string;
}

export interface TestEvidence {
  testId: string;
  testType: 'PHYSICAL' | 'SIMULATION_REPLAY' | 'BENCH_TEST' | 'FLIGHT_TEST';
  testCondition: string;
  input: any;
  expectedResult: any;
  measuredResult: any;
  acceptanceCriterion: string;
  timestamp: string;
  instrumentation?: {
    deviceName: string;
    lastCalibrated: string;
  };
  calibration?: string;
  uncertainty?: number;
  verdict: VerificationVerdict;
}

export interface EvidenceProvenance {
  who: string;
  what: string;
  when: string;
  source: string;
  version: string;
  input: string;
  process: string;
  output: string;
}

export interface EvidenceRecord {
  evidenceId: string;
  evidenceType:
    | 'DESIGN'
    | 'ANALYSIS'
    | 'SIMULATION'
    | 'MANUFACTURING'
    | 'TEST'
    | 'MEASUREMENT'
    | 'DOCUMENT'
    | 'LOG'
    | 'REPORT';
  caseId: string;
  sourceType: string;
  sourceId: string;
  sourceRevision: string;
  executionId: string;
  createdAt: string;
  createdBy: string;
  inputReferences: string[];
  outputReferences: string[];
  hash: string;
  provenance: EvidenceProvenance | null;
  status: string;
  rawPayload?: any; // Used to re-verify hashing on-the-fly
}

export interface UniversalVerificationPackage {
  packageId: string;
  caseId: string;
  productId: string;
  productRevision: string;
  configurationId: string;
  createdAt: string;
  createdBy: string;
  status: PackageStatus;

  requirements: RequirementEvidence[];
  design?: DesignEvidence;
  cad?: DesignEvidence;
  assembly?: {
    assemblyId: string;
    components: string[];
  };
  cae?: {
    caeModelId: string;
    analysisCases: string[];
  };
  fea?: AnalysisEvidence;
  cfd?: AnalysisEvidence;
  dynamics?: AnalysisEvidence;
  simulation?: SimulationEvidence;
  optimization?: {
    optimizationId: string;
    iterations: number;
    converged: boolean;
  };
  manufacturing?: ManufacturingEvidence;
  cam?: {
    setupId: string;
    operations: string[];
  };
  bom?: {
    bomId: string;
    revision: string;
  };
  tests: TestEvidence[];
  measurements: TestEvidence[];
  evidence: EvidenceRecord[];
}

export interface PackageEvaluationResult {
  packageId: string;
  status: PackageStatus;
  verdict: VerificationVerdict;
  coverage: {
    totalCritical: number;
    verifiedCritical: number;
    unverifiedCritical: number;
    failedCritical: number;
  };
  failures: string[];
  integrityChecks: {
    evidenceId: string;
    passed: boolean;
    error?: string;
  }[];
  consistencyErrors: string[];
}

export class UniversalVerificationPackageEngine {
  /**
   * Generates a deterministic SHA-256 hash of any canonical stringified content
   */
  public static computeHash(payload: any): string {
    const canonicalString = JSON.stringify(payload, Object.keys(payload || {}).sort());
    return crypto.createHash('sha256').update(canonicalString).digest('hex');
  }

  /**
   * Evaluates a Verification Package against strict engineering rules
   */
  public static evaluatePackage(pkg: UniversalVerificationPackage): PackageEvaluationResult {
    const failures: string[] = [];
    const consistencyErrors: string[] = [];
    const integrityChecks: { evidenceId: string; passed: boolean; error?: string }[] = [];

    // 1. Mandatory Structural Check for Integrity
    for (const record of pkg.evidence) {
      if (record.rawPayload) {
        const computed = this.computeHash(record.rawPayload);
        if (computed !== record.hash) {
          integrityChecks.push({
            evidenceId: record.evidenceId,
            passed: false,
            error: 'INTEGRITY_FAILURE'
          });
          failures.push(`Evidence integrity check failed for record [${record.evidenceId}] - Raw content hash mismatch!`);
        } else {
          integrityChecks.push({ evidenceId: record.evidenceId, passed: true });
        }
      } else {
        // Missing payload to re-hash on fly, but check if hash exists at all
        if (!record.hash) {
          integrityChecks.push({
            evidenceId: record.evidenceId,
            passed: false,
            error: 'MISSING_HASH'
          });
          failures.push(`Evidence [${record.evidenceId}] is missing its integrity hash.`);
        } else {
          integrityChecks.push({ evidenceId: record.evidenceId, passed: true });
        }
      }

      // Check for Provenance Completeness
      if (!record.provenance) {
        failures.push(`Evidence [${record.evidenceId}] has missing provenance data (PROVENANCE_INCOMPLETE)`);
      } else {
        const provKeys: (keyof EvidenceProvenance)[] = ['who', 'what', 'when', 'source', 'version', 'input', 'process', 'output'];
        const missingKeys = provKeys.filter(k => !record.provenance?.[k]);
        if (missingKeys.length > 0) {
          failures.push(`Evidence [${record.evidenceId}] provenance metadata is incomplete. Missing: [${missingKeys.join(', ')}] (PROVENANCE_INCOMPLETE)`);
        }
      }
    }

    // 2. Revision & Configuration Consistency Check
    const revisions: Record<string, string> = {};
    if (pkg.productRevision) revisions['PRODUCT'] = pkg.productRevision;
    if (pkg.cad?.cadRevision) revisions['CAD'] = pkg.cad.cadRevision;
    if (pkg.simulation?.geometryRevision) revisions['SIMULATION_GEOMETRY'] = pkg.simulation.geometryRevision;
    if (pkg.simulation?.materialRevision) revisions['SIMULATION_MATERIAL'] = pkg.simulation.materialRevision;
    if (pkg.manufacturing?.mfgRevision) revisions['MANUFACTURING'] = pkg.manufacturing.mfgRevision;
    if (pkg.bom?.revision) revisions['BOM'] = pkg.bom.revision;

    const uniqueRevs = new Set(Object.values(revisions));
    if (uniqueRevs.size > 1) {
      const details = Object.entries(revisions).map(([k, v]) => `${k}:${v}`).join(', ');
      consistencyErrors.push(`CONFIGURATION_MISMATCH: Revision conflict detected across domains: ${details}`);
      failures.push(`Domain revision consistency failure (STALE_EVIDENCE/CONFIGURATION_MISMATCH): ${details}`);
    }

    // 3. Evaluate Requirements Coverage & Verification Checks
    let totalCritical = 0;
    let verifiedCritical = 0;
    let unverifiedCritical = 0;
    let failedCritical = 0;

    for (const req of pkg.requirements) {
      const isCritical = req.priority === 'CRITICAL';
      if (isCritical) {
        totalCritical++;
      }

      // Track down verification links
      let hasValidEvidence = false;
      let hasFailedEvidence = false;

      // Rule: Simulation results are simulated. Test result cannot be mapped to a measurement if it is simulated.
      const linkedTest = pkg.tests.find(t => t.testId === req.linkedTestId);
      if (linkedTest) {
        if (linkedTest.testType === 'SIMULATION_REPLAY') {
          // If a simulation is registered as physical measurement, throw hard error
          if (req.verificationMethod === 'PHYSICAL_MEASUREMENT') {
            failures.push(`Hard Failure: Simulation result registered as PHYSICAL_MEASUREMENT for requirement [${req.requirementId}]`);
            hasFailedEvidence = true;
          }
        }
        if (linkedTest.verdict === 'FAIL') {
          hasFailedEvidence = true;
        } else if (linkedTest.verdict === 'PASS') {
          hasValidEvidence = true;
        }
      }

      const linkedCae = pkg.fea || pkg.cfd || pkg.dynamics;
      if (req.linkedAnalysisId && linkedCae?.analysisId === req.linkedAnalysisId) {
        if (linkedCae.verdict === 'FAIL') {
          hasFailedEvidence = true;
        } else if (linkedCae.verdict === 'PASS') {
          hasValidEvidence = true;
        }
      }

      const linkedRecord = pkg.evidence.find(e => e.evidenceId === req.linkedEvidenceId);
      if (linkedRecord) {
        const provComplete = linkedRecord.provenance && 
          Object.values(linkedRecord.provenance).every(v => v !== undefined && v !== '');
        
        if (!provComplete) {
          failures.push(`Requirement [${req.requirementId}] is linked to evidence [${req.linkedEvidenceId}] with incomplete provenance.`);
          hasValidEvidence = false;
        } else {
          hasValidEvidence = true;
        }
      }

      if (hasFailedEvidence) {
        if (isCritical) {
          failedCritical++;
        }
      } else if (hasValidEvidence) {
        if (isCritical) {
          verifiedCritical++;
        }
      } else {
        if (isCritical) {
          unverifiedCritical++;
        }
      }
    }

    // Complete Check: Missing domain sections
    const completeSections = {
      requirements: pkg.requirements.length > 0,
      cad: !!pkg.cad,
      cae: !!pkg.cae || !!pkg.fea || !!pkg.cfd,
      simulation: !!pkg.simulation,
      manufacturing: !!pkg.manufacturing,
      tests: pkg.tests.length > 0
    };

    let calculatedStatus: PackageStatus = 'COMPLETE';
    const missing = Object.entries(completeSections).filter(([_, val]) => !val).map(([name]) => name);

    if (missing.length > 0) {
      calculatedStatus = 'INCOMPLETE';
    }

    // Integrity of whole package verdict derivation
    let verdict: VerificationVerdict = 'PASS';

    // Rule: Any failed critical requirement, integrity failure, or revision mismatch causes immediate package FAIL
    if (failedCritical > 0 || failures.length > 0 || consistencyErrors.length > 0) {
      verdict = 'FAIL';
    } else if (unverifiedCritical > 0) {
      // Rule: Critical requirement without evidence = UNVERIFIED / INCONCLUSIVE
      failures.push(`Critical requirements [Count: ${unverifiedCritical}] have no valid verification evidence. Status: UNVERIFIED`);
      verdict = 'INCONCLUSIVE';
    }

    if (calculatedStatus === 'INCOMPLETE' && verdict === 'PASS') {
      calculatedStatus = 'INCOMPLETE';
    }

    return {
      packageId: pkg.packageId,
      status: calculatedStatus,
      verdict,
      coverage: {
        totalCritical,
        verifiedCritical,
        unverifiedCritical,
        failedCritical
      },
      failures,
      integrityChecks,
      consistencyErrors
    };
  }

  /**
   * Graph Reconstruction of relationships
   */
  public static rebuildTraceabilityChain(pkg: UniversalVerificationPackage): any {
    const chain: any[] = [];
    for (const req of pkg.requirements) {
      chain.push({
        requirementId: req.requirementId,
        designId: req.linkedDesignId || null,
        analysisId: req.linkedAnalysisId || null,
        simulationId: req.linkedSimulationId || null,
        testId: req.linkedTestId || null,
        evidenceId: req.linkedEvidenceId || null
      });
    }
    return chain;
  }
}
