/**
 * CADGeometryGenerator.ts
 * Parametric CAD B-Rep Geometry Corpus & Analytical Surface Models (PATCH-300)
 */

import { CADBRepGeometry, CADSurfaceDefinition } from './GPUMeshingTypes';

export class CADGeometryGenerator {
  /**
   * 1. Flat Plane Geometry
   */
  public static createFlatPlane(geometryId = 'GEO-PLANE-01', width = 2.0, height = 1.0): CADBRepGeometry {
    const surface: CADSurfaceDefinition = {
      surfaceId: `${geometryId}-SURF-0`,
      cadFaceId: 'FACE-PLANE-0',
      type: 'PLANE',
      uMin: 0.0,
      uMax: width,
      vMin: 0.0,
      vMax: height,
      featureEdges: [
        { edgeId: 'E0', isSharp: true, curvePoints: [[0, 0, 0], [width, 0, 0]] },
        { edgeId: 'E1', isSharp: true, curvePoints: [[width, 0, 0], [width, height, 0]] },
        { edgeId: 'E2', isSharp: true, curvePoints: [[width, height, 0], [0, height, 0]] },
        { edgeId: 'E3', isSharp: true, curvePoints: [[0, height, 0], [0, 0, 0]] },
      ],
      parameters: { width, height },
    };

    return {
      geometryId,
      name: 'Flat Plate CAD Surface',
      revision: 'REV-A',
      type: 'PLANE',
      surfaces: [surface],
      boundingBox: { min: [0, 0, 0], max: [width, height, 0] },
      hasSharpFeatures: true,
      isClosedSolid: false,
    };
  }

  /**
   * 2. Cylindrical Shell
   */
  public static createCylinder(geometryId = 'GEO-CYL-01', radius = 0.5, height = 2.0): CADBRepGeometry {
    const surface: CADSurfaceDefinition = {
      surfaceId: `${geometryId}-SURF-0`,
      cadFaceId: 'FACE-CYL-0',
      type: 'CYLINDER',
      uMin: 0.0,
      uMax: 2.0 * Math.PI,
      vMin: 0.0,
      vMax: height,
      isPeriodicU: true,
      featureEdges: [
        { edgeId: 'CIRC-BOTTOM', isSharp: true, curvePoints: [] },
        { edgeId: 'CIRC-TOP', isSharp: true, curvePoints: [] },
      ],
      parameters: { radius, height },
    };

    return {
      geometryId,
      name: 'Cylindrical Pipe Surface',
      revision: 'REV-A',
      type: 'CYLINDER',
      surfaces: [surface],
      boundingBox: { min: [-radius, -radius, 0], max: [radius, radius, height] },
      hasSharpFeatures: true,
      isClosedSolid: false,
    };
  }

  /**
   * 3. Spherical Surface
   */
  public static createSphere(geometryId = 'GEO-SPH-01', radius = 1.0): CADBRepGeometry {
    const surface: CADSurfaceDefinition = {
      surfaceId: `${geometryId}-SURF-0`,
      cadFaceId: 'FACE-SPH-0',
      type: 'SPHERE',
      uMin: 0.0,
      uMax: 2.0 * Math.PI,
      vMin: -Math.PI / 2.0,
      vMax: Math.PI / 2.0,
      isPeriodicU: true,
      featureEdges: [],
      parameters: { radius },
    };

    return {
      geometryId,
      name: 'Spherical Shell CAD Surface',
      revision: 'REV-A',
      type: 'SPHERE',
      surfaces: [surface],
      boundingBox: { min: [-radius, -radius, -radius], max: [radius, radius, radius] },
      hasSharpFeatures: false,
      isClosedSolid: true,
    };
  }

