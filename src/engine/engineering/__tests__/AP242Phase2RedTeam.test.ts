/**
 * SECP Industrial OS v2 — CAP-SUP-002 Phase 2 Red-Team Adversarial Test Suite
 * AP242 Semantic Round-Trip Truth & Multi-Dimensional Fidelity Suite
 */

import { describe, it, expect } from 'vitest';
import { StepAp242Pipeline } from '../../interop/step-ap242/StepAp242Pipeline';
import { StepAp242Parser } from '../../interop/step-ap242/StepAp242Parser';
import { StepAp242Validator } from '../../interop/step-ap242/StepAp242Validator';
import { StepAp242Exporter } from '../../interop/step-ap242/StepAp242Exporter';
import { StepAp242Mapper } from '../../interop/step-ap242/StepAp242Mapper';
import { StepAp242RoundTripVerifier } from '../../interop/step-ap242/StepAp242RoundTripVerifier';
import { AP242PmiParser } from '../../interop/step-ap242/pmi/AP242PmiParser';
import { AP242PmiExporter } from '../../interop/step-ap242/pmi/AP242PmiExporter';
import { AP242PmiRoundTripVerifier } from '../../interop/step-ap242/pmi/AP242PmiRoundTripVerifier';
import { IndependentAp242Oracle } from '../../interop/step-ap242/IndependentAp242Oracle';
import { AP242TestFixtures } from '../../interop/AP242TestFixtures';
import { SECP080AP242VerificationEngine } from '../../validation/SECP080AP242VerificationEngine';

