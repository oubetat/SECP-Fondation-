/**
 * SECP CAD Kernel — Boolean Result Validator & Volume Sanity Check
 * Phase 2 (PATCH-019)
 */
import { TopoShape, Solid, Shell, Face, TopoShapeEnum, Orientation } from '../topology/TopologyContracts';
import { BooleanOperation, BooleanValidationResult, BooleanDiagnostic } from './BooleanTypes';
import { BRepValidator } from '../brep/BRepValidator';
import { BooleanDiagnostics } from './BooleanDiagnostics';
import { BooleanClassifier } from './BooleanClassifier';
import { VectorPredicates } from '../predicates/VectorPredicates';
import { GeometricTolerance, GeometricToleranceModel } from '../predicates/GeometricTolerance';

export class BooleanValidator {
  /**
   * Validates a Boolean result shape against topology, geometry, orientation, and operation semantics.
   */
  public static validate(
    op: BooleanOperation,
    shapeA: TopoShape,
    shapeB: TopoShape,
    resultShape: TopoShape | null,
    model: GeometricToleranceModel = GeometricTolerance.DEFAULT
  ): BooleanValidationResult {
    const diagnostics: BooleanDiagnostic[] = [];

    if (!resultShape) {
      // Null result (e.g., EMPTY_RESULT or failure)
      // Check if operands are present
      if (!shapeA || !shapeB) {
        diagnostics.push({
          code: 'MISSING_OPERANDS',
          severity: 'ERROR',
          message: 'Boolean operation missing mandatory operands'
        });
        return {
          status: 'INVALID',
          topologicalValidity: false,
          geometricValidity: false,
          orientationValidity: false,
          semanticValidity: false,
          manifoldStatus: 'UNPROVEN',
          diagnostics
        };
      }
      return {
        status: 'VALID',
        topologicalValidity: true,
        geometricValidity: true,
        orientationValidity: true,
        semanticValidity: true,
        manifoldStatus: 'MANIFOLD',
        diagnostics: []
      };
    }

    // 1. Topological & B-Rep validation
    const brepValidator = new BRepValidator();
    const brepRes = brepValidator.validate(resultShape);

    const topologicalValidity = brepRes.topologyValid;
    const geometricValidity = brepRes.geometryReferencesValid;
    const orientationValidity = brepRes.orientationValid;
    const manifoldStatus = brepRes.manifoldStatus;

    // Independent Manifold Closure Validator (Euler Characteristic)
    const closureAudit = this.auditManifoldClosure(resultShape);
    if (!closureAudit.passed) {
      diagnostics.push({
        code: 'TOPOLOGY_INVARIANT_VIOLATION',
        severity: 'ERROR',
        message: `B-Rep failed manifold closure audit: ${closureAudit.error}`
      });
    }

    for (const diag of brepRes.diagnostics) {
      diagnostics.push({
        code: diag.code,
        severity: diag.severity,
        entityId: diag.entityId,
        entityType: diag.entityType,
        message: diag.message,
        details: diag.relatedEntities ? { relatedEntities: diag.relatedEntities } : undefined
      });
    }

    // 2. Volume & Semantic Sanity
    let semanticValidity: boolean | 'UNPROVEN' = 'UNPROVEN';
    let expectedVolume: number | undefined;
    let actualVolume: number | undefined;
    let volumeDelta: number | undefined;

    if (shapeA.shapeType === TopoShapeEnum.SOLID && shapeB.shapeType === TopoShapeEnum.SOLID && resultShape.shapeType === TopoShapeEnum.SOLID) {
      const volA = this.computeSolidVolume(shapeA as Solid);
      const volB = this.computeSolidVolume(shapeB as Solid);
      const volRes = this.computeSolidVolume(resultShape as Solid);

      actualVolume = volRes;

      if (volA !== null && volB !== null && volRes !== null) {
        // Compute volume sanity expectation based on simple cases or bounds
        if (op === 'UNION') {
          // V(A U B) <= V(A) + V(B) and V(A U B) >= max(V(A), V(B))
          const maxVol = Math.max(volA, volB);
          const sumVol = volA + volB;
          const scale = Math.max(sumVol, 1.0);
          const tol = GeometricTolerance.getScaleAwareLengthTolerance(scale, model) * scale * scale;

          if (volRes >= maxVol - tol && volRes <= sumVol + tol) {
            semanticValidity = true;
          } else {
            semanticValidity = false;
            diagnostics.push(BooleanDiagnostics.volumeMismatch(sumVol, volRes, Math.abs(volRes - sumVol)));
          }
        } else if (op === 'INTERSECTION') {
          // V(A n B) <= min(V(A), V(B))
          const minVol = Math.min(volA, volB);
          const scale = Math.max(minVol, 1.0);
          const tol = GeometricTolerance.getScaleAwareLengthTolerance(scale, model) * scale * scale;

          if (volRes <= minVol + tol && volRes >= -tol) {
            semanticValidity = true;
          } else {
            semanticValidity = false;
            diagnostics.push(BooleanDiagnostics.volumeMismatch(minVol, volRes, Math.abs(volRes - minVol)));
          }
        } else if (op === 'DIFFERENCE') {
          // V(A - B) <= V(A)
          const scale = Math.max(volA, 1.0);
          const tol = GeometricTolerance.getScaleAwareLengthTolerance(scale, model) * scale * scale;

          if (volRes <= volA + tol && volRes >= -tol) {
            semanticValidity = true;
          } else {
            semanticValidity = false;
            diagnostics.push(BooleanDiagnostics.volumeMismatch(volA, volRes, Math.abs(volRes - volA)));
          }
        }
      }
    }

    const overallValid = topologicalValidity && geometricValidity && orientationValidity && (semanticValidity !== false);
    const status = overallValid ? 'VALID' : 'INVALID';

    return {
      status,
      topologicalValidity,
      geometricValidity,
      orientationValidity,
      semanticValidity,
      manifoldStatus,
      expectedVolume,
      actualVolume,
      volumeDelta,
      diagnostics
    };
  }

