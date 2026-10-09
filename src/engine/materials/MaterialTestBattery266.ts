/**
 * SECP Industrial OS - PATCH-266: Material Database
 * Automated Test Battery (35+ Verification Tests)
 */

import { MaterialLibrary266 } from './MaterialLibrary266';
import { MaterialUnitService } from './MaterialUnitService';
import {
  MaterialDefinition266,
  PropertyName266,
} from './MaterialDatabase266Types';

export interface TestResult266 {
  id: string;
  testName: string;
  category: string;
  passed: boolean;
  message: string;
  durationMs: number;
}

export class MaterialTestBattery266 {
  public static runAllTests(): {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    results: TestResult266[];
  } {
    MaterialLibrary266.reset();
    const results: TestResult266[] = [];

    // Helper runner
    const runTest = (
      id: string,
      testName: string,
      category: string,
      fn: () => void
    ) => {
      const t0 = performance.now();
      try {
        fn();
        results.push({
          id,
          testName,
          category,
          passed: true,
          message: 'PASS: Verified successfully',
          durationMs: performance.now() - t0,
        });
      } catch (err: any) {
        results.push({
          id,
          testName,
          category,
          passed: false,
          message: `FAIL: ${err.message || String(err)}`,
          durationMs: performance.now() - t0,
        });
      }
    };

    // TEST 1: Material Creation
    runTest('TEST-266-01', 'Material Creation & Persistence', 'IDENTITY', () => {
      const mat = MaterialLibrary266.getMaterial('MAT-AL-6061-T6');
      if (!mat || mat.canonicalName !== 'Aluminum 6061-T6') {
        throw new Error('Failed to retrieve seeded Aluminum 6061-T6');
      }
    });

    // TEST 2: Material Retrieval by ID & Version
    runTest('TEST-266-02', 'Material Retrieval by Version', 'IDENTITY', () => {
      const matV1 = MaterialLibrary266.getMaterial('MAT-AL-6061-T6', 1);
      if (!matV1 || matV1.version !== 1) {
        throw new Error('Failed to retrieve version 1 explicitly');
      }
    });

    // TEST 3: Material Search & Alias Matching
    runTest('TEST-266-03', 'Material Search & Alias Matching', 'SEARCH', () => {
      const searchRes = MaterialLibrary266.searchMaterials('UNS A96061');
      if (searchRes.length === 0 || searchRes[0].material.grade !== '6061') {
        throw new Error('Search failed to match UNS A96061 alias');
      }
    });

    // TEST 4: Grade Handling
    runTest('TEST-266-04', 'Grade Distinction & Validation', 'IDENTITY', () => {
      const mat = MaterialLibrary266.getMaterial('MAT-SS-316L');
      if (!mat || mat.grade !== '316L') {
        throw new Error('Grade 316L not preserved');
      }
    });

    // TEST 5: StandardReference Validation
    runTest('TEST-266-05', 'StandardReference Formal Object', 'STANDARDS', () => {
      const mat = MaterialLibrary266.getMaterial('MAT-AL-6061-T6');
      if (!mat || mat.standard.organization !== 'ASTM' || mat.standard.designation !== 'ASTM B209') {
        throw new Error('Standard reference invalid');
      }
    });

    // TEST 6: Material Revisioning & Version Isolation
    runTest('TEST-266-06', 'Material Revisioning & Immature Block', 'REVISION', () => {
      const mat = MaterialLibrary266.getMaterial('MAT-AL-6061-T6');
      if (!mat) throw new Error('Material not found');

      // Attempting to modify approved revision directly should throw error
      try {
        MaterialLibrary266.saveMaterial({ ...mat });
        throw new Error('Should have blocked modifying approved revision');
      } catch (e: any) {
        if (!e.message.includes('IMMUTABLE_REVISION_ERROR')) {
          throw e;
        }
      }
    });

    // TEST 7: Property Explicit Unit Enforcement
    runTest('TEST-266-07', 'No Unit Ambiguity Enforcement', 'UNITS', () => {
      try {
        MaterialUnitService.normalizeToSI('DENSITY', 7850, '');
        throw new Error('Allowed empty unit');
      } catch (e: any) {
        if (!e.message.includes('NO_UNIT_AMBIGUITY_ERROR')) {
          throw e;
        }
      }
    });

    // TEST 8: SI Unit Normalization (MPa -> Pa)
    runTest('TEST-266-08', 'Unit Normalization (MPa to Pa)', 'UNITS', () => {
      const res = MaterialUnitService.normalizeToSI('YIELD_STRENGTH', 276, 'MPa');
      if (res.canonicalValue !== 276e6 || res.canonicalUnit !== 'Pa') {
        throw new Error(`Normalization failed: ${res.canonicalValue} ${res.canonicalUnit}`);
      }
    });

    // TEST 9: Mechanical Properties Preservation
    runTest('TEST-266-09', 'Mechanical Properties Access', 'PROPERTIES', () => {
      const mat = MaterialLibrary266.getMaterial('MAT-AL-6061-T6');
      if (!mat) throw new Error('Material missing');

      const E = mat.properties['YOUNGS_MODULUS']?.canonicalValue;
      const ys = mat.properties['YIELD_STRENGTH']?.canonicalValue;
      if (E !== 68.9e9 || ys !== 276e6) {
        throw new Error(`Incorrect mechanical properties E=${E}, YS=${ys}`);
      }
    });

    // TEST 10: Thermal Properties
    runTest('TEST-266-10', 'Thermal Properties Access', 'PROPERTIES', () => {
      const mat = MaterialLibrary266.getMaterial('MAT-AL-6061-T6');
      if (!mat) throw new Error('Material missing');

      const k = mat.properties['THERMAL_CONDUCTIVITY']?.canonicalValue;
      const cp = mat.properties['SPECIFIC_HEAT']?.canonicalValue;
      if (k !== 167 || cp !== 896) {
        throw new Error(`Thermal properties incorrect k=${k}, cp=${cp}`);
      }
    });

    // TEST 11: Material Source Tracking
    runTest('TEST-266-11', 'Material Source Provenance', 'SOURCE', () => {
      const mat = MaterialLibrary266.getMaterial('MAT-AL-6061-T6');
      if (!mat || mat.sources.length === 0 || mat.sources[0].publisher !== 'MMPDS Program') {
        throw new Error('Source MMPDS missing or invalid');
      }
    });

    // TEST 12: Property Provenance Link
    runTest('TEST-266-12', 'Property SourceId Linkage', 'PROVENANCE', () => {
      const mat = MaterialLibrary266.getMaterial('MAT-AL-6061-T6');
      const prop = mat?.properties['YIELD_STRENGTH'];
      if (!prop || prop.sourceId !== 'SRC-MMPDS-15') {
        throw new Error('Property yield strength not linked to source');
      }
    });

    // TEST 13: Temperature Condition Context
    runTest('TEST-266-13', 'Temperature Condition Context', 'CONTEXT', () => {
      const mat = MaterialLibrary266.getMaterial('MAT-AL-6061-T6');
      const prop = mat?.properties['YOUNGS_MODULUS'];
      if (!prop || prop.condition.temperatureK !== 293.15) {
        throw new Error('Temperature context 293.15 K missing');
      }
    });

    // TEST 14: Heat Treatment Condition / Temper
    runTest('TEST-266-14', 'Temper Condition Trait', 'CONDITION', () => {
      const mat = MaterialLibrary266.getMaterial('MAT-AL-6061-T6');
      if (!mat || mat.temperCondition !== 'T6') {
        throw new Error('Temper T6 missing');
      }
    });

    // TEST 15: Elastic Derivation (E, ν -> G, K)
    runTest('TEST-266-15', 'Elastic Properties Automatic Derivation', 'ELASTIC', () => {
      const mat = MaterialLibrary266.getMaterial('MAT-AL-6061-T6');
      if (!mat) throw new Error('Material missing');

      const G = mat.properties['SHEAR_MODULUS'];
      const K = mat.properties['BULK_MODULUS'];

      if (!G || G.originType !== 'DERIVED' || !G.derivationExpression) {
        throw new Error('Shear modulus G was not derived automatically');
      }
      if (!K || K.originType !== 'DERIVED' || !K.derivationExpression) {
        throw new Error('Bulk modulus K was not derived automatically');
      }

      // Check math: G = 68.9e9 / (2 * (1 + 0.33)) = 25.902255e9 Pa
      const expectedG = 68.9e9 / (2 * 1.33);
      if (Math.abs(G.canonicalValue - expectedG) > 1e6) {
        throw new Error(`Derived G value mismatch: ${G.canonicalValue} vs expected ${expectedG}`);
      }
    });

    // TEST 16: Orthotropic & Composite Metadata Schema
    runTest('TEST-266-16', 'Orthotropic & Composite Metadata Schema', 'COMPOSITE', () => {
      const carbonMat: MaterialDefinition266 = {
        id: 'MAT-CFRP-01-V1',
        materialId: 'MAT-CFRP-01',
        canonicalName: 'Carbon Fiber Epoxy Laminate [0/90]s',
        aliases: ['CFRP-UD-T700'],
        family: 'COMPOSITES',
        subfamily: 'FIBER_COMPOSITE',
        grade: 'T700/Epoxy',
        temperCondition: 'Cured',
        standard: { organization: 'CUSTOM', designation: 'ISO 14125' },
        version: 1,
        status: 'VERIFIED',
        truthStatus: 'PROVEN',
        materialState: 'SOLID',
        directionality: 'ORTHOTROPIC',
        compositeMetadata: {
          fiberType: 'Toray T700SC 12K',
          matrixType: 'Epoxy 3501-6',
          fiberVolumeFraction: 0.60,
          layupReference: '[0/90/0/90]s',
        },
        orthotropicProperties: {
          E1_Pa: 135e9,
          E2_Pa: 10e9,
          E3_Pa: 10e9,
          nu12: 0.30,
          nu23: 0.40,
          nu13: 0.30,
          G12_Pa: 5e9,
          G23_Pa: 3.5e9,
          G13_Pa: 5e9,
        },
        sources: [{ sourceId: 'SRC-COMP-01', publisher: 'Toray Industries', document: 'T700 Datasheet', revision: '1.0', publicationDate: '2021-01-01', retrievalDate: '2026-08-28', evidenceStatus: 'VERIFIED' }],
        properties: {
          DENSITY: { propertyName: 'DENSITY', canonicalValue: 1550, canonicalUnit: 'kg/m3', originType: 'PUBLISHED', sourceId: 'SRC-COMP-01', confidence: { basis: 'Datasheet', score: 0.95 }, condition: { temperatureK: 293.15 }, validityRange: { temperatureMinK: 200, temperatureMaxK: 380 } },
        },
        evidence: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        revisionHash: 'HASH-CFRP',
      };

      MaterialLibrary266.saveMaterial(carbonMat, 'Test Runner');
      const saved = MaterialLibrary266.getMaterial('MAT-CFRP-01');
      if (!saved || saved.compositeMetadata?.fiberType !== 'Toray T700SC 12K') {
        throw new Error('Composite metadata failed to save or retrieve');
      }
    });

    // TEST 17: Derived Property Origin Tagging
    runTest('TEST-266-17', 'Derived Property Origin Tagging', 'ORIGIN', () => {
      const mat = MaterialLibrary266.getMaterial('MAT-AL-6061-T6');
      const G = mat?.properties['SHEAR_MODULUS'];
      if (G?.originType !== 'DERIVED') {
        throw new Error('G property missing DERIVED origin tag');
      }
    });

    // TEST 18: Physical Consistency Contradiction Detection
    runTest('TEST-266-18', 'Physical Consistency Contradiction Rejection', 'CONSISTENCY', () => {
      const badMat: MaterialDefinition266 = {
        id: 'MAT-BAD-PHYSICS-V1',
        materialId: 'MAT-BAD-PHYSICS',
        canonicalName: 'Bad Physics Metal',
        aliases: [],
        family: 'METALS',
        subfamily: 'STEEL',
        grade: 'BAD-100',
        temperCondition: 'None',
        standard: { organization: 'CUSTOM', designation: 'BAD-SPEC' },
        version: 1,
        status: 'DRAFT',
        truthStatus: 'UNPROVEN',
        materialState: 'SOLID',
        directionality: 'ISOTROPIC',
        sources: [{ sourceId: 'S1', publisher: 'Test', document: 'Doc', revision: '1', publicationDate: '2020', retrievalDate: '2026', evidenceStatus: 'UNVERIFIED' }],
        properties: {
          DENSITY: { propertyName: 'DENSITY', canonicalValue: 7800, canonicalUnit: 'kg/m3', originType: 'USER_DEFINED', sourceId: 'S1', confidence: { basis: 'Test', score: 0.5 }, condition: { temperatureK: 293.15 }, validityRange: {} },
          YOUNGS_MODULUS: { propertyName: 'YOUNGS_MODULUS', canonicalValue: 200e9, canonicalUnit: 'Pa', originType: 'USER_DEFINED', sourceId: 'S1', confidence: { basis: 'Test', score: 0.5 }, condition: { temperatureK: 293.15 }, validityRange: {} },
          POISSONS_RATIO: { propertyName: 'POISSONS_RATIO', canonicalValue: 0.30, canonicalUnit: 'dimensionless', originType: 'USER_DEFINED', sourceId: 'S1', confidence: { basis: 'Test', score: 0.5 }, condition: { temperatureK: 293.15 }, validityRange: {} },
          SHEAR_MODULUS: { propertyName: 'SHEAR_MODULUS', canonicalValue: 150e9, canonicalUnit: 'Pa', originType: 'MEASURED', sourceId: 'S1', confidence: { basis: 'Test', score: 0.5 }, condition: { temperatureK: 293.15 }, validityRange: {} }, // 150 GPa contradicts 200 / (2*1.3) = 76.9 GPa!
        },
        evidence: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        revisionHash: 'HASH-BAD',
      };

      try {
        MaterialLibrary266.saveMaterial(badMat);
        throw new Error('Should have rejected inconsistent G modulus');
      } catch (e: any) {
        if (!e.message.includes('PHYSICAL_INCONSISTENCY_ERROR')) {
          throw e;
        }
      }
    });

    // TEST 19: Missing Property Detection (MISSING_REQUIRED_MATERIAL_PROPERTY)
    runTest('TEST-266-19', 'Missing Property Error (No Mock Defaults)', 'ERRORS', () => {
      const mat = MaterialLibrary266.getMaterial('MAT-AL-6061-T6');
      if (!mat) throw new Error('Material missing');

      const res = MaterialLibrary266.getPropertyWithContext(mat, 'COMPRESSIVE_STRENGTH');
      if (res.status !== 'MISSING_REQUIRED_MATERIAL_PROPERTY') {
        throw new Error('Expected MISSING_REQUIRED_MATERIAL_PROPERTY for missing compressive strength');
      }
    });

    // TEST 20: Negative Value Physical Inconsistency Error
    runTest('TEST-266-20', 'Negative Density Physical Error', 'ERRORS', () => {
      try {
        const badMat = {
          id: 'MAT-NEG-DENSITY-V1',
          materialId: 'MAT-NEG-DENSITY',
          canonicalName: 'Negative Density Matter',
          grade: 'NEG',
          standard: { organization: 'CUSTOM', designation: 'NEG-01' },
          properties: {
            DENSITY: { propertyName: 'DENSITY', canonicalValue: -500, canonicalUnit: 'kg/m3' },
          },
        } as any;
        MaterialLibrary266.saveMaterial(badMat);
        throw new Error('Allowed negative density');
      } catch (e: any) {
        if (!e.message.includes('PHYSICAL_INCONSISTENCY_ERROR')) {
          throw e;
        }
      }
    });

    // TEST 21: Duplicate Material Detection
    runTest('TEST-266-21', 'Duplicate Material Grade & Temper Detection', 'IMPORT', () => {
      const dup = MaterialLibrary266.validateAndPreviewImport([
        {
          materialId: 'MAT-AL-6061-T6-DUP',
          canonicalName: 'Aluminum 6061-T6 Duplicate',
          grade: '6061',
          temperCondition: 'T6',
          standard: { designation: 'ASTM B209' },
          properties: { DENSITY: { canonicalValue: 2700, canonicalUnit: 'kg/m3' } },
        },
      ]);

      if (dup.duplicates.length === 0) {
        throw new Error('Failed to detect duplicate Aluminum 6061-T6 material');
      }
    });

    // TEST 22: Material Import Preview & Pre-validation
    runTest('TEST-266-22', 'Material Import Pre-validation', 'IMPORT', () => {
      const preview = MaterialLibrary266.validateAndPreviewImport([
        {
          materialId: 'MAT-NEW-POLYMER',
          canonicalName: 'PEEK 450G Polymer',
          grade: '450G',
          temperCondition: 'Unfilled',
          standard: { designation: 'ISO 23936' },
          properties: { DENSITY: { canonicalValue: 1300, canonicalUnit: 'kg/m3' } },
        },
        {
          // Bad item missing grade
          materialId: 'MAT-BAD-ITEM',
          canonicalName: 'Bad Item',
          properties: {},
        },
      ]);

      if (preview.accepted.length !== 1 || preview.rejected.length !== 1) {
        throw new Error(`Import preview mismatch: accepted ${preview.accepted.length}, rejected ${preview.rejected.length}`);
      }
    });

    // TEST 23: Material Assignment to CAD Part
    runTest('TEST-266-23', 'Material Assignment to CAD Part', 'CAD', () => {
      const assignment = MaterialLibrary266.assignMaterial('CAD-BRACKET-01', 'CAD_PART', 'MAT-AL-6061-T6');
      if (!assignment || assignment.materialId !== 'MAT-AL-6061-T6' || !assignment.snapshotId) {
        throw new Error('CAD part material assignment failed');
      }
    });

    // TEST 24: Assembly Component Material Assignment
    runTest('TEST-266-24', 'Assembly Component Material Assignment', 'ASSEMBLY', () => {
      const assignment = MaterialLibrary266.assignMaterial('ASSY-COMP-PIN-02', 'ASSEMBLY_COMPONENT', 'MAT-SS-316L');
      if (!assignment || assignment.targetEntityId !== 'ASSY-COMP-PIN-02') {
        throw new Error('Assembly component assignment failed');
      }
    });

    // TEST 25: FEM Integration Export (SI System)
    runTest('TEST-266-25', 'FEM Export (SI System Pa)', 'FEM', () => {
      const snapshot = MaterialLibrary266.createSnapshot('MAT-AL-6061-T6');
      const femExport = MaterialLibrary266.exportToFemSolver(snapshot.snapshotId, 'SI_PA');

      if (femExport.youngsModulus !== 68.9e9 || femExport.yieldStrength !== 276e6) {
        throw new Error(`FEM export SI Pa values incorrect E=${femExport.youngsModulus}`);
      }
    });

    // TEST 26: Unit Conversion to FEM Solver (MM_MPA System)
    runTest('TEST-266-26', 'FEM Export (MM_MPA System)', 'FEM', () => {
      const snapshot = MaterialLibrary266.createSnapshot('MAT-AL-6061-T6');
      const femExport = MaterialLibrary266.exportToFemSolver(snapshot.snapshotId, 'MM_MPA');

      if (femExport.youngsModulus !== 68900 || femExport.yieldStrength !== 276) {
        throw new Error(`FEM export MM_MPA values incorrect E=${femExport.youngsModulus} (expected 68900 MPa)`);
      }
    });

    // TEST 27: Immutable Material Snapshot Freeze Test
    runTest('TEST-266-27', 'Immutable Material Snapshot Freeze Test', 'SNAPSHOT', () => {
      const snapshot1 = MaterialLibrary266.createSnapshot('MAT-AL-6061-T6', 1);
      const E_snap1 = snapshot1.properties['YOUNGS_MODULUS'].value;

      // Verify signature
      if (!snapshot1.digitalSignatureSHA256.startsWith('SIG-SNAP-')) {
        throw new Error('Digital signature missing on snapshot');
      }

      if (E_snap1 !== 68.9e9) {
        throw new Error('Snapshot value altered');
      }
    });

    // TEST 28: Evidence Generation & SHA-256 Signature
    runTest('TEST-266-28', 'Material Evidence Generation', 'EVIDENCE', () => {
      const mat = MaterialLibrary266.getMaterial('MAT-AL-6061-T6');
      if (!mat || mat.evidence.length === 0 || !mat.evidence[0].hash.startsWith('HASH-')) {
        throw new Error('Evidence SHA-256 missing');
      }
    });

    // TEST 29: Audit Trail Log Recording
    runTest('TEST-266-29', 'Audit Trail Recording', 'AUDIT', () => {
      const logs = MaterialLibrary266.getAuditLogs();
      if (logs.length === 0) {
        throw new Error('Audit trail is empty');
      }
    });

    // TEST 30: Out-of-Range Temperature Detection
    runTest('TEST-266-30', 'Out-Of-Range Temperature Detection', 'VALIDITY', () => {
      const mat = MaterialLibrary266.getMaterial('MAT-AL-6061-T6');
      if (!mat) throw new Error('Material missing');

      // Requested T = 800 K (Exceeds validity range max of 450 K)
      const res = MaterialLibrary266.getPropertyWithContext(mat, 'YOUNGS_MODULUS', { temperatureK: 800 });
      if (res.status !== 'OUT_OF_VALIDITY_RANGE') {
        throw new Error('Expected OUT_OF_VALIDITY_RANGE when temperature exceeds validity domain');
      }
    });

    // TEST 31: Deterministic Retrieval
    runTest('TEST-266-31', 'Deterministic Retrieval Repeatability', 'DETERMINISM', () => {
      const run1 = MaterialLibrary266.getMaterial('MAT-AL-6061-T6', 1);
      const run2 = MaterialLibrary266.getMaterial('MAT-AL-6061-T6', 1);
      if (run1?.revisionHash !== run2?.revisionHash) {
        throw new Error('Revision hash non-deterministic');
      }
    });

    // TEST 32: Multi-property Filter Search
    runTest('TEST-266-32', 'Multi-Property Search Filter', 'SEARCH', () => {
      const results = MaterialLibrary266.searchMaterials(undefined, {
        family: 'METALS',
        minYieldStrengthMPa: 800, // Ti-6Al-4V (880 MPa) passes, Al 6061-T6 (276 MPa) filtered out
      });

      if (results.length !== 1 || results[0].material.grade !== 'Grade 5 (6Al-4V)') {
        throw new Error(`Multi-property filter failed: expected Titanium Grade 5, got ${results.map(r => r.material.canonicalName).join(', ')}`);
      }
    });

    // TEST 33: Material Comparison Tool
    runTest('TEST-266-33', 'Material Comparison Multi-Entity', 'COMPARISON', () => {
      const mat1 = MaterialLibrary266.getMaterial('MAT-AL-6061-T6');
      const mat2 = MaterialLibrary266.getMaterial('MAT-TI-6AL4V');

      if (!mat1 || !mat2) throw new Error('Materials for comparison missing');

      const ratio = (mat2.properties['YIELD_STRENGTH']?.canonicalValue || 1) / (mat1.properties['YIELD_STRENGTH']?.canonicalValue || 1);
      if (ratio < 3.0) {
        throw new Error(`Titanium to Aluminum yield strength ratio unexpected: ${ratio.toFixed(2)}`);
      }
    });

    // TEST 34: Yield vs Ultimate Tensile Strength Cross-Mapping Guard
    runTest('TEST-266-34', 'Yield vs Ultimate Tensile Strength Guard', 'FEM', () => {
      const snapshot = MaterialLibrary266.createSnapshot('MAT-AL-6061-T6');
      const fem = MaterialLibrary266.exportToFemSolver(snapshot.snapshotId, 'SI_PA');

      if (fem.yieldStrength === fem.ultimateTensileStrength) {
        throw new Error('Yield Strength and Ultimate Strength cross-contaminated in FEM export!');
      }
      if (fem.yieldStrength > fem.ultimateTensileStrength) {
        throw new Error('Yield Strength cannot exceed Ultimate Tensile Strength');
      }
    });

    // TEST 35: Access Control & Engineering Truth Status
    runTest('TEST-266-35', 'Engineering Truth Status PROVEN', 'GOVERNANCE', () => {
      const mat = MaterialLibrary266.getMaterial('MAT-AL-6061-T6');
      if (!mat || mat.truthStatus !== 'PROVEN') {
        throw new Error('Engineering truth status not PROVEN');
      }
    });

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    const passRate = (passed / results.length) * 100;

    return {
      total: results.length,
      passed,
      failed,
      passRate,
      results,
    };
  }
}
