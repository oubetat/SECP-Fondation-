/**
 * SECP Industrial OS - PATCH-267: Material Properties System
 * Core Engineering Intelligence Service
 */

import {
  DimensionType,
  EngineeringTruthStatus267,
  HardnessProperty,
  MaterialCoordinateSystem,
  MaterialProperty,
  MaterialPropertyDependencyNode,
  MaterialPropertySnapshot,
  MaterialPropertyValidationReport,
  MaterialSolverMapping,
  MaterialStressStrainDataset,
  OrthotropicElasticProperties,
  PropertyCategory,
  PropertySource,
  PropertyStatus267,
  StressStrainPoint,
} from './MaterialPropertyTypes267';

import {
  MaterialDefinition266,
  MaterialSource266,
  PropertyName266,
  StandardOrganization,
  ValidityRange266,
} from './MaterialDatabase266Types';

import { MaterialUnitService } from './MaterialUnitService';
import { MaterialLibrary266 } from './MaterialLibrary266';

export class MaterialPropertyService267 {
  private static propertiesStore: Map<string, MaterialProperty> = new Map();
  private static snapshotsStore: Map<string, MaterialPropertySnapshot> = new Map();
  private static auditTrail: Array<{
    timestamp: string;
    action: string;
    propertyId: string;
    details: string;
    performedBy: string;
  }> = [];

  // Initialize store with benchmark materials from MaterialLibrary266
  public static initialize(): void {
    if (this.propertiesStore.size > 0) return;

    const benchmarkMaterials = MaterialLibrary266.getAllMaterials();
    for (const mat of benchmarkMaterials) {
      this.populatePropertiesFrom266(mat);
    }
  }

  private static populatePropertiesFrom266(mat: MaterialDefinition266): void {
    const firstSource = mat.sources[0] || {
      sourceId: 'SRC-BENCHMARK-266',
      publisher: 'Unknown',
      document: 'Engineering Data',
      revision: '1.0'
    };

    const defaultSource: PropertySource = {
      sourceId: firstSource.sourceId,
      type: 'STANDARD',
      organization: mat.standard.organization,
      publisher: firstSource.publisher,
      document: firstSource.document,
      revision: firstSource.revision,
      evidenceStatus: 'VERIFIED',
    };

    const propertyKeys = Object.keys(mat.properties) as PropertyName266[];

    for (const propName of propertyKeys) {
      const propVal = mat.properties[propName];
      if (!propVal) continue;

      let category: PropertyCategory = 'PHYSICAL';
      let dimension: DimensionType = 'DIMENSIONLESS';

      // Mapping logic
      switch (propName) {
        case 'DENSITY': 
          category = 'PHYSICAL'; dimension = 'MASS_DENSITY'; break;
        case 'YOUNGS_MODULUS': 
        case 'SHEAR_MODULUS':
        case 'BULK_MODULUS':
        case 'YIELD_STRENGTH':
        case 'ULTIMATE_TENSILE_STRENGTH':
        case 'COMPRESSIVE_STRENGTH':
        case 'SHEAR_STRENGTH':
          category = 'MECHANICAL'; dimension = 'PRESSURE_STRESS_MODULUS'; break;
        case 'POISSONS_RATIO':
          category = 'MECHANICAL'; dimension = 'DIMENSIONLESS'; break;
        case 'THERMAL_CONDUCTIVITY':
          category = 'THERMAL'; dimension = 'THERMAL_CONDUCTIVITY'; break;
        case 'SPECIFIC_HEAT':
          category = 'THERMAL'; dimension = 'SPECIFIC_HEAT_CAPACITY'; break;
        case 'THERMAL_EXPANSION':
          category = 'THERMAL'; dimension = 'THERMAL_EXPANSION_COEFFICIENT'; break;
        case 'MELTING_POINT':
        case 'SOLIDUS_TEMPERATURE':
        case 'LIQUIDUS_TEMPERATURE':
          category = 'THERMAL'; dimension = 'TEMPERATURE'; break;
        default:
          category = 'OTHER'; dimension = 'DIMENSIONLESS';
      }

      this.setProperty({
        materialId: mat.materialId,
        materialRevision: mat.version,
        category,
        propertyType: propName,
        value: propVal.canonicalValue,
        unit: propVal.canonicalUnit,
        dimension,
        dataOrigin: propVal.originType === 'MEASURED' ? 'MEASURED' : 'PUBLISHED',
        source: defaultSource,
        conditions: { 
          temperatureK: propVal.condition.temperatureK || 293.15,
          temperCondition: mat.temperCondition
        },
        validityRange: propVal.validityRange,
        status: 'APPROVED',
        truthStatus: 'PROVEN',
        confidence: propVal.confidence,
        evidenceId: `EVID-${mat.materialId}-${propName}`,
      });
    }
  }

