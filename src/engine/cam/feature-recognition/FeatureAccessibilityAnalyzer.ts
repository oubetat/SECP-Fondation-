/**
 * SECP Industrial OS v2 — CAM Production Engine
 * PATCH-255 — Feature Accessibility Analyzer
 */

import { Vector3D } from '../../cadKernel';
import { ManufacturingFeature, ToolAccessDirection } from './FeatureTypes';
import { FaceGeometryInfo } from './FeatureGeometryAnalyzer';

export interface AccessibilityResult {
  primaryDirection: ToolAccessDirection;
  accessibleDirections: ToolAccessDirection[];
  minToolLengthMm: number;
  maxToolDiameterMm?: number;
  minToolDiameterMm?: number;
  isOccluded: boolean;
  clearanceMarginMm: number;
}

export class FeatureAccessibilityAnalyzer {
  /**
   * Evaluates machining tool access vectors for a given feature
   */
  public static analyzeAccessibility(
    feature: Partial<ManufacturingFeature>,
    faceGeoms: Map<string, FaceGeometryInfo>,
    stockBounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }
  ): AccessibilityResult {
    const accessibleDirs: ToolAccessDirection[] = [];
    let primaryDir = ToolAccessDirection.POS_Z;
    let minLength = 20.0;
    let maxDia: number | undefined;
    let minDia: number | undefined;

    if (feature.parameters) {
      if (feature.parameters.type === 'HOLE') {
        const p = feature.parameters.params;
        const axis = p.axis;
        if (Math.abs(axis.z) > 0.8) {
          primaryDir = axis.z > 0 ? ToolAccessDirection.POS_Z : ToolAccessDirection.NEG_Z;
        } else if (Math.abs(axis.x) > 0.8) {
          primaryDir = axis.x > 0 ? ToolAccessDirection.POS_X : ToolAccessDirection.NEG_X;
        } else {
          primaryDir = axis.y > 0 ? ToolAccessDirection.POS_Y : ToolAccessDirection.NEG_Y;
        }

        accessibleDirs.push(primaryDir);
        if (p.isThrough) {
          accessibleDirs.push(this.invertDirection(primaryDir));
        }

        minLength = p.depthMm + 8.0;
        maxDia = p.diameterMm;
        minDia = p.diameterMm * 0.5;
      } else if (feature.parameters.type === 'POCKET') {
        const p = feature.parameters.params;
        primaryDir = this.vectorToDirection(p.floorNormal);
        accessibleDirs.push(primaryDir);
        minLength = p.depthMm + 12.0;
        maxDia = Math.min(p.widthMm * 0.8, 32.0);
        minDia = (p.cornerRadiiMm[0] || 2.0) * 1.8;
      } else if (feature.parameters.type === 'SLOT') {
        const p = feature.parameters.params;
        primaryDir = this.vectorToDirection(p.floorNormal);
        accessibleDirs.push(primaryDir);
        minLength = p.depthMm + 10.0;
        maxDia = p.widthMm * 0.95;
        minDia = p.widthMm * 0.4;
      } else if (feature.parameters.type === 'FACE') {
        const p = feature.parameters.params;
        primaryDir = this.vectorToDirection(p.normal);
        accessibleDirs.push(primaryDir);
        minLength = 15.0;
      } else {
        accessibleDirs.push(ToolAccessDirection.POS_Z);
      }
    }

    return {
      primaryDirection: primaryDir,
      accessibleDirections: accessibleDirs.length > 0 ? accessibleDirs : [ToolAccessDirection.POS_Z],
      minToolLengthMm: Math.max(10.0, minLength),
      maxToolDiameterMm: maxDia,
      minToolDiameterMm: minDia,
      isOccluded: false,
      clearanceMarginMm: 5.0,
    };
  }

  public static vectorToDirection(v: Vector3D): ToolAccessDirection {
    if (v.z > 0.7) return ToolAccessDirection.POS_Z;
    if (v.z < -0.7) return ToolAccessDirection.NEG_Z;
    if (v.x > 0.7) return ToolAccessDirection.POS_X;
    if (v.x < -0.7) return ToolAccessDirection.NEG_X;
    if (v.y > 0.7) return ToolAccessDirection.POS_Y;
    if (v.y < -0.7) return ToolAccessDirection.NEG_Y;
    return ToolAccessDirection.OBLIQUE;
  }

  public static invertDirection(dir: ToolAccessDirection): ToolAccessDirection {
    switch (dir) {
      case ToolAccessDirection.POS_Z: return ToolAccessDirection.NEG_Z;
      case ToolAccessDirection.NEG_Z: return ToolAccessDirection.POS_Z;
      case ToolAccessDirection.POS_X: return ToolAccessDirection.NEG_X;
      case ToolAccessDirection.NEG_X: return ToolAccessDirection.POS_X;
      case ToolAccessDirection.POS_Y: return ToolAccessDirection.NEG_Y;
      case ToolAccessDirection.NEG_Y: return ToolAccessDirection.POS_Y;
      default: return ToolAccessDirection.POS_Z;
    }
  }

  public static directionToVector(dir: ToolAccessDirection): Vector3D {
    switch (dir) {
      case ToolAccessDirection.POS_Z: return { x: 0, y: 0, z: 1 };
      case ToolAccessDirection.NEG_Z: return { x: 0, y: 0, z: -1 };
      case ToolAccessDirection.POS_X: return { x: 1, y: 0, z: 0 };
      case ToolAccessDirection.NEG_X: return { x: -1, y: 0, z: 0 };
      case ToolAccessDirection.POS_Y: return { x: 0, y: 1, z: 0 };
      case ToolAccessDirection.NEG_Y: return { x: 0, y: -1, z: 0 };
      default: return { x: 0, y: 0, z: 1 };
    }
  }
}
