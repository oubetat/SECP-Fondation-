import { PropertySourceType } from "../types";
import { describe, expect, it } from "vitest";
import { 
  HeatTreatmentEngine, 
  IndependentHeatTreatmentAuditor, 
  HardAcceptanceGate096, 
  generateReports096,
  HeatTreatmentVerdict,
  HeatTreatmentType,
  AtmosphereType,
  CoolingMedium,
  ThermalCycle,
  HeatTreatmentProcess
} from "../index";

describe("PATCH-096: Heat Treatment Framework", () => {
  const mockCycle: ThermalCycle = {
    cycleId: "CYC-01",
    timePoints: [0, 1000, 2000],
    temperaturePoints: [293.15, 1100.15, 1100.15],
    heatingStages: [
      {
        startTemperature: 293.15,
        targetTemperature: 1100.15,
        heatingRate: 0.8,
        duration: 1000,
        atmosphere: AtmosphereType.AIR
      }
    ],
    soakingStages: [
      {
        soakTemperature: 1100.15,
        soakDuration: 1000,
        temperatureUniformity: 2.0,
        atmosphere: AtmosphereType.AIR
      }
    ],
    coolingStages: [],
    fingerprint: "cycle-01-fp"
  };

  const mockEquipment = {
    equipmentId: "EQ-01",
    furnaceType: "Standard Box Furnace",
    temperatureRange: { min: 273.15, max: 1300.15 },
    calibrationStatus: "VALID" as const
  };

  const mockProcess: HeatTreatmentProcess = {
    processId: "PROC-01",
    processType: HeatTreatmentType.ANNEALING,
    materialId: "AISI-4140",
    materialRevision: 1,
    initialConditionId: "COND-ANN",
    targetConditionId: "COND-ANN-FINAL",
    thermalCycle: mockCycle,
    equipment: mockEquipment,
    batchId: "BATCH-001",
    provenance: {
      sourceId: 'Lab Oven Logs', sourceType: PropertySourceType.STANDARD, reference: 'ref', author: 'system', hash: 'hash',
      timestamp: "2026-08-20T11:00:00Z"
    },
    revision: 1
  };

  it("1. HeatTreatmentEngine detects invalid non-monotonic times", () => {
    const invalidCycle: ThermalCycle = {
      ...mockCycle,
      timePoints: [1000, 500, 2000], // non-monotonic
    };
    const validation = HeatTreatmentEngine.validateThermalCycle(invalidCycle);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("strictly monotonic");
  });

  it("2. HeatTreatmentEngine detects invalid temperatures", () => {
    const invalidCycle: ThermalCycle = {
      ...mockCycle,
      temperaturePoints: [293.15, -100, 1100.15], // negative temperature
    };
    const validation = HeatTreatmentEngine.validateThermalCycle(invalidCycle);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("temperature");
  });

  it("3. Compliance evaluation successfully flags out of window processes", () => {
    const window = {
      temperatureRange: { min: 1200, max: 1300 }, // Process max is 1100.15
      timeRange: { min: 0, max: 5000 }
    };
    const comp = HeatTreatmentEngine.evaluateCompliance(mockProcess, window);
    expect(comp).toBe(HeatTreatmentVerdict.NON_COMPLIANT);
  });

  it("4. Hard Acceptance Gate evaluates to PASS", () => {
    const gateReport = HardAcceptanceGate096.evaluateGate();
    expect(gateReport.verdict).toBe("PASS");
  });

  it("5. generateReports096 runs successfully", () => {
    expect(() => generateReports096()).not.toThrow();
  });
});
