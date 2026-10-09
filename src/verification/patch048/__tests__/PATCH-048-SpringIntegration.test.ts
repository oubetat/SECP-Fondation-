/**
 * PROMPT-048 — Spring Engineering Integration Verification
 * Negative proofs, Physical Verifications & Truth Gates for Canonical Spring Generation
 */

import { describe, it, expect } from 'vitest';
import { DocumentEvaluator } from '../../../engine/cad-kernel/document/DocumentEvaluator';
import { SpringGenerator } from '../../../engine/assembly/spring/SpringGenerator';
import { SpringEvaluator } from '../../../engine/features/SpringEvaluator';
import { SpringStressEngine } from '../../../engine/assembly/spring/SpringStressEngine';
import { SPRING_MATERIALS } from '../../../engine/assembly/spring/SpringTypes';
import { FeatureNode } from '../../../engine/cad-kernel/history/FeatureNode';

describe('PROMPT-048: Canonical Spring Engineering Integration', () => {
  it('SPR-NEG-001: Rejects Cylinder Mapping for Springs', () => {
    const springDef = SpringGenerator.createParametricSpring({
      wireDiameterMm: 2.0,
      meanDiameterMm: 20.0,
      activeCoilsCount: 5,
      freeLengthMm: 50.0
    });
    
    const partDef = SpringGenerator.toAssemblyPartDefinition(springDef);
    
    // Primitive mapping as CYLINDER must be removed!
    const cylinderPrimitive = partDef.primitives?.find(p => p.type === 'CYLINDER');
    expect(cylinderPrimitive).toBeUndefined();
    
    // Must be replaced with Canonical Features
    expect(partDef.features).toBeDefined();
    if (!partDef.features) throw new Error('partDef.features missing');
    expect(partDef.features.length).toBeGreaterThan(0);
    expect(partDef.features[0].type).toBe('SPRING');
  });

  it('SPR-001 & SPR-002: Rejection of Non-Physical Parameters (Negative Proofs)', () => {
    // 1. Rejects zero/negative wire diameter
    expect(() => {
      const node = new FeatureNode({
        id: 'FEAT-NEG-1',
        documentId: 'DOC-1',
        type: 'SPRING',
        name: 'Bad Wire',
        sequence: 1,
        definition: {
          type: 'SPRING',
          name: 'Bad Wire',
          parameters: {
            springType: 'COMPRESSION',
            wireDiameterMm: -2.0,
            meanDiameterMm: 20.0,
            activeCoilsCount: 5,
            freeLengthMm: 50.0
          },
          inputReferences: []
        }
      });
      SpringEvaluator.evaluate(node);
    }).toThrow(/INVALID_WIRE_DIAMETER/);

    // 2. Rejects mean diameter smaller than wire diameter (geometric self-intersection)
    expect(() => {
      const node = new FeatureNode({
        id: 'FEAT-NEG-2',
        documentId: 'DOC-1',
        type: 'SPRING',
        name: 'Intersecting',
        sequence: 1,
        definition: {
          type: 'SPRING',
          name: 'Intersecting',
          parameters: {
            springType: 'COMPRESSION',
            wireDiameterMm: 10.0,
            meanDiameterMm: 8.0,
            activeCoilsCount: 5,
            freeLengthMm: 50.0
          },
          inputReferences: []
        }
      });
      SpringEvaluator.evaluate(node);
    }).toThrow(/GEOMETRIC_SELF_INTERSECTION/);

    // 3. Rejects free length smaller than solid height
    expect(() => {
      const node = new FeatureNode({
        id: 'FEAT-NEG-3',
        documentId: 'DOC-1',
        type: 'SPRING',
        name: 'Crushed Solid',
        sequence: 1,
        definition: {
          type: 'SPRING',
          name: 'Crushed Solid',
          parameters: {
            springType: 'COMPRESSION',
            wireDiameterMm: 5.0,
            meanDiameterMm: 30.0,
            activeCoilsCount: 10, // nt = 12, Solid Height = 12 * 5 = 60mm
            freeLengthMm: 40.0 // 40 < 60mm -> Infeasible
          },
          inputReferences: []
        }
      });
      SpringEvaluator.evaluate(node);
    }).toThrow(/SOLID_HEIGHT_VIOLATION/);
  });

  it('SPR-003: Wahl Factor and Analytical Stress Calculations', () => {
    // Standard spring index C = D / d = 24 / 3 = 8
    const C = 8.0;
    const Kw = SpringStressEngine.calculateWahlFactor(C);
    
    // Theoretical: Kw = (4*8 - 1)/(4*8 - 4) + 0.615 / 8 = 31/28 + 0.076875 = 1.10714 + 0.076875 = 1.1840
    expect(Kw).toBeCloseTo(1.184, 3);

    // Solid height with closed and ground ends (nt = 10, d = 2.5mm)
    const solidHeight = SpringStressEngine.calculateSolidHeight(2.5, 10, {
      startEndType: 'CLOSED_AND_GROUND',
      endEndType: 'CLOSED_AND_GROUND',
      groundCoilsCount: 1.5,
      inactiveCoilsCount: 2.0
    });
    expect(solidHeight).toBe(25.0); // 10 * 2.5
  });

  it('SPR-004: Material Ontology & Spring Rate Physics', () => {
    const musicWire = SPRING_MATERIALS.MUSIC_WIRE_ASTM_A228;
    expect(musicWire.shearModulusG_Gpa).toBe(80);

    const doc = DocumentEvaluator.createDocument({ documentId: 'DOC-SPRING-PHYS' });
    const springFeature = new FeatureNode({
      id: 'FEAT-SPRING-PHYS',
      documentId: 'DOC-SPRING-PHYS',
      type: 'SPRING',
      name: 'Precision Spring',
      sequence: 1,
      definition: {
        type: 'SPRING',
        name: 'Precision Spring',
        parameters: {
          springType: 'COMPRESSION',
          wireDiameterMm: 2.0,
          meanDiameterMm: 20.0,
          activeCoilsCount: 10,
          freeLengthMm: 80.0,
          materialGrade: 'MUSIC_WIRE_ASTM_A228'
        },
        inputReferences: []
      }
    });

    if (!doc.features) throw new Error('doc.features missing');
    doc.features.push(springFeature);
    const result = DocumentEvaluator.evaluate(doc);
    expect(result.success).toBe(true);

    const props = springFeature.outputGeometry.engineeringProperties;
    expect(props).toBeDefined();
    expect(props.springIndex).toBe(10.0); // 20 / 2
    expect(props.outerDiameter).toBe(22.0); // 20 + 2
    expect(props.innerDiameter).toBe(18.0); // 20 - 2
    expect(props.pitch).toBe(8.0); // 80 / 10
    
    // k = G * d^4 / (8 * D^3 * na) = (80000 * 2^4) / (8 * 20^3 * 10) = 1,280,000 / 640,000 = 2.0 N/mm
    expect(props.springRateNPerMm).toBeCloseTo(2.0, 4);
  });

  it('SPR-005: Right-Hand vs Left-Hand Helix Coordinates', () => {
    const rhPoints = SpringEvaluator.generateMathematicalHelix(20.0, 50.0, 2, 'RIGHT_HAND');
    const lhPoints = SpringEvaluator.generateMathematicalHelix(20.0, 50.0, 2, 'LEFT_HAND');

    expect(rhPoints.length).toBe(lhPoints.length);
    expect(rhPoints.length).toBeGreaterThan(50);
    
    // Point at non-zero angle should have inverted y coordinates between RH and LH
    const pRH = rhPoints[10];
    const pLH = lhPoints[10];
    expect(pRH.z).toBeCloseTo(pLH.z, 4);
    expect(pRH.x).toBeCloseTo(pLH.x, 4);
    expect(pRH.y).toBeCloseTo(-pLH.y, 4);
  });

  it('SPR-009 & SPR-010: B-Rep Generation and Signature Verification', () => {
    // Create Document with Spring Feature
    const doc = DocumentEvaluator.createDocument({ documentId: 'DOC-SPRING-1' });
    
    const springFeature = new FeatureNode({
      id: 'FEAT-SPRING',
      documentId: 'DOC-SPRING-1',
      type: 'SPRING',
      name: 'Compression Spring',
      sequence: 1,
      dependencyIds: [],
      definition: {
        type: 'SPRING',
        name: 'Compression Spring',
        parameters: {
          springType: 'COMPRESSION',
          wireDiameterMm: 2.5,
          meanDiameterMm: 25.0,
          activeCoilsCount: 10,
          freeLengthMm: 100.0,
          helixDirection: 'RIGHT_HAND'
        },
        inputReferences: []
      }
    });
    
    if (!doc.features) throw new Error('doc.features missing');
    doc.features.push(springFeature);
    
    const evalResult = DocumentEvaluator.evaluate(doc);
    if (!evalResult.success) {
      console.error(evalResult.diagnostics);
    }
    expect(evalResult.success).toBe(true);
    
    const evaluatedSpring = doc.features[0];
    expect(evaluatedSpring.state).toBe('VALID');
    expect(evaluatedSpring.outputGeometry).toBeDefined();
    
    const geometry = evaluatedSpring.outputGeometry;
    
    // Assert Helical Sweep Signature exists (Proves B-Rep creation from Sweep instead of fake cylinder)
    expect(geometry.signature).toContain('BREP_HELICAL_SWEEP');
    expect(geometry.signature).toContain('Wire(2.500)');
    expect(geometry.signature).toContain('Mean(25.000)');
    expect(geometry.signature).toContain('Pitch(10.000)'); // 100 / 10
    expect(geometry.signature).toContain('Coils(10)');
    expect(geometry.topology.facesCount).toBe(1);
    expect(geometry.topology.isWatertight).toBe(true);
    expect(geometry.id).toContain('SOLID_SPRING_FEAT-SPRING');
  });

  it('SPR-011 to SPR-017: Parametric Mutation updates canonical Geometry', () => {
    const doc = DocumentEvaluator.createDocument({ documentId: 'DOC-SPRING-2' });
    if (!doc.features) throw new Error('doc.features missing');
    
    doc.features.push(new FeatureNode({
      id: 'FEAT-SPRING',
      documentId: 'DOC-SPRING-2',
      type: 'SPRING',
      name: 'Compression Spring',
      sequence: 1,
      dependencyIds: [],
      definition: {
        type: 'SPRING',
        name: 'Compression Spring',
        parameters: {
          springType: 'COMPRESSION',
          wireDiameterMm: 2.0,
          meanDiameterMm: 20.0,
          activeCoilsCount: 5,
          freeLengthMm: 50.0,
          helixDirection: 'LEFT_HAND'
        },
        inputReferences: []
      }
    }));
    
    DocumentEvaluator.evaluate(doc);
    let springFeat = doc.features[0];
    const initialSignature = springFeat.outputGeometry.signature;
    
    expect(initialSignature).toContain('Wire(2.000)');
    expect(initialSignature).toContain('Mean(20.000)');
    
    // Mutate parameters
    springFeat.definition.parameters = {
      ...springFeat.definition.parameters,
      wireDiameterMm: 3.5,
      meanDiameterMm: 30.0,
      activeCoilsCount: 8,
      freeLengthMm: 60.0
    };
    springFeat.parameters = springFeat.definition.parameters;
    springFeat.state = 'STALE'; // trigger regeneration
    
    DocumentEvaluator.evaluate(doc);
    if (!doc.features) throw new Error('doc.features missing');
    springFeat = doc.features[0];
    const updatedSignature = springFeat.outputGeometry.signature;
    
    expect(updatedSignature).not.toBe(initialSignature);
    expect(updatedSignature).toContain('Wire(3.500)');
    expect(updatedSignature).toContain('Mean(30.000)');
    expect(updatedSignature).toContain('Pitch(7.500)'); // 60 / 8
    expect(updatedSignature).toContain('Coils(8)');
  });

  it('SPR-018: End-to-End STEP AP214 and IGES 5.3 Export Verification', () => {
    const stepOutput = SpringGenerator.generateStepAP214({
      springId: 'SPRING-AP214-TEST',
      name: 'Helical_Spring_Main',
      d: 2.0,
      D: 20.0,
      L0: 50.0,
      nt: 7,
      materialName: 'Music Wire ASTM A228'
    });

    expect(stepOutput).toContain('ISO-10303-21;');
    expect(stepOutput).toContain('AUTOMOTIVE_DESIGN');
    expect(stepOutput).toContain('MANIFOLD_SOLID_BREP');
    expect(stepOutput).toContain('SURFACE_CURVE_SWEEP');

    const igesOutput = SpringGenerator.generateIges53({
      springId: 'SPRING-IGES-TEST',
      name: 'Helical_Spring_Main',
      d: 2.0,
      D: 20.0,
      L0: 50.0
    });

    expect(igesOutput).toContain('IGES 5.3');
    expect(igesOutput).toContain('SPRING-IGES-TEST');
  });
});

