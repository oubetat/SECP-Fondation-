import { FractureDataset, FracturePropertyModel, FracturePropertyType } from "./types";

export interface FractureAuditReport {
  verdict: string;
  checks: { id: string; passed: boolean; details: string }[];
}

export class IndependentFractureAuditor {
  public static audit(dataset: FractureDataset, property: FracturePropertyModel): FractureAuditReport {
    const checks: { id: string; passed: boolean; details: string }[] = [];

    // 1. PROVENANCE_INTEGRITY
    checks.push({
      id: "PROVENANCE_INTEGRITY",
      passed: !!dataset.provenance && !!dataset.provenance.sourceId,
      details: "Verified that fracture data has a documented and traceable source"
    });

    // 2. UNIT_CONSISTENCY
    const validUnits = ['MPa√m', 'Pa√m', 'J/m²', 'mm'];
    checks.push({
      id: "UNIT_CONSISTENCY",
      passed: validUnits.includes(dataset.units),
      details: `Verified that property units (${dataset.units}) are standard fracture mechanics units`
    });

    // 3. PHYSICAL_PLAUSIBILITY
    checks.push({
      id: "PHYSICAL_PLAUSIBILITY",
      passed: dataset.measuredValue > 0,
      details: "Verified that fracture toughness is positive"
    });

    // 4. PLANE_STRAIN_METADATA
    if (dataset.fractureProperty === FracturePropertyType.KIC) {
       checks.push({
         id: "PLANE_STRAIN_QUALIFICATION",
         passed: dataset.thickness > 0,
         details: "Verified that thickness metadata exists for plane-strain qualification"
       });
    }

    const verdict = checks.every(c => c.passed) ? "PASS" : "FAIL";
    return { verdict, checks };
  }
}