  /**
   * Set or Update a Material Property with full validation
   */
  public static setProperty(params: {
    materialId: string;
    materialRevision: number;
    category: PropertyCategory;
    propertyType: string;
    value: number;
    unit: string;
    dimension: DimensionType;
    dataOrigin: 'MEASURED' | 'PUBLISHED' | 'DERIVED' | 'USER_DEFINED' | 'ESTIMATED';
    source: PropertySource;
    conditions: {
      temperatureK: number;
      pressurePa?: number;
      strainRate_s1?: number;
      relativeHumidityPercent?: number;
      temperCondition?: any;
      manufacturingCondition?: any;
    };
    validityRange: ValidityRange266;
    status: PropertyStatus267;
    truthStatus: EngineeringTruthStatus267;
    confidence: { basis: string; score: number };
    derivationFormula?: string;
    orthotropic?: OrthotropicElasticProperties;
    hardness?: HardnessProperty;
    stressStrainDataset?: MaterialStressStrainDataset;
    evidenceId?: string;
  }): MaterialProperty {
    this.initialize();

    // 1. Validation Rules
    if (!params.materialId || params.materialId.trim() === '') {
      throw new Error('PARAM_ERROR: Material ID is required.');
    }

    if (!params.unit || params.unit.trim() === '') {
      throw new Error('UNIT_SAFETY_VIOLATION: Every material property must have an explicit unit.');
    }

    if (isNaN(params.value) || !isFinite(params.value)) {
      throw new Error('INVALID_NUMERIC_VALUE: Property value cannot be NaN or Infinity.');
    }

    // Dimensional verification check
    this.verifyDimensionalMatch(params.propertyType, params.dimension, params.unit);

    // Negative physical values check for density, modulus, temperature
    if (
      ['DENSITY', 'YOUNGS_MODULUS', 'SHEAR_MODULUS', 'BULK_MODULUS', 'THERMAL_CONDUCTIVITY', 'SPECIFIC_HEAT'].includes(
        params.propertyType
      ) &&
      params.value <= 0
    ) {
      throw new Error(`VALIDATION_FAILED: Physical property ${params.propertyType} must be strictly positive (> 0).`);
    }

    // Poisson ratio domain check
    if (params.propertyType === 'POISSONS_RATIO' && (params.value < -1.0 || params.value >= 0.5)) {
      throw new Error(`VALIDATION_FAILED: Poisson's ratio ${params.value} must be in range (-1.0, 0.5).`);
    }

    // 2. Derive Property Key & ID
    const propertyId = `PROP-${params.materialId}-R${params.materialRevision}-${params.propertyType}`;

    const prop: MaterialProperty = {
      propertyId,
      materialId: params.materialId,
      materialRevision: params.materialRevision,
      category: params.category,
      propertyType: params.propertyType,
      value: params.value,
      unit: params.unit,
      dimension: params.dimension,
      dataOrigin: params.dataOrigin,
      source: params.source,
      conditions: params.conditions,
      validityRange: params.validityRange,
      status: params.status,
      truthStatus: params.truthStatus,
      confidence: params.confidence,
      derivationFormula: params.derivationFormula,
      orthotropic: params.orthotropic,
      hardness: params.hardness,
      stressStrainDataset: params.stressStrainDataset,
      evidenceId: params.evidenceId || `EVID-${propertyId}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.propertiesStore.set(propertyId, prop);

    // Record Audit Trail
    this.auditTrail.push({
      timestamp: new Date().toISOString(),
      action: 'SET_PROPERTY',
      propertyId,
      details: `Set ${params.propertyType} = ${params.value} ${params.unit} (Revision ${params.materialRevision})`,
      performedBy: 'ENGINEER_USER',
    });

    // Invalidate derived dependencies if Young's modulus or Poisson's ratio updated
    if (params.propertyType === 'YOUNGS_MODULUS' || params.propertyType === 'POISSONS_RATIO') {
      this.invalidateDerivedElasticProperties(params.materialId, params.materialRevision);
    }

    return prop;
  }

  public static getProperty(
    materialId: string,
    propertyType: string,
    revision: number = 1
  ): MaterialProperty | undefined {
    this.initialize();
    const propertyId = `PROP-${materialId}-R${revision}-${propertyType}`;
    return this.propertiesStore.get(propertyId);
  }

  public static getRequiredProperty(
    materialId: string,
    propertyType: string,
    revision: number = 1
  ): MaterialProperty {
    const prop = this.getProperty(materialId, propertyType, revision);
    if (!prop) {
      throw new Error(
        `MISSING_REQUIRED_MATERIAL_PROPERTY: Required property '${propertyType}' is missing for material '${materialId}' Rev ${revision}. No defaults or guessing permitted.`
      );
    }
    return prop;
  }

  public static getPropertySet(materialId: string, revision: number = 1): Record<string, MaterialProperty> {
    this.initialize();
    const result: Record<string, MaterialProperty> = {};
    const prefix = `PROP-${materialId}-R${revision}-`;

    for (const [key, prop] of this.propertiesStore.entries()) {
      if (key.startsWith(prefix)) {
        result[prop.propertyType] = prop;
      }
    }
    return result;
  }

  /**
   * Evaluate Isotropic Elastic Consistency
   * G_calc = E / (2*(1+nu))
   * K_calc = E / (3*(1-2*nu))
   */
  public static evaluateElasticConsistency(
    materialId: string,
    revision: number = 1
  ): {
    passed: boolean;
    discrepancyPercent: number;
    details: string;
    calculatedG?: number;
    calculatedK?: number;
  } {
    const props = this.getPropertySet(materialId, revision);
    const eProp = props['YOUNGS_MODULUS'];
    const nuProp = props['POISSONS_RATIO'];

    if (!eProp || !nuProp) {
      return {
        passed: false,
        discrepancyPercent: 100,
        details: 'Missing Young Modulus or Poisson Ratio to evaluate elastic consistency.',
      };
    }

    const E = eProp.value;
    const nu = nuProp.value;

    const calcG = E / (2 * (1 + nu));
    const calcK = E / (3 * (1 - 2 * nu));

    let maxDiscrepancy = 0;
    let details = 'Elastic properties are mathematically consistent.';

    const gProp = props['SHEAR_MODULUS'];
    if (gProp && gProp.dataOrigin !== 'DERIVED') {
      const diffG = Math.abs(gProp.value - calcG) / calcG;
      if (diffG > maxDiscrepancy) maxDiscrepancy = diffG;
      if (diffG > 0.05) {
        details = `INVALID_PROPERTY_SET: Contradictory Shear Modulus G (${gProp.value} Pa vs calc ${calcG.toFixed(0)} Pa). Discrepancy ${(diffG * 100).toFixed(2)}% exceeds 5% limit.`;
      }
    }

    const kProp = props['BULK_MODULUS'];
    if (kProp && kProp.dataOrigin !== 'DERIVED') {
      const diffK = Math.abs(kProp.value - calcK) / calcK;
      if (diffK > maxDiscrepancy) maxDiscrepancy = diffK;
      if (diffK > 0.05) {
        details = `INVALID_PROPERTY_SET: Contradictory Bulk Modulus K (${kProp.value} Pa vs calc ${calcK.toFixed(0)} Pa). Discrepancy ${(diffK * 100).toFixed(2)}% exceeds 5% limit.`;
      }
    }

    const passed = maxDiscrepancy <= 0.05;
    return {
      passed,
      discrepancyPercent: maxDiscrepancy * 100,
      details,
      calculatedG: calcG,
      calculatedK: calcK,
    };
  }

  /**
   * Validate Stress Strain Curve Integrity
   */
  public static validateStressStrainCurve(dataset: MaterialStressStrainDataset): {
    isValid: boolean;
    error?: string;
  } {
    if (!dataset.dataPoints || dataset.dataPoints.length === 0) {
      return { isValid: false, error: 'Dataset contains no data points.' };
    }

    for (let i = 0; i < dataset.dataPoints.length; i++) {
      const pt = dataset.dataPoints[i];
      if (isNaN(pt.trueStressPa) || isNaN(pt.trueStrain)) {
        return { isValid: false, error: `Data point #${i} contains NaN value.` };
      }
      if (pt.trueStressPa < 0 || pt.trueStrain < 0) {
        return { isValid: false, error: `Data point #${i} contains negative stress or strain.` };
      }
      if (i > 0) {
        const prev = dataset.dataPoints[i - 1];
        if (pt.trueStrain <= prev.trueStrain) {
          return { isValid: false, error: `Duplicate or non-increasing strain at index #${i}.` };
        }
      }
    }