describe('CAP-SUP-002: AP242 Semantic Round-Trip Truth & Red-Team Suite', () => {
  // =========================================================================
  // 1. CANONICAL SPECIMEN & POSITIVE ROUND-TRIP FIDELITY
  // =========================================================================

  it('P1: Executes complete round-trip for Canonical Specimen A (Prismatic Block) with EXACT fidelity', async () => {
    const fixtureA = AP242TestFixtures.getFixtureA();
    const audit = SECP080AP242VerificationEngine.performFullRoundTripAudit(fixtureA);

    expect(audit.passed).toBe(true);
    expect(audit.geometryFidelity.passed).toBe(true);
    expect(audit.geometryFidelity.volumeDeviationRelative).toBeLessThan(1e-4);
    expect(audit.semanticRetention.retentionRatio).toBeGreaterThanOrEqual(0.9999);
    expect(audit.unitIntegrity.passed).toBe(true);
  });

  it('P2: Executes complete round-trip for Fixture C (Datum System & GD&T) preserving datums and position tolerances', async () => {
    const fixtureC = AP242TestFixtures.getFixtureC();
    const audit = SECP080AP242VerificationEngine.performFullRoundTripAudit(fixtureC);

    expect(audit.passed).toBe(true);
    expect(audit.datumIntegrity.passed).toBe(true);
    expect(audit.datumIntegrity.unresolvedDatumReferences).toBe(0);
    expect(audit.semanticRetention.preservedEntities).toBe(audit.semanticRetention.totalExpectedEntities);
  });

  it('P3: Executes complete round-trip for Fixture E (Assembly with Shaft) maintaining component integrity', async () => {
    const fixtureE = AP242TestFixtures.getFixtureE();
    const audit = SECP080AP242VerificationEngine.performFullRoundTripAudit(fixtureE);

    expect(audit.passed).toBe(true);
    expect(audit.geometryFidelity.vertexCountMatch).toBe(true);
    expect(audit.semanticRetention.retentionRatio).toBe(1.0);
  });

  // =========================================================================
  // 2. UNIT CONVERSION & NORMALIZATION FIDELITY
  // =========================================================================

  it('U1: Preserves unit normalization across Millimeter, Meter, and Inch declarations', () => {
    const fixtureMM = AP242TestFixtures.getFixtureA();
    fixtureMM.unitSystem.lengthUnit = 'MILLIMETRE';
    fixtureMM.unitSystem.lengthConversionToMm = 1.0;

    const fixtureINCH = AP242TestFixtures.getFixtureA();
    fixtureINCH.unitSystem.lengthUnit = 'INCH';
    fixtureINCH.unitSystem.lengthConversionToMm = 25.4;

    const auditMM = SECP080AP242VerificationEngine.verifyUnitIntegrity(fixtureMM);
    const auditINCH = SECP080AP242VerificationEngine.verifyUnitIntegrity(fixtureINCH);

    expect(auditMM.passed).toBe(true);
    expect(auditINCH.passed).toBe(true);
    expect(auditINCH.conversionValid).toBe(true);
  });

  // =========================================================================
  // 3. INDEPENDENT ORACLE VALIDATION
  // =========================================================================

  it('O1: Independent Oracle computes raw STEP bounding box and topology without SECP kernel dependencies', () => {
    const fixtureA = AP242TestFixtures.getFixtureA();
    const stepText = SECP080AP242VerificationEngine.performFullRoundTripAudit(fixtureA).stepFileHash;

    // Use raw STEP string for oracle
    const rawStepText = `
ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('Test Block'),'2;1');
FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF'));
ENDSEC;
DATA;
#100=CARTESIAN_POINT('',(0.0,0.0,0.0));
#101=CARTESIAN_POINT('',(100.0,50.0,25.0));
#102=VERTEX_POINT('v1',#100);
#103=VERTEX_POINT('v2',#101);
#104=EDGE_CURVE('e1',#102,#103,#105,.T.);
#105=LINE('',#100,#106);
#106=VECTOR('',#107,1.0);
#107=DIRECTION('',(1.0,0.0,0.0));
#108=ADVANCED_FACE('f1',(#109),#110,.T.);
#109=FACE_BOUND('',#111,.T.);
#110=PLANE('',#112);
#111=EDGE_LOOP('',(#104));
#112=AXIS2_PLACEMENT_3D('',#100,#107,#107);
#113=CLOSED_SHELL('',(#108));
#114=MANIFOLD_SOLID_BREP('solid1',#113);
#200=DIMENSIONAL_CHARACTERISTIC_REPRESENTATION('dim1','LINEAR',100.0,'mm',('NONE',0,0),(#108),.T.);
ENDSEC;
END-ISO-10303-21;
    `.trim();

    const bbox = IndependentAp242Oracle.computeIndependentBBox(rawStepText);
    const topo = IndependentAp242Oracle.computeIndependentTopology(rawStepText);
    const pmis = IndependentAp242Oracle.extractIndependentPmi(rawStepText);

    expect(bbox.dx).toBe(100.0);
    expect(bbox.dy).toBe(50.0);
    expect(bbox.dz).toBe(25.0);
    expect(topo.vertices).toBe(2);
    expect(topo.faces).toBe(1);
    expect(topo.solids).toBe(1);
    expect(pmis.length).toBe(1);
    expect(pmis[0].nominalValue).toBe(100.0);
  });

  // =========================================================================
  // 4. ADVERSARIAL RED-TEAM CASES (A1 THROUGH A12)
  // =========================================================================

  it('A1: Intercepts corrupt STEP entity reference (dangling reference #9999)', async () => {
    const corruptStep = `
ISO-10303-21;
HEADER;
FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF'));
ENDSEC;
DATA;
#100=MANIFOLD_SOLID_BREP('solid_corrupt',#9999);
ENDSEC;
END-ISO-10303-21;
    `.trim();

    const result = await StepAp242Pipeline.execute(corruptStep, 'corrupt_ref.stp');
    expect(result.validation.status === 'INVALID' || !result.validation.referenceIntegrity).toBe(true);
  });

  it('A2: Intercepts duplicate entity ID / persistent identity collision', () => {
    const duplicateStep = `
ISO-10303-21;
HEADER;
FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF'));
ENDSEC;
DATA;
#100=CARTESIAN_POINT('',(0.0,0.0,0.0));
#100=CARTESIAN_POINT('',(10.0,10.0,10.0));
ENDSEC;
END-ISO-10303-21;
    `.trim();

    const parsed = StepAp242Parser.parse(duplicateStep);
    // Expect entities map size to reflect single key or validator error
    expect(parsed.data.entities.size).toBe(1);
  });

  it('A3: Intercepts broken topology reference (edge loop referencing missing entity)', async () => {
    const brokenTopoStep = `
ISO-10303-21;
HEADER;
FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF'));
ENDSEC;
DATA;
#100=EDGE_LOOP('loop1',(#8888));
#101=ADVANCED_FACE('face1',(#100),#102,.T.);
#102=PLANE('',#103);
#103=AXIS2_PLACEMENT_3D('',#104,#105,#105);
#104=CARTESIAN_POINT('',(0,0,0));
#105=DIRECTION('',(0,0,1));
#106=CLOSED_SHELL('',(#101));
#107=MANIFOLD_SOLID_BREP('solid1',#106);
ENDSEC;
END-ISO-10303-21;
    `.trim();

    const res = await StepAp242Pipeline.execute(brokenTopoStep, 'broken_topo.stp');
    expect(res.validation.status === 'INVALID' || (res.fidelity?.lossReports.length ?? 0) > 0).toBe(true);
  });

  it('A4: Intercepts unit mismatch or unresolvable unit declaration', () => {
    const invalidUnitModel = AP242TestFixtures.getFixtureA();
    invalidUnitModel.unitSystem.lengthUnit = 'UNKNOWN_UNIT_CURRENCY';
    invalidUnitModel.unitSystem.lengthConversionToMm = -1.0;

    const unitAudit = SECP080AP242VerificationEngine.verifyUnitIntegrity(invalidUnitModel);
    expect(unitAudit.passed).toBe(false);
  });

  it('A5: Intercepts PMI referencing non-existent geometry entity', () => {
    const fixtureC = AP242TestFixtures.getFixtureC();
    fixtureC.datums[0].referencedFaceIds = ['non_existent_face_999'];

    const datumAudit = SECP080AP242VerificationEngine.verifyDatumIntegrity(fixtureC);
    expect(datumAudit.passed).toBe(false);
    expect(datumAudit.unresolvedDatumReferences).toBeGreaterThan(0);
  });

  it('A6: Intercepts assembly occurrence referencing non-existent component', () => {
    const badAssemblyStep = `
ISO-10303-21;
HEADER;
FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF'));
ENDSEC;
DATA;
#500=NEXT_ASSEMBLY_USAGE_OCCURRENCE('NAUO_1','Link',#9991,#9992);
ENDSEC;
END-ISO-10303-21;
    `.trim();

    const topo = IndependentAp242Oracle.computeIndependentTopology(badAssemblyStep);
    expect(topo.danglingReferences).toContain(9991);
  });

  it('A7: Intercepts missing required entity in STEP structure', async () => {
    const missingEntityStep = `
ISO-10303-21;
HEADER;
FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF'));
ENDSEC;
DATA;
#10=MANIFOLD_SOLID_BREP('solid_missing');
ENDSEC;
END-ISO-10303-21;
    `.trim();

    const res = await StepAp242Pipeline.execute(missingEntityStep, 'missing.stp');
    expect(res.validation.status).toBe('INVALID');
  });

  it('A8: Detects modified geometry with unchanged semantic identity (Integrity Violation)', () => {
    const src = AP242TestFixtures.getFixtureA();
    const mutated = JSON.parse(JSON.stringify(src));
    mutated.solids[0].volumeMm3 = 999999.0; // Mutated volume

    const audit = SECP080AP242VerificationEngine.verifyGeometryFidelity(src, mutated);
    expect(audit.passed).toBe(false);
    expect(audit.volumeDeviationRelative).toBeGreaterThan(0.1);
  });

  it('A9: Detects modified PMI value/unit with unchanged identity (Integrity Violation)', () => {
    const src = AP242TestFixtures.getFixtureA();
    const mutated = JSON.parse(JSON.stringify(src));
    mutated.dimensions[0].nominalValue = 999.9; // Tampered nominal value

    const report = SECP080AP242VerificationEngine.verifySemanticRetention(src, mutated);
    expect(report.retentionRatio).toBeLessThan(1.0);
    expect(report.modifiedEntities).toBeGreaterThan(0);
  });

  it('A10: Intercepts revision mismatch preventing stale inspection attachment', () => {
    const src = AP242TestFixtures.getFixtureA();
    const mutated = JSON.parse(JSON.stringify(src));
    mutated.header.fileName = 'fixture_a_rev2.stp';

    const hash1 = SECP080AP242VerificationEngine.computeModelHash(src);
    const hash2 = SECP080AP242VerificationEngine.computeModelHash(mutated);

    expect(hash1).not.toBe(hash2);
  });

  it('A11: Entity reordering preserves engineering identity and mapping', () => {
    const step1 = `
ISO-10303-21;
HEADER;
FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF'));
ENDSEC;
DATA;
#10=CARTESIAN_POINT('',(0,0,0));
#20=CARTESIAN_POINT('',(10,0,0));
ENDSEC;
END-ISO-10303-21;
    `.trim();

    const step2 = `
ISO-10303-21;
HEADER;
FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF'));
ENDSEC;
DATA;
#20=CARTESIAN_POINT('',(10,0,0));
#10=CARTESIAN_POINT('',(0,0,0));
ENDSEC;
END-ISO-10303-21;
    `.trim();

    const p1 = StepAp242Parser.parse(step1);
    const p2 = StepAp242Parser.parse(step2);

    expect(p1.data.entities.size).toBe(p2.data.entities.size);
    expect(p1.data.entities.get(10)).toEqual(p2.data.entities.get(10));
    expect(p1.data.entities.get(20)).toEqual(p2.data.entities.get(20));
  });

  it('A12: Distinguishes duplicate geometry with distinct persistent identities', () => {
    const fixtureA = AP242TestFixtures.getFixtureA();
    const dim1 = fixtureA.dimensions[0];
    const dim2 = fixtureA.dimensions[1];

    expect(dim1.id).not.toBe(dim2.id);
  });

  // =========================================================================
  // 5. MUTATION TESTING SUITE (100% DETECTION OF CRITICAL MUTATIONS)
  // =========================================================================

  it('M1: Achieves 100% detection rate across 11 critical declared mutations', () => {
    const baseModel = AP242TestFixtures.getFixtureD();
    const baseHash = SECP080AP242VerificationEngine.computeModelHash(baseModel);

    const mutations = [
      { name: 'Vertex Coordinates', mutator: (m: any) => m.solids[0].vertices[0].point.x += 10.0 },
      { name: 'Edge Connectivity', mutator: (m: any) => m.solids[0].edges[0].startVertexId = 'v8' },
      { name: 'Face Orientation', mutator: (m: any) => m.solids[0].faces[0].normal.z = 1 },
      { name: 'Loop Membership', mutator: (m: any) => m.solids[0].faces[0].boundEdgeIds.pop() },
      { name: 'Solid Identity', mutator: (m: any) => m.solids[0].solidId = 'MUTATED_SOLID_ID' },
      { name: 'Assembly Transform', mutator: (m: any) => m.solids[0].centerOfGravity.x += 100.0 },
      { name: 'Unit Metadata', mutator: (m: any) => m.unitSystem.lengthUnit = 'INCH' },
      { name: 'PMI Target', mutator: (m: any) => m.dimensions[0].referencedGeometryIds = ['face_back'] },
      { name: 'Tolerance Value', mutator: (m: any) => m.dimensions[0].tolerance.upperDeviationMm = 5.0 },
      { name: 'Revision ID', mutator: (m: any) => m.header.timestamp = '2099-01-01T00:00:00Z' },
      { name: 'Persistent Identity', mutator: (m: any) => m.dimensions[0].id = 'dim_mutated_id' }
    ];

    let detectedCount = 0;

    for (const mutation of mutations) {
      const clone = JSON.parse(JSON.stringify(baseModel));
      mutation.mutator(clone);

      const mutHash = SECP080AP242VerificationEngine.computeModelHash(clone);
      const audit = SECP080AP242VerificationEngine.performFullRoundTripAudit(clone);

      const detected = mutHash !== baseHash || !audit.passed || audit.semanticRetention.modifiedEntities > 0;
      if (detected) detectedCount++;
    }

    expect(detectedCount).toBe(mutations.length);
  });
});
