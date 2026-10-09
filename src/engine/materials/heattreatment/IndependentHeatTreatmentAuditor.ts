import { HeatTreatmentProcess, TreatedMaterialCondition, HeatTreatmentVerdict } from "./types";
import { HeatTreatmentEngine } from "./HeatTreatmentEngine";

export interface HeatTreatmentAuditReport {
  verdict: string;
  checks: { id: string; passed: boolean; details: string }[];
}

export class IndependentHeatTreatmentAuditor {
  public static audit(
    process: HeatTreatmentProcess,
    condition: TreatedMaterialCondition
  ): HeatTreatmentAuditReport {
    const checks: { id: string; passed: boolean; details: string }[] = [];

    // 1. MATERIAL_ONTOLOGY_CONSISTENCY
    const matMatch = process.materialId === condition.materialId;
    checks.push({
      id: "MATERIAL_ONTOLOGY_CONSISTENCY",
      passed: matMatch,
      details: matMatch 
        ? `Material IDs match consistently: ${process.materialId}`
        : `Material ID mismatch! Process has ${process.materialId}, Condition has ${condition.materialId}`
    });

    // 2. THERMAL_CYCLE_VALIDITY
    const cycleValidation = HeatTreatmentEngine.validateThermalCycle(process.thermalCycle);
    checks.push({
      id: "THERMAL_CYCLE_VALIDITY",
      passed: cycleValidation.valid,
      details: cycleValidation.valid
        ? "Thermal cycle validated successfully (monotonic time, valid temperatures)"
        : `Thermal cycle invalid: ${cycleValidation.error}`
    });

    // 3. EQUIPMENT_CALIBRATION_CHECK
    const calStatus = process.equipment.calibrationStatus === "VALID";
    checks.push({
      id: "EQUIPMENT_CALIBRATION_CHECK",
      passed: calStatus,
      details: calStatus
        ? `Equipment ${process.equipment.equipmentId} has valid calibration.`
        : `Equipment ${process.equipment.equipmentId} calibration is EXPIRED or INVALID!`
    });

    // 4. BATCH_LOT_TRACEABILITY
    const batchValid = !!process.batchId && process.batchId.length > 0;
    checks.push({
      id: "BATCH_LOT_TRACEABILITY",
      passed: batchValid,
      details: batchValid
        ? `Batch/Lot ID successfully traced: ${process.batchId}`
        : "Process is missing mandatory batch/lot identifier!"
    });

    // 5. DATA_PROVENANCE_INTEGRITY
    const provValid = !!process.provenance && !!process.provenance.sourceId;
    checks.push({
      id: "DATA_PROVENANCE_INTEGRITY",
      passed: provValid,
      details: provValid
        ? "Process data source provenance successfully traced"
        : "Missing mandatory process provenance source!"
    });

    // 6. MICROSTRUCTURE_PROVENANCE
    const hasMicro = !!condition.microstructure;
    const microProvValid = hasMicro 
      ? ["MEASURED", "SIMULATED", "INFERRED", "REFERENCE"].includes(condition.microstructure!.provenance)
      : true;
    checks.push({
      id: "MICROSTRUCTURE_PROVENANCE",
      passed: microProvValid,
      details: hasMicro 
        ? `Microstructure provenance is valid: ${condition.microstructure!.provenance}`
        : "No microstructure metadata specified (allowed by fallback)"
    });

    // 7. HARDNESS_SCALE_VALIDITY
    let hardnessValid = true;
    if (condition.properties.hardness) {
      hardnessValid = ["HB", "HRC", "HV"].includes(condition.properties.hardness.scale);
    }
    checks.push({
      id: "HARDNESS_SCALE_VALIDITY",
      passed: hardnessValid,
      details: hardnessValid
        ? "Hardness properties are defined with standard validated scales (HB, HRC, HV)"
        : "Hardness lacks a valid scale definition!"
    });

    // Final Verdict
    const verdict = checks.every(c => c.passed) ? "PASS" : "FAIL";

    return { verdict, checks };
  }
}
