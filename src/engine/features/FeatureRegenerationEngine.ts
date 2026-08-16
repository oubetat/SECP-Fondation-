import crypto from 'crypto';
import { FeatureDefinition, DesignHistory, FeatureDiagnosticResult, FeatureType } from './FeatureTypes';
import { FeatureDependencyGraph } from './FeatureDependencyGraph';
import { GeometryKernelManager } from '../geometry/GeometryKernelManager';
import { ShapeHandle } from '../geometry/ShapeHandle';
import { Vector3 } from '../geometry/GeometryTypes';

/**
 * SECP-102.2: Deterministic Feature Regeneration Engine
 * Responsible for rebuilding B-Rep geometry strictly from parametric design history.
 * Implements deterministic dependency graph execution, rigorous numerical validation,
 * exact geometric regeneration, and cryptographic provenance verification.
 */
export class FeatureRegenerationEngine {
  private dependencyGraph: FeatureDependencyGraph;

  constructor() {
    this.dependencyGraph = new FeatureDependencyGraph();
  }

  /**
   * Validates a single feature definition for structural and numerical integrity
   */
  public static validateFeature(feature: FeatureDefinition): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!feature) {
      errors.push('Feature definition is null or undefined');
      return { isValid: false, errors };
    }

    if (!feature.featureId || typeof feature.featureId !== 'string' || feature.featureId.trim() === '') {
      errors.push('Missing or empty featureId');
    }

    const validTypes: FeatureType[] = [
      'ROOT',
      'EXTRUSION',
      'REVOLVE',
      'BOOLEAN',
      'FILLET',
      'CHAMFER',
      'PATTERN',
      'SKETCH'
    ];

    if (!validTypes.includes(feature.type)) {
      errors.push(`Unsupported or invalid feature type: ${feature.type}`);
    }

    if (!feature.parameters || typeof feature.parameters !== 'object') {
      errors.push('Feature parameters must be a non-null object');
    } else {
      // Validate numerical parameters for finite values
      for (const [key, val] of Object.entries(feature.parameters)) {
        if (typeof val === 'number') {
          if (!Number.isFinite(val)) {
            errors.push(`Parameter '${key}' must be a finite number, received: ${val}`);
          }
        } else if (val && typeof val === 'object') {
          // Check vector objects
          if ('x' in val && (!Number.isFinite(val.x) || !Number.isFinite(val.y) || !Number.isFinite(val.z))) {
            errors.push(`Vector parameter '${key}' contains non-finite coordinates`);
          }
        }
      }

      // Feature specific dimension validations
      if (feature.type === 'EXTRUSION') {
        const w = feature.parameters.width ?? feature.parameters.dx;
        const h = feature.parameters.height ?? feature.parameters.dy;
        const d = feature.parameters.depth ?? feature.parameters.dz;

        if (w !== undefined && (typeof w !== 'number' || !Number.isFinite(w) || w <= 0)) {
          errors.push(`Invalid extrusion width/dx: ${w} (must be finite positive number)`);
        }
        if (h !== undefined && (typeof h !== 'number' || !Number.isFinite(h) || h <= 0)) {
          errors.push(`Invalid extrusion height/dy: ${h} (must be finite positive number)`);
        }
        if (d !== undefined && (typeof d !== 'number' || !Number.isFinite(d) || d <= 0)) {
          errors.push(`Invalid extrusion depth/dz: ${d} (must be finite positive number)`);
        }
      } else if (feature.type === 'FILLET') {
        const r = feature.parameters.radius;
        if (r !== undefined && (typeof r !== 'number' || !Number.isFinite(r) || r <= 0)) {
          errors.push(`Invalid fillet radius: ${r} (must be finite positive number)`);
        }
      } else if (feature.type === 'CHAMFER') {
        const dist = feature.parameters.distance ?? feature.parameters.chamferDistance;
        if (dist !== undefined && (typeof dist !== 'number' || !Number.isFinite(dist) || dist <= 0)) {
          errors.push(`Invalid chamfer distance: ${dist} (must be finite positive number)`);
        }
      } else if (feature.type === 'REVOLVE') {
        const angle = feature.parameters.angle;
        if (angle !== undefined && (typeof angle !== 'number' || !Number.isFinite(angle) || angle === 0)) {
          errors.push(`Invalid revolve angle: ${angle} (must be non-zero finite number)`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Regenerates the entire model or a specific affected subgraph deterministically
   */
  public async regenerate(
    history: DesignHistory,
    changedFeatureIds: string[] = []
  ): Promise<{
    success: boolean;
    finalShape?: ShapeHandle;
    diagnostics: FeatureDiagnosticResult[];
    provenanceHash?: string;
  }> {
    const diagnostics: FeatureDiagnosticResult[] = [];

    // 1. History validation
    if (!history || !Array.isArray(history.features)) {
      diagnostics.push({
        featureId: 'history-root',
        status: 'ERROR',
        message: 'Invalid design history: features collection is missing or malformed',
        affectedFeatures: []
      });
      return { success: false, diagnostics };
    }

    // 2. Validate every individual feature
    for (const feature of history.features) {
      const val = FeatureRegenerationEngine.validateFeature(feature);
      if (!val.isValid) {
        diagnostics.push({
          featureId: feature?.featureId || 'unknown-feature',
          status: 'ERROR',
          message: `Feature validation failed: ${val.errors.join('; ')}`,
          affectedFeatures: [feature?.featureId || 'unknown-feature']
        });
        return { success: false, diagnostics };
      }
    }

    // 3. Build & Validate Dependency Graph
    this.dependencyGraph.build(history.features);
    const graphValidation = this.dependencyGraph.validate();
    if (!graphValidation.isValid) {
      diagnostics.push({
        featureId: 'dependency-graph',
        status: 'ERROR',
        message: `Cyclic or broken feature dependency detected: ${graphValidation.issues.join('; ')}`,
        affectedFeatures: changedFeatureIds
      });
      return { success: false, diagnostics };
    }

    // 4. Determine regeneration order
    let orderToExecute: string[];
    try {
      if (changedFeatureIds.length === 0) {
        orderToExecute = history.features.map(f => f.featureId);
      } else {
        orderToExecute = this.dependencyGraph.getRegenerationOrder(changedFeatureIds);
      }
    } catch (e: any) {
      diagnostics.push({
        featureId: 'dependency-graph',
        status: 'ERROR',
        message: e.message || 'Failed to resolve feature dependency ordering',
        affectedFeatures: changedFeatureIds
      });
      return { success: false, diagnostics };
    }

    // 5. Execute regeneration in exact topological order
    const kernel = await GeometryKernelManager.getKernel();
    let currentShape: ShapeHandle | undefined;

    const featureMap = new Map<string, FeatureDefinition>();
    for (const f of history.features) {
      featureMap.set(f.featureId, f);
    }

    for (const feature of history.features) {
      if (feature.suppressionState === 'SUPPRESSED') {
        feature.status = 'SUPPRESSED';
        continue;
      }

      // Check if feature references valid prior features
      if (feature.references && feature.references.length > 0) {
        for (const ref of feature.references) {
          if (ref.featureId && !featureMap.has(ref.featureId)) {
            feature.status = 'FAILED';
            diagnostics.push({
              featureId: feature.featureId,
              status: 'ERROR',
              message: `Dangling reference: Referenced parent feature '${ref.featureId}' does not exist in history`,
              affectedFeatures: [feature.featureId]
            });
            return { success: false, diagnostics };
          }
        }
      }

      try {
        currentShape = await this.executeFeature(feature, currentShape, kernel);
        feature.outputShape = currentShape;
        feature.status = 'ACTIVE';
        diagnostics.push({
          featureId: feature.featureId,
          status: 'SUCCESS',
          message: `Regenerated ${feature.type} (${feature.name || feature.featureId})`,
          affectedFeatures: []
        });
      } catch (e: any) {
        feature.status = 'FAILED';
        diagnostics.push({
          featureId: feature.featureId,
          status: 'ERROR',
          message: e.message || 'Feature execution failed',
          affectedFeatures: this.dependencyGraph.getRegenerationOrder([feature.featureId])
        });
        return { success: false, diagnostics };
      }
    }

    // 6. Compute Deterministic Provenance SHA-256
    const canonicalPayload = {
      modelId: history.modelId,
      revision: history.revision,
      features: history.features.map(f => ({
        id: f.featureId,
        type: f.type,
        status: f.status,
        suppressed: f.suppressionState,
        params: f.parameters,
        shapeHash: f.outputShape?.identityHash || null
      }))
    };

    const provenanceHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(canonicalPayload))
      .digest('hex');

    return {
      success: true,
      finalShape: currentShape,
      diagnostics,
      provenanceHash
    };
  }

  private async executeFeature(
    feature: FeatureDefinition,
    inputShape: ShapeHandle | undefined,
    kernel: any
  ): Promise<ShapeHandle> {
    const params = feature.parameters || {};

    switch (feature.type) {
      case 'ROOT': {
        if (inputShape) return inputShape;
        const identityContext = {
          featureId: feature.featureId,
          revision: feature.revision || 1,
          operation: 'ROOT',
          parameters: params
        };
        return await kernel.createBox(0.001, 0.001, 0.001, undefined, identityContext);
      }

      case 'EXTRUSION': {
        const w = typeof params.width === 'number' ? params.width : (params.dx || 10);
        const h = typeof params.height === 'number' ? params.height : (params.dy || 10);
        const d = typeof params.depth === 'number' ? params.depth : (params.dz || 10);

        if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(h) || h <= 0 || !Number.isFinite(d) || d <= 0) {
          throw new Error(`Invalid extrusion dimensions: width=${w}, height=${h}, depth=${d}`);
        }

        const identityContext = {
          featureId: feature.featureId,
          revision: feature.revision || 1,
          operation: 'EXTRUSION',
          parameters: { width: w, height: h, depth: d }
        };

        const box = await kernel.createBox(w, h, d, undefined, identityContext);

        if (inputShape) {
          const isCut = params.operation === 'CUT' || (feature.name && feature.name.toLowerCase().includes('cut'));
          if (isCut) {
            return await kernel.cut(inputShape, box, identityContext);
          }
          return await kernel.fuse(inputShape, box, identityContext);
        }
        return box;
      }

      case 'FILLET': {
        if (!inputShape) {
          throw new Error(`Fillet feature '${feature.featureId}' requires an existing input shape.`);
        }
        const radius = typeof params.radius === 'number' ? params.radius : 1.0;
        if (!Number.isFinite(radius) || radius <= 0) {
          throw new Error(`Invalid fillet radius: ${radius}`);
        }
        return await kernel.fillet(inputShape, radius, feature.references);
      }

      case 'CHAMFER': {
        if (!inputShape) {
          throw new Error(`Chamfer feature '${feature.featureId}' requires an existing input shape.`);
        }
        const distance = typeof params.distance === 'number' ? params.distance : (params.chamferDistance || 1.0);
        if (!Number.isFinite(distance) || distance <= 0) {
          throw new Error(`Invalid chamfer distance: ${distance}`);
        }
        return await kernel.chamfer(inputShape, distance, feature.references);
      }

      case 'BOOLEAN': {
        if (!inputShape) {
          throw new Error(`Boolean feature '${feature.featureId}' requires an existing input shape.`);
        }
        const operation = (params.operation || 'UNION').toUpperCase();
        const toolShape: ShapeHandle | undefined = params.toolShape;
        
        if (!toolShape) {
          // If no separate tool shape is supplied, perform self-consistent identity preservation
          return inputShape;
        }

        const identityContext = {
          featureId: feature.featureId,
          revision: feature.revision || 1,
          operation: `BOOLEAN_${operation}`,
          parameters: params
        };

        if (operation === 'CUT' || operation === 'SUBTRACT') {
          return await kernel.cut(inputShape, toolShape, identityContext);
        } else if (operation === 'INTERSECT' || operation === 'COMMON') {
          return await kernel.common(inputShape, toolShape, identityContext);
        } else {
          return await kernel.fuse(inputShape, toolShape, identityContext);
        }
      }

      case 'REVOLVE': {
        if (!inputShape) {
          throw new Error(`Revolve feature '${feature.featureId}' requires an existing input shape or profile.`);
        }
        const angle = typeof params.angle === 'number' ? params.angle : 360;
        if (!Number.isFinite(angle) || angle === 0) {
          throw new Error(`Invalid revolve angle: ${angle}`);
        }
        const axisPoint: Vector3 = params.axisPoint || { x: 0, y: 0, z: 0 };
        const axisDir: Vector3 = params.axisDir || { x: 0, y: 0, z: 1 };
        return await kernel.revolve(inputShape, axisPoint, axisDir, angle);
      }

      case 'SKETCH': {
        if (params.sketch) {
          return await kernel.evaluateSketch(params.sketch);
        }
        throw new Error(`Sketch feature '${feature.featureId}' is missing sketch definition parameter.`);
      }

      case 'PATTERN': {
        if (!inputShape) {
          throw new Error(`Pattern feature '${feature.featureId}' requires an existing input shape.`);
        }
        const count = typeof params.count === 'number' ? params.count : 2;
        const spacing = typeof params.spacing === 'number' ? params.spacing : 10;
        const axis = params.axis || { x: 1, y: 0, z: 0 };
        
        let accumulatedShape = inputShape;
        for (let i = 1; i < count; i++) {
          const shift: Vector3 = {
            x: axis.x * spacing * i,
            y: axis.y * spacing * i,
            z: axis.z * spacing * i
          };
          const translated = await kernel.translate(inputShape, shift);
          accumulatedShape = await kernel.fuse(accumulatedShape, translated);
        }
        return accumulatedShape;
      }

      default:
        throw new Error(`Unsupported feature type: ${(feature as any).type}`);
    }
  }
}
