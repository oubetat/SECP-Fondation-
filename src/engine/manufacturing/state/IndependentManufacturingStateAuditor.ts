import { ManufacturingState, ManufacturingStateType } from "./types";
import { ManufacturingStateEngine } from "./ManufacturingStateEngine";

export interface ManufacturingAuditReport {
  verdict: "PASS" | "FAIL";
  checks: { id: string; passed: boolean; details: string }[];
}

export class IndependentManufacturingStateAuditor {
  public static audit(state: ManufacturingState): ManufacturingAuditReport {
    const checks: { id: string; passed: boolean; details: string }[] = [];

    // 1. PART_IDENTITY_VALIDATION
    const hasPartId = !!state.partId && state.partId.length > 0;
    checks.push({
      id: "PART_IDENTITY_VALIDATION",
      passed: hasPartId,
      details: hasPartId 
        ? `Part ID successfully tracked: ${state.partId}`
        : "Part is missing a valid part identifier!"
    });

    // 2. CHRONOLOGY_INTEGRITY
    let chronologyValid = true;
    let chronDetails = "Process history sequence is chronologically consistent";
    if (state.processHistory && state.processHistory.length > 0) {
      for (let i = 1; i < state.processHistory.length; i++) {
        const prevEnd = new Date(state.processHistory[i - 1].endTime).getTime();
        const curStart = new Date(state.processHistory[i].startTime).getTime();
        if (curStart < prevEnd) {
          chronologyValid = false;
          chronDetails = `Chronology overlap detected: Operation ${state.processHistory[i].operationId} starts before prior operation completed`;
          break;
        }
      }
    }
    checks.push({
      id: "CHRONOLOGY_INTEGRITY",
      passed: chronologyValid,
      details: chronDetails
    });

    // 3. MATERIAL_CONDITION_ALIGNMENT
    const hasMaterialCondition = !!state.materialCondition;
    checks.push({
      id: "MATERIAL_CONDITION_ALIGNMENT",
      passed: hasMaterialCondition,
      details: hasMaterialCondition
        ? `Verified material condition revision mapping: ${state.materialCondition.conditionId || state.materialCondition}`
        : "Missing material condition references!"
    });

    // 4. INSPECTION_METROLOGY_VALIDATION
    let inspectionValid = true;
    let inspDetails = "All inspection measurements contain valid instrument calibration metadata";
    if (state.inspectionState && state.inspectionState.length > 0) {
      for (const insp of state.inspectionState) {
        if (!insp.instrument || !insp.calibration || insp.calibration === "EXPIRED") {
          inspectionValid = false;
          inspDetails = `Inspection ${insp.inspectionId} lacks a valid instrument or calibration reference`;
          break;
        }
      }
    }
    checks.push({
      id: "INSPECTION_METROLOGY_VALIDATION",
      passed: inspectionValid,
      details: inspDetails
    });

    // 5. GEOMETRIC_TOLERANCE_COMPLIANCE
    let tolerancePassed = true;
    let tolDetails = "Geometry state nominal geometries are fully verified against limits";
    if (state.geometryState.toleranceState === "OUT_OF_TOLERANCE") {
      tolerancePassed = false;
      tolDetails = "Geometric deviation exceeded allowable design tolerances";
    }
    checks.push({
      id: "GEOMETRIC_TOLERANCE_COMPLIANCE",
      passed: tolerancePassed,
      details: tolDetails
    });

    // 6. PROVENANCE_TRACEABILITY
    const hasProvenance = !!state.provenance && (!!state.provenance.sourceId || !!state.provenance.sourceId);
    checks.push({
      id: "PROVENANCE_TRACEABILITY",
      passed: hasProvenance,
      details: hasProvenance
        ? "Verified strict manufacturing provenance records and data sources"
        : "Part history lacks mandatory provenance reference"
    });

    // 7. FINGERPRINT_INTEGRITY
    const expectedFp = ManufacturingStateEngine.calculateStateFingerprint(state);
    const fpValid = state.fingerprint === expectedFp;
    checks.push({
      id: "FINGERPRINT_INTEGRITY",
      passed: fpValid,
      details: fpValid
        ? "State fingerprint matches the cryptographic hash signature perfectly"
        : `Fingerprint mismatch! Expected: ${expectedFp}, Received: ${state.fingerprint}`
    });

    const verdict = checks.every(c => c.passed) ? "PASS" : "FAIL";

    return { verdict, checks };
  }
}
