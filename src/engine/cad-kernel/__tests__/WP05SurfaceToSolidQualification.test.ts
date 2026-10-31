/**
 * SECP CAD Kernel — WP-05 Surface-to-Solid & Complex Topology Qualification Test Suite
 * SECP-CAD-KERNEL-PHASE-2-001
 */

import { describe, it, expect } from 'vitest';
import { SurfaceSewingEngine } from '../healing/SurfaceSewingEngine';
import { SurfaceModelingEngine } from '../modeling/SurfaceModelingEngine';
import { BoxFactory } from '../boolean/BoxFactory';
import { BRepValidator } from '../brep/BRepValidator';
import { Solid, TopoShapeEnum } from '../topology/TopologyContracts';
import { BRepKernel } from '../brep/BRepKernel';
import { Point } from '../geometry/GeometryContracts';

describe('SECP-CAD-KERNEL-PHASE-2-001 — WP-05 Surface-to-Solid & Complex Topology Qualification', () => {
  const validator = new BRepValidator();

  it('QUAL-01: Reconstruct 2-Manifold Closed Solid from Watertight B-Rep Shell with Outward Volume Orientation', () => {
    const box = BoxFactory.createBox('BOX_SRC', 0, 0, 0, 10, 10, 10);
    const shell = box.outerShell;

    const newSolid = SurfaceSewingEngine.createSolidFromShell(shell, 'RECON_SOLID');
    expect(newSolid.shapeType).toBe(TopoShapeEnum.SOLID);
    expect(newSolid.id).toBe('RECON_SOLID');

    const val = validator.validate(newSolid);
    expect(val.status).toBe('VALID');
    expect(val.manifoldStatus).toBe('MANIFOLD');

    const signedVol = BRepKernel.getCanonical().computeVolume(newSolid as any, { rawDivergence: true });
    expect(signedVol).toBeGreaterThan(0);
  });

  it('QUAL-02: Proximity Surface Sewing & Duplicate Vertex Merging across Disjoint Faces', () => {
    const box = BoxFactory.createBox('BOX_FACES', 0, 0, 0, 10, 10, 10);
    const faces = box.outerShell.orientedFaces.map(of => of.face);

    const sewRes = SurfaceSewingEngine.sew(faces, 'SEWN_SHELL_01', 1e-6);

    expect(sewRes.success).toBe(true);
    expect(sewRes.sewnShell).toBeDefined();
    expect(sewRes.isClosed).toBe(true);

    const val = validator.validate(sewRes.sewnShell!);
    expect(val.status).toBe('VALID');
  });

  it('QUAL-03: Real Surface Thickening into a 2-Manifold Closed Watertight Solid Body', () => {
    // 1. Create a planar sheet face
    const p1: Point[] = [
      { x: 0 as any, y: 0 as any, z: 0 as any },
      { x: 20 as any, y: 0 as any, z: 0 as any }
    ];
    const p2: Point[] = [
      { x: 0 as any, y: 20 as any, z: 0 as any },
      { x: 20 as any, y: 20 as any, z: 0 as any }
    ];
    const surface = SurfaceModelingEngine.loftNURBS([p1, p2]);
    const sheetFace = SurfaceModelingEngine.createNURBSFace(surface, 'SHEET_FACE_01');

    // 2. Thicken face by 5 mm (0.005 m)
    const thickenedSolid = SurfaceSewingEngine.thicken(sheetFace, 0.005, 'THICK_SOLID_01');

    expect(thickenedSolid).toBeDefined();
    expect(thickenedSolid.shapeType).toBe(TopoShapeEnum.SOLID);

    // Validate 2-manifold closed solid
    const val = validator.validate(thickenedSolid);
    expect(val.status).toBe('VALID');
    expect(val.manifoldStatus).toBe('MANIFOLD');

    const vol = BRepKernel.getCanonical().computeVolume(thickenedSolid as any, { rawDivergence: true });
    // Area (20x20=400) * thickness (0.005) = 2.0 m^3 (or equivalent scaled volume)
    expect(vol).toBeGreaterThan(0);
  });

  it('QUAL-04: Multi-Shell Solid with Internal Void / Cavity Construction', () => {
    const outerBox = BoxFactory.createBox('OUTER_BOX', 0, 0, 0, 50, 50, 50);
    const innerBox = BoxFactory.createBox('INNER_VOID', 10, 10, 10, 40, 40, 40);

    const cavitySolid: Solid = {
      id: 'CAVITY_SOLID_01',
      shapeType: TopoShapeEnum.SOLID,
      outerShell: outerBox.outerShell,
      innerShells: [innerBox.outerShell]
    };

    const val = validator.validate(cavitySolid);
    expect(val.status).toBe('VALID');
    expect(cavitySolid.innerShells!.length).toBe(1);
  });

  it('QUAL-05: Adversarial Rejection of Open / Non-Manifold Shells for Solid Conversion', () => {
    const box = BoxFactory.createBox('BOX_OPEN', 0, 0, 0, 10, 10, 10);
    const openShell = { ...box.outerShell, id: 'OPEN_SHELL' };
    // Remove one face to make shell open
    openShell.orientedFaces = openShell.orientedFaces.slice(0, 5);

    expect(() => SurfaceSewingEngine.createSolidFromShell(openShell as any, 'FAIL_SOLID')).toThrow('not closed');
  });
});