    return { isValid: true };
  }

  /**
   * Check temperature validity condition & block out-of-range evaluation
   */
  public static evaluatePropertyAtTemperature(
    prop: MaterialProperty,
    targetTempK: number
  ): {
    value: number;
    unit: string;
    isValid: boolean;
    error?: string;
  } {
    const minT = prop.validityRange.temperatureMinK ?? 0;
    const maxT = prop.validityRange.temperatureMaxK ?? 5000;

    if (targetTempK < minT || targetTempK > maxT) {
      return {
        value: prop.value,
        unit: prop.unit,
        isValid: false,
        error: `OUT_OF_VALIDITY_RANGE: Requested temperature ${targetTempK} K is outside validity range [${minT} K, ${maxT} K]. Extrapolation blocked.`,
      };
    }

    // Constant property for PATCH-267 (f(T) functional evaluation ready in PATCH-268)
    return {
      value: prop.value,
      unit: prop.unit,
      isValid: true,
    };
  }

  /**
   * Get Solver Mapping for FEM / CFD / Thermal
   */
  public static getSolverMapping(
    materialId: string,
    solverType: 'FEM_ELASTIC' | 'FEM_PLASTIC' | 'THERMAL' | 'CFD' | 'FATIGUE',
    revision: number = 1
  ): MaterialSolverMapping {
    const props = this.getPropertySet(materialId, revision);
    const mapped: Record<string, { value: number; unit: string; propertyId: string }> = {};
    const missing: string[] = [];
    const warnings: string[] = [];

    let requiredProps: string[] = [];
    let optionalProps: string[] = [];

    switch (solverType) {
      case 'FEM_ELASTIC':
        requiredProps = ['DENSITY', 'YOUNGS_MODULUS', 'POISSONS_RATIO'];
        optionalProps = ['YIELD_STRENGTH', 'THERMAL_EXPANSION'];
        break;
      case 'FEM_PLASTIC':
        requiredProps = ['DENSITY', 'YOUNGS_MODULUS', 'POISSONS_RATIO', 'YIELD_STRENGTH', 'ULTIMATE_TENSILE_STRENGTH'];
        optionalProps = ['HARDNESS'];
        break;
      case 'THERMAL':
        requiredProps = ['DENSITY', 'THERMAL_CONDUCTIVITY', 'SPECIFIC_HEAT'];
        optionalProps = ['MELTING_POINT', 'THERMAL_EXPANSION'];
        break;
      case 'CFD':
        requiredProps = ['DENSITY', 'THERMAL_CONDUCTIVITY', 'SPECIFIC_HEAT'];
        optionalProps = ['VISCOSITY'];
        break;
      case 'FATIGUE':
        requiredProps = ['YOUNGS_MODULUS', 'YIELD_STRENGTH', 'ULTIMATE_TENSILE_STRENGTH'];
        optionalProps = ['HARDNESS'];
        break;
    }

    for (const req of requiredProps) {
      if (props[req]) {
        mapped[req] = {
          value: props[req].value,
          unit: props[req].unit,
          propertyId: props[req].propertyId,
        };
        if (props[req].dataOrigin === 'ESTIMATED') {
          warnings.push(`Property '${req}' is ESTIMATED data.`);
        }
      } else {
        missing.push(req);
      }
    }

    for (const opt of optionalProps) {
      if (props[opt]) {
        mapped[opt] = {
          value: props[opt].value,
          unit: props[opt].unit,
          propertyId: props[opt].propertyId,
        };
      }
    }

    const isCompatible = missing.length === 0;

    return {
      solverType,
      requiredPropertyTypes: requiredProps,
      optionalPropertyTypes: optionalProps,
      mappedProperties: mapped,
      missingProperties: missing,
      isCompatible,
      warnings,
    };
  }

  /**
   * Create Immutable Material Property Snapshot for Simulation Reproducibility
   */
  public static createSnapshot(
    materialId: string,
    revision: number = 1,
    materialName: string = 'Engineering Material'
  ): MaterialPropertySnapshot {
    const props = this.getPropertySet(materialId, revision);
    if (Object.keys(props).length === 0) {
      throw new Error(`CANNOT_CREATE_SNAPSHOT: No properties found for material '${materialId}' Rev ${revision}.`);
    }

    const propertySetHash = this.computePropertySetHash(props);
    const snapshotId = `SNAP-${materialId}-R${revision}-${propertySetHash.substring(0, 8)}`;

    const snapshot: MaterialPropertySnapshot = {
      snapshotId,
      materialId,
      materialName,
      materialRevision: revision,
      properties: props,
      propertySetHash,
      createdAt: new Date().toISOString(),
      isImmutable: true,
    };

    this.snapshotsStore.set(snapshotId, snapshot);
    return snapshot;
  }

  public static getSnapshot(snapshotId: string): MaterialPropertySnapshot | undefined {
    return this.snapshotsStore.get(snapshotId);
  }

  /**
   * Compute Deterministic Cryptographic Hash for Property Set
   */
  public static computePropertySetHash(props: Record<string, MaterialProperty>): string {
    const keys = Object.keys(props).sort();
    const serializedPayload = keys
      .map((k) => {
        const p = props[k];
        return `${p.propertyType}:${p.value}:${p.unit}:${p.dataOrigin}:${p.conditions.temperatureK}`;
      })
      .join('|');

    // Simple deterministic DJB2/FNV-1a 32-bit hex hash string
    let hash = 0x811c9dc5;
    for (let i = 0; i < serializedPayload.length; i++) {
      hash ^= serializedPayload.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    const hashHex = (hash >>> 0).toString(16).padStart(8, '0');
    return `HASH267-${hashHex.toUpperCase()}`;
  }

  /**
   * Invalidate derived elastic properties when Young's Modulus or Poisson's Ratio change
   */
  private static invalidateDerivedElasticProperties(materialId: string, revision: number): void {
    const gProp = this.getProperty(materialId, 'SHEAR_MODULUS', revision);
    if (gProp && gProp.dataOrigin === 'DERIVED') {
      gProp.status = 'INVALID';
      gProp.truthStatus = 'ABSENT';
    }

    const kProp = this.getProperty(materialId, 'BULK_MODULUS', revision);
    if (kProp && kProp.dataOrigin === 'DERIVED') {
      kProp.status = 'INVALID';
      kProp.truthStatus = 'ABSENT';
    }
  }

  /**
   * Verification of dimensional matching for Property Types
   */
  private static verifyDimensionalMatch(propertyType: string, dimension: DimensionType, unit: string): void {
    const normalizedUnit = MaterialUnitService.normalizeUnitString(unit);

    if (
      ['YOUNGS_MODULUS', 'YIELD_STRENGTH', 'ULTIMATE_TENSILE_STRENGTH', 'SHEAR_MODULUS', 'BULK_MODULUS', 'COMPRESSIVE_STRENGTH'].includes(
        propertyType
      )
    ) {
      if (dimension !== 'PRESSURE_STRESS_MODULUS') {
        throw new Error(
          `DIMENSIONAL_SAFETY_VIOLATION: Property '${propertyType}' expects dimension 'PRESSURE_STRESS_MODULUS', got '${dimension}'.`
        );
      }
    } else if (propertyType === 'DENSITY') {
      if (dimension !== 'MASS_DENSITY') {
        throw new Error(
          `DIMENSIONAL_SAFETY_VIOLATION: Property '${propertyType}' expects dimension 'MASS_DENSITY', got '${dimension}'.`
        );
      }
    } else if (propertyType === 'POISSONS_RATIO') {
      if (dimension !== 'DIMENSIONLESS') {
        throw new Error(
          `DIMENSIONAL_SAFETY_VIOLATION: Property '${propertyType}' expects dimension 'DIMENSIONLESS', got '${dimension}'.`
        );
      }
    }
  }

  /**
   * Export Full Validation Report for a Material
   */
  public static generateValidationReport(
    materialId: string,
    revision: number = 1
  ): MaterialPropertyValidationReport {
    const props = this.getPropertySet(materialId, revision);
    const propTypes = Object.keys(props);

    let validCount = 0;
    let invalidCount = 0;
    let derivedCount = 0;
    let unprovenCount = 0;
    const issues: string[] = [];

    for (const pKey of propTypes) {
      const p = props[pKey];
      if (p.status === 'APPROVED' || p.status === 'VALIDATED') {
        validCount++;
      } else {
        invalidCount++;
        issues.push(`Property '${p.propertyType}' status is '${p.status}'.`);
      }

      if (p.dataOrigin === 'DERIVED') {
        derivedCount++;
      }

      if (p.truthStatus !== 'PROVEN') {
        unprovenCount++;
        issues.push(`Property '${p.propertyType}' truth status is '${p.truthStatus}'.`);
      }
    }

    const requiredForFEM = ['DENSITY', 'YOUNGS_MODULUS', 'POISSONS_RATIO'];
    const missingForFEM = requiredForFEM.filter((r) => !props[r]);

    const elasticCheck = this.evaluateElasticConsistency(materialId, revision);
    if (!elasticCheck.passed) {
      issues.push(elasticCheck.details);
    }

    const overallStatus =
      invalidCount === 0 && missingForFEM.length === 0 && elasticCheck.passed
        ? 'PASSED'
        : issues.length <= 2
        ? 'PASSED_WITH_WARNINGS'
        : 'FAILED';

    return {
      timestamp: new Date().toISOString(),
      materialId,
      materialRevision: revision,
      totalProperties: propTypes.length,
      validPropertiesCount: validCount,
      invalidPropertiesCount: invalidCount,
      missingRequiredProperties: missingForFEM,
      derivedPropertiesCount: derivedCount,
      outOfRangePropertiesCount: 0,
      elasticConsistencyPassed: elasticCheck.passed,
      elasticConsistencyDiscrepancyPercent: elasticCheck.discrepancyPercent,
      unprovenSourceCount: unprovenCount,
      overallStatus,
      issues,
    };
  }

  /**
   * Compare Two Property Sets
   */
  public static comparePropertySets(
    materialIdA: string,
    revisionA: number,
    materialIdB: string,
    revisionB: number
  ): Array<{
    propertyType: string;
    valueA?: number;
    unitA?: string;
    valueB?: number;
    unitB?: string;
    ratioBoverA?: number;
  }> {
    const propsA = this.getPropertySet(materialIdA, revisionA);
    const propsB = this.getPropertySet(materialIdB, revisionB);

    const allTypes = Array.from(new Set([...Object.keys(propsA), ...Object.keys(propsB)])).sort();

    return allTypes.map((type) => {
      const pA = propsA[type];
      const pB = propsB[type];

      const valA = pA ? pA.value : undefined;
      const valB = pB ? pB.value : undefined;
      const ratio = valA && valB ? valB / valA : undefined;

      return {
        propertyType: type,
        valueA: valA,
        unitA: pA ? pA.unit : undefined,
        valueB: valB,
        unitB: pB ? pB.unit : undefined,
        ratioBoverA: ratio,
      };
    });
  }

  /**
   * Search Materials by Property Threshold Query
   */
  public static searchMaterialsByProperties(query: {
    minYoungsModulusGPa?: number;
    maxDensityKgM3?: number;
    minYieldStrengthMPa?: number;
  }): Array<{ materialId: string; revision: number; matchedProperties: Record<string, number> }> {
    this.initialize();
    const results: Array<{ materialId: string; revision: number; matchedProperties: Record<string, number> }> = [];

    const materials = MaterialLibrary266.getAllMaterials();
    for (const mat of materials) {
      const props = this.getPropertySet(mat.materialId, mat.version);
      let match = true;
      const matched: Record<string, number> = {};

      if (query.minYoungsModulusGPa !== undefined) {
        const e = props['YOUNGS_MODULUS'];
        if (!e || e.value / 1e9 < query.minYoungsModulusGPa) {
          match = false;
        } else {
          matched['YOUNGS_MODULUS_GPa'] = e.value / 1e9;
        }
      }

      if (query.maxDensityKgM3 !== undefined) {
        const rho = props['DENSITY'];
        if (!rho || rho.value > query.maxDensityKgM3) {
          match = false;
        } else {
          matched['DENSITY_kg_m3'] = rho.value;
        }
      }

      if (query.minYieldStrengthMPa !== undefined) {
        const sy = props['YIELD_STRENGTH'];
        if (!sy || sy.value / 1e6 < query.minYieldStrengthMPa) {
          match = false;
        } else {
          matched['YIELD_STRENGTH_MPa'] = sy.value / 1e6;
        }
      }

      if (match) {
        results.push({
          materialId: mat.materialId,
          revision: mat.version,
          matchedProperties: matched,
        });
      }
    }

    return results;
  }

  public static getAuditTrail() {
    return this.auditTrail;
  }
}
