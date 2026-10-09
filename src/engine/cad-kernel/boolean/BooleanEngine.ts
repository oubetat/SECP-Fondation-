/**
 * SECP CAD Kernel — Boolean Operations Engine
 * Phase 2 (PATCH-019)
 */
import { TopoShape, Solid, TopoShapeEnum } from '../topology/TopologyContracts';
import {
  BooleanOperation,
  BooleanStatus,
  BooleanResult,
  BooleanDiagnostic,
  BooleanEvidence
} from './BooleanTypes';
import { BooleanTolerance } from './BooleanTolerance';
import { BooleanDiagnostics } from './BooleanDiagnostics';
import { BooleanIntersector } from './BooleanIntersector';
import { BooleanSplitter } from './BooleanSplitter';
import { BooleanClassifier } from './BooleanClassifier';
import { BooleanAssembler } from './BooleanAssembler';
import { BooleanValidator } from './BooleanValidator';
import { BRepValidator } from '../brep/BRepValidator';
import { GeometricTolerance, GeometricToleranceModel } from '../predicates/GeometricTolerance';
import { CanonicalSerializer } from '../../serialization/CanonicalSerializer';
import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';
import { BoxFactory } from './BoxFactory';
import { BRepHasher } from '../topology/BRepHasher';

export class BooleanEngine {
  public static readonly KERNEL_VERSION = 'SECP-BOOLEAN-2.0.0';

