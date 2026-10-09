/**
 * SECP CAD Kernel — Canonical Engineering Document & Evaluator Tests
 * Phase 2 (PATCH-KERNEL-002)
 */

import { describe, it, expect } from 'vitest';
import {
  DocumentEvaluator,
  EngineeringDocument,
  DEFAULT_UNIT_SYSTEM_MM,
  DEFAULT_UNIT_SYSTEM_SI
} from '../index';
import { TopoShapeEnum } from '../../topology/TopologyContracts';

describe('PATCH-KERNEL-002 — Canonical Engineering Document & Evaluator', () => {
  it('TEST-01: Creates a canonical EngineeringDocument with default SI/MM units and structure', () => {
    const doc = DocumentEvaluator.createDocument({
      documentId: 'DOC_FLANGE_001',
      units: DEFAULT_UNIT_SYSTEM_MM,
      parameters: [
        { id: 'p1', name: 'outerDiameter', expression: '120', value: 120, unit: 'mm' },
        { id: 'p2', name: 'innerDiameter', expression: 'outerDiameter * 0.5', value: 0, unit: 'mm' },
        { id: 'p3', name: 'thickness', expression: '25', value: 25, unit: 'mm' }
      ]
    });

    expect(doc.documentId).toBe('DOC_FLANGE_001');
    expect(doc.revision).toBe(1);
    expect(doc.units.system).toBe('SI_MM');
    expect(doc.parameters.length).toBe(3);
    expect(doc.sketches).toBeDefined();
    expect(doc.features).toBeDefined();
    expect(doc.topologyMap).toBeDefined();
    expect(doc.derived).toBeDefined();
    expect(doc.evidence).toBeDefined();
  });

  it('TEST-02: Evaluates parameter dependencies and algebraic expressions deterministically', () => {
    const rawParams = [
      { id: 'p1', name: 'L', expression: '200', value: 200 },
      { id: 'p2', name: 'W', expression: 'L / 4', value: 0 },
      { id: 'p3', name: 'H', expression: 'W * 0.5 + 5', value: 0 }
    ];

    const evaluated = DocumentEvaluator.evaluateParameters(rawParams);
    expect(evaluated.find(p => p.name === 'L')?.value).toBe(200);
    expect(evaluated.find(p => p.name === 'W')?.value).toBe(50);
    expect(evaluated.find(p => p.name === 'H')?.value).toBe(30);
  });

  it('TEST-03: Full pipeline execution: Document (Parameters + Sketches + Features) -> Evaluator -> BRepSolid', () => {
    const doc = DocumentEvaluator.createDocument({
      documentId: 'DOC_BRACKET_002',
      parameters: [
        { id: 'p1', name: 'width', expression: '50', value: 50 },
        { id: 'p2', name: 'height', expression: '40', value: 40 },
        { id: 'p3', name: 'depth', expression: '30', value: 30 }
      ],
      sketches: [
        {
          id: 'SKETCH_01',
          name: 'BaseProfile',
          plane: 'XY',
          closedProfile: true,
          entities: [
            { id: 'l1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }] },
            { id: 'l2', type: 'LINE', points: [{ x: 50, y: 0 }, { x: 50, y: 40 }] },
            { id: 'l3', type: 'LINE', points: [{ x: 50, y: 40 }, { x: 0, y: 40 }] },
            { id: 'l4', type: 'LINE', points: [{ x: 0, y: 40 }, { x: 0, y: 0 }] }
          ]
        }
      ],
      features: [
        {
          id: 'EXTRUDE_01',
          type: 'EXTRUDE',
          name: 'MainBody',
          parameters: {
            depth: 'depth'
          },
          inputReferences: [{ targetFeatureId: 'SKETCH_01' }],
          dependencyIds: ['SKETCH_01']
        }
      ]
    });

    const result = DocumentEvaluator.evaluate(doc, {
      generateMesh: true,
      generateFEA: true,
      generateCFD: true,
      generateCAM: true
    });

    expect(result.success).toBe(true);
    expect(result.evaluatedShape).toBeDefined();
    expect(result.evaluatedShape?.shapeType).toBe(TopoShapeEnum.SOLID);
    expect(result.evaluatedShape?.outerShell.orientedFaces.length).toBeGreaterThan(0);

    // Derived engineering representations
    expect(result.document.derived.mesh).toBeDefined();
    expect(result.document.derived.mesh?.vertices.length).toBeGreaterThan(0);
    expect(result.document.derived.fea).toBeDefined();
    expect(result.document.derived.fea?.nodeCount).toBeGreaterThan(0);
    expect(result.document.derived.cfd).toBeDefined();
    expect(result.document.derived.cam).toBeDefined();
    expect(result.document.derived.cam?.operations.length).toBeGreaterThan(0);

    // Topology lineage & forensic evidence
    expect(result.document.topologyMap.documentId).toBe('DOC_BRACKET_002');
    expect(Object.keys(result.document.topologyMap.entries).length).toBeGreaterThan(0);
    expect(result.document.evidence.length).toBeGreaterThan(0);
    expect(result.document.evidence[0].stage).toBe('GEOMETRY');
    expect(result.document.evidence[0].canonicalHash).toBeDefined();
  });

  it('TEST-04: Sketch-only document should not evaluate to a SOLID', () => {
    const doc = DocumentEvaluator.createDocument({
      documentId: 'DOC_SKETCH_ONLY',
      parameters: [],
      sketches: [
        {
          id: 'SKETCH_01',
          name: 'BaseProfile',
          plane: 'XY',
          closedProfile: true,
          entities: [
            { id: 'l1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }] }
          ]
        }
      ],
      features: []
    });

    const result = DocumentEvaluator.evaluate(doc, {
      generateMesh: false,
      generateFEA: false,
      generateCFD: false,
      generateCAM: false
    });

    expect(result.success).toBe(true);
    expect(result.evaluatedShape).toBeUndefined(); // Must NOT be fabricated into a Solid
  });

  it('TEST-05: Causality and determinism on parametric changes', () => {
    // We create a doc that extrudes
    const createParametricDoc = (depthVal: number) => {
      return DocumentEvaluator.createDocument({
        documentId: 'DOC_PARAM_01',
        parameters: [
          { id: 'p1', name: 'depth', expression: depthVal.toString(), value: depthVal }
        ],
        sketches: [
          {
            id: 'SKETCH_01',
            name: 'Profile',
            plane: 'XY',
            closedProfile: true,
            entities: [
              { id: 'l1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }] },
              { id: 'l2', type: 'LINE', points: [{ x: 50, y: 0 }, { x: 50, y: 50 }] },
              { id: 'l3', type: 'LINE', points: [{ x: 50, y: 50 }, { x: 0, y: 50 }] },
              { id: 'l4', type: 'LINE', points: [{ x: 0, y: 50 }, { x: 0, y: 0 }] }
            ]
          }
        ],
        features: [
          {
            id: 'EXTRUDE_01',
            type: 'EXTRUDE',
            name: 'MainBody',
            parameters: { depth: 'depth' },
            inputReferences: [{ targetFeatureId: 'SKETCH_01' }],
            dependencyIds: ['SKETCH_01']
          }
        ]
      });
    };

    const docA1 = createParametricDoc(10);
    const resultA1 = DocumentEvaluator.evaluate(docA1, { generateMesh: true, generateFEA: true, generateCFD: true, generateCAM: true });
    
    const docA2 = createParametricDoc(10);
    const resultA2 = DocumentEvaluator.evaluate(docA2, { generateMesh: true, generateFEA: true, generateCFD: true, generateCAM: true });

    // Determinism: Same params -> same hashes
    const evidenceA1 = resultA1.document.evidence.find(e => e.stage === 'GEOMETRY');
    const evidenceA2 = resultA2.document.evidence.find(e => e.stage === 'GEOMETRY');
    expect(evidenceA1?.geometryHash).toEqual(evidenceA2?.geometryHash);
    expect(evidenceA1?.canonicalHash).toEqual(evidenceA2?.canonicalHash);

    // Causality: Different params -> different hashes
    const docB = createParametricDoc(20);
    const resultB = DocumentEvaluator.evaluate(docB, { generateMesh: true, generateFEA: true, generateCFD: true, generateCAM: true });
    const evidenceB = resultB.document.evidence.find(e => e.stage === 'GEOMETRY');

    expect(evidenceB?.geometryHash).not.toEqual(evidenceA1?.geometryHash);
    expect(evidenceB?.canonicalHash).not.toEqual(evidenceA1?.canonicalHash);
  });

  it('TEST-06: Invalid feature: REAL FAILURE not fabricated recovery', () => {
    const doc = DocumentEvaluator.createDocument({
      documentId: 'DOC_INVALID_01',
      parameters: [],
      sketches: [
        {
          id: 'SKETCH_01',
          name: 'BaseProfile',
          plane: 'XY',
          closedProfile: false, // Not closed!
          entities: [
            { id: 'l1', type: 'LINE', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }] } // Open profile
          ]
        }
      ],
      features: [
        {
          id: 'EXTRUDE_01',
          type: 'EXTRUDE',
          name: 'MainBody',
          parameters: { depth: '10' },
          inputReferences: [{ targetFeatureId: 'SKETCH_01' }],
          dependencyIds: ['SKETCH_01']
        }
      ]
    });

    const result = DocumentEvaluator.evaluate(doc, {
      generateMesh: false,
      generateFEA: false,
      generateCFD: false,
      generateCAM: false
    });

    // Real failure occurs without fabricated fallback recovery
    expect(result.success).toBe(false);
    expect(result.evaluatedShape).toBeUndefined();
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics.some(d => d.includes('Invalid') || d.includes('UNAVAILABLE') || d.includes('FAILED'))).toBe(true);
  });
});
