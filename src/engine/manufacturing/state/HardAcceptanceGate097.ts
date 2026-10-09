import { 
  ManufacturingState, 
  ManufacturingStateType, 
  ManufacturingOperation, 
  ManufacturedGeometryState,
  ManufacturingInspectionState,
  ManufacturingDefectState
} from "./types";
import { ManufacturingStateEngine } from "./ManufacturingStateEngine";
import { IndependentManufacturingStateAuditor } from "./IndependentManufacturingStateAuditor";

export interface Gate097Report {
  verdict: string;
  checks: { id: string; passed: boolean; details: string }[];
}

export class HardAcceptanceGate097 {
  public static evaluateGate(): Gate097Report {
    const checks: { id: string; passed: boolean; details: string }[] = [];

    // 1. STATE MACHINE - VALID AND INVALID TRANSITION CHECKS
    const validTrans = ManufacturingStateEngine.validateTransition(
      ManufacturingStateType.AS_DESIGNED, 
      ManufacturingStateType.AS_PLANNED
    );
    checks.push({
      id: "STATE_TRANSITION_VALID_FLOW",
      passed: validTrans.valid,
      details: "Design state successfully progresses to Plan state"
    });

    const invalidTrans1 = ManufacturingStateEngine.validateTransition(
      ManufacturingStateType.RELEASED, 
      ManufacturingStateType.AS_DESIGNED
    );
    checks.push({
      id: "STATE_TRANSITION_REJECTS_RELEASED_TO_DESIGN",
      passed: !invalidTrans1.valid && invalidTrans1.error?.includes("revert"),
      details: "Properly rejected illegal reverse transition from Released back to Design"
    });

    const invalidTrans2 = ManufacturingStateEngine.validateTransition(
      ManufacturingStateType.SCRAPPED, 
      ManufacturingStateType.RELEASED
    );
    checks.push({
      id: "STATE_TRANSITION_REJECTS_SCRAPPED_TO_RELEASED",
      passed: !invalidTrans2.valid && invalidTrans2.error?.includes("scrapped"),
      details: "Properly rejected illegal recovery from Scrapped directly to Released"
    });

    // 2. SETUP SAMPLE HIGH-QUALITY AS-MANUFACTURED STATE
    const partId = "TURBINE-BLADE-IN718-097";
    const batchId = "BATCH-IN718-024";
    const lotId = "LOT-097";
    const materialId = "INCONEL-718";
    const materialRevision = 3;

    const op1: ManufacturingOperation = {
      operationId: "OP-10-MILL",
      operationType: "Milling",
      sequence: 1,
      plannedParameters: { speed: 1200, feed: 150, depthOfCut: 2.0 },
      actualParameters: { speed: 1195, feed: 150, depthOfCut: 2.0 }, // closely matching
      machineId: "CNC-MILL-HERMLE-01",
      toolId: "CARBIDE-ENDMILL-12MM",
      fixtureId: "VICE-HYDRAULIC-02",
      startTime: "2026-08-20T08:00:00Z",
      endTime: "2026-08-20T09:00:00Z",
      operator: "M. Schneider",
      result: "COMPLETED",
      evidence: "NC-Execution-Log-OP10"
    };

    const op2: ManufacturingOperation = {
      operationId: "OP-20-GRIND",
      operationType: "Grinding",
      sequence: 2,
      plannedParameters: { speed: 3000, feed: 50 },
      actualParameters: { speed: 3005, feed: 48 }, // slightly different but within tolerances
      machineId: "CNC-GRINDER-STUDER-03",
      toolId: "ALUMINA-WHEEL-150MM",
      fixtureId: "MAGNETIC-CHUCK-01",
      startTime: "2026-08-20T09:15:00Z",
      endTime: "2026-08-20T10:00:00Z",
      operator: "M. Schneider",
      result: "COMPLETED",
      evidence: "NC-Execution-Log-OP20"
    };

    const geometryState: ManufacturedGeometryState = {
      nominalGeometry: "TURBINE-BLADE-REV-A.STEP",
      actualGeometryReference: "TURBINE-BLADE-097-MEASURED.STEP",
      geometricRevision: 1,
      deviationReference: "BLADE-097-DEVIATION.CSV",
      coordinateSystem: "WCS-G54",
      toleranceState: "IN_TOLERANCE"
    };

    const defectState: ManufacturingDefectState[] = [
      {
        defectId: "DEF-01",
        defectType: "porosity",
        location: "X:23.1, Y:12.4, Z:5.0",
        size: 0.12, // mm
        orientation: "isotropic",
        severity: 1, // very low
        detectionMethod: "ultrasonic",
        confidence: 0.95,
        provenance: "NDT-Report-IN718-01"
      }
    ];

    const inspectionState: ManufacturingInspectionState[] = [
      {
        inspectionId: "INSP-BLADE-097",
        method: "CMM Metrology & NDT Ultrasonic",
        instrument: "Zeiss Prismo CMM",
        calibration: "VALID-CAL-2026-07-12",
        result: "PASS",
        defectFindings: defectState,
        dimensionalFindings: [
          {
            measurement: "Chord Width",
            nominal: 45.0,
            actual: 45.02,
            deviation: 0.02,
            tolerance: 0.05,
            instrument: "CMM Tactile Probe",
            calibration: "CAL-ZEISS-2026",
            timestamp: "2026-08-20T10:30:00Z"
          }
        ],
        materialFindings: [],
        operator: "S. Vance",
        evidence: "CMM-Metrology-Run-4421"
      }
    ];

    const state: ManufacturingState = {
      stateId: "STATE-BLADE-097-IN718",
      partId,
      batchId,
      lotId,
      materialId,
      materialRevision,
      stateType: ManufacturingStateType.AS_INSPECTED,
      processHistory: [op1, op2],
      geometryState,
      materialCondition: {
        conditionId: "COND-IN718-QT",
        conditionName: "Solution Treated & Aged (IN718)"
      },
      defectState,
      inspectionState,
      provenance: {
        sourceId: "GENEALOGY-BLADE-097",
        sourceType: "EXPERIMENT" as any,
        reference: "JobCard-IN718-TurbineBlade-992",
        timestamp: "2026-08-20T11:00:00Z",
        author: "M. Schneider",
        hash: "e5f2a1b3c4d5e6f7"
      },
      revision: 1,
      timestamp: "2026-08-20T11:00:00Z",
      fingerprint: ""
    };

    // Calculate actual fingerprint
    state.fingerprint = ManufacturingStateEngine.calculateStateFingerprint(state);

    // 3. RECONCILIATION - PLAN VS ACTUAL PARAMETERS
    const recon1 = ManufacturingStateEngine.reconcileParameters(op1.plannedParameters, op1.actualParameters);
    checks.push({
      id: "PROCESS_RECONCILIATION_MATCHED",
      passed: recon1.status === "MATCHED",
      details: "Operation 1 parameters reconciled cleanly within specified tolerances (MATCHED)"
    });

    const anomalousOp = {
      plannedParameters: { feed: 150, speed: 1200 },
      actualParameters: { feed: 300, speed: 1200 } // Extreme deviation (double feed rate)
    };
    const recon2 = ManufacturingStateEngine.reconcileParameters(anomalousOp.plannedParameters, anomalousOp.actualParameters);
    checks.push({
      id: "PROCESS_RECONCILIATION_CONFLICT",
      passed: recon2.status === "CONFLICT",
      details: "Anomalous operation feed-rate mismatch correctly flagged as CONFLICT"
    });

    // 4. CHRONOLOGY CHECKS
    const auditorReport = IndependentManufacturingStateAuditor.audit(state);
    checks.push({
      id: "INDEPENDENT_STATE_AUDITOR_PASS",
      passed: auditorReport.verdict === "PASS",
      details: "Passed third-party independent manufacturing auditor checklist cleanly"
    });

    // 5. CHRONOLOGICAL ERROR DETECTION
    const outOfOrderHistory = [
      { ...op2, startTime: "2026-08-20T08:30:00Z", endTime: "2026-08-20T09:30:00Z" }, // ends at 09:30, while op1 below starts at 08:00 (overlap/out-of-order)
      op1
    ];
    const chronologyCheckState = { ...state, processHistory: outOfOrderHistory };
    const chronologicalAuditorReport = IndependentManufacturingStateAuditor.audit(chronologyCheckState);
    checks.push({
      id: "CHRONOLOGY_INTEGRITY_CHECK",
      passed: chronologicalAuditorReport.verdict === "FAIL" && 
              chronologicalAuditorReport.checks.some(c => c.id === "CHRONOLOGY_INTEGRITY" && !c.passed),
      details: "Successfully flagged chronological operation overlaps or out-of-order execution histories"
    });

    const verdict = checks.every(c => c.passed) ? "PASS" : "FAIL";

    return { verdict, checks };
  }
}
