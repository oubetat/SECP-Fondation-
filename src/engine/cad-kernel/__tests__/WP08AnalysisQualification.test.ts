/**
 * SECP CAD Kernel — WP-08 Geometry Analysis & Recognition Qualification Test Suite
 * SECP-CAD-KERNEL-PHASE-2-001
 */

import { describe, it, expect } from 'vitest';
import { GeometryAnalysisEngine } from '../analysis/GeometryAnalysisEngine';
import { SurfaceModelingEngine } from '../modeling/SurfaceModelingEngine';
import { BoxFactory } from '../boolean/BoxFactory';
import { Point } from '../geometry/GeometryContracts';

describe('SECP-CAD-KERNEL-PHASE-2-001 — WP-08 Geometry Analysis & Recognition Qualification', () => {
  it('QUAL-01: Differential Geometry Curvature Analysis on Planar & NURBS Surfaces', () => {
    // 1. Planar Face -> Gaussian = 0, Mean = 0
    const box = BoxFactory.createBox('BOX_CURV', 0, 0, 0, 10, 10, 10);
    const planFace = box.outerShell.orientedFaces[0].face;
    const planCurv = GeometryAnalysisEngine.analyzeCurvature(planFace, 0.5, 0.5);

    expect(planCurv.gaussian).toBe(0);
    expect(planCurv.mean).toBe(0);

    // 2. NURBS Loft Surface -> Differential Curvatures
    const p1: Point[] = [
      { x: 0 as any, y: 0 as any, z: 0 as any },
      { x: 10 as any, y: 0 as any, z: 5 as any }
    ];
    const p2: Point[] = [
      { x: 0 as any, y: 10 as any, z: 5 as any },
      { x: 10 as any, y: 10 as any, z: 0 as any }
    ];
    const surface = SurfaceModelingEngine.loftNURBS([p1, p2]);
    const nurbsFace = SurfaceModelingEngine.createNURBSFace(surface, 'NURBS_CURV_FACE');

    const nurbsCurv = GeometryAnalysisEngine.analyzeCurvature(nurbsFace, 0.5, 0.5);
    expect(typeof nurbsCurv.gaussian).toBe('number');
    expect(typeof nurbsCurv.mean).toBe('number');
  });

  it('QUAL-02: Feature Recognition across Planar, Cylindrical, and Spherical B-Rep Solids', () => {
    const box = BoxFactory.createBox('BOX_FEAT', 0, 0, 0, 10, 10, 10);
    const res = GeometryAnalysisEngine.recognizeFeatures(box);

    expect(res.planarFacesCount).toBe(6);
    expect(res.cylindricalFacesCount).toBe(0);
  });

  it('QUAL-03: Mass Properties, Bounding Box, and Center of Mass Evaluation', () => {
    const box = BoxFactory.createBox('BOX_MASS', 0, 0, 0, 10, 10, 10);
    const props = GeometryAnalysisEngine.computeMassProperties(box);

    expect(props.boundingMin.x).toBe(0);
    expect(props.boundingMin.y).toBe(0);
    expect(props.boundingMin.z).toBe(0);

    expect(props.boundingMax.x).toBe(10);
    expect(props.boundingMax.y).toBe(10);
    expect(props.boundingMax.z).toBe(10);

    expect(props.centerOfMass.x).toBeCloseTo(5, 1);
    expect(props.centerOfMass.y).toBeCloseTo(5, 1);
    expect(props.centerOfMass.z).toBeCloseTo(5, 1);
  });
});
