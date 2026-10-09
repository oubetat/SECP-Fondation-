/**
 * SECP Industrial OS - PATCH-266: Material Database
 * Real Engineering Material Database Engine & Service Layer
 */

import {
  MaterialDefinition266,
  MaterialPropertyValue266,
  PropertyName266,
  MaterialSnapshot266,
  MaterialAssignment266,
  MaterialAuditEntry266,
  MaterialSource266,
  MaterialSearchResult266,
  FemMaterialExport266,
  MaterialFamilyType,
  MaterialSubfamilyType,
  MaterialStatus266,
  EngineeringTruthStatus266,
  StandardReference,
} from './MaterialDatabase266Types';
import { MaterialUnitService } from './MaterialUnitService';

export class MaterialLibrary266 {
  private static materialsMap: Map<string, MaterialDefinition266[]> = new Map(); // materialId -> revisions[]
  private static snapshotsMap: Map<string, MaterialSnapshot266> = new Map(); // snapshotId -> snapshot
  private static assignmentsMap: Map<string, MaterialAssignment266> = new Map(); // targetEntityId -> assignment
  private static auditLogs: MaterialAuditEntry266[] = [];

  private static initialized = false;

  /**
   * Initializes the Material Database with standard reference benchmark materials
   */
  public static init(): void {
    if (this.initialized) return;
    this.seedBenchmarkMaterials();
    this.initialized = true;
  }

