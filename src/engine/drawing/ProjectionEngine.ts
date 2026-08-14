/**
 * PATCH-SECP-044 — Technical Drawing Projection Engine
 * Computes 1st/3rd Angle Orthographic and Axonometric Isometric Projections from 3D B-Rep entities.
 */

import { 
  DrawingView, 
  OrthographicView, 
  IsometricView, 
  ViewOrientation, 
  Vector2D, 
  Box2D,
  DrawingGeometry2D
} from './DrawingTypes';
import { HiddenLineRemovalEngine, Edge3D, Face3D, Vector3D } from './HiddenLineRemoval';

export interface ModelGeometrySource {
  id: string;
  name: string;
  revision: number;
  edges: Edge3D[];
  faces: Face3D[];
  boundingBox: { min: Vector3D; max: Vector3D };
}

export class TechnicalDrawingProjectionEngine {
  /**
   * Generates a 2D Drawing View with full HLR from source 3D B-Rep geometry.
   */
  public static generateView(
    orientation: ViewOrientation,
    model: ModelGeometrySource,
    positionOnSheet: Vector2D,
    scaleRatioStr: string = '1:1',
    customName?: string
  ): DrawingView {
    const scale = this.parseScale(scaleRatioStr);
    const viewId = `view-${orientation.toLowerCase()}-${Date.now().toString().slice(-4)}`;
    const viewName = customName || `${orientation.replace('_', ' ')} VIEW`;

    // 1. Determine Camera Transform & Projection Math
    const projectPoint = (p3d: Vector3D): { uv: Vector2D; depth: number } => {
      let u = 0;
      let v = 0;
      let depth = 0;

      // Center model around its centroid
      const cx = (model.boundingBox.min.x + model.boundingBox.max.x) * 0.5;
      const cy = (model.boundingBox.min.y + model.boundingBox.max.y) * 0.5;
      const cz = (model.boundingBox.min.z + model.boundingBox.max.z) * 0.5;

      const rx = p3d.x - cx;
      const ry = p3d.y - cy;
      const rz = p3d.z - cz;

      switch (orientation) {
        case 'FRONT': // Look from -Y, Up is +Z
          u = rx;
          v = -rz; // invert Y for screen coordinates
          depth = ry;
          break;
        case 'BACK': // Look from +Y, Up is +Z
          u = -rx;
          v = -rz;
          depth = -ry;
          break;
        case 'TOP': // Look from +Z, Up is +Y
          u = rx;
          v = ry;
          depth = -rz;
          break;
        case 'BOTTOM': // Look from -Z, Up is -Y
          u = rx;
          v = -ry;
          depth = rz;
          break;
        case 'RIGHT': // Look from +X, Up is +Z
          u = ry;
          v = -rz;
          depth = -rx;
          break;
        case 'LEFT': // Look from -X, Up is +Z
          u = -ry;
          v = -rz;
          depth = rx;
          break;
        case 'ISOMETRIC': // Standard 30° Axonometric
        default:
          // Isometric transformation: rotation 45° around Z, then ~35.264° tilt
          const cos30 = Math.cos(Math.PI / 6);
          const sin30 = Math.sin(Math.PI / 6);
          u = (rx - ry) * cos30;
          v = -(rz - (rx + ry) * sin30);
          depth = (rx + ry + rz) * 0.577;
          break;
      }

      // Apply Scale and Position on Sheet
      return {
        uv: {
          x: positionOnSheet.x + u * scale,
          y: positionOnSheet.y + v * scale
        },
        depth
      };
    };

    // 2. Perform B-Rep Hidden Line Removal
    const hlrResult = HiddenLineRemovalEngine.computeHLR(
      model.edges,
      model.faces,
      projectPoint
    );

    // 3. Compute 2D Bounding Box
    const allPoints: Vector2D[] = [];
    hlrResult.visibleEdges.concat(hlrResult.hiddenEdges).forEach(geom => {
      if (geom.type === 'LINE') {
        allPoints.push(geom.p1, geom.p2);
      } else if (geom.type === 'ARC') {
        allPoints.push(
          { x: geom.center.x - geom.radius, y: geom.center.y - geom.radius },
          { x: geom.center.x + geom.radius, y: geom.center.y + geom.radius }
        );
      }
    });

    let minX = positionOnSheet.x - 20;
    let maxX = positionOnSheet.x + 20;
    let minY = positionOnSheet.y - 20;
    let maxY = positionOnSheet.y + 20;

    if (allPoints.length > 0) {
      minX = Math.min(...allPoints.map(p => p.x));
      maxX = Math.max(...allPoints.map(p => p.x));
      minY = Math.min(...allPoints.map(p => p.y));
      maxY = Math.max(...allPoints.map(p => p.y));
    }

    const bbox: Box2D = {
      min: { x: minX, y: minY },
      max: { x: maxX, y: maxY }
    };

    // 4. Construct View Object
    const baseView = {
      id: viewId,
      name: viewName,
      scaleRatio: scaleRatioStr,
      transform: {
        cameraDirection: this.getCameraDirection(orientation),
        upDirection: { x: 0, y: 0, z: 1 },
        scale,
        positionOnSheet,
        rotationDeg: 0
      },
      visible: true,
      sourceModelId: model.id,
      sourceRevision: model.revision,
      boundingBox: bbox,
      visibleGeometry: hlrResult.visibleEdges,
      hiddenGeometry: hlrResult.hiddenEdges,
      centerlines: hlrResult.centerlines,
      silhouettes: hlrResult.silhouettes,
      dimensions: [],
      gdtFrames: [],
      datums: [],
      surfaceFinishes: []
    };

    if (orientation === 'ISOMETRIC') {
      return {
        ...baseView,
        type: 'ISOMETRIC',
        isoAngleDeg: 30
      } as IsometricView;
    }

    return {
      ...baseView,
      type: orientation
    } as OrthographicView;
  }

  private static parseScale(scaleStr: string): number {
    const parts = scaleStr.split(':').map(p => parseFloat(p.trim()));
    if (parts.length === 2 && parts[1] > 0) {
      return parts[0] / parts[1];
    }
    return 1.0;
  }

  private static getCameraDirection(orientation: ViewOrientation): Vector3D {
    switch (orientation) {
      case 'FRONT': return { x: 0, y: -1, z: 0 };
      case 'BACK': return { x: 0, y: 1, z: 0 };
      case 'TOP': return { x: 0, y: 0, z: 1 };
      case 'BOTTOM': return { x: 0, y: 0, z: -1 };
      case 'RIGHT': return { x: 1, y: 0, z: 0 };
      case 'LEFT': return { x: -1, y: 0, z: 0 };
      case 'ISOMETRIC':
      default: return { x: 0.577, y: 0.577, z: 0.577 };
    }
  }
}
