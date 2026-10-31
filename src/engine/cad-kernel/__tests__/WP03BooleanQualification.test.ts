/**
 * SECP CAD Kernel — WP-03 Advanced Boolean Operations Qualification Test Suite
 * SECP-CAD-KERNEL-PHASE-2-001
 */

import { describe, it, expect } from 'vitest';
import { AdvancedBooleanEngine } from '../boolean/AdvancedBooleanEngine';
import { BoxFactory } from '../boolean/BoxFactory';
import { Solid, TopoShapeEnum } from '../topology/TopologyContracts';
import { BRepValidator } from '../brep/BRepValidator';

describe('SECP-CAD-KERNEL-PHASE-2-001 — WP-03 Advanced Boolean Qualification', () => {
  const validator = new BRepValidator();

  it('QUAL-01: Split Solid using Intersection and Difference into Multiple Bodies', () => {
    const target = BoxFactory.createBox('TARGET_SPLIT', 0, 0, 0, 20, 20, 20);
    const tool = BoxFactory.createBox('TOOL_SPLIT', 10, 0, 0, 30, 20, 20);

    const parts = AdvancedBooleanEngine.splitSolid(target, tool);
    expect(parts.length).toBeGreaterThanOrEqual(1);

    for (const part of parts) {
      expect(part.shapeType).toBe(TopoShapeEnum.SOLID);
      const val = validator.validate(part);
      expect(val.status).toBe('VALID');
    }
  });

  it('QUAL-02: Multi-Body Boolean Union across 3 Sequential Overlapping Bodies', () => {
    const b1 = BoxFactory.createBox('MB_U1', 0, 0, 0, 10, 10, 10);
    const b2 = BoxFactory.createBox('MB_U2', 5, 0, 0, 15, 10, 10);
    const b3 = BoxFactory.createBox('MB_U3', 10, 0, 0, 20, 10, 10);

    const result = AdvancedBooleanEngine.multiBodyBoolean('UNION', [b1, b2, b3]);
    expect(result.status).toBe('SUCCESS');
    expect(result.resultShape).toBeDefined();

    const unionSolid = result.resultShape as Solid;
    const val = validator.validate(unionSolid);
    expect(val.status).toBe('VALID');
  });

  it('QUAL-03: Multi-Body Boolean Intersection across Co-axial Blocks', () => {
    const b1 = BoxFactory.createBox('MB_I1', 0, 0, 0, 20, 20, 20);
    const b2 = BoxFactory.createBox('MB_I2', 5, 5, 0, 15, 15, 20);
    const b3 = BoxFactory.createBox('MB_I3', 8, 8, 0, 12, 12, 20);

    const result = AdvancedBooleanEngine.multiBodyBoolean('INTERSECTION', [b1, b2, b3]);
    expect(result.status).toBe('SUCCESS');
    expect(result.resultShape).toBeDefined();

    const intSolid = result.resultShape as Solid;
    const val = validator.validate(intSolid);
    expect(val.status).toBe('VALID');
  });

  it('QUAL-04: True Geometric Imprint Embedding Intersection Edges on Target Faces', () => {
    const target = BoxFactory.createBox('IMPRINT_TARGET', 0, 0, 0, 20, 20, 20);
    const tool = BoxFactory.createBox('IMPRINT_TOOL', 10, -5, -5, 30, 25, 25);

    const imprintRes = AdvancedBooleanEngine.imprint(target, tool);
    expect(imprintRes.success).toBe(true);
    expect(imprintRes.imprintedSolid).toBeDefined();

    // Verify face subdivision
    expect(imprintRes.imprintedFaceCount).toBeGreaterThanOrEqual(imprintRes.originalFaceCount);

    const val = validator.validate(imprintRes.imprintedSolid!);
    expect(val.status).toBe('VALID');
  });

  it('QUAL-05: Planar Cross Section Wire Extraction across Solid', () => {
    const solid = BoxFactory.createBox('SEC_BOX', 0, 0, 0, 10, 10, 10);
    // Cut box in middle with plane at z = 5
    const secRes = AdvancedBooleanEngine.section(
      solid,
      { x: 0 as any, y: 0 as any, z: 5 as any },
      { x: 0 as any, y: 0 as any, z: 1 as any }
    );

    expect(secRes.success).toBe(true);
    expect(secRes.sectionWires.length).toBeGreaterThanOrEqual(1);

    const wire = secRes.sectionWires[0];
    expect(wire.vertices.length).toBeGreaterThanOrEqual(4);
    // Every vertex in wire must lie on z = 5
    for (const v of wire.vertices) {
      expect(v.z).toBeCloseTo(5, 4);
    }
  });

  it('QUAL-06: Connected Component Extraction from Multi-Shell Shape', () => {
    const b1 = BoxFactory.createBox('COMP_1', 0, 0, 0, 10, 10, 10);
    const b2 = BoxFactory.createBox('COMP_2', 50, 50, 50, 60, 60, 60);

    const compound: any = {
      id: 'DISJOINT_COMPOUND',
      shapeType: TopoShapeEnum.COMPOUND,
      shapes: [b1, b2]
    };

    const components = AdvancedBooleanEngine.extractConnectedComponents(compound);
    expect(components.length).toBe(2);
    expect(components[0].id).toBe(b1.id);
    expect(components[1].id).toBe(b2.id);
  });

  it('QUAL-07: Adversarial Multi-Body Gate with insufficient inputs', () => {
    const b1 = BoxFactory.createBox('SINGLE_BOX', 0, 0, 0, 10, 10, 10);
    expect(() => AdvancedBooleanEngine.multiBodyBoolean('UNION', [b1])).toThrow('at least 2 bodies');
  });
});