  /**
   * Executes a canonical Boolean operation (UNION, INTERSECTION, DIFFERENCE) on two B-Rep shapes.
   */
  public static execute(
    op: BooleanOperation,
    shapeA: TopoShape,
    shapeB: TopoShape,
    options?: { model?: GeometricToleranceModel }
  ): BooleanResult {
    const model = BooleanTolerance.resolve(options?.model);
    const diagnostics: BooleanDiagnostic[] = [];

    const inputShapeIds = [shapeA ? shapeA.id : 'null', shapeB ? shapeB.id : 'null'];

    // 1. INPUT VALIDATION
    if (!shapeA || !shapeB) {
      const diag = BooleanDiagnostics.invalidInput('null', 'Null shape passed to Boolean operation');
      diagnostics.push(diag);
      return this.buildResult(op, 'INVALID_INPUT', null, shapeA, shapeB, model, diagnostics, null);
    }

    const validatorA = new BRepValidator();
    const resA = validatorA.validate(shapeA);
    if (resA.status === 'INVALID') {
      for (const d of resA.diagnostics) {
        diagnostics.push(BooleanDiagnostics.invalidInput(d.entityId, `Shape A validation error: ${d.message}`));
      }
      return this.buildResult(op, 'INVALID_INPUT', null, shapeA, shapeB, model, diagnostics, null);
    }

    const validatorB = new BRepValidator();
    const resB = validatorB.validate(shapeB);
    if (resB.status === 'INVALID') {
      for (const d of resB.diagnostics) {
        diagnostics.push(BooleanDiagnostics.invalidInput(d.entityId, `Shape B validation error: ${d.message}`));
      }
      return this.buildResult(op, 'INVALID_INPUT', null, shapeA, shapeB, model, diagnostics, null);
    }

    // Only 3D Solid operands supported for solid Boolean operations
    if (shapeA.shapeType !== TopoShapeEnum.SOLID || shapeB.shapeType !== TopoShapeEnum.SOLID) {
      diagnostics.push(BooleanDiagnostics.invalidInput(shapeA.id, 'Non-solid B-Rep shapes are currently unproven for solid Booleans'));
      return this.buildResult(op, 'UNPROVEN', null, shapeA, shapeB, model, diagnostics, null);
    }

    const solidA = shapeA as Solid;
    const solidB = shapeB as Solid;

    // Reject degenerate inputs
    const aabbA = this.computeSolidAABB(solidA);
    const aabbB = this.computeSolidAABB(solidB);
    const volA = (aabbA.max.x - aabbA.min.x) * (aabbA.max.y - aabbA.min.y) * (aabbA.max.z - aabbA.min.z);
    const volB = (aabbB.max.x - aabbB.min.x) * (aabbB.max.y - aabbB.min.y) * (aabbB.max.z - aabbB.min.z);

    const scaleA = Math.max(Math.abs(aabbA.min.x), Math.abs(aabbA.max.x));
    const tolA = GeometricTolerance.getScaleAwareLengthTolerance(scaleA, model);
    if (volA < tolA * tolA * tolA) {
      diagnostics.push(BooleanDiagnostics.invalidInput(solidA.id, 'Solid A is degenerate (zero volume)'));
      return this.buildResult(op, 'INVALID_INPUT', null, solidA, solidB, model, diagnostics, null);
    }
    const scaleB = Math.max(Math.abs(aabbB.min.x), Math.abs(aabbB.max.x));
    const tolB = GeometricTolerance.getScaleAwareLengthTolerance(scaleB, model);
    if (volB < tolB * tolB * tolB) {
      diagnostics.push(BooleanDiagnostics.invalidInput(solidB.id, 'Solid B is degenerate (zero volume)'));
      return this.buildResult(op, 'INVALID_INPUT', null, solidA, solidB, model, diagnostics, null);
    }

    // 2. CHECK DISJOINT / COINCIDENT QUICK PATHS (CLASSIFICATION)
    const quickRel = this.detectSpecialRelationship(solidA, solidB, model);
    if (quickRel) {
      const specialRes = BooleanAssembler.handleSpecialRelationships(op, solidA, solidB, quickRel);
      diagnostics.push(...specialRes.diagnostics);

      const status: BooleanStatus = specialRes.resultShape ? 'SUCCESS' : 'EMPTY_RESULT';
      return this.buildResult(op, status, specialRes.resultShape, solidA, solidB, model, diagnostics, specialRes.generatedTopology);
    }

    // 3. SURFACE INTERSECTION
    const intRes = BooleanIntersector.intersectSolids(solidA, solidB, model);
    diagnostics.push(...intRes.diagnostics);

    if (intRes.unsupportedCount > 0) {
      // Unsupported surface pair present in solids
      return this.buildResult(op, 'UNSUPPORTED', null, solidA, solidB, model, diagnostics, null);
    }

    // 4. TOPOLOGY SPLITTING
    const splitRes = BooleanSplitter.splitSolids(solidA, solidB, intRes.intersectionCurves, model);
    diagnostics.push(...splitRes.diagnostics);

    // 5. REGION SELECTION & ASSEMBLY (STITCHING)
    const assemblyRes = BooleanAssembler.assemble(
      op, solidA, solidB, splitRes.splitFacesA, splitRes.splitFacesB, model
    );
    diagnostics.push(...assemblyRes.diagnostics);

    let status: BooleanStatus = 'SUCCESS';
    if (!assemblyRes.resultShape) {
      status = 'EMPTY_RESULT';
    }

    // 6. TOPOLOGY VALIDATION
    if (assemblyRes.resultShape) {
      const finalValidator = new BRepValidator();
      const validationRes = finalValidator.validate(assemblyRes.resultShape);
      if (validationRes.status === 'INVALID') {
        for (const d of validationRes.diagnostics) {
          diagnostics.push({
            code: 'INVALID_RESULT',
            severity: 'ERROR',
            entityId: d.entityId,
            message: `Result topology validation failure: ${d.message}`
          });
        }
        status = 'INVALID_RESULT';
      }
    }

    return this.buildResult(
      op,
      status,
      assemblyRes.resultShape,
      solidA,
      solidB,
      model,
      diagnostics,
      assemblyRes.generatedTopology
    );
  }

