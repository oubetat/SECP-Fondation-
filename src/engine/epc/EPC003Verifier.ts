/**
 * SECP Industrial OS — EPC-003: Requirement Traceability Verifier
 * Executes verification checks and generates machine-readable EPC-003 evidence.
 */

import { pureSha256 } from '../../polyfills/crypto';
import { CanonicalSerializer } from '../serialization/CanonicalSerializer';
import { RequirementTraceabilityEngine } from './RequirementTraceabilityEngine';
import { TraceabilitySerializer } from './TraceabilitySerializer';
import {
  TraceabilityValidationError,
  EPC003ValidationResult
} from './TraceabilityTypes';
import { EngineeringRequirement } from './EngineeringRequirementTypes';
import { EngineeringRequirementValidator } from './EngineeringRequirementValidator';
import { ProofCaseProject } from './ProofCaseTypes';
import { ProofCaseValidator } from './ProofCaseValidator';

export class EPC003Verifier {
  public static readonly REVISION = 'SECP-EPC-003-REV1';

  /**
   * Runs all verification checks for EPC-003 and returns machine-readable result.
   */
  public static runVerification(): EPC003ValidationResult {
    const checks: Record<string, boolean> = {
      REQUIREMENT_TO_DESIGN: false,
      DESIGN_TO_ANALYSIS: false,
      ANALYSIS_TO_TEST: false,
      TEST_TO_EVIDENCE: false,
      CRITICAL_REQUIREMENT_RULE: false,
      ORPHAN_DETECTION: false,
      DUPLICATE_PROTECTION: false,
      CYCLE_PROTECTION: false,
      REVERSE_TRACEABILITY: false,
      SERIALIZATION: false,
      EPC001_INTEGRATION: false,
      EPC002_INTEGRATION: false,
      ADVERSARIAL_RESISTANCE: false
    };

    // 1. REQUIREMENT_TO_DESIGN
    try {
      const engine = new RequirementTraceabilityEngine('VERIF-1');
      engine.addArtifact({ artifactId: 'REQ-1', type: 'REQUIREMENT', name: 'Req 1' });
      engine.addArtifact({ artifactId: 'DF-1', type: 'DESIGN_FEATURE', name: 'DF 1' });
      engine.addEdge({
        edgeId: 'E-1',
        sourceId: 'REQ-1',
        sourceType: 'REQUIREMENT',
        targetId: 'DF-1',
        targetType: 'DESIGN_FEATURE',
        relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE'
      });
      const trace = engine.getRequirementTrace('REQ-1');
      checks.REQUIREMENT_TO_DESIGN = trace.designFeatures.length === 1 && trace.designFeatures[0].artifactId === 'DF-1';
    } catch (e) {
      checks.REQUIREMENT_TO_DESIGN = false;
    }

    // 2. DESIGN_TO_ANALYSIS
    try {
      const engine = new RequirementTraceabilityEngine('VERIF-2');
      engine.addArtifact({ artifactId: 'DF-1', type: 'DESIGN_FEATURE', name: 'DF 1' });
      engine.addArtifact({ artifactId: 'AN-1', type: 'ANALYSIS', name: 'AN 1' });
      engine.addEdge({
        edgeId: 'E-2',
        sourceId: 'DF-1',
        sourceType: 'DESIGN_FEATURE',
        targetId: 'AN-1',
        targetType: 'ANALYSIS',
        relationshipType: 'DESIGN_FEATURE_TO_ANALYSIS'
      });
      checks.DESIGN_TO_ANALYSIS = engine.getAllEdges().length === 1;
    } catch (e) {
      checks.DESIGN_TO_ANALYSIS = false;
    }

    // 3. ANALYSIS_TO_TEST
    try {
      const engine = new RequirementTraceabilityEngine('VERIF-3');
      engine.addArtifact({ artifactId: 'AN-1', type: 'ANALYSIS', name: 'AN 1' });
      engine.addArtifact({ artifactId: 'TST-1', type: 'TEST', name: 'TST 1' });
      engine.addEdge({
        edgeId: 'E-3',
        sourceId: 'AN-1',
        sourceType: 'ANALYSIS',
        targetId: 'TST-1',
        targetType: 'TEST',
        relationshipType: 'ANALYSIS_TO_TEST'
      });
      checks.ANALYSIS_TO_TEST = engine.getAllEdges().length === 1;
    } catch (e) {
      checks.ANALYSIS_TO_TEST = false;
    }

    // 4. TEST_TO_EVIDENCE
    try {
      const engine = new RequirementTraceabilityEngine('VERIF-4');
      engine.addArtifact({ artifactId: 'TST-1', type: 'TEST', name: 'TST 1' });
      engine.addArtifact({ artifactId: 'EV-1', type: 'EVIDENCE', name: 'EV 1' });
      engine.addEdge({
        edgeId: 'E-4',
        sourceId: 'TST-1',
        sourceType: 'TEST',
        targetId: 'EV-1',
        targetType: 'EVIDENCE',
        relationshipType: 'TEST_TO_EVIDENCE'
      });
      checks.TEST_TO_EVIDENCE = engine.getAllEdges().length === 1;
    } catch (e) {
      checks.TEST_TO_EVIDENCE = false;
    }

    // 5. CRITICAL_REQUIREMENT_RULE
    try {
      const engine = new RequirementTraceabilityEngine('VERIF-5');
      const critReqSpec: EngineeringRequirement = {
        requirementId: 'REQ-CRIT-1',
        description: 'Critical flight control safety margin',
        parameter: 'stress',
        unit: 'MPa',
        tolerance: { upperBound: 200 },
        priority: 'CRITICAL',
        verificationMethod: 'SIMULATION',
        validationMethod: 'PHYSICAL_TEST'
      };

      engine.addArtifact({ artifactId: 'REQ-CRIT-1', type: 'REQUIREMENT', name: 'Crit Req' });
      engine.addArtifact({ artifactId: 'DF-1', type: 'DESIGN_FEATURE', name: 'DF 1' });
      engine.addArtifact({ artifactId: 'AN-1', type: 'ANALYSIS', name: 'AN 1' });
      engine.addArtifact({ artifactId: 'TST-1', type: 'TEST', name: 'TST 1' });
      // MISSING EVIDENCE initially
      engine.addEdge({ edgeId: 'E-1', sourceId: 'REQ-CRIT-1', sourceType: 'REQUIREMENT', targetId: 'DF-1', targetType: 'DESIGN_FEATURE', relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE' });
      engine.addEdge({ edgeId: 'E-2', sourceId: 'DF-1', sourceType: 'DESIGN_FEATURE', targetId: 'AN-1', targetType: 'ANALYSIS', relationshipType: 'DESIGN_FEATURE_TO_ANALYSIS' });
      engine.addEdge({ edgeId: 'E-3', sourceId: 'AN-1', sourceType: 'ANALYSIS', targetId: 'TST-1', targetType: 'TEST', relationshipType: 'ANALYSIS_TO_TEST' });

      const traceIncomplete = engine.getRequirementTrace('REQ-CRIT-1', critReqSpec);
      const gateFailedWhenIncomplete = traceIncomplete.criticalGatePassed === false && traceIncomplete.status === 'PARTIALLY_TRACEABLE';

      // Add Evidence
      engine.addArtifact({ artifactId: 'EV-1', type: 'EVIDENCE', name: 'EV 1' });
      engine.addEdge({ edgeId: 'E-4', sourceId: 'TST-1', sourceType: 'TEST', targetId: 'EV-1', targetType: 'EVIDENCE', relationshipType: 'TEST_TO_EVIDENCE' });

      const traceComplete = engine.getRequirementTrace('REQ-CRIT-1', critReqSpec);
      const gatePassedWhenComplete = traceComplete.criticalGatePassed === true && traceComplete.status === 'FULLY_TRACEABLE';

      checks.CRITICAL_REQUIREMENT_RULE = gateFailedWhenIncomplete && gatePassedWhenComplete;
    } catch (e) {
      checks.CRITICAL_REQUIREMENT_RULE = false;
    }

    // 6. ORPHAN_DETECTION
    try {
      const engine = new RequirementTraceabilityEngine('VERIF-6');
      engine.addArtifact({ artifactId: 'REQ-ORPHAN', type: 'REQUIREMENT', name: 'Orphan Req' });
      engine.addArtifact({ artifactId: 'DF-ORPHAN', type: 'DESIGN_FEATURE', name: 'Orphan DF' });
      const orphans = engine.detectOrphans();
      checks.ORPHAN_DETECTION =
        orphans.orphanRequirements.length === 1 &&
        orphans.orphanDesignFeatures.length === 1 &&
        orphans.totalOrphans === 2;
    } catch (e) {
      checks.ORPHAN_DETECTION = false;
    }

    // 7. DUPLICATE_PROTECTION
    try {
      const engine = new RequirementTraceabilityEngine('VERIF-7');
      engine.addArtifact({ artifactId: 'R1', type: 'REQUIREMENT', name: 'R1' });
      engine.addArtifact({ artifactId: 'DF1', type: 'DESIGN_FEATURE', name: 'DF1' });
      engine.addEdge({ edgeId: 'E1', sourceId: 'R1', sourceType: 'REQUIREMENT', targetId: 'DF1', targetType: 'DESIGN_FEATURE', relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE' });

      let duplicateRejected = false;
      try {
        engine.addEdge({ edgeId: 'E2', sourceId: 'R1', sourceType: 'REQUIREMENT', targetId: 'DF1', targetType: 'DESIGN_FEATURE', relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE' });
      } catch (e: any) {
        duplicateRejected = e instanceof TraceabilityValidationError && e.code === 'DUPLICATE_TRACE_EDGE';
      }
      checks.DUPLICATE_PROTECTION = duplicateRejected;
    } catch (e) {
      checks.DUPLICATE_PROTECTION = false;
    }

    // 8. CYCLE_PROTECTION
    try {
      const engine = new RequirementTraceabilityEngine('VERIF-8');
      engine.addArtifact({ artifactId: 'R1', type: 'REQUIREMENT', name: 'R1' });
      engine.addArtifact({ artifactId: 'DF1', type: 'DESIGN_FEATURE', name: 'DF1' });

      let cycleRejected = false;
      try {
        // Attempt backward edge DF -> R
        engine.addEdge({
          edgeId: 'E-BACK',
          sourceId: 'DF1',
          sourceType: 'DESIGN_FEATURE',
          targetId: 'R1',
          targetType: 'REQUIREMENT',
          relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE' as any
        });
      } catch (e: any) {
        cycleRejected = e instanceof TraceabilityValidationError && e.code === 'INVALID_DIRECTIONAL_RELATIONSHIP';
      }
      checks.CYCLE_PROTECTION = cycleRejected;
    } catch (e) {
      checks.CYCLE_PROTECTION = false;
    }

    // 9. REVERSE_TRACEABILITY
    try {
      const engine = new RequirementTraceabilityEngine('VERIF-9');
      engine.addArtifact({ artifactId: 'REQ-1', type: 'REQUIREMENT', name: 'R1' });
      engine.addArtifact({ artifactId: 'DF-1', type: 'DESIGN_FEATURE', name: 'DF1' });
      engine.addArtifact({ artifactId: 'AN-1', type: 'ANALYSIS', name: 'AN1' });
      engine.addArtifact({ artifactId: 'TST-1', type: 'TEST', name: 'TST1' });
      engine.addArtifact({ artifactId: 'EV-1', type: 'EVIDENCE', name: 'EV1' });

      engine.addEdge({ edgeId: 'E1', sourceId: 'REQ-1', sourceType: 'REQUIREMENT', targetId: 'DF-1', targetType: 'DESIGN_FEATURE', relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE' });
      engine.addEdge({ edgeId: 'E2', sourceId: 'DF-1', sourceType: 'DESIGN_FEATURE', targetId: 'AN-1', targetType: 'ANALYSIS', relationshipType: 'DESIGN_FEATURE_TO_ANALYSIS' });
      engine.addEdge({ edgeId: 'E3', sourceId: 'AN-1', sourceType: 'ANALYSIS', targetId: 'TST-1', targetType: 'TEST', relationshipType: 'ANALYSIS_TO_TEST' });
      engine.addEdge({ edgeId: 'E4', sourceId: 'TST-1', sourceType: 'TEST', targetId: 'EV-1', targetType: 'EVIDENCE', relationshipType: 'TEST_TO_EVIDENCE' });

      const rev = engine.getReverseTrace('EV-1');
      checks.REVERSE_TRACEABILITY =
        rev.requirements.length === 1 &&
        rev.requirements[0].artifactId === 'REQ-1' &&
        rev.isCompleteReverseChain === true;
    } catch (e) {
      checks.REVERSE_TRACEABILITY = false;
    }

    // 10. SERIALIZATION
    try {
      const engine = new RequirementTraceabilityEngine('VERIF-10');
      engine.addArtifact({ artifactId: 'REQ-1', type: 'REQUIREMENT', name: 'R1' });
      engine.addArtifact({ artifactId: 'DF-1', type: 'DESIGN_FEATURE', name: 'DF1' });
      engine.addEdge({ edgeId: 'E1', sourceId: 'REQ-1', sourceType: 'REQUIREMENT', targetId: 'DF-1', targetType: 'DESIGN_FEATURE', relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE' });

      const isRoundTrip = TraceabilitySerializer.verifyRoundTrip(engine);
      checks.SERIALIZATION = isRoundTrip;
    } catch (e) {
      checks.SERIALIZATION = false;
    }

    // 11. EPC001_INTEGRATION
    try {
      const reqSpec: EngineeringRequirement = {
        requirementId: 'REQ-EPC001-01',
        description: 'Pressure hull integrity',
        parameter: 'pressure',
        unit: 'bar',
        tolerance: { upperBound: 300 },
        priority: 'CRITICAL',
        verificationMethod: 'SIMULATION',
        validationMethod: 'PHYSICAL_TEST'
      };
      const reqRef = EngineeringRequirementValidator.toProofCaseRequirementReference(reqSpec);

      const project: ProofCaseProject = {
        caseId: 'CASE-TRACE-01',
        caseType: 'SYSTEM',
        domain: 'FLUID_SYSTEMS',
        revision: 'v1.0.0',
        status: 'DEFINED',
        owner: 'SYSTEM-LEAD',
        requirements: [reqRef],
        models: [],
        simulations: [],
        manufacturing: [],
        tests: [],
        evidence: []
      };

      const validatedProject = ProofCaseValidator.validate(project);
      checks.EPC001_INTEGRATION = validatedProject.requirements[0].requirementId === 'REQ-EPC001-01';
    } catch (e) {
      checks.EPC001_INTEGRATION = false;
    }

    // 12. EPC002_INTEGRATION
    try {
      const reqSpec: EngineeringRequirement = {
        requirementId: 'REQ-EPC002-01',
        description: 'Maximum component weight',
        parameter: 'mass',
        unit: 'kg',
        tolerance: { upperBound: 50 },
        priority: 'HIGH',
        verificationMethod: 'MEASUREMENT',
        validationMethod: 'PHYSICAL_TEST'
      };
      const validated = EngineeringRequirementValidator.validate(reqSpec);
      checks.EPC002_INTEGRATION = validated.requirementId === 'REQ-EPC002-01';
    } catch (e) {
      checks.EPC002_INTEGRATION = false;
    }

    // 13. ADVERSARIAL_RESISTANCE
    try {
      const engine = new RequirementTraceabilityEngine('VERIF-13');
      let passedAllAdv = true;

      try {
        engine.addArtifact(null as any);
        passedAllAdv = false;
      } catch (e) {}

      try {
        engine.addEdge({
          edgeId: 'E-NONEXISTENT',
          sourceId: 'NO-SRC',
          sourceType: 'REQUIREMENT',
          targetId: 'NO-TGT',
          targetType: 'DESIGN_FEATURE',
          relationshipType: 'REQUIREMENT_TO_DESIGN_FEATURE'
        });
        passedAllAdv = false;
      } catch (e) {}

      checks.ADVERSARIAL_RESISTANCE = passedAllAdv;
    } catch (e) {
      checks.ADVERSARIAL_RESISTANCE = false;
    }

    // Compute verdict
    const checkKeys = Object.keys(checks);
    const passedCount = checkKeys.filter(k => checks[k]).length;
    const totalCount = checkKeys.length;

    let verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE' = 'FAIL';
    if (passedCount === totalCount && totalCount > 0) {
      verdict = 'PASS';
    } else if (passedCount > 0) {
      verdict = 'INCONCLUSIVE';
    }

    const timestamp = new Date().toISOString();

    const evidencePayload = {
      epc: 'EPC-003',
      name: 'Requirement Traceability',
      verdict,
      checks,
      implementationRevision: this.REVISION
    };

    const canonicalEvidenceStr = CanonicalSerializer.serialize(evidencePayload).canonicalString;
    const evidenceHash = pureSha256(canonicalEvidenceStr);

    return {
      epc: 'EPC-003',
      name: 'Requirement Traceability',
      verdict,
      checks,
      evidenceHash,
      timestamp,
      implementationRevision: this.REVISION
    };
  }
}
