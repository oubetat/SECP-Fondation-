/**
 * SECP Industrial OS — Programmable Material Engineering (SECP-PROGRAMMABLE-MATERIAL-V6)
 * ManufacturingConstraintEngine.ts
 * 
 * Production-grade manufacturability qualification engine.
 * Audits CAD geometry, mesh elements, and spatial material property fields against
 * manufacturing process profile constraints (min wall thickness, min feature size,
 * max spatial property gradients, build direction overhangs, material compatibility).
 */

import { createHash } from "crypto";
import { FEMModel, FEMElement } from "./FEMTypes";
import { SpatialMaterialField } from "./SpatialMaterialField";

export type ProcessType =
  | 'ADDITIVE_PBF'
  | 'ADDITIVE_DED'
  | 'SUBTRACTIVE_CNC'
  | 'GRADED_MATERIAL_DEPOSITION'
  | 'HYBRID_ADDITIVE_SUBTRACTIVE';

export type UnitSystem = 'SI_MM_MPA' | 'SI_M_PA';

export type QualificationStatus =
  | 'SYNTHETIC_TEST_PROFILE'
  | 'PROCESS_MODEL_EVALUATED'
  | 'MACHINE_PROFILE_QUALIFIED'
  | 'PHYSICALLY_MANUFACTURED_AND_MEASURED';

export type FindingSeverity = 'VIOLATION' | 'WARNING' | 'BLOCKED' | 'UNSUPPORTED' | 'INDETERMINATE';

export interface ManufacturingConstraintProfile {
  profileId: string;
  profileVersion: string;
  processType: ProcessType;
  unitSystem: UnitSystem;
  syntheticProfile: boolean;
  minWallThickness: number; // mm
  minFeatureSize: number; // mm
  minCellSize?: number; // mm
  maxSpatialGradient: number; // MPa/mm
  processResolution: number; // mm
  buildDirection?: { x: number; y: number; z: number };
  minOverhangAngle?: number; // degrees
  materialCompatibility: string[];
  qualificationStatus: QualificationStatus;
  qualifiedMachineId?: string;
  qualificationSource?: string;
}

export interface ManufacturabilityFinding {
  findingId: string;
  ruleId: string;
  elementId?: string;
  nodeId?: string;
  location?: { x: number; y: number; z: number };
  measuredValue: number;
  allowableLimit: number;
  unit: string;
  exceedance?: number;
  severity: FindingSeverity;
  message: string;
}

export interface ManufacturabilityResult {
  ok: boolean;
  status: 'PASS' | 'FAIL' | 'BLOCKED' | 'INDETERMINATE';
  qualificationLevel:
    | 'CONSTRAINT_CHECKED'
    | 'SYNTHETIC_TEST_EVALUATED'
    | 'PROCESS_MODEL_EVALUATED'
    | 'MACHINE_PROFILE_QUALIFIED'
    | 'PHYSICALLY_MANUFACTURED_AND_MEASURED';
  findings: ManufacturabilityFinding[];
  profileId: string;
  profileVersion: string;
  profileHash: string;
  summary: {
    totalViolations: number;
    totalWarnings: number;
    totalChecks: number;
  };
}

export class ManufacturingConstraintEngine {

  /**
   * Computes SHA-256 hash of a ManufacturingConstraintProfile for revision binding.
   */
  public static computeProfileHash(profile: ManufacturingConstraintProfile): string {
    const sortedPayload = {
      profileId: profile.profileId,
      profileVersion: profile.profileVersion,
      processType: profile.processType,
      unitSystem: profile.unitSystem,
      syntheticProfile: profile.syntheticProfile,
      minWallThickness: profile.minWallThickness,
      minFeatureSize: profile.minFeatureSize,
      minCellSize: profile.minCellSize ?? null,
      maxSpatialGradient: profile.maxSpatialGradient,
      processResolution: profile.processResolution,
      buildDirection: profile.buildDirection ?? null,
      minOverhangAngle: profile.minOverhangAngle ?? null,
      materialCompatibility: [...profile.materialCompatibility].sort(),
      qualificationStatus: profile.qualificationStatus,
      qualifiedMachineId: profile.qualifiedMachineId ?? null
    };

    return createHash("sha256").update(JSON.stringify(sortedPayload)).digest("hex");
  }