  private static detectSpecialRelationship(
    solidA: Solid,
    solidB: Solid,
    model: GeometricToleranceModel
  ): 'DISJOINT' | 'COINCIDENT' | 'A_CONTAINS_B' | 'B_CONTAINS_A' | null {
    // 1. Check ID coincidence (fast path)
    if (solidA.id === solidB.id) return 'COINCIDENT';

    // 2. Check bounding box overlap
    const boxA = this.computeSolidAABB(solidA);
    const boxB = this.computeSolidAABB(solidB);

    const scale = Math.max(
      Math.abs(boxA.min.x), Math.abs(boxA.max.x),
      Math.abs(boxB.min.x), Math.abs(boxB.max.x)
    );
    const tol = GeometricTolerance.getScaleAwareLengthTolerance(scale, model);

    if (boxA.max.x <= boxB.min.x + tol || boxB.max.x <= boxA.min.x + tol ||
        boxA.max.y <= boxB.min.y + tol || boxB.max.y <= boxA.min.y + tol ||
        boxA.max.z <= boxB.min.z + tol || boxB.max.z <= boxA.min.z + tol) {
      return 'DISJOINT';
    }

    // 3. Check for geometric coincidence (identical geometry but different IDs)
    if (this.areSolidsGeometricallyCoincident(solidA, solidB, model)) {
      return 'COINCIDENT';
    }

    // 4. Check for containment
    if (this.isSolidContained(solidA, solidB, boxA, boxB, tol, model)) return 'B_CONTAINS_A';
    if (this.isSolidContained(solidB, solidA, boxB, boxA, tol, model)) return 'A_CONTAINS_B';

    return null;
  }

  private static isSolidContained(
    innerSolid: Solid,
    outerSolid: Solid,
    innerBox: any,
    outerBox: any,
    tol: number,
    model: GeometricToleranceModel
  ): boolean {
    // Fast reject if AABB is not contained
    if (!(innerBox.min.x >= outerBox.min.x - tol && innerBox.max.x <= outerBox.max.x + tol &&
          innerBox.min.y >= outerBox.min.y - tol && innerBox.max.y <= outerBox.max.y + tol &&
          innerBox.min.z >= outerBox.min.z - tol && innerBox.max.z <= outerBox.max.z + tol)) {
      return false;
    }

    // Verify all vertices of innerSolid are INSIDE or ON_BOUNDARY of outerSolid
    if (innerSolid.outerShell) {
      for (const oface of innerSolid.outerShell.orientedFaces) {
        if (!oface.face) continue;
        const verts = BooleanClassifier.getLoopVertices(oface.face.outerLoop);
        for (const v of verts) {
          const cls = BooleanClassifier.classifyPointAgainstSolid(v, outerSolid, model);
          if (cls === 'OUTSIDE') {
            return false;
          }
        }
      }
    }

    return true;
  }

  private static areSolidsGeometricallyCoincident(
    solidA: Solid,
    solidB: Solid,
    model: GeometricToleranceModel
  ): boolean {
    if (!solidA.outerShell || !solidB.outerShell) return false;
    
    // Quick volume check
    const boxA = this.computeSolidAABB(solidA);
    const boxB = this.computeSolidAABB(solidB);
    
    const volA = (boxA.max.x - boxA.min.x) * (boxA.max.y - boxA.min.y) * (boxA.max.z - boxA.min.z);
    const volB = (boxB.max.x - boxB.min.x) * (boxB.max.y - boxB.min.y) * (boxB.max.z - boxB.min.z);
    
    if (Math.abs(volA - volB) > 1e-6) return false;

    // Check if every vertex of A is on boundary of B
    // (Simplified check for now: centroid of faces)
    for (const oface of solidA.outerShell.orientedFaces) {
      if (!oface.face) continue;
      const centroid = this.computeFaceCentroid(oface.face);
      const cls = BooleanClassifier.classifyPointAgainstSolid(centroid, solidB, model);
      if (cls !== 'ON_BOUNDARY') return false;
    }

    return true;
  }

  private static computeFaceCentroid(face: any): any {
    const verts = BooleanClassifier.getLoopVertices(face.outerLoop);
    let x = 0, y = 0, z = 0;
    for (const v of verts) {
      x += v.x; y += v.y; z += v.z;
    }
    return { x: x / verts.length, y: y / verts.length, z: z / verts.length };
  }