  /**
   * 4. Box with Central Hole
   */
  public static createBoxWithHole(geometryId = 'GEO-HOLE-01', width = 2.0, height = 2.0, holeRadius = 0.4): CADBRepGeometry {
    const surface: CADSurfaceDefinition = {
      surfaceId: `${geometryId}-SURF-0`,
      cadFaceId: 'FACE-HOLE-0',
      type: 'BOX_WITH_HOLE',
      uMin: -width / 2.0,
      uMax: width / 2.0,
      vMin: -height / 2.0,
      vMax: height / 2.0,
      featureEdges: [
        { edgeId: 'OUTER-0', isSharp: true, curvePoints: [[-width/2, -height/2, 0], [width/2, -height/2, 0]] },
        { edgeId: 'OUTER-1', isSharp: true, curvePoints: [[width/2, -height/2, 0], [width/2, height/2, 0]] },
        { edgeId: 'OUTER-2', isSharp: true, curvePoints: [[width/2, height/2, 0], [-width/2, height/2, 0]] },
        { edgeId: 'OUTER-3', isSharp: true, curvePoints: [[-width/2, height/2, 0], [-width/2, -height/2, 0]] },
        { edgeId: 'HOLE-CIRCLE', isSharp: true, curvePoints: [] },
      ],
      parameters: { width, height, holeRadius },
    };

    return {
      geometryId,
      name: 'Plate with Stress-Concentration Hole',
      revision: 'REV-B',
      type: 'BOX_WITH_HOLE',
      surfaces: [surface],
      boundingBox: { min: [-width/2, -height/2, 0], max: [width/2, height/2, 0] },
      hasSharpFeatures: true,
      isClosedSolid: false,
    };
  }

  /**
   * 5. High-Curvature Sinusoidal Surface
   */
  public static createHighCurvatureSurface(geometryId = 'GEO-CURV-01', width = 2.0, height = 2.0, amplitude = 0.3): CADBRepGeometry {
    const surface: CADSurfaceDefinition = {
      surfaceId: `${geometryId}-SURF-0`,
      cadFaceId: 'FACE-WAVE-0',
      type: 'HIGH_CURVATURE',
      uMin: -width / 2.0,
      uMax: width / 2.0,
      vMin: -height / 2.0,
      vMax: height / 2.0,
      featureEdges: [],
      parameters: { width, height, amplitude },
    };

    return {
      geometryId,
      name: 'High-Curvature Sinusoidal Wave Patch',
      revision: 'REV-A',
      type: 'HIGH_CURVATURE',
      surfaces: [surface],
      boundingBox: { min: [-width/2, -height/2, -amplitude], max: [width/2, height/2, amplitude] },
      hasSharpFeatures: false,
      isClosedSolid: false,
    };
  }

  /**
   * 6. Thin Shell Body
   */
  public static createThinBody(geometryId = 'GEO-THIN-01', length = 3.0, width = 0.2, thickness = 0.01): CADBRepGeometry {
    const surface: CADSurfaceDefinition = {
      surfaceId: `${geometryId}-SURF-0`,
      cadFaceId: 'FACE-THIN-0',
      type: 'THIN_BODY',
      uMin: 0.0,
      uMax: length,
      vMin: 0.0,
      vMax: width,
      featureEdges: [
        { edgeId: 'E_LONG_0', isSharp: true, curvePoints: [[0, 0, 0], [length, 0, 0]] },
        { edgeId: 'E_SHORT_0', isSharp: true, curvePoints: [[length, 0, 0], [length, width, 0]] },
        { edgeId: 'E_LONG_1', isSharp: true, curvePoints: [[length, width, 0], [0, width, 0]] },
        { edgeId: 'E_SHORT_1', isSharp: true, curvePoints: [[0, width, 0], [0, 0, 0]] },
      ],
      parameters: { length, width, thickness },
    };

    return {
      geometryId,
      name: 'Aero-Structure Thin Skin Panel',
      revision: 'REV-C',
      type: 'THIN_BODY',
      surfaces: [surface],
      boundingBox: { min: [0, 0, 0], max: [length, width, thickness] },
      hasSharpFeatures: true,
      isClosedSolid: false,
    };
  }

  /**
   * Standard Suite of Test Geometries for Meshing Gate 300
   */
  public static getStandardGeometrySuite(): {
    plane: CADBRepGeometry;
    cylinder: CADBRepGeometry;
    sphere: CADBRepGeometry;
    boxWithHole: CADBRepGeometry;
    highCurvature: CADBRepGeometry;
    thinBody: CADBRepGeometry;
  } {
    return {
      plane: this.createFlatPlane(),
      cylinder: this.createCylinder(),
      sphere: this.createSphere(),
      boxWithHole: this.createBoxWithHole(),
      highCurvature: this.createHighCurvatureSurface(),
      thinBody: this.createThinBody(),
    };
  }
}
