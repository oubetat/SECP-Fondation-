// SECP Industrial OS v2 — Inspection Identity & Evaluation Service
import {
  InspectionRequirement,
  MeasurementRecord,
  CalibrationRecord,
  ToleranceEvaluation,
  InspectionVerdict,
  InspectionState
} from './types';
import { CanonicalInspectionSerializer } from './CanonicalInspectionSerializer';

export class InspectionIdentityService {

  // 1. Verify Requirement Revision
  public static verifyRequirementRevision(
    inspectionRequirementRevision: string,
    releasedRequirementRevision: string
  ): { valid: boolean; error?: string } {
    if (inspectionRequirementRevision !== releasedRequirementRevision) {
      return {
        valid: false,
        error: `REQUIREMENT_REVISION_MISMATCH: Inspection requirement revision [${inspectionRequirementRevision}] does not match released revision [${releasedRequirementRevision}]`
      };
    }
    return { valid: true };
  }

  // 2. Verify Calibration State
  public static verifyCalibration(
    calibration: CalibrationRecord
  ): { valid: boolean; error?: string } {
    if (calibration.status !== 'VALID') {
      return {
        valid: false,
        error: `CALIBRATION_FAILURE: Calibration state is ${calibration.status}`
      };
    }
    const expiry = new Date(calibration.expiryDate);
    if (expiry < new Date()) {
      return {
        valid: false,
        error: `CALIBRATION_EXPIRED: Calibration expired on ${calibration.expiryDate}`
      };
    }
    return { valid: true };
  }

  // 3. Normalize Units (simplistic for demonstration, but checks mismatch)
  public static normalizeUnit(value: number, sourceUnit: string, targetUnit: string): number {
    if (sourceUnit === targetUnit) return value;
    if (sourceUnit === 'in' && targetUnit === 'mm') return value * 25.4;
    if (sourceUnit === 'mm' && targetUnit === 'in') return value / 25.4;
    throw new Error(`UNIT_MISMATCH: Cannot implicitly convert ${sourceUnit} to ${targetUnit}`);
  }

  // 4. Guard Band & Tolerance Evaluation
  public static evaluateTolerance(
    requirement: InspectionRequirement,
    measurement: MeasurementRecord
  ): ToleranceEvaluation {
    const dev = Math.abs(measurement.measuredValue - requirement.nominal);
    let verdict: InspectionVerdict = 'WITHIN_TOLERANCE' as any; // Temporary, will refine below
    
    // Evaluate if measurement uncertainty exceeds requirement capability limit
    if (measurement.uncertainty > requirement.uncertaintyLimit) {
      verdict = 'MEASUREMENT_INVALID';
    } else {
      // Guard banding implementation
      // A strict guard band reduces the acceptance zone by the uncertainty
      const effectiveUpper = requirement.upperLimit - measurement.uncertainty;
      const effectiveLower = requirement.lowerLimit + measurement.uncertainty;
      
      if (measurement.measuredValue > requirement.upperLimit || measurement.measuredValue < requirement.lowerLimit) {
        verdict = 'OUT_OF_TOLERANCE';
      } else if (measurement.measuredValue > effectiveUpper || measurement.measuredValue < effectiveLower) {
        // Measurement is inside tolerance but outside guard band (ambiguous zone)
        verdict = 'INDETERMINATE';
      } else {
        verdict = 'PASS';
      }
    }

    return {
      requirementId: requirement.requirementId,
      nominal: requirement.nominal,
      lowerLimit: requirement.lowerLimit,
      upperLimit: requirement.upperLimit,
      measured: measurement.measuredValue,
      deviation: dev,
      uncertainty: measurement.uncertainty,
      acceptanceMargin: Math.min(
        requirement.upperLimit - measurement.measuredValue,
        measurement.measuredValue - requirement.lowerLimit
      ),
      verdict
    };
  }

  // 5. Aggregate Verdict
  public static aggregateVerdict(evaluations: ToleranceEvaluation[]): InspectionVerdict {
    if (evaluations.length === 0) return 'INCOMPLETE';

    let hasIndeterminate = false;

    for (const ev of evaluations) {
      if (ev.verdict === 'MEASUREMENT_INVALID') return 'MEASUREMENT_INVALID';
      if (ev.verdict === 'OUT_OF_TOLERANCE') return 'OUT_OF_TOLERANCE';
      if (ev.verdict === 'INDETERMINATE') hasIndeterminate = true;
      if (ev.verdict === 'FAIL') return 'FAIL';
    }

    return hasIndeterminate ? 'INDETERMINATE' : 'PASS';
  }

  // 6. Cross-Part Evidence Attack Check
  public static verifyCrossPartEvidence(
    measuredPartSerial: string,
    inspectionPartSerial: string
  ): { valid: boolean; error?: string } {
    if (measuredPartSerial !== inspectionPartSerial) {
      return {
        valid: false,
        error: `PART_IDENTITY_MISMATCH: Measurement evidence for part ${measuredPartSerial} cannot be applied to inspection for part ${inspectionPartSerial}`
      };
    }
    return { valid: true };
  }

  // 7. Full Audit
  public static auditInspectionState(state: InspectionState, actualPartSerial: string): {
    evaluations: ToleranceEvaluation[];
    verdict: InspectionVerdict;
    errors: string[];
  } {
    const errors: string[] = [];

    // Calibration
    const calCheck = this.verifyCalibration(state.calibrationRecord);
    if (!calCheck.valid && calCheck.error) {
      errors.push(calCheck.error);
    }

    // Evaluate all measurements against requirements
    const evaluations: ToleranceEvaluation[] = [];
    const reqMap = new Map(state.inspectionPlan.requirements.map(r => [r.requirementId, r]));

    for (const m of state.measurements) {
      const req = reqMap.get(m.requirementId);
      if (!req) {
        errors.push(`REQUIREMENT_NOT_FOUND: Measurement refers to unknown requirement ${m.requirementId}`);
        continue;
      }
      try {
        evaluations.push(this.evaluateTolerance(req, m));
      } catch (e: any) {
        errors.push(e.message);
      }
    }

    let overallVerdict = this.aggregateVerdict(evaluations);

    if (errors.length > 0) {
      if (errors.some(e => e.includes('CALIBRATION_EXPIRED') || e.includes('CALIBRATION_FAILURE'))) {
        overallVerdict = 'CALIBRATION_FAILURE';
      } else if (errors.some(e => e.includes('UNIT_MISMATCH') || e.includes('REQUIREMENT_NOT_FOUND'))) {
        overallVerdict = 'INVALID';
      }
    }

    // Check missing measurements
    if (state.measurements.length < state.inspectionPlan.requirements.length && overallVerdict === 'PASS') {
      overallVerdict = 'INCOMPLETE';
      errors.push('INCOMPLETE: Missing measurements for some requirements');
    }

    return { evaluations, verdict: overallVerdict, errors };
  }
}
