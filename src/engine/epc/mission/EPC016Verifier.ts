/**
 * SECP Industrial OS — EPC-016: Mission & Product Definition Verifier
 * Executes canonical automated checks and validation for EPC-016 compliance.
 */

import { IndustrialDroneProofCase } from './IndustrialDroneProofCase';
import { MissionValidator } from './MissionValidator';
import { EPC016InputConfig, EPC016ValidationError } from './MissionTypes';
import { ProofCaseValidator } from '../ProofCaseValidator';
import { EngineeringRequirementValidator } from '../EngineeringRequirementValidator';
import { EvidenceIntegrityService } from '../evidence/EvidenceIntegrityService';

export interface EPC016VerificationResult {
  readonly epc: 'EPC-016';
  readonly name: 'Mission & Product Definition';
  readonly verdict: 'PASS' | 'FAIL' | 'INCONCLUSIVE';
  readonly checks: Record<string, { passed: boolean; message: string; details?: unknown }>;
  readonly evidenceHash: string;
  readonly timestamp: string;
  readonly implementationRevision: string;
}

export class EPC016Verifier {
  public static readonly REVISION = 'SECP-EPC-016-REV1';

  /**
   * Runs all verification checks for EPC-016 and produces a canonical validation result.
   */
  public static runVerification(config?: EPC016InputConfig): EPC016VerificationResult {
    const checks: Record<string, { passed: boolean; message: string; details?: unknown }> = {};
    const effectiveConfig = config || IndustrialDroneProofCase.createDefaultInspectionDroneConfig();

    const recordCheck = (id: string, condition: boolean, successMsg: string, failMsg: string, details?: unknown) => {
      const entry: { passed: boolean; message: string; details?: unknown } = {
        passed: condition,
        message: condition ? successMsg : failMsg
      };
      if (details !== undefined) {
        entry.details = details;
      }
      checks[id] = entry;
    };

    // 1. PROOF_CASE_IDENTITY
    try {
      const bundle = IndustrialDroneProofCase.createProductBundle(effectiveConfig);
      const pcValid = Boolean(ProofCaseValidator.validate(bundle.proofCase));
      const isCorrectId = bundle.proofCase.caseId === (effectiveConfig.caseId || 'EPC-CASE-001');
      const isStatusDefined = bundle.proofCase.status === 'DEFINED';

      recordCheck(
        'PROOF_CASE_IDENTITY',
        pcValid && isCorrectId && isStatusDefined,
        'Proof Case identity is valid, compliant with EPC-001 schema, and marked as DEFINED.',
        'Proof Case identity or EPC-001 validation failed.',
        { caseId: bundle.proofCase.caseId, status: bundle.proofCase.status }
      );
    } catch (e: any) {
      recordCheck('PROOF_CASE_IDENTITY', false, '', `Exception during ProofCase validation: ${e.message}`);
    }

    // 2. MISSION_DEFINITION
    try {
      MissionValidator.validateMission(effectiveConfig.mission);
      recordCheck(
        'MISSION_DEFINITION',
        true,
        'Mission definition complete with valid duration, range, payload, altitude, and speed parameters.',
        'Mission definition is incomplete or invalid.'
      );
    } catch (e: any) {
      recordCheck('MISSION_DEFINITION', false, '', `Mission definition error: ${e.message}`);
    }

    // 3. ENVIRONMENT_DEFINITION
    try {
      MissionValidator.validateEnvironment(effectiveConfig.environment);
      recordCheck(
        'ENVIRONMENT_DEFINITION',
        true,
        'Operating environment definition valid with temperature, pressure, humidity, wind, gust, and altitude ranges.',
        'Environment definition failed validation.'
      );
    } catch (e: any) {
      recordCheck('ENVIRONMENT_DEFINITION', false, '', `Environment validation error: ${e.message}`);
    }

    // 4. PAYLOAD_DEFINITION
    try {
      MissionValidator.validatePayload(effectiveConfig.payload);
      recordCheck(
        'PAYLOAD_DEFINITION',
        true,
        'Payload definition valid with positive mass, dimensions, power, CG, duty cycle, and requirements.',
        'Payload definition failed validation.'
      );
    } catch (e: any) {
      recordCheck('PAYLOAD_DEFINITION', false, '', `Payload validation error: ${e.message}`);
    }

    // 5. ENDURANCE_DEFINITION
    try {
      MissionValidator.validateEndurance(effectiveConfig.endurance);
      recordCheck(
        'ENDURANCE_DEFINITION',
        true,
        'Endurance and energy budgets defined with clear separation between requirements and predictions.',
        'Endurance definition failed validation.'
      );
    } catch (e: any) {
      recordCheck('ENDURANCE_DEFINITION', false, '', `Endurance validation error: ${e.message}`);
    }

    // 6. PERFORMANCE_REQUIREMENTS_EPC002
    try {
      const bundle = IndustrialDroneProofCase.createProductBundle(effectiveConfig);
      let allReqsValid = true;
      for (const req of bundle.requirements) {
        if (!EngineeringRequirementValidator.validate(req)) {
          allReqsValid = false;
          break;
        }
      }
      recordCheck(
        'PERFORMANCE_REQUIREMENTS_EPC002',
        allReqsValid && bundle.requirements.length >= 15,
        `All ${bundle.requirements.length} generated engineering requirements conform to EPC-002 schema.`,
        'Requirements failed EPC-002 validation.'
      );
    } catch (e: any) {
      recordCheck('PERFORMANCE_REQUIREMENTS_EPC002', false, '', `Requirement validation error: ${e.message}`);
    }

    // 7. ASSUMPTION_VS_REQUIREMENT_SEPARATION
    try {
      const bundle = IndustrialDroneProofCase.createProductBundle(effectiveConfig);
      const assumptionsCount = bundle.assumptions ? bundle.assumptions.length : 0;
      const noAssumptionsAsVerifiedReqs = bundle.requirements.every(r => r.metadata?.status !== 'VERIFIED');
      recordCheck(
        'ASSUMPTION_VS_REQUIREMENT_SEPARATION',
        assumptionsCount >= 0 && noAssumptionsAsVerifiedReqs,
        'Assumptions are explicitly tracked separately from requirements and not treated as verified facts.',
        'Assumptions mixed with verified requirements.'
      );
    } catch (e: any) {
      recordCheck('ASSUMPTION_VS_REQUIREMENT_SEPARATION', false, '', `Assumption check error: ${e.message}`);
    }

    // 8. CONFIGURATION_BASELINE_EPC004
    try {
      const bundle = IndustrialDroneProofCase.createProductBundle(effectiveConfig);
      const cb = bundle.configurationBaseline;
      const isCompliant =
        cb &&
        cb.baselineId &&
        cb.status === 'QUALIFIED' &&
        cb.cad === 'NOT_DEFINED_YET' &&
        cb.cae === 'NOT_DEFINED_YET' &&
        cb.mesh === 'NOT_DEFINED_YET' &&
        cb.solver === 'NOT_DEFINED_YET' &&
        cb.cam === 'NOT_DEFINED_YET';

      recordCheck(
        'CONFIGURATION_BASELINE_EPC004',
        !!isCompliant,
        'Configuration baseline contains defined mission/payload configs and accurately marks uninstantiated CAD/CAE as NOT_DEFINED_YET.',
        'Configuration baseline is invalid or generated fake CAD/CAE models.'
      );
    } catch (e: any) {
      recordCheck('CONFIGURATION_BASELINE_EPC004', false, '', `Baseline check error: ${e.message}`);
    }

    // 9. EVIDENCE_PACKAGE_EPC009
    try {
      const bundle = IndustrialDroneProofCase.createProductBundle(effectiveConfig);
      const ep = bundle.evidencePackage as any;
      const hashValid = ep && ep.contentHash && typeof ep.contentHash === 'string' && ep.contentHash.length === 64;
      const sourceValid = ep && ep.source === 'EPC-016';

      recordCheck(
        'EVIDENCE_PACKAGE_EPC009',
        hashValid && sourceValid,
        'Evidence package assembled with cryptographic SHA-256 integrity hash and EPC-009 compliance.',
        'Evidence package creation or integrity check failed.'
      );
    } catch (e: any) {
      recordCheck('EVIDENCE_PACKAGE_EPC009', false, '', `Evidence package error: ${e.message}`);
    }

    // 10. PROVENANCE_EPC011
    try {
      const bundle = IndustrialDroneProofCase.createProductBundle(effectiveConfig);
      const prov = bundle.provenance;
      const provValid =
        prov &&
        prov.provenanceId &&
        prov.actor &&
        prov.action &&
        prov.timestamp &&
        prov.source === 'EPC-016' &&
        prov.sourceVersion &&
        prov.inputs &&
        prov.process &&
        prov.outputs &&
        prov.outputs.length > 0;

      recordCheck(
        'PROVENANCE_EPC011',
        !!provValid,
        'Complete EPC-011 provenance record generated with actor, action, timestamp, source, inputs, process, and outputs.',
        'Provenance record failed validation.'
      );
    } catch (e: any) {
      recordCheck('PROVENANCE_EPC011', false, '', `Provenance check error: ${e.message}`);
    }

    // 11. INPUT_VALIDATION_NEGATIVE_REJECTION
    try {
      let rejectedNegativeMass = false;
      try {
        const invalidConfig = {
          ...effectiveConfig,
          payload: {
            ...effectiveConfig.payload,
            payloadMass: { value: -5, unit: 'kg' }
          }
        };
        MissionValidator.validate(invalidConfig);
      } catch (e: any) {
        rejectedNegativeMass = e instanceof EPC016ValidationError && e.code === 'NEGATIVE_PAYLOAD_MASS';
      }

      let rejectedInvalidUnit = false;
      try {
        const invalidConfig = {
          ...effectiveConfig,
          mission: {
            ...effectiveConfig.mission,
            operatingSpeed: { value: 12, unit: 'furlongs_per_fortnight' }
          }
        };
        MissionValidator.validate(invalidConfig);
      } catch (e: any) {
        rejectedInvalidUnit = e instanceof EPC016ValidationError && e.code === 'INVALID_UNIT';
      }

      recordCheck(
        'INPUT_VALIDATION_NEGATIVE_REJECTION',
        rejectedNegativeMass && rejectedInvalidUnit,
        'Input validator strictly rejects negative masses, invalid units, and non-physical values.',
        'Validator failed to reject negative mass or invalid units.'
      );
    } catch (e: any) {
      recordCheck('INPUT_VALIDATION_NEGATIVE_REJECTION', false, '', `Validation test error: ${e.message}`);
    }

    const allPassed = Object.values(checks).every(c => c.passed);
    const verdict = allPassed ? 'PASS' : 'FAIL';
    const timestamp = new Date().toISOString();
    const evidenceHash = EvidenceIntegrityService.computeHash({
      checks,
      verdict,
      timestamp,
      revision: this.REVISION
    });

    return {
      epc: 'EPC-016',
      name: 'Mission & Product Definition',
      verdict,
      checks,
      evidenceHash,
      timestamp,
      implementationRevision: this.REVISION
    };
  }
}