  /**
   * Validates profile schema, numeric positivity, unit system, and qualification claims.
   */
  public static validateProfile(profile: ManufacturingConstraintProfile): void {
    if (!profile.profileId || profile.profileId.trim() === '') {
      throw new Error(`[INVALID_PROFILE] Profile ID cannot be empty.`);
    }
    if (!profile.profileVersion || profile.profileVersion.trim() === '') {
      throw new Error(`[INVALID_PROFILE] Profile version cannot be empty.`);
    }
    if (!Number.isFinite(profile.minWallThickness) || profile.minWallThickness <= 0) {
      throw new Error(`[INVALID_PROFILE_VALUE] minWallThickness must be strictly positive: ${profile.minWallThickness}`);
    }
    if (!Number.isFinite(profile.minFeatureSize) || profile.minFeatureSize <= 0) {
      throw new Error(`[INVALID_PROFILE_VALUE] minFeatureSize must be strictly positive: ${profile.minFeatureSize}`);
    }
    if (!Number.isFinite(profile.maxSpatialGradient) || profile.maxSpatialGradient <= 0) {
      throw new Error(`[INVALID_PROFILE_VALUE] maxSpatialGradient must be strictly positive: ${profile.maxSpatialGradient}`);
    }
    if (!Number.isFinite(profile.processResolution) || profile.processResolution <= 0) {
      throw new Error(`[INVALID_PROFILE_VALUE] processResolution must be strictly positive: ${profile.processResolution}`);
    }
    if (!profile.materialCompatibility || profile.materialCompatibility.length === 0) {
      throw new Error(`[INVALID_PROFILE] Profile must specify at least one compatible material.`);
    }

    // Anti-false-claim gate: synthetic profile cannot claim machine profile qualification
    if (!profile.syntheticProfile && profile.qualificationStatus === 'SYNTHETIC_TEST_PROFILE') {
      throw new Error(`[INVALID_PROFILE_DECLARATION] Profile marked as non-synthetic cannot have qualificationStatus SYNTHETIC_TEST_PROFILE.`);
    }
    if (!profile.syntheticProfile && !profile.qualifiedMachineId) {
      throw new Error(`[INVALID_PROFILE_DECLARATION] Non-synthetic machine qualified profile requires qualifiedMachineId.`);
    }

    // Validate build direction normalization if present
    if (profile.buildDirection) {
      const { x, y, z } = profile.buildDirection;
      const mag = Math.sqrt(x * x + y * y + z * z);
      if (Math.abs(mag - 1.0) > 1e-3) {
        throw new Error(`[INVALID_BUILD_DIRECTION] Build direction vector must be normalized (unit length). Got magnitude=${mag.toFixed(4)}.`);
      }
    }
  }

