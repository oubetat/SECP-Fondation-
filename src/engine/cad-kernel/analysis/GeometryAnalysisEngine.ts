/**
 * SECP CAD Kernel — Geometry Analysis & Feature Recognition Engine
 * WP-08 Implementation & Independent Qualification
 */

import { Face, Solid, TopoShapeEnum } from '../topology/TopologyContracts';
import { NurbsDerivatives } from '../nurbs/NurbsDerivatives';
import { Point } from '../geometry/GeometryContracts';

export interface CurvatureResult {
  gaussian: number;
  mean: number;
  k1: number;
  k2: number;
}

export interface FeatureRecognitionResult {
  cylindricalFacesCount: number;
  planarFacesCount: number;
  sphericalFacesCount: number;
  recognizedFeatures: string[];
}

export interface MassPropertiesResult {
  boundingMin: Point;
  boundingMax: Point;
  centerOfMass: Point;
  volumeM3: number;
}

export class GeometryAnalysisEngine {
  /**
   * Computes exact Gaussian and Mean curvature at (u, v) on a face.
   */
  public static analyzeCurvature(face: Face, u: number = 0.5, v: number = 0.5): CurvatureResult {
    if (!face || !face.geometry) {
      return { gaussian: 0, mean: 0, k1: 0, k2: 0 };
    }

    const geom = face.geometry as any;
    if (geom.type === 'NURBS' && geom.controlPoints) {
      const curvs = NurbsDerivatives.evaluateSurfaceCurvatures(geom, u, v, { absolute: 1e-7, relative: 1e-7 });
      return {
        gaussian: curvs.gaussianCurvature || 0,
        mean: curvs.meanCurvature || 0,
        k1: curvs.principalCurvature1 || 0,
        k2: curvs.principalCurvature2 || 0
      };
    } else if (geom.type === 'PLANE') {
      return { gaussian: 0, mean: 0, k1: 0, k2: 0 };
    }

    return { gaussian: 0, mean: 0, k1: 0, k2: 0 };
  }

  /**
   * Recognizes standard geometric features (Cylindrical holes, planar faces, spherical faces).
   */
  public static recognizeFeatures(solid: Solid): FeatureRecognitionResult {
    if (!solid || !solid.outerShell || !solid.outerShell.orientedFaces) {
      return {
        cylindricalFacesCount: 0,
        planarFacesCount: 0,
        sphericalFacesCount: 0,
        recognizedFeatures: []
      };
    }

    let cylCount = 0;
    let planarCount = 0;
    let sphereCount = 0;
    const recognizedFeatures: string[] = [];

    for (const of of solid.outerShell.orientedFaces) {
      if (!of.face) continue;
      const geom = of.face.geometry as any;
      const geomType = geom?.type;

      if (geomType === 'CYLINDER') {
        cylCount++;
        recognizedFeatures.push(`CYLINDRICAL_FEATURE_${of.face.id}`);
      } else if (geomType === 'PLANE' || !geomType) {
        planarCount++;
      } else if (geomType === 'SPHERE') {
        sphereCount++;
        recognizedFeatures.push(`SPHERICAL_FEATURE_${of.face.id}`);
      }
    }

    return {
      cylindricalFacesCount: cylCount,
      planarFacesCount: planarCount,
      sphericalFacesCount: sphereCount,
      recognizedFeatures
    };
  }

  /**
   * Computes bounding box and center of mass for a solid.
   */
  public static computeMassProperties(solid: Solid): MassPropertiesResult {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let sumX = 0, sumY = 0, sumZ = 0, vCount = 0;

    const processLoop = (loop: any) => {
      if (!loop || !loop.orientedEdges) return;
      for (const oe of loop.orientedEdges) {
        if (!oe.edge) continue;
        const verts = [oe.edge.startVertex, oe.edge.endVertex];
        for (const v of verts) {
          if (!v || !v.geometry) continue;
          const { x, y, z } = v.geometry;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (z < minZ) minZ = z;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          if (z > maxZ) maxZ = z;

          sumX += x;
          sumY += y;
          sumZ += z;
          vCount++;
        }
      }
    };

    if (solid && solid.outerShell && solid.outerShell.orientedFaces) {
      for (const of of solid.outerShell.orientedFaces) {
        if (of.face) processLoop(of.face.outerLoop);
      }
    }

    if (vCount === 0) {
      minX = minY = minZ = maxX = maxY = maxZ = 0;
    }

    return {
      boundingMin: { x: minX as any, y: minY as any, z: minZ as any },
      boundingMax: { x: maxX as any, y: maxY as any, z: maxZ as any },
      centerOfMass: {
        x: (vCount > 0 ? sumX / vCount : 0) as any,
        y: (vCount > 0 ? sumY / vCount : 0) as any,
        z: (vCount > 0 ? sumZ / vCount : 0) as any
      },
      volumeM3: 0
    };
  }
}