  private static computeSolidAABB(solid: Solid): { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    if (solid.outerShell) {
      for (const oface of solid.outerShell.orientedFaces) {
        if (!oface.face) continue;
        const verts = BooleanClassifier.getLoopVertices(oface.face.outerLoop);
        for (const v of verts) {
          if (v.x < minX) minX = v.x;
          if (v.y < minY) minY = v.y;
          if (v.z < minZ) minZ = v.z;
          if (v.x > maxX) maxX = v.x;
          if (v.y > maxY) maxY = v.y;
          if (v.z > maxZ) maxZ = v.z;
        }
      }
    }

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ }
    };
  }

  private static buildResult(
    op: BooleanOperation,
    status: BooleanStatus,
    resultShape: TopoShape | null,
    solidA: TopoShape | null,
    solidB: TopoShape | null,
    model: GeometricToleranceModel,
    diagnostics: BooleanDiagnostic[],
    countsOverride: any
  ): BooleanResult {
    // Run Boolean Validation
    const validation = BooleanValidator.validate(
      op,
      solidA as any,
      solidB as any,
      resultShape,
      model
    );

    const inputShapeIds = [solidA ? solidA.id : 'null', solidB ? solidB.id : 'null'];
    const generatedTopology = status === 'UNSUPPORTED' ? null : (countsOverride || { vertices: 0, edges: 0, faces: 0, shells: 0, solids: 0 });
    const safeDiagnostics = diagnostics || [];

    // Compute Determinism Hash
    const payload = {
      operation: op,
      status,
      inputShapeIds,
      resultShapeId: resultShape ? resultShape.id : null,
      generatedTopology,
      diagnostics: safeDiagnostics.map(d => ({ code: d.code, severity: d.severity, entityId: d.entityId ?? null })),
      validationStatus: validation.status,
      kernelVersion: this.KERNEL_VERSION
    };

    const canonRes = CanonicalSerializer.serialize(payload);
    const hashRes = EngineeringHashChain.computeCanonicalHash(payload);
    const determinismHash = hashRes.canonicalHash;

    // Artifact Hashing (PATCH-012)
    let geometryHash = 'EMPTY_RESULT';
    let topologyHash = 'EMPTY_RESULT';
    if (resultShape && resultShape.shapeType === TopoShapeEnum.SOLID) {
      const artifactEvidence = BRepHasher.computeEvidence(resultShape as Solid);
      geometryHash = artifactEvidence.geometryHash;
      topologyHash = artifactEvidence.topologyHash;
    }

    // Input Hashing
    const inputHashes = [
      (solidA && solidA.shapeType === TopoShapeEnum.SOLID) ? BRepHasher.computeEvidence(solidA as Solid).topologyHash : 'null',
      (solidB && solidB.shapeType === TopoShapeEnum.SOLID) ? BRepHasher.computeEvidence(solidB as Solid).topologyHash : 'null'
    ];

    // Build Evidence
    const evidence: BooleanEvidence = {
      operation: op,
      inputIdentities: inputShapeIds,
      inputHashes,
      outputIdentity: resultShape ? resultShape.id : 'EMPTY_RESULT',
      outputHash: EngineeringHashChain.computeCanonicalHash({ resultShapeId: resultShape ? resultShape.id : null }).canonicalHash,
      geometryHash,
      topologyHash,
      kernelVersion: this.KERNEL_VERSION,
      tolerancePolicy: model,
      diagnostics: safeDiagnostics,
      validationResult: validation,
      provenanceReferences: [`BooleanEngine.execute(${op})`],
      canonicalHash: determinismHash
    };

    return Object.freeze({
      operation: op,
      status,
      resultShape,
      inputShapeIds,
      generatedTopology,
      tolerance: model,
      diagnostics: safeDiagnostics,
      validation,
      determinismHash,
      evidence
    });
  }
}
