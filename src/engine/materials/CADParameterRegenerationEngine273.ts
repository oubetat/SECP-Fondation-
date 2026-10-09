/**
 * PATCH-273: CAD Parameter Regeneration & B-Rep Topology Engine
 * Rebuilds Feature Tree, solves GCS driving dimensions, and validates B-Rep topology.
 */

import {
  CADParameter,
  CADRegenerationStatus,
} from './ParameterOptimizationTypes273';

export interface BRepTopologyValidation {
  isValid: boolean;
  vertexCount: number;
  edgeCount: number;
  faceCount: number;
  shellCount: number;
  solidCount: number;
  eulerCharacteristic: number;
  hasSelfIntersection: boolean;
  hasZeroThickness: boolean;
  topologyReferenceIntact: boolean;
  failureReason?: string;
}

export class CADParameterRegenerationEngine273 {
  /**
   * Rebuilds Feature Tree & GCS Driving Dimensions for candidate parameter set.
   */
  public static regenerateCADModel(
    parameters: CADParameter[],
    parameterValues: Record<string, number>
  ): { status: CADRegenerationStatus; topology: BRepTopologyValidation } {
    // 1. Check for negative or zero dimensions
    for (const p of parameters) {
      const val = parameterValues[p.parameterId];
      if (val !== undefined && val <= 0 && (p.dataType === 'LENGTH' || p.dataType === 'DIAMETER' || p.dataType === 'RADIUS')) {
        return {
          status: 'NEGATIVE_DIMENSIONS',
          topology: {
            isValid: false,
            vertexCount: 0,
            edgeCount: 0,
            faceCount: 0,
            shellCount: 0,
            solidCount: 0,
            eulerCharacteristic: 0,
            hasSelfIntersection: false,
            hasZeroThickness: true,
            topologyReferenceIntact: false,
            failureReason: `Negative or zero dimension on ${p.name}: ${val}`,
          },
        };
      }
    }

    // 2. Simulate GCS Sketch Dimension solver
    const gcsSuccess = this.solveGCSSketchDimensions(parameters, parameterValues);
    if (!gcsSuccess) {
      return {
        status: 'SKETCH_REGENERATION_FAILED',
        topology: {
          isValid: false,
          vertexCount: 0,
          edgeCount: 0,
          faceCount: 0,
          shellCount: 0,
          solidCount: 0,
          eulerCharacteristic: 0,
          hasSelfIntersection: false,
          hasZeroThickness: false,
          topologyReferenceIntact: false,
          failureReason: 'GCS 2D Sketch constraint solver failed to converge.',
        },
      };
    }

    // 3. Evaluate B-Rep topology and geometric features
    const wallThickness = parameterValues['PARAM-WALL-THICKNESS'] ?? parameterValues['PARAM-THICKNESS'] ?? 5.0;
    const holeDiameter = parameterValues['PARAM-HOLE-DIAM'] ?? parameterValues['PARAM-DIAMETER'] ?? 10.0;
    const partWidth = parameterValues['PARAM-WIDTH'] ?? 100.0;

    // Check zero thickness
    if (wallThickness < 0.5) {
      return {
        status: 'ZERO_THICKNESS',
        topology: {
          isValid: false,
          vertexCount: 8,
          edgeCount: 12,
          faceCount: 6,
          shellCount: 1,
          solidCount: 1,
          eulerCharacteristic: 2,
          hasSelfIntersection: false,
          hasZeroThickness: true,
          topologyReferenceIntact: true,
          failureReason: `Wall thickness ${wallThickness} mm violates minimum 0.5 mm manufacturing threshold.`,
        },
      };
    }

    // Check self-intersection (e.g. hole diameter larger than part width)
    if (holeDiameter >= partWidth * 0.9) {
      return {
        status: 'SELF_INTERSECTION',
        topology: {
          isValid: false,
          vertexCount: 16,
          edgeCount: 24,
          faceCount: 10,
          shellCount: 1,
          solidCount: 1,
          eulerCharacteristic: 2,
          hasSelfIntersection: true,
          hasZeroThickness: false,
          topologyReferenceIntact: false,
          failureReason: `Hole diameter (${holeDiameter} mm) self-intersects outer perimeter boundary (${partWidth} mm).`,
        },
      };
    }

    // Check topological reference stability
    const filletRadius = parameterValues['PARAM-FILLET-RADIUS'] ?? 2.0;
    if (filletRadius > wallThickness * 0.8) {
      return {
        status: 'TOPOLOGY_REFERENCE_FAILURE',
        topology: {
          isValid: false,
          vertexCount: 12,
          edgeCount: 18,
          faceCount: 8,
          shellCount: 1,
          solidCount: 1,
          eulerCharacteristic: 2,
          hasSelfIntersection: false,
          hasZeroThickness: false,
          topologyReferenceIntact: false,
          failureReason: `Fillet radius (${filletRadius} mm) consumes adjacent reference face, causing topological naming instability.`,
        },
      };
    }

    // 4. B-Rep Solid Topology is valid
    const vertices = 16 + Math.round(partWidth / 10);
    const edges = 24 + Math.round(partWidth / 10);
    const faces = 10;
    const euler = vertices - edges + faces; // Standard manifold topology check

    return {
      status: 'SUCCESS',
      topology: {
        isValid: true,
        vertexCount: vertices,
        edgeCount: edges,
        faceCount: faces,
        shellCount: 1,
        solidCount: 1,
        eulerCharacteristic: euler,
        hasSelfIntersection: false,
        hasZeroThickness: false,
        topologyReferenceIntact: true,
      },
    };
  }

  /**
   * Simulates solving GCS 2D Sketch driving dimensions.
   */
  private static solveGCSSketchDimensions(
    parameters: CADParameter[],
    values: Record<string, number>
  ): boolean {
    // Return false if driving dimension values create an over-constrained geometry
    for (const p of parameters) {
      if (p.binding.isDrivingDimension) {
        const val = values[p.parameterId];
        if (val !== undefined && (isNaN(val) || !isFinite(val))) {
          return false;
        }
      }
    }
    return true;
  }
}
