import { describe, expect, it, beforeEach } from "vitest";
import { 
  MaterialDatabaseService, 
  ImportPipeline, 
  MaterialSearchEngine, 
  MaterialResolver,
  HardAcceptanceGate090,
  generateReports090,
  DatabaseNamespace,
  MaterialFamily,
  PropertySourceType
} from "../index";

describe("PATCH-090: Material Database Framework", () => {
  beforeEach(() => {
    MaterialDatabaseService.clear();
  });

  it("1. Atomic Import Pipeline correctly processes raw data and prevents overwrites", () => {
    const rawData = [
      {
        canonicalName: 'Steel S235',
        family: MaterialFamily.METAL,
        grade: 'S235JR',
        revision: 1,
        properties: [
          { name: 'YOUNGS_MODULUS', value: 210e9, unit: 'Pa', dimension: 'P', provenance: { reference: 'EN 10025-2', sourceType: PropertySourceType.STANDARD } }
        ]
      }
    ];
    
    const manifest = ImportPipeline.importData(rawData, 'UNIT_TEST', DatabaseNamespace.STANDARD);
    expect(manifest.acceptedCount).toBe(1);
    expect(manifest.validationResult).toBe('SUCCESS');

    const allRecords = MaterialDatabaseService.getAllRecords();
    expect(allRecords.length).toBe(1);
    expect(allRecords[0].canonicalName).toBe('Steel S235');

    // Attempting same revision again should fail to commit (conflict)
    const manifest2 = ImportPipeline.importData(rawData, 'UNIT_TEST', DatabaseNamespace.STANDARD);
    expect(manifest2.acceptedCount).toBe(0);
    expect(manifest2.conflictCount).toBe(1);
  });

  it("2. Search Engine supports property range and exact matching", () => {
    const rawData = [
      { canonicalName: 'Aluminum 6061', family: MaterialFamily.METAL, properties: [{ name: 'DENSITY', value: 2700, unit: 'kg/m3', provenance: { reference: 'Ref1' } }] },
      { canonicalName: 'Steel S355', family: MaterialFamily.METAL, properties: [{ name: 'DENSITY', value: 7850, unit: 'kg/m3', provenance: { reference: 'Ref2' } }] }
    ];
    ImportPipeline.importData(rawData, 'UNIT_TEST', DatabaseNamespace.SECP_NATIVE);

    const denseMaterials = MaterialSearchEngine.search({ propertyRange: { name: 'DENSITY', min: 5000 } });
    expect(denseMaterials.length).toBe(1);
    expect(denseMaterials[0].canonicalName).toBe('Steel S355');

    const alu = MaterialSearchEngine.search({ canonicalName: 'Aluminum' });
    expect(alu.length).toBe(1);
  });

  it("3. Solver Material Resolver builds valid Simulation Packages", () => {
    const rawData = [
      { 
        canonicalName: 'Steel', 
        family: MaterialFamily.METAL, 
        properties: [
          { name: 'E', value: 200e9, unit: 'Pa', dimension: 'P', provenance: { reference: 'Ref1' } },
          { name: 'NU', value: 0.3, unit: '-', dimension: 'P', provenance: { reference: 'Ref1' } }
        ] 
      }
    ];
    ImportPipeline.importData(rawData, 'UNIT_TEST', DatabaseNamespace.SECP_NATIVE);
    const records = MaterialDatabaseService.getAllRecords();
    const dbId = records[0].dbId;

    const simPkg = MaterialResolver.resolveForSimulation(dbId, ['E', 'NU'], 'LINEAR_ELASTIC');
    expect(simPkg.packageId).toBeDefined();
    expect(simPkg.properties.length).toBe(2);
    expect(simPkg.model).toBe('LINEAR_ELASTIC');

    // Missing property should throw
    expect(() => MaterialResolver.resolveForSimulation(dbId, ['RHO'], 'DYNAMICS')).toThrow();
  });

  it("4. HardAcceptanceGate090 achieves PASS verdict", () => {
    const report = HardAcceptanceGate090.evaluateGate();
    expect(report.verdict).toBe("PASS");
  });

  it("5. generateReports090 executes without error", () => {
    expect(() => generateReports090()).not.toThrow();
  });
});
