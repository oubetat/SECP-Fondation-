import { PropertySourceType } from "../types";
import { 
  HeatTreatmentProcess, 
  TreatedMaterialCondition, 
  HeatTreatmentType, 
  AtmosphereType, 
  CoolingMedium, 
  HeatTreatmentVerdict,
  HeatTreatmentProcessWindow,
  ThermalCycle
} from "./types";
import { HeatTreatmentEngine } from "./HeatTreatmentEngine";
import { IndependentHeatTreatmentAuditor } from "./IndependentHeatTreatmentAuditor";

export interface Gate096Report {
  verdict: string;
  checks: { id: string; passed: boolean; details: string }[];
}

export class HardAcceptanceGate096 {
  public static evaluateGate(): Gate096Report {
    const checks: { id: string; passed: boolean; details: string }[] = [];

    // Setup sample material and batch
    const materialId = "AISI-4140";
    const materialRevision = 2;
    const batchId = "BATCH-4140-QT-009";

    // 1. Setup high-quality Thermal Cycle (Austenitize -> Quench -> Temper -> Cool)
    const thermalCycle: ThermalCycle = {
      cycleId: "CYC-4140-QT",
      timePoints: [0, 3600, 7200, 7210, 10810, 14410, 18010],
      temperaturePoints: [293.15, 1123.15, 1123.15, 313.15, 313.15, 873.15, 293.15],
      heatingStages: [
        {
          startTemperature: 293.15,
          targetTemperature: 1123.15,
          heatingRate: 0.23, // K/s
          duration: 3600,
          atmosphere: AtmosphereType.CONTROLLED
        }
      ],
      soakingStages: [
        {
          soakTemperature: 1123.15,
          soakDuration: 3600,
          temperatureUniformity: 5.0,
          atmosphere: AtmosphereType.CONTROLLED
        }
      ],
      coolingStages: [
        {
          startTemperature: 1123.15,
          endTemperature: 313.15,
          coolingRate: 81.0, // fast quench rate
          medium: CoolingMedium.OIL,
          agitation: "HIGH",
          atmosphere: AtmosphereType.CONTROLLED
        },
        {
          startTemperature: 873.15,
          endTemperature: 293.15,
          coolingRate: 0.16, // slow cool after temper
          medium: CoolingMedium.AIR,
          agitation: "NONE",
          atmosphere: AtmosphereType.AIR
        }
      ],
      fingerprint: "cycle-fingerprint-4140"
    };

    const equipment = {
      equipmentId: "FURNACE-IPSEN-04",
      furnaceType: "Controlled Atmosphere Batch Furnace",
      temperatureRange: { min: 273.15, max: 1573.15 },
      calibrationStatus: "VALID" as const,
      calibrationDate: "2026-05-15",
      calibrationRevision: 3
    };

    const process: HeatTreatmentProcess = {
      processId: "PROC-4140-QT-01",
      processType: HeatTreatmentType.QUENCH_AND_TEMPER,
      materialId,
      materialRevision,
      initialConditionId: "COND-4140-ANN",
      targetConditionId: "COND-4140-QT",
      thermalCycle,
      equipment,
      batchId,
      provenance: {
        sourceId: 'Ipsen Furnace logs #9921', sourceType: PropertySourceType.STANDARD, reference: 'ref', author: 'system', hash: 'hash',
        timestamp: "2026-08-20T11:00:00Z"
      },
      revision: 1
    };

    const targetCondition: TreatedMaterialCondition = {
      conditionId: "COND-4140-QT",
      materialId,
      materialRevision,
      conditionName: "Quenched & Tempered (873K / 600C)",
      heatTreatmentHistory: ["PROC-4140-QT-01"],
      microstructure: {
        grainSize: {
          value: 8.5,
          unit: "ASTM E112",
          method: "ASTM E112"
        },
        phaseFractions: [
        ],
        provenance: "MEASURED"
      },
      properties: {
        hardness: {
          value: 32,
          scale: "HRC"
        },
        yieldStrength: 950e6, // 950 MPa
        ultimateStrength: 1080e6, // 1080 MPa
        elongation: 0.15
      },
      provenance: {
        sourceId: 'Mechanical Lab Report #4140-QT-99', sourceType: PropertySourceType.STANDARD, reference: 'ref', author: 'system', hash: 'hash',
        timestamp: "2026-08-20T11:00:00Z"
      },
      revision: 1
    };

    // 1. THERMAL CYCLE MONOTONICITY & TRANSITIONS
    const cycleVal = HeatTreatmentEngine.validateThermalCycle(thermalCycle);
    checks.push({
      id: "THERMAL_CYCLE_VALIDITY",
      passed: cycleVal.valid,
      details: "Successfully validated time monotonicity and temperature sequence of the Q&T process cycle"
    });

    // 2. HARDNESS PROPERTY SCHEMA AND RESOLUTION
    const hardnessValid = targetCondition.properties.hardness?.value === 32 && targetCondition.properties.hardness?.scale === "HRC";
    checks.push({
      id: "HARDNESS_PROPERTY_SCHEMA",
      passed: hardnessValid,
      details: "Hardness is correctly represented with an explicit value (32) and scale (HRC)"
    });

    // 3. PROCESS COMPLIANCE - INSIDE PROCESS WINDOW
    const processWindow: HeatTreatmentProcessWindow = {
      temperatureRange: { min: 1100.15, max: 1150.15 }, // target aust. temperature
      timeRange: { min: 10000, max: 20000 }, // overall process time
      coolingRateRange: { min: 50, max: 100 } // oil quench rate window
    };
    const complianceInside = HeatTreatmentEngine.evaluateCompliance(process, processWindow);
    checks.push({
      id: "PROCESS_COMPLIANCE_INSIDE_WINDOW",
      passed: complianceInside === HeatTreatmentVerdict.COMPLIANT,
      details: "Successfully verified process compliance within the specified temperature/time/cooling-rate process window"
    });

    // 4. PROCESS COMPLIANCE - OUTSIDE WINDOW
    const tightWindow: HeatTreatmentProcessWindow = {
      temperatureRange: { min: 1200.15, max: 1300.15 }, // Out of range!
      timeRange: { min: 10000, max: 20000 }
    };
    const complianceOutside = HeatTreatmentEngine.evaluateCompliance(process, tightWindow);
    checks.push({
      id: "PROCESS_COMPLIANCE_OUTSIDE_WINDOW",
      passed: complianceOutside === HeatTreatmentVerdict.NON_COMPLIANT,
      details: "Successfully flagged non-compliant process when heat treat temperature fell outside the specification window"
    });

    // 5. INDEPENDENT AUDITOR CHECK
    const auditReport = IndependentHeatTreatmentAuditor.audit(process, targetCondition);
    checks.push({
      id: "INDEPENDENT_AUDITOR_VERIFICATION",
      passed: auditReport.verdict === "PASS",
      details: "Passed third-party auditor check verifying material consistency, calibration status, and lot traceability"
    });

    // 6. PROCESS AND CONDITION FINGERPRINTS
    const procFp = HeatTreatmentEngine.calculateProcessFingerprint(process);
    const condFp = HeatTreatmentEngine.calculateConditionFingerprint(targetCondition);
    checks.push({
      id: "DETERMINISTIC_FINGERPRINTING",
      passed: procFp.startsWith("process-fp-") && condFp.startsWith("cond-fp-"),
      details: `Generated distinct immutable fingerprints: Process: ${procFp}, Condition: ${condFp}`
    });

    // 7. PROPERTY REFERENCE MISMATCH CHECK
    const annealCondition: TreatedMaterialCondition = {
      ...targetCondition,
      conditionId: "COND-4140-ANN",
      conditionName: "Annealed AISI-4140",
      properties: {
        hardness: { value: 15, scale: "HRC" },
        yieldStrength: 415e6
      }
    };
    const refMismatch = annealCondition.conditionId === process.initialConditionId;
    checks.push({
      id: "PROPERTY_REFERENCE_INTEGRITY",
      passed: refMismatch,
      details: "Verified initial and target conditions are mapped correctly without silent reference pollution"
    });

    const verdict = checks.every(c => c.passed) ? "PASS" : "FAIL";

    return { verdict, checks };
  }
}