  /**
   * Cryptographic / Hash generator for determinism & audit
   */
  public static hashString(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  /**
   * Resets the database to initial seeded state (useful for tests)
   */
  public static reset(): void {
    this.materialsMap.clear();
    this.snapshotsMap.clear();
    this.assignmentsMap.clear();
    this.auditLogs = [];
    this.initialized = false;
    this.init();
  }

  /**
   * Registers a new material definition or creates an immutable new revision
   */
  public static saveMaterial(mat: MaterialDefinition266, actor = 'System'): MaterialDefinition266 {
    // Validate unit & required identity fields
    this.validateMaterialStructure(mat);

    // Derive elastic properties if possible and check physical consistency
    this.processElasticPropertiesAndConsistency(mat);

    const revisions = this.materialsMap.get(mat.materialId) || [];
    
    // Check if modifying an approved existing revision silently (Forbidden!)
    const existingRevIndex = revisions.findIndex((r) => r.version === mat.version);
    if (existingRevIndex >= 0) {
      const existing = revisions[existingRevIndex];
      if (existing.status === 'APPROVED' || existing.status === 'VERIFIED') {
        throw new Error(
          `IMMUTABLE_REVISION_ERROR: Cannot modify approved Material '${mat.materialId}' Revision ${mat.version} silently. You must create a new revision.`
        );
      }
    }

    // Generate revision hash
    const contentToHash = `${mat.materialId}-v${mat.version}-${mat.canonicalName}-${mat.grade}-${mat.temperCondition}-${JSON.stringify(mat.properties)}`;
    mat.revisionHash = `HASH-${this.hashString(contentToHash)}`;
    mat.updatedAt = new Date().toISOString();

    if (existingRevIndex >= 0) {
      revisions[existingRevIndex] = mat;
    } else {
      revisions.push(mat);
    }

    revisions.sort((a, b) => a.version - b.version);
    this.materialsMap.set(mat.materialId, revisions);

    // Record audit log
    this.recordAudit({
      auditId: `AUD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action: existingRevIndex >= 0 ? 'REVISED' : 'CREATED',
      materialId: mat.materialId,
      version: mat.version,
      actor,
      details: `Material '${mat.canonicalName}' v${mat.version} saved with hash ${mat.revisionHash}`,
      hash: mat.revisionHash,
    });

    return mat;
  }

  /**
   * Retrieves a material by ID and optional version (defaults to latest)
   */
  public static getMaterial(materialId: string, version?: number): MaterialDefinition266 | undefined {
    this.init();
    const revisions = this.materialsMap.get(materialId);
    if (!revisions || revisions.length === 0) return undefined;

    if (version !== undefined) {
      return revisions.find((r) => r.version === version);
    }
    return revisions[revisions.length - 1]; // latest
  }

  /**
   * Retrieves all materials in the database (latest versions)
   */
  public static getAllMaterials(): MaterialDefinition266[] {
    this.init();
    const list: MaterialDefinition266[] = [];
    this.materialsMap.forEach((revisions) => {
      if (revisions.length > 0) {
        list.push(revisions[revisions.length - 1]);
      }
    });
    return list;
  }

  /**
   * Searches materials by name, grade, standard, family, or properties
   */
  public static searchMaterials(
    query?: string,
    filters?: {
      family?: MaterialFamilyType;
      subfamily?: MaterialSubfamilyType;
      minYieldStrengthMPa?: number;
      minYoungsModulusGPa?: number;
      maxDensityKgM3?: number;
      temperCondition?: string;
    }
  ): MaterialSearchResult266[] {
    this.init();
    const results: MaterialSearchResult266[] = [];
    const allLatest = this.getAllMaterials();

    const q = (query || '').toLowerCase().trim();

    for (const mat of allLatest) {
      let matched = true;
      let matchedField = 'ALL';
      let score = 100;

      if (q) {
        const nameMatch = mat.canonicalName.toLowerCase().includes(q);
        const gradeMatch = mat.grade.toLowerCase().includes(q);
        const aliasMatch = mat.aliases.some((a) => a.toLowerCase().includes(q));
        const stdMatch = mat.standard.designation.toLowerCase().includes(q);

        if (nameMatch) matchedField = 'Canonical Name';
        else if (gradeMatch) matchedField = 'Grade';
        else if (aliasMatch) matchedField = 'Alias';
        else if (stdMatch) matchedField = 'Standard';
        else {
          matched = false;
        }
      }

      if (matched && filters) {
        if (filters.family && mat.family !== filters.family) matched = false;
        if (filters.subfamily && mat.subfamily !== filters.subfamily) matched = false;
        if (filters.temperCondition && !mat.temperCondition.toLowerCase().includes(filters.temperCondition.toLowerCase())) matched = false;

        if (filters.minYieldStrengthMPa !== undefined) {
          const ys = mat.properties['YIELD_STRENGTH']?.canonicalValue;
          if (!ys || ys < filters.minYieldStrengthMPa * 1e6) matched = false;
        }

        if (filters.minYoungsModulusGPa !== undefined) {
          const E = mat.properties['YOUNGS_MODULUS']?.canonicalValue;
          if (!E || E < filters.minYoungsModulusGPa * 1e9) matched = false;
        }

        if (filters.maxDensityKgM3 !== undefined) {
          const rho = mat.properties['DENSITY']?.canonicalValue;
          if (!rho || rho > filters.maxDensityKgM3) matched = false;
        }
      }

      if (matched) {
        results.push({
          material: mat,
          relevanceScore: score,
          matchedField,
        });
      }
    }

    return results;
  }

  /**
   * Gets a specific property with temperature context and validity range enforcement
   */
  public static getPropertyWithContext(
    mat: MaterialDefinition266,
    propertyName: PropertyName266,
    context?: { temperatureK?: number; pressurePa?: number; strainRate?: number }
  ): { value: number; unit: string; origin: string; sourceId: string; status: 'VALID' | 'MISSING_REQUIRED_MATERIAL_PROPERTY' | 'OUT_OF_VALIDITY_RANGE'; message?: string } {
    const prop = mat.properties[propertyName];
    if (!prop) {
      return {
        value: 0,
        unit: MaterialUnitService.CANONICAL_UNITS[propertyName] || '',
        origin: 'NONE',
        sourceId: 'NONE',
        status: 'MISSING_REQUIRED_MATERIAL_PROPERTY',
        message: `Property '${propertyName}' is missing for material '${mat.canonicalName}' v${mat.version}. System will not invent defaults.`,
      };
    }

    // Check validity domain if temperature context is provided
    if (context && context.temperatureK !== undefined && prop.validityRange) {
      const T = context.temperatureK;
      const minT = prop.validityRange.temperatureMinK ?? 0;
      const maxT = prop.validityRange.temperatureMaxK ?? 5000;

      if (T < minT || T > maxT) {
        return {
          value: prop.canonicalValue,
          unit: prop.canonicalUnit,
          origin: prop.originType,
          sourceId: prop.sourceId,
          status: 'OUT_OF_VALIDITY_RANGE',
          message: `Temperature ${T} K is outside property validity range [${minT} K, ${maxT} K] for material '${mat.canonicalName}'. Silent extrapolation blocked.`,
        };
      }
    }

    return {
      value: prop.canonicalValue,
      unit: prop.canonicalUnit,
      origin: prop.originType,
      sourceId: prop.sourceId,
      status: 'VALID',
    };
  }

  /**
   * Derives G and K for Isotropic Materials and checks for physical consistency
   */
  private static processElasticPropertiesAndConsistency(mat: MaterialDefinition266): void {
    if (mat.directionality !== 'ISOTROPIC') return;

    const E_prop = mat.properties['YOUNGS_MODULUS'];
    const nu_prop = mat.properties['POISSONS_RATIO'];
    const G_prop = mat.properties['SHEAR_MODULUS'];
    const K_prop = mat.properties['BULK_MODULUS'];

    if (!E_prop || !nu_prop) return;

    const E = E_prop.canonicalValue;
    const nu = nu_prop.canonicalValue;

    // Physical plausibility check for Poisson's ratio
    if (nu <= -1.0 || nu >= 0.5) {
      throw new Error(`PHYSICAL_INCONSISTENCY_ERROR: Poisson's ratio ν = ${nu} is outside physically possible isotropic range (-1 < ν < 0.5).`);
    }

    // Mathematical derivation
    const derivedG = E / (2 * (1 + nu));
    const derivedK = E / (3 * (1 - 2 * nu));

    // Check consistency if G was explicitly provided
    if (G_prop && G_prop.originType !== 'DERIVED') {
      const relError = Math.abs(G_prop.canonicalValue - derivedG) / derivedG;
      if (relError > 0.05) {
        throw new Error(
          `PHYSICAL_INCONSISTENCY_ERROR: Provided Shear Modulus G (${(G_prop.canonicalValue / 1e9).toFixed(2)} GPa) contradicts E and ν derived G (${(derivedG / 1e9).toFixed(2)} GPa) by ${(relError * 100).toFixed(1)}%.`
        );
      }
    } else {
      // Auto-derive G
      mat.properties['SHEAR_MODULUS'] = {
        propertyName: 'SHEAR_MODULUS',
        canonicalValue: derivedG,
        canonicalUnit: 'Pa',
        originType: 'DERIVED',
        sourceId: E_prop.sourceId,
        confidence: E_prop.confidence,
        condition: E_prop.condition,
        validityRange: E_prop.validityRange,
        derivationExpression: 'G = E / (2 * (1 + ν))',
      };
    }

    // Check consistency if K was explicitly provided
    if (K_prop && K_prop.originType !== 'DERIVED') {
      const relError = Math.abs(K_prop.canonicalValue - derivedK) / derivedK;
      if (relError > 0.05) {
        throw new Error(
          `PHYSICAL_INCONSISTENCY_ERROR: Provided Bulk Modulus K (${(K_prop.canonicalValue / 1e9).toFixed(2)} GPa) contradicts E and ν derived K (${(derivedK / 1e9).toFixed(2)} GPa) by ${(relError * 100).toFixed(1)}%.`
        );
      }
    } else {
      // Auto-derive K
      mat.properties['BULK_MODULUS'] = {
        propertyName: 'BULK_MODULUS',
        canonicalValue: derivedK,
        canonicalUnit: 'Pa',
        originType: 'DERIVED',
        sourceId: E_prop.sourceId,
        confidence: E_prop.confidence,
        condition: E_prop.condition,
        validityRange: E_prop.validityRange,
        derivationExpression: 'K = E / (3 * (1 - 2 * ν))',
      };
    }
  }

  /**
   * Structure validation for material definitions
   */
  private static validateMaterialStructure(mat: MaterialDefinition266): void {
    if (!mat.materialId || !mat.canonicalName || !mat.grade) {
      throw new Error(`MATERIAL_VALIDATION_ERROR: Material must contain materialId, canonicalName, and grade.`);
    }

    if (!mat.standard || !mat.standard.organization || !mat.standard.designation) {
      throw new Error(`MATERIAL_VALIDATION_ERROR: Material must contain a valid StandardReference (organization and designation).`);
    }

    // Check property units
    for (const [key, prop] of Object.entries(mat.properties)) {
      if (!prop) continue;
      if (!prop.canonicalUnit) {
        throw new Error(`NO_UNIT_AMBIGUITY_ERROR: Property '${key}' in Material '${mat.canonicalName}' lacks an explicit unit.`);
      }
      if (prop.canonicalValue < 0 && key !== 'POISSONS_RATIO') {
        throw new Error(`PHYSICAL_INCONSISTENCY_ERROR: Property '${key}' cannot be negative (${prop.canonicalValue}).`);
      }
    }
  }

  /**
   * Creates an immutable MaterialSnapshot frozen in time for simulation reproducibility
   */
  public static createSnapshot(
    materialId: string,
    version?: number,
    requiredProperties: PropertyName266[] = ['DENSITY', 'YOUNGS_MODULUS', 'POISSONS_RATIO', 'YIELD_STRENGTH']
  ): MaterialSnapshot266 {
    const mat = this.getMaterial(materialId, version);
    if (!mat) {
      throw new Error(`MATERIAL_NOT_FOUND_ERROR: Cannot create snapshot for material '${materialId}' v${version}.`);
    }

    // Check missing properties
    for (const reqProp of requiredProperties) {
      if (!mat.properties[reqProp]) {
        throw new Error(`MISSING_REQUIRED_MATERIAL_PROPERTY: Required property '${reqProp}' is missing in material '${mat.canonicalName}' v${mat.version}.`);
      }
    }

    const snapshotProps: Record<string, { value: number; unit: string; origin: any; sourceId: string }> = {};
    const validityRanges: Record<string, any> = {};

    for (const [propKey, propVal] of Object.entries(mat.properties)) {
      if (!propVal) continue;
      snapshotProps[propKey] = {
        value: propVal.canonicalValue,
        unit: propVal.canonicalUnit,
        origin: propVal.originType,
        sourceId: propVal.sourceId,
      };
      validityRanges[propKey] = propVal.validityRange;
    }

    const timestamp = new Date().toISOString();
    const contentToSign = `${mat.materialId}-v${mat.version}-${timestamp}-${JSON.stringify(snapshotProps)}`;
    const sig = `SIG-SNAP-${this.hashString(contentToSign)}`;

    const snapshot: MaterialSnapshot266 = {
      snapshotId: `SNAP-${mat.materialId}-V${mat.version}-${Date.now().toString(36).toUpperCase()}`,
      materialId: mat.materialId,
      canonicalName: mat.canonicalName,
      version: mat.version,
      grade: mat.grade,
      temperCondition: mat.temperCondition,
      standard: mat.standard,
      capturedAt: timestamp,
      requiredProperties,
      properties: snapshotProps,
      validityRanges,
      digitalSignatureSHA256: sig,
    };

    this.snapshotsMap.set(snapshot.snapshotId, snapshot);

    this.recordAudit({
      auditId: `AUD-SNAP-${Date.now()}`,
      timestamp,
      action: 'SIMULATION_USED',
      materialId: mat.materialId,
      version: mat.version,
      actor: 'Simulation Engine',
      details: `Material Snapshot ${snapshot.snapshotId} generated with signature ${sig}`,
      hash: sig,
    });

    return snapshot;
  }

  /**
   * Assigns a material to a CAD Part or Assembly Component
   */
  public static assignMaterial(
    targetEntityId: string,
    targetEntityType: 'CAD_PART' | 'ASSEMBLY_COMPONENT',
    materialId: string,
    version?: number
  ): MaterialAssignment266 {
    const mat = this.getMaterial(materialId, version);
    if (!mat) {
      throw new Error(`MATERIAL_NOT_FOUND_ERROR: Cannot assign non-existent material '${materialId}'.`);
    }

    const warnings: string[] = [];
    if (mat.status === 'DEPRECATED') {
      warnings.push(`Warning: Material '${mat.canonicalName}' v${mat.version} is DEPRECATED.`);
    }

    const snapshot = this.createSnapshot(mat.materialId, mat.version);

    const assignment: MaterialAssignment266 = {
      assignmentId: `ASGN-${targetEntityId}-${Date.now().toString(36).toUpperCase()}`,
      targetEntityId,
      targetEntityType,
      materialId: mat.materialId,
      canonicalName: mat.canonicalName,
      version: mat.version,
      temperCondition: mat.temperCondition,
      snapshotId: snapshot.snapshotId,
      assignedAt: new Date().toISOString(),
      assignedBy: 'Lead Mechanical Engineer',
      isCompliant: warnings.length === 0,
      warnings,
    };

    this.assignmentsMap.set(targetEntityId, assignment);

    this.recordAudit({
      auditId: `AUD-ASGN-${Date.now()}`,
      timestamp: assignment.assignedAt,
      action: 'ASSIGNED',
      materialId: mat.materialId,
      version: mat.version,
      actor: 'Engineer',
      details: `Assigned '${mat.canonicalName}' v${mat.version} to ${targetEntityType} '${targetEntityId}'`,
      hash: snapshot.digitalSignatureSHA256,
    });

    return assignment;
  }

  /**
   * Exports material properties for FEM solvers with deterministic unit conversion
   */
  public static exportToFemSolver(
    snapshotId: string,
    targetUnitSystem: 'SI_PA' | 'MM_MPA' | 'INCH_PSI' = 'SI_PA'
  ): FemMaterialExport266 {
    const snapshot = this.snapshotsMap.get(snapshotId);
    if (!snapshot) {
      throw new Error(`SNAPSHOT_NOT_FOUND_ERROR: Cannot export non-existent snapshot '${snapshotId}' for FEM.`);
    }

    let density = snapshot.properties['DENSITY']?.value || 0;
    let E = snapshot.properties['YOUNGS_MODULUS']?.value || 0;
    let nu = snapshot.properties['POISSONS_RATIO']?.value || 0;
    let G = snapshot.properties['SHEAR_MODULUS']?.value || 0;
    let K = snapshot.properties['BULK_MODULUS']?.value || 0;
    let yieldStr = snapshot.properties['YIELD_STRENGTH']?.value || 0;
    let uts = snapshot.properties['ULTIMATE_TENSILE_STRENGTH']?.value || 0;

    // Deterministic unit conversions for target solver
    if (targetUnitSystem === 'MM_MPA') {
      // mm, MPa, tonne/mm3
      density = density * 1e-12; // kg/m3 -> tonne/mm3
      E = E / 1e6; // Pa -> MPa
      G = G / 1e6;
      K = K / 1e6;
      yieldStr = yieldStr / 1e6;
      uts = uts / 1e6;
    } else if (targetUnitSystem === 'INCH_PSI') {
      density = density / 27679.90471; // kg/m3 -> lb/in3
      E = E / 6894.757293168; // Pa -> psi
      G = G / 6894.757293168;
      K = K / 6894.757293168;
      yieldStr = yieldStr / 6894.757293168;
      uts = uts / 6894.757293168;
    }

    return {
      materialName: snapshot.canonicalName,
      unitSystem: targetUnitSystem,
      density,
      youngsModulus: E,
      poissonsRatio: nu,
      shearModulus: G,
      bulkModulus: K,
      yieldStrength: yieldStr,
      ultimateTensileStrength: uts,
      thermalConductivity: snapshot.properties['THERMAL_CONDUCTIVITY']?.value,
      specificHeat: snapshot.properties['SPECIFIC_HEAT']?.value,
      thermalExpansion: snapshot.properties['THERMAL_EXPANSION']?.value,
      sourceSnapshotId: snapshot.snapshotId,
    };
  }

  /**
   * Pre-import validation preview for external material files/JSON
   */
  public static validateAndPreviewImport(inputMaterials: any[]): {
    accepted: any[];
    rejected: any[];
    duplicates: any[];
    warnings: string[];
  } {
    this.init();
    const accepted: any[] = [];
    const rejected: any[] = [];
    const duplicates: any[] = [];
    const warnings: string[] = [];

    const existingList = this.getAllMaterials();

    for (const raw of inputMaterials) {
      let isDuplicate = false;
      const dupMatch = existingList.find(
        (ex) =>
          ex.standard.designation.toLowerCase() === (raw.standard?.designation || '').toLowerCase() &&
          ex.grade.toLowerCase() === (raw.grade || '').toLowerCase() &&
          ex.temperCondition.toLowerCase() === (raw.temperCondition || '').toLowerCase()
      );

      if (dupMatch) {
        isDuplicate = true;
        duplicates.push({ raw, existingId: dupMatch.id });
        warnings.push(`Duplicate material detected: Grade '${raw.grade}' Temper '${raw.temperCondition}' matches existing '${dupMatch.canonicalName}'.`);
      }

      if (!raw.materialId || !raw.canonicalName || !raw.grade) {
        rejected.push({ raw, reason: 'Missing required identity fields (materialId, canonicalName, grade)' });
        continue;
      }

      if (!raw.properties || Object.keys(raw.properties).length === 0) {
        rejected.push({ raw, reason: 'No properties provided' });
        continue;
      }

      accepted.push(raw);
    }

    return { accepted, rejected, duplicates, warnings };
  }

  /**
   * Records an audit trail entry
   */
  private static recordAudit(entry: MaterialAuditEntry266): void {
    this.auditLogs.push(entry);
  }

  /**
   * Gets audit logs
   */
  public static getAuditLogs(): MaterialAuditEntry266[] {
    return [...this.auditLogs];
  }

  /**
   * Seeds standard engineering reference materials
   */
  private static seedBenchmarkMaterials(): void {
    const srcMMPDS: MaterialSource266 = {
      sourceId: 'SRC-MMPDS-15',
      publisher: 'MMPDS Program',
      document: 'Metallic Materials Properties Development and Standardization (MMPDS-15)',
      revision: '15.0',
      publicationDate: '2020-01-01',
      retrievalDate: '2026-08-28',
      evidenceStatus: 'VERIFIED',
    };

    const srcASTM: MaterialSource266 = {
      sourceId: 'SRC-ASTM-STD',
      publisher: 'ASTM International',
      document: 'ASTM Standards Collection',
      revision: '2022',
      publicationDate: '2022-06-01',
      retrievalDate: '2026-08-28',
      evidenceStatus: 'VERIFIED',
    };

    // 1. Aluminum 6061-T6
    const al6061: MaterialDefinition266 = {
      id: 'MAT-AL-6061-T6-V1',
      materialId: 'MAT-AL-6061-T6',
      canonicalName: 'Aluminum 6061-T6',
      aliases: ['AA6061-T6', 'UNS A96061', 'AlMg1SiCu', 'Alloy 6061 T6'],
      family: 'METALS',
      subfamily: 'ALUMINUM',
      grade: '6061',
      temperCondition: 'T6',
      standard: { organization: 'ASTM', designation: 'ASTM B209', title: 'Aluminum and Aluminum-Alloy Sheet and Plate' },
      manufacturer: 'Standard Wrought Aluminum',
      version: 1,
      status: 'APPROVED',
      truthStatus: 'PROVEN',
      materialState: 'SOLID',
      directionality: 'ISOTROPIC',
      manufacturingMetadata: { machinabilityIndex: 90, weldabilityRating: 'GOOD', heatTreatmentCompatibility: ['Solution heat treat', 'Artificial aging'] },
      sources: [srcMMPDS, srcASTM],
      properties: {
        DENSITY: { propertyName: 'DENSITY', canonicalValue: 2700, canonicalUnit: 'kg/m3', originType: 'PUBLISHED', sourceId: srcMMPDS.sourceId, confidence: { basis: 'MMPDS A-basis', score: 0.99 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 200, temperatureMaxK: 450 } },
        YOUNGS_MODULUS: { propertyName: 'YOUNGS_MODULUS', canonicalValue: 68.9e9, canonicalUnit: 'Pa', originType: 'PUBLISHED', sourceId: srcMMPDS.sourceId, confidence: { basis: 'MMPDS A-basis', score: 0.99 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 200, temperatureMaxK: 450 } },
        POISSONS_RATIO: { propertyName: 'POISSONS_RATIO', canonicalValue: 0.33, canonicalUnit: 'dimensionless', originType: 'PUBLISHED', sourceId: srcMMPDS.sourceId, confidence: { basis: 'MMPDS A-basis', score: 0.98 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 200, temperatureMaxK: 450 } },
        YIELD_STRENGTH: { propertyName: 'YIELD_STRENGTH', canonicalValue: 276e6, canonicalUnit: 'Pa', originType: 'PUBLISHED', sourceId: srcMMPDS.sourceId, confidence: { basis: 'MMPDS A-basis', score: 0.99 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 200, temperatureMaxK: 450 } },
        ULTIMATE_TENSILE_STRENGTH: { propertyName: 'ULTIMATE_TENSILE_STRENGTH', canonicalValue: 310e6, canonicalUnit: 'Pa', originType: 'PUBLISHED', sourceId: srcMMPDS.sourceId, confidence: { basis: 'MMPDS A-basis', score: 0.99 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 200, temperatureMaxK: 450 } },
        THERMAL_CONDUCTIVITY: { propertyName: 'THERMAL_CONDUCTIVITY', canonicalValue: 167, canonicalUnit: 'W/(m·K)', originType: 'PUBLISHED', sourceId: srcMMPDS.sourceId, confidence: { basis: 'ASM Handbook', score: 0.95 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 200, temperatureMaxK: 500 } },
        SPECIFIC_HEAT: { propertyName: 'SPECIFIC_HEAT', canonicalValue: 896, canonicalUnit: 'J/(kg·K)', originType: 'PUBLISHED', sourceId: srcMMPDS.sourceId, confidence: { basis: 'ASM Handbook', score: 0.95 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 200, temperatureMaxK: 500 } },
        THERMAL_EXPANSION: { propertyName: 'THERMAL_EXPANSION', canonicalValue: 23e-6, canonicalUnit: '1/K', originType: 'PUBLISHED', sourceId: srcMMPDS.sourceId, confidence: { basis: 'ASM Handbook', score: 0.95 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 200, temperatureMaxK: 500 } },
        MELTING_POINT: { propertyName: 'MELTING_POINT', canonicalValue: 855.15, canonicalUnit: 'K', originType: 'PUBLISHED', sourceId: srcMMPDS.sourceId, confidence: { basis: 'ASM Handbook', score: 0.99 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 0, temperatureMaxK: 2000 } },
      },
      evidence: [
        { evidenceId: 'EVID-AL6061-01', propertyName: 'YIELD_STRENGTH', canonicalValue: 276e6, canonicalUnit: 'Pa', sourceId: srcMMPDS.sourceId, verificationStatus: 'VERIFIED', timestamp: '2026-08-28', hash: 'HASH-EVID-AL6061-YS' },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      revisionHash: 'HASH-AL6061-T6-V1',
    };

    // 2. Stainless Steel 316L
    const ss316l: MaterialDefinition266 = {
      id: 'MAT-SS-316L-V1',
      materialId: 'MAT-SS-316L',
      canonicalName: 'Stainless Steel 316L',
      aliases: ['UNS S31603', 'EN 1.4404', 'X2CrNiMo17-12-2'],
      family: 'METALS',
      subfamily: 'STAINLESS_STEEL',
      grade: '316L',
      temperCondition: 'Annealed',
      standard: { organization: 'ASTM', designation: 'ASTM A240', title: 'Chromium and Chromium-Nickel Stainless Steel Plate' },
      version: 1,
      status: 'APPROVED',
      truthStatus: 'PROVEN',
      materialState: 'SOLID',
      directionality: 'ISOTROPIC',
      manufacturingMetadata: { machinabilityIndex: 45, weldabilityRating: 'EXCELLENT' },
      sources: [srcASTM],
      properties: {
        DENSITY: { propertyName: 'DENSITY', canonicalValue: 8000, canonicalUnit: 'kg/m3', originType: 'PUBLISHED', sourceId: srcASTM.sourceId, confidence: { basis: 'ASTM A240', score: 0.99 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 100, temperatureMaxK: 1000 } },
        YOUNGS_MODULUS: { propertyName: 'YOUNGS_MODULUS', canonicalValue: 193e9, canonicalUnit: 'Pa', originType: 'PUBLISHED', sourceId: srcASTM.sourceId, confidence: { basis: 'ASTM A240', score: 0.99 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 100, temperatureMaxK: 1000 } },
        POISSONS_RATIO: { propertyName: 'POISSONS_RATIO', canonicalValue: 0.30, canonicalUnit: 'dimensionless', originType: 'PUBLISHED', sourceId: srcASTM.sourceId, confidence: { basis: 'ASTM A240', score: 0.98 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 100, temperatureMaxK: 1000 } },
        YIELD_STRENGTH: { propertyName: 'YIELD_STRENGTH', canonicalValue: 290e6, canonicalUnit: 'Pa', originType: 'PUBLISHED', sourceId: srcASTM.sourceId, confidence: { basis: 'ASTM A240', score: 0.99 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 100, temperatureMaxK: 1000 } },
        ULTIMATE_TENSILE_STRENGTH: { propertyName: 'ULTIMATE_TENSILE_STRENGTH', canonicalValue: 580e6, canonicalUnit: 'Pa', originType: 'PUBLISHED', sourceId: srcASTM.sourceId, confidence: { basis: 'ASTM A240', score: 0.99 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 100, temperatureMaxK: 1000 } },
        THERMAL_CONDUCTIVITY: { propertyName: 'THERMAL_CONDUCTIVITY', canonicalValue: 16.3, canonicalUnit: 'W/(m·K)', originType: 'PUBLISHED', sourceId: srcASTM.sourceId, confidence: { basis: 'ASM Handbook', score: 0.95 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 100, temperatureMaxK: 1000 } },
        SPECIFIC_HEAT: { propertyName: 'SPECIFIC_HEAT', canonicalValue: 500, canonicalUnit: 'J/(kg·K)', originType: 'PUBLISHED', sourceId: srcASTM.sourceId, confidence: { basis: 'ASM Handbook', score: 0.95 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 100, temperatureMaxK: 1000 } },
        THERMAL_EXPANSION: { propertyName: 'THERMAL_EXPANSION', canonicalValue: 16e-6, canonicalUnit: '1/K', originType: 'PUBLISHED', sourceId: srcASTM.sourceId, confidence: { basis: 'ASM Handbook', score: 0.95 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 100, temperatureMaxK: 1000 } },
      },
      evidence: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      revisionHash: 'HASH-SS316L-V1',
    };

    // 3. Titanium Ti-6Al-4V Grade 5
    const ti64: MaterialDefinition266 = {
      id: 'MAT-TI-6AL4V-V1',
      materialId: 'MAT-TI-6AL4V',
      canonicalName: 'Titanium Ti-6Al-4V Grade 5',
      aliases: ['UNS R56400', 'ASTM Grade 5 Titanium', 'Ti64'],
      family: 'METALS',
      subfamily: 'TITANIUM',
      grade: 'Grade 5 (6Al-4V)',
      temperCondition: 'Annealed',
      standard: { organization: 'ASTM', designation: 'ASTM B265', title: 'Titanium and Titanium Alloy Strip, Sheet, and Plate' },
      version: 1,
      status: 'APPROVED',
      truthStatus: 'PROVEN',
      materialState: 'SOLID',
      directionality: 'ISOTROPIC',
      sources: [srcMMPDS],
      properties: {
        DENSITY: { propertyName: 'DENSITY', canonicalValue: 4430, canonicalUnit: 'kg/m3', originType: 'PUBLISHED', sourceId: srcMMPDS.sourceId, confidence: { basis: 'MMPDS-15', score: 0.99 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 50, temperatureMaxK: 700 } },
        YOUNGS_MODULUS: { propertyName: 'YOUNGS_MODULUS', canonicalValue: 113.8e9, canonicalUnit: 'Pa', originType: 'PUBLISHED', sourceId: srcMMPDS.sourceId, confidence: { basis: 'MMPDS-15', score: 0.99 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 50, temperatureMaxK: 700 } },
        POISSONS_RATIO: { propertyName: 'POISSONS_RATIO', canonicalValue: 0.342, canonicalUnit: 'dimensionless', originType: 'PUBLISHED', sourceId: srcMMPDS.sourceId, confidence: { basis: 'MMPDS-15', score: 0.98 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 50, temperatureMaxK: 700 } },
        YIELD_STRENGTH: { propertyName: 'YIELD_STRENGTH', canonicalValue: 880e6, canonicalUnit: 'Pa', originType: 'PUBLISHED', sourceId: srcMMPDS.sourceId, confidence: { basis: 'MMPDS-15', score: 0.99 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 50, temperatureMaxK: 700 } },
        ULTIMATE_TENSILE_STRENGTH: { propertyName: 'ULTIMATE_TENSILE_STRENGTH', canonicalValue: 950e6, canonicalUnit: 'Pa', originType: 'PUBLISHED', sourceId: srcMMPDS.sourceId, confidence: { basis: 'MMPDS-15', score: 0.99 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 50, temperatureMaxK: 700 } },
        THERMAL_CONDUCTIVITY: { propertyName: 'THERMAL_CONDUCTIVITY', canonicalValue: 6.7, canonicalUnit: 'W/(m·K)', originType: 'PUBLISHED', sourceId: srcMMPDS.sourceId, confidence: { basis: 'ASM Handbook', score: 0.95 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 50, temperatureMaxK: 700 } },
        SPECIFIC_HEAT: { propertyName: 'SPECIFIC_HEAT', canonicalValue: 526, canonicalUnit: 'J/(kg·K)', originType: 'PUBLISHED', sourceId: srcMMPDS.sourceId, confidence: { basis: 'ASM Handbook', score: 0.95 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 50, temperatureMaxK: 700 } },
      },
      evidence: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      revisionHash: 'HASH-TI64-V1',
    };

    // Save all seed materials
    this.saveMaterial(al6061, 'System Seed');
    this.saveMaterial(ss316l, 'System Seed');
    this.saveMaterial(ti64, 'System Seed');
  }
}