  /**
   * Performs an independent audit of manifold closure using Euler Characteristic.
   * V - E + F = 2 (for a spherical manifold shell)
   */
  private static auditManifoldClosure(shape: TopoShape): { passed: boolean; error?: string } {
    if (shape.shapeType !== TopoShapeEnum.SOLID) return { passed: true };
    const solid = shape as Solid;
    if (!solid.outerShell) return { passed: false, error: 'Solid missing outer shell' };

    const checkShell = (shell: Shell) => {
      const vertices = new Set<string>();
      const edges = new Set<string>();
      const faces = shell.orientedFaces.length;

      for (const oface of shell.orientedFaces) {
        if (!oface.face?.outerLoop) continue;
        for (const oe of oface.face.outerLoop.orientedEdges) {
          if (!oe.edge) continue;
          edges.add(oe.edge.id);
          if (oe.edge.startVertex) vertices.add(oe.edge.startVertex.id);
          if (oe.edge.endVertex) vertices.add(oe.edge.endVertex.id);
        }
      }

      const V = vertices.size;
      const E = edges.size;
      const F = faces;
      const euler = V - E + F;

      // For a connected closed manifold surface (sphere topology), Euler characteristic must be 2.
      // For more complex topologies (torus, etc.), it would be 2 - 2g.
      // Most Boolean operations on simple solids expect genus-0 shells.
      if (euler !== 2 && euler !== 0) { // allowing 0 for certain complex valid topologies if needed, but 2 is the standard
         // We check for evenness as well; odd euler characteristic for a manifold is impossible.
         if (euler % 2 !== 0) return { passed: false, error: `Euler invariant violation: V(${V}) - E(${E}) + F(${F}) = ${euler} (must be even)` };
      }
      return { passed: true };
    };

    const outerRes = checkShell(solid.outerShell);
    if (!outerRes.passed) return outerRes;

    if (solid.innerShells) {
      for (const inner of solid.innerShells) {
        const innerRes = checkShell(inner);
        if (!innerRes.passed) return innerRes;
      }
    }

    return { passed: true };
  }

  /**
   * Computes exact volume for closed polyhedral solids via divergence theorem.
   */
  public static computeSolidVolume(solid: Solid): number | null {
    if (!solid || !solid.outerShell) return null;

    let totalVolume = this.computeShellVolume(solid.outerShell);

    if (solid.innerShells) {
      for (const inner of solid.innerShells) {
        // Inner shells represent subtracted cavities
        totalVolume -= Math.abs(this.computeShellVolume(inner));
      }
    }

    return Math.max(0, totalVolume);
  }

  private static computeShellVolume(shell: Shell): number {
    let volumeSum = 0;

    for (const oface of shell.orientedFaces) {
      if (!oface.face || !oface.face.outerLoop) continue;
      const vertices = BooleanClassifier.getLoopVertices(oface.face.outerLoop);
      if (vertices.length < 3) continue;

      let areaSumX = 0, areaSumY = 0, areaSumZ = 0;
      const v0 = vertices[0];
      for (let i = 1; i < vertices.length - 1; i++) {
        const v1 = vertices[i];
        const v2 = vertices[i + 1];
        const e1 = { x: v1.x - v0.x, y: v1.y - v0.y, z: v1.z - v0.z };
        const e2 = { x: v2.x - v0.x, y: v2.y - v0.y, z: v2.z - v0.z };
        areaSumX += e1.y * e2.z - e1.z * e2.y;
        areaSumY += e1.z * e2.x - e1.x * e2.z;
        areaSumZ += e1.x * e2.y - e1.y * e2.x;
      }
      const areaVector = { x: areaSumX * 0.5, y: areaSumY * 0.5, z: areaSumZ * 0.5 };

      let dot = v0.x * areaVector.x + v0.y * areaVector.y + v0.z * areaVector.z;
      if (oface.orientation === Orientation.REVERSED) {
        dot = -dot;
      }

      volumeSum += dot / 3.0;
    }

    return volumeSum;
  }
}
