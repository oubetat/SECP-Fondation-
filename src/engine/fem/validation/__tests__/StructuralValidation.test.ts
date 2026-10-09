import { describe, expect, it } from "vitest";
import { ReferenceDatasetManager } from "../ReferenceDatasetManager";
import { CorrelationEngines } from "../CorrelationEngines";
import { UncertaintyModel } from "../UncertaintyModel";
import { StructuralValidationEngine } from "../StructuralValidationEngine";
import { HardAcceptanceGate088 } from "../HardAcceptanceGate088";
import { generateReports088 } from "../generateReports088";
import { ReferenceSourceType, ReferenceDataset, ValidationVerdict, ValidationStatus } from "../types";

describe("PATCH-088: Structural Validation Framework", () => {
  it("1. ReferenceDatasetManager verifies integrity and locks datasets", () => {
    const data = { freq: 440 };
    const dataset: ReferenceDataset = {
      datasetId: 'DS_TEST',
      source: 'Source',
      sourceType: ReferenceSourceType.EXPERIMENTAL,
      acquisitionDate: '2026-08-20',
      datasetVersion: '1.0',
      rawDataHash: ReferenceDatasetManager.hashDataset(data),
      units: 'Hz',
      data,
      uncertainty: 0.1
    };
    expect(ReferenceDatasetManager.verifyIntegrity(dataset)).toBe(true);
    
    dataset.data.freq = 441;
    expect(ReferenceDatasetManager.verifyIntegrity(dataset)).toBe(false);
  });

  it("2. CorrelationEngines performs RMSE, MAC, and frequency correlation", () => {
    const rmse = CorrelationEngines.correlateDisplacement([1, 2], [1.01, 1.99], 0, 0.05);
    expect(rmse.status).toBe(ValidationStatus.PASS);

    const mac = CorrelationEngines.calculateMAC([1, 0], [1, 0.01]);
    expect(mac).toBeGreaterThan(0.99);

    const freq = CorrelationEngines.correlateFrequency(100, 101, 0.02);
    expect(freq.status).toBe(ValidationStatus.PASS);
  });

  it("3. UncertaintyModel combines uncertainties correctly", () => {
    const combined = UncertaintyModel.combineUncertainty(3, 4);
    expect(combined).toBe(5); // sqrt(3^2 + 4^2) = 5
  });

  it("4. StructuralValidationEngine produces VALIDATED verdict on matching data", () => {
    const data = { u: [10] };
    const dataset: ReferenceDataset = {
      datasetId: 'DS_01',
      source: 'S',
      sourceType: ReferenceSourceType.EXPERIMENTAL,
      acquisitionDate: '2026-08-20',
      datasetVersion: '1.0',
      rawDataHash: ReferenceDatasetManager.hashDataset(data),
      units: 'mm',
      data,
      uncertainty: 0.1
    };
    const res = StructuralValidationEngine.validate('C1', 'A1', { u: [10.1] }, dataset, [{ metricId: 'DISPLACEMENT_RMSE', threshold: 0.05 }]);
    expect(res.verdict).toBe(ValidationVerdict.VALIDATED);
  });

  it("5. HardAcceptanceGate088 evaluates and achieves VALIDATED verdict", () => {
    const report = HardAcceptanceGate088.evaluateGate();
    expect(report.verdict).toBe("VALIDATED");
  });

  it("6. generateReports088 produces complete evidence package", () => {
    expect(() => generateReports088()).not.toThrow();
  });
});
