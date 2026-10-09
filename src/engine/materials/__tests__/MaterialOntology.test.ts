import { describe, expect, it } from "vitest";
import { 
  MaterialPropertyResolver, 
  MaterialIdentityManager, 
  IndependentMaterialAuditor,
  HardAcceptanceGate089,
  generateReports089,
  MaterialFamily,
  PropertySourceType
} from "../index";

describe("PATCH-089: Material Ontology Framework", () => {
  it("1. Property Resolver correctly resolves conflicts and validates ranges", () => {
    const p1 = { name: 'E', value: 200, unit: 'GPa', dimension: 'P', provenance: { sourceType: PropertySourceType.STANDARD } } as any;
    const p2 = { name: 'E', value: 205, unit: 'GPa', dimension: 'P', provenance: { sourceType: PropertySourceType.CERTIFICATE } } as any;
    
    const resolved = MaterialPropertyResolver.resolveConflict(p1, p2);
    expect(resolved.value).toBe(205);
    
    expect(MaterialPropertyResolver.validateRange({ name: 'POISSON_RATIO', value: 0.6 } as any)).toBe(false);
  });

  it("2. Identity Manager generates stable fingerprints", () => {
    const identity = { materialId: 'M1', revision: 1 } as any;
    const props = [{ name: 'E', value: 200, unit: 'GPa' }] as any;
    const state = { temperature: 293, condition: 'annealed' } as any;
    
    const f1 = MaterialIdentityManager.generateFingerprint(identity, props, state);
    const f2 = MaterialIdentityManager.generateFingerprint(identity, props, state);
    expect(f1).toBe(f2);
    
    const f3 = MaterialIdentityManager.generateFingerprint(identity, [{ ...props[0], value: 201 }], state);
    expect(f1).not.toBe(f3);
  });

  it("3. Independent Auditor detects missing provenance", () => {
    const identity = { materialId: 'M1', canonicalName: 'Steel', family: MaterialFamily.METAL, revision: 1 } as any;
    const props = [{ name: 'E', value: 200, unit: 'Pa', dimension: 'P' }] as any; // Missing provenance
    const state = { temperature: 293, condition: 'annealed' } as any;
    
    const audit = IndependentMaterialAuditor.auditMaterial(identity, props, state);
    expect(audit.verdict).toContain("missing provenance");
  });

  it("4. HardAcceptanceGate089 achieves PASS verdict", () => {
    const report = HardAcceptanceGate089.evaluateGate();
    expect(report.verdict).toBe("PASS");
  });

  it("5. generateReports089 executes without error", () => {
    expect(() => generateReports089()).not.toThrow();
  });
});