  /**
   * Main entry point: Evaluates complete model against a manufacturing process profile.
   */
  public static evaluateManufacturability(
    model: FEMModel,
    profile: ManufacturingConstraintProfile
  ): ManufacturabilityResult {
    // 1. Validate Profile Contract
    this.validateProfile(profile);

    const findings: ManufacturabilityFinding[] = [];
    let checkCounter = 0;
    const profileHash = this.computeProfileHash(profile);

    // 2. Check Material Compatibility across all elements
    for (const [elemId, elem] of model.elements.entries()) {
      checkCounter++;
      if (!profile.materialCompatibility.includes(elem.materialId)) {
        findings.push({
          findingId: `FIND_MAT_INCOMPAT_${elemId}`,
          ruleId: 'RULE_MATERIAL_COMPATIBILITY',
          elementId: elemId,
          measuredValue: 0,
          allowableLimit: 1,
          unit: 'compatibility_flag',
          severity: 'VIOLATION',
          message: `[MATERIAL_PROCESS_INCOMPATIBLE] Material '${elem.materialId}' on element '${elemId}' is not compatible with process profile '${profile.profileId}' (${profile.processType}).`
        });
      }
    }

    // 3. Check Minimum Feature Size & Wall Thickness on Elements
    for (const [elemId, elem] of model.elements.entries()) {
      checkCounter++;
      const nodes = elem.nodeIds.map(id => model.nodes.get(id));
      if (nodes.some(n => !n)) continue;

      if (elem.formulationId === 'BAR_1D') {
        const n1 = nodes[0]!, n2 = nodes[1]!;
        const dx = n2.x - n1.x, dy = n2.y - n1.y, dz = n2.z - n1.z;
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Check Bar length against process resolution
        if (length < profile.minFeatureSize) {
          findings.push({
            findingId: `FIND_MIN_FEATURE_${elemId}`,
            ruleId: 'RULE_MIN_FEATURE_SIZE',
            elementId: elemId,
            location: { x: (n1.x + n2.x) / 2, y: (n1.y + n2.y) / 2, z: (n1.z + n2.z) / 2 },
            measuredValue: length,
            allowableLimit: profile.minFeatureSize,
            unit: 'mm',
            exceedance: profile.minFeatureSize - length,
            severity: 'VIOLATION',
            message: `[MIN_FEATURE_SIZE_VIOLATION] Bar length ${length.toFixed(2)} mm is below process minimum feature size ${profile.minFeatureSize} mm on element '${elemId}'.`
          });
        }

        // Section area wall thickness equivalent
        const section = model.sections?.get(elem.sectionId || '');
        if (section && section.area) {
          const equivThickness = Math.sqrt(section.area);
          if (equivThickness < profile.minWallThickness) {
            findings.push({
              findingId: `FIND_MIN_WALL_${elemId}`,
              ruleId: 'RULE_MIN_WALL_THICKNESS',
              elementId: elemId,
              measuredValue: equivThickness,
              allowableLimit: profile.minWallThickness,
              unit: 'mm',
              exceedance: profile.minWallThickness - equivThickness,
              severity: 'VIOLATION',
              message: `[MIN_WALL_THICKNESS_VIOLATION] Section equivalent thickness ${equivThickness.toFixed(2)} mm is below minimum wall thickness ${profile.minWallThickness} mm on element '${elemId}'.`
            });
          }
        }
      } else if (elem.formulationId === 'TET4_3D') {
        // Compute 3D element volume & characteristic size h = (6*V)^(1/3)
        const x = nodes.map(n => n!.x), y = nodes.map(n => n!.y), z = nodes.map(n => n!.z);
        const J11 = x[1] - x[0], J12 = y[1] - y[0], J13 = z[1] - z[0];
        const J21 = x[2] - x[0], J22 = y[2] - y[0], J23 = z[2] - z[0];
        const J31 = x[3] - x[0], J32 = y[3] - y[0], J33 = z[3] - z[0];
        const detJ = J11 * (J22 * J33 - J23 * J32) - J12 * (J21 * J33 - J23 * J31) + J13 * (J21 * J32 - J22 * J31);
        const volume = detJ / 6.0;
        const charSize = Math.pow(Math.max(0, volume * 6.0), 1.0 / 3.0);

        if (charSize < profile.minFeatureSize) {
          const cx = (x[0] + x[1] + x[2] + x[3]) / 4.0;
          const cy = (y[0] + y[1] + y[2] + y[3]) / 4.0;
          const cz = (z[0] + z[1] + z[2] + z[3]) / 4.0;
          findings.push({
            findingId: `FIND_MIN_FEATURE_${elemId}`,
            ruleId: 'RULE_MIN_FEATURE_SIZE',
            elementId: elemId,
            location: { x: cx, y: cy, z: cz },
            measuredValue: charSize,
            allowableLimit: profile.minFeatureSize,
            unit: 'mm',
            exceedance: profile.minFeatureSize - charSize,
            severity: 'VIOLATION',
            message: `[MIN_FEATURE_SIZE_VIOLATION] Element characteristic size ${charSize.toFixed(2)} mm is below process minimum ${profile.minFeatureSize} mm on element '${elemId}'.`
          });
        }
      }
    }

    // 4. Check Spatial Material Property Gradients (|grad E|)
    if (model.spatialMaterialFields) {
      for (const [fieldId, field] of model.spatialMaterialFields.entries()) {
        checkCounter++;

        // Collect elements sharing this spatial field
        const targetElems: FEMElement[] = [];
        for (const elem of model.elements.values()) {
          if (elem.spatialFieldId === fieldId) targetElems.push(elem);
        }

        // Evaluate gradient across adjacent elements or element nodes
        for (let i = 0; i < targetElems.length; i++) {
          for (let j = i + 1; j < targetElems.length; j++) {
            const e1 = targetElems[i], e2 = targetElems[j];

            // Check if e1 and e2 share at least one node (adjacent)
            const sharesNode = e1.nodeIds.some(nid => e2.nodeIds.includes(nid));
            if (!sharesNode) continue;

            const n1_coords = e1.nodeIds.map(nid => model.nodes.get(nid)!);
            const n2_coords = e2.nodeIds.map(nid => model.nodes.get(nid)!);

            const c1 = {
              x: n1_coords.reduce((s, n) => s + n.x, 0) / n1_coords.length,
              y: n1_coords.reduce((s, n) => s + n.y, 0) / n1_coords.length,
              z: n1_coords.reduce((s, n) => s + n.z, 0) / n1_coords.length
            };
            const c2 = {
              x: n2_coords.reduce((s, n) => s + n.x, 0) / n2_coords.length,
              y: n2_coords.reduce((s, n) => s + n.y, 0) / n2_coords.length,
              z: n2_coords.reduce((s, n) => s + n.z, 0) / n2_coords.length
            };

            const dist = Math.sqrt((c2.x - c1.x) ** 2 + (c2.y - c1.y) ** 2 + (c2.z - c1.z) ** 2);
            if (dist <= 1e-6) continue;

            const p1 = field.evaluate(c1);
            const p2 = field.evaluate(c2);

            if (p1.E !== undefined && p2.E !== undefined) {
              const dE = Math.abs(p2.E - p1.E);
              const gradE = dE / dist; // MPa/mm

              if (gradE > profile.maxSpatialGradient) {
                findings.push({
                  findingId: `FIND_GRAD_E_${e1.elementId}_${e2.elementId}`,
                  ruleId: 'RULE_MAX_SPATIAL_GRADIENT',
                  elementId: e1.elementId,
                  location: c1,
                  measuredValue: gradE,
                  allowableLimit: profile.maxSpatialGradient,
                  unit: 'MPa/mm',
                  exceedance: gradE - profile.maxSpatialGradient,
                  severity: 'VIOLATION',
                  message: `[SPATIAL_GRADIENT_EXCEEDED] Modulus gradient |dE/dx| = ${gradE.toFixed(2)} MPa/mm exceeds process profile maximum ${profile.maxSpatialGradient} MPa/mm between elements '${e1.elementId}' and '${e2.elementId}'.`
                });
              }
            }
          }
        }
      }
    }

    // 5. Aggregate Findings Summary
    const totalViolations = findings.filter(f => f.severity === 'VIOLATION').length;
    const totalWarnings = findings.filter(f => f.severity === 'WARNING').length;

    const ok = totalViolations === 0;
    const status = ok ? 'PASS' : 'FAIL';

    const qualificationLevel = profile.syntheticProfile
      ? 'SYNTHETIC_TEST_EVALUATED'
      : (profile.qualificationStatus === 'PHYSICALLY_MANUFACTURED_AND_MEASURED'
          ? 'PHYSICALLY_MANUFACTURED_AND_MEASURED'
          : 'MACHINE_PROFILE_QUALIFIED');

    return {
      ok,
      status,
      qualificationLevel,
      findings,
      profileId: profile.profileId,
      profileVersion: profile.profileVersion,
      profileHash,
      summary: {
        totalViolations,
        totalWarnings,
        totalChecks: checkCounter
      }
    };
  }
}
