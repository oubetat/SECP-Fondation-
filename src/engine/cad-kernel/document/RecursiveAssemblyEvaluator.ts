/**
 * SECP CAD Kernel — Recursive Assembly Evaluator (PATCH-039A)
 * 
 * ARCHITECTURAL CONTRACT:
 * 1. Engineering SOT: EngineeringDocument remains the sole engineering SOT.
 * 2. Recursive Hierarchy: An ASSEMBLY document may reference leaf PART documents
 *    or nested ASSEMBLY documents.
 * 3. Pure Transform Composition:
 *    M_world = M_parent × M_child (Translation + 3D Euler Rotation)
 * 4. Active Traversal Stack Cycle Detection:
 *    Detects dependency cycles and emits [SECP_ASSEMBLY_CYCLE_DETECTED] A → B → C → A.
 * 5. Suppression Cascade:
 *    Suppression of a parent instance automatically cascades to all descendant occurrences.
 * 6. Child Immutability:
 *    Child document definitions are never mutated by parent occurrence transforms.
 * 7. Zero Synthetic Geometry:
 *    Missing or cyclic child references produce truthful MISSING status with solid = undefined.
 * 8. Deterministic Occurrence Graph:
 *    occurrencePath (e.g. 'rootInst/subInst/leafInst') and depth are uniquely determined.
 */

import {
  EngineeringDocument,
  AssemblyInstance,
  AssemblyMate,
  AssemblyDefinition
} from './CADDocument';
import {
  IDocumentResolver,
  InMemoryDocumentResolver,
  DocumentResolutionStatus,
  DocumentEvaluationContext
} from './DocumentResolver';
import { AssemblyMateSolver, EvaluatedAssemblyMate } from './AssemblyMateSolver';
import { DocumentEvaluator, DocumentEvaluationOptions } from './DocumentEvaluator';
import { CadGeometryKernel, CadSolidEntity, MeshGeometryData } from '../../cadKernel';
import { SECP_UNIT_CONTRACT } from './UnitContract';

export type Matrix16Tuple = readonly [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number
];

export interface Matrix4x4Data {
  m: number[] | Matrix16Tuple; // 16 elements in row-major order: [m00, m01, m02, m03, m10, ...]
}

export class Matrix4x4Helper {
  public static validate(mat: Matrix4x4Data): boolean {
    if (!mat || !Array.isArray(mat.m) || mat.m.length !== 16) {
      return false;
    }
    return mat.m.every(val => typeof val === 'number' && !isNaN(val) && isFinite(val));
  }

  public static assertValid(mat: Matrix4x4Data): void {
    if (!this.validate(mat)) {
      const len = mat && Array.isArray(mat.m) ? mat.m.length : 'non-array';
      throw new Error(`INVALID_MATRIX_4X4: Matrix must contain exactly 16 finite numeric elements. Received: ${len}`);
    }
  }
}

export interface Transform3DValue {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number }; // in degrees (Euler XYZ)
}

export interface EvaluatedOccurrenceComponent {
  id: string;
  name: string;
  partId: string;
  instanceId: string;
  documentId: string;
  revision: string;       // Alphanumeric revision (e.g. "REV-A")
  occurrencePath: string; // e.g. "inst-chassis/inst-arm/inst-gripper/inst-finger"
  depth: number;          // 0 for direct children of root, 1 for sub-assembly children, etc.
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  matrix: number[];       // 16-element 4x4 homogenous matrix
  colorHex: string;
  visible: boolean;
  suppressed: boolean;
  solid?: CadSolidEntity;
  resolutionStatus?: DocumentResolutionStatus | 'CYCLE_ERROR' | 'EVALUATION_ERROR';
  resolutionError?: string;
}

export interface EvaluatedAssemblyResult {
  components: EvaluatedOccurrenceComponent[];
  mates: EvaluatedAssemblyMate[];
  allMatesSolved: boolean;
  hasErrors: boolean;
  diagnostics: string[];
}

export class AssemblyTransformMatrix {
  /**
   * Creates an identity 4x4 matrix.
   */
  public static identity(): Matrix4x4Data {
    return {
      m: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]
    };
  }

  /**
   * Converts translation and Euler XYZ rotation (in degrees) into a 4x4 matrix.
   */
  public static fromTranslationAndRotation(
    pos: { x: number; y: number; z: number },
    rot: { x: number; y: number; z: number }
  ): Matrix4x4Data {
    const px = pos?.x || 0;
    const py = pos?.y || 0;
    const pz = pos?.z || 0;

    const rx = ((rot?.x || 0) * Math.PI) / 180;
    const ry = ((rot?.y || 0) * Math.PI) / 180;
    const rz = ((rot?.z || 0) * Math.PI) / 180;

    const cx = Math.cos(rx);
    const sx = Math.sin(rx);
    const cy = Math.cos(ry);
    const sy = Math.sin(ry);
    const cz = Math.cos(rz);
    const sz = Math.sin(rz);

    // Rotation Matrix R = Rx * Ry * Rz (Euler XYZ)
    // Row 0:
    const m00 = cy * cz;
    const m01 = -cy * sz;
    const m02 = sy;
    const m03 = px;

    // Row 1:
    const m10 = sx * sy * cz + cx * sz;
    const m11 = -sx * sy * sz + cx * cz;
    const m12 = -sx * cy;
    const m13 = py;

    // Row 2:
    const m20 = -cx * sy * cz + sx * sz;
    const m21 = cx * sy * sz + sx * cz;
    const m22 = cx * cy;
    const m23 = pz;

    // Row 3:
    const m30 = 0;
    const m31 = 0;
    const m32 = 0;
    const m33 = 1;

    return {
      m: [
        m00, m01, m02, m03,
        m10, m11, m12, m13,
        m20, m21, m22, m23,
        m30, m31, m32, m33
      ]
    };
  }

  /**
   * Multiplies two 4x4 matrices: A × B.
   */
  public static multiply(a: Matrix4x4Data, b: Matrix4x4Data): Matrix4x4Data {
    const am = a.m;
    const bm = b.m;
    const out = new Array<number>(16);

    for (let row = 0; row < 4; row++) {
      const rOffset = row * 4;
      for (let col = 0; col < 4; col++) {
        out[rOffset + col] =
          am[rOffset + 0] * bm[0 * 4 + col] +
          am[rOffset + 1] * bm[1 * 4 + col] +
          am[rOffset + 2] * bm[2 * 4 + col] +
          am[rOffset + 3] * bm[3 * 4 + col];
      }
    }

    return { m: out };
  }

  /**
   * Decomposes a 4x4 matrix into position and Euler XYZ rotation (in degrees).
   */
  public static decompose(mat: Matrix4x4Data): Transform3DValue {
    const m = mat.m;
    const px = m[3];
    const py = m[7];
    const pz = m[11];

    // Extract Euler XYZ rotation angles
    // m02 = sy
    const sy = Math.max(-1, Math.min(1, m[2]));
    const ryRad = Math.asin(sy);

    let rxRad = 0;
    let rzRad = 0;

    if (Math.abs(sy) < 0.999999) {
      rxRad = Math.atan2(-m[6], m[10]);
      rzRad = Math.atan2(-m[1], m[0]);
    } else {
      // Gimbal lock
      rxRad = Math.atan2(m[9], m[5]);
      rzRad = 0;
    }

    const rx = (rxRad * 180) / Math.PI;
    const ry = (ryRad * 180) / Math.PI;
    const rz = (rzRad * 180) / Math.PI;

    const fixZero = (n: number): number => {
      const rounded = Math.round(n * 1e6) / 1e6;
      return Object.is(rounded, -0) ? 0 : rounded;
    };

    return {
      position: {
        x: fixZero(px),
        y: fixZero(py),
        z: fixZero(pz)
      },
      rotation: {
        x: fixZero(rx),
        y: fixZero(ry),
        z: fixZero(rz)
      }
    };
  }

  /**
   * Transforms a 3D point (x, y, z) by a 4x4 matrix.
   */
  public static transformPoint(
    mat: Matrix4x4Data,
    pt: { x: number; y: number; z: number }
  ): { x: number; y: number; z: number } {
    const m = mat.m;
    const x = pt.x || 0;
    const y = pt.y || 0;
    const z = pt.z || 0;

    return {
      x: m[0] * x + m[1] * y + m[2] * z + m[3],
      y: m[4] * x + m[5] * y + m[6] * z + m[7],
      z: m[8] * x + m[9] * y + m[10] * z + m[11]
    };
  }

  /**
   * Computes the determinant of the 3x3 rotation/scale part of the 4x4 matrix.
   * A negative determinant indicates a reflection (handedness change).
   */
  public static computeDeterminant3x3(mat: Matrix4x4Data): number {
    const m = mat.m;
    // Row 0: m00, m01, m02
    // Row 1: m10, m11, m12
    // Row 2: m20, m21, m22
    return (
      m[0] * (m[5] * m[10] - m[6] * m[9]) -
      m[1] * (m[4] * m[10] - m[6] * m[8]) +
      m[2] * (m[4] * m[9] - m[5] * m[8])
    );
  }

  /**
   * Validates if the matrix preserves handedness (no reflection).
   */
  public static preservesHandedness(mat: Matrix4x4Data): boolean {
    return this.computeDeterminant3x3(mat) > 0;
  }
}

export class RecursiveAssemblyEvaluator {
  /**
   * Recursively evaluates an assembly document and all nested sub-assemblies.
   */
  public static evaluateAssemblyGraph(
    rootDoc: EngineeringDocument,
    options: DocumentEvaluationOptions
  ): EvaluatedAssemblyResult {
    const diagnostics: string[] = [];
    const components: EvaluatedOccurrenceComponent[] = [];
    let allMates: EvaluatedAssemblyMate[] = [];
    let hasErrors = false;

    const resolver = options?.context?.resolver;
    const maxDepth = options?.context?.maxDepth ?? 16;

    // Active traversal stack for exact cycle detection: [rootId]
    const initialStack: string[] = options?.context?.visitedDocIds ? Array.from(options.context.visitedDocIds) : [];
    if (!initialStack.includes(rootDoc.documentId)) {
      initialStack.push(rootDoc.documentId);
    }

    this.traverseAssemblyNode(
      rootDoc,
      AssemblyTransformMatrix.identity(),
      '',
      0,
      false,
      initialStack,
      components,
      allMates,
      diagnostics,
      resolver,
      maxDepth,
      options
    );

    // Sort components deterministically by occurrencePath
    components.sort((a, b) => a.occurrencePath.localeCompare(b.occurrencePath));

    hasErrors = components.some(
      c => c.resolutionStatus === 'MISSING' || c.resolutionStatus === 'CYCLE_ERROR' || c.resolutionStatus === 'EVALUATION_ERROR'
    );

    const allMatesSolved = allMates.every(m => m.status === 'SOLVED');

    return {
      components,
      mates: allMates,
      allMatesSolved,
      hasErrors,
      diagnostics
    };
  }

  private static traverseAssemblyNode(
    currentAssemblyDoc: EngineeringDocument,
    parentWorldMatrix: Matrix4x4Data,
    parentOccurrencePath: string,
    currentDepth: number,
    parentSuppressed: boolean,
    activeStack: string[],
    accumulatedComponents: EvaluatedOccurrenceComponent[],
    accumulatedMates: EvaluatedAssemblyMate[],
    diagnostics: string[],
    resolver?: IDocumentResolver,
    maxDepth: number = 16,
    options?: DocumentEvaluationOptions
  ): void {
    if (!currentAssemblyDoc.assembly || !currentAssemblyDoc.assembly.instances) {
      return;
    }

    if (currentDepth >= maxDepth) {
      diagnostics.push(
        `[SECP_DOC_DEPTH_EXCEEDED] Maximum evaluation depth (${maxDepth}) exceeded at assembly: '${currentAssemblyDoc.documentId}'`
      );
      return;
    }

    // 1. Solve mates at current assembly level
    const solverResult = AssemblyMateSolver.solve(
      currentAssemblyDoc.assembly,
      options?.tolerancePolicy
    );

    for (const diag of solverResult.diagnostics) {
      diagnostics.push(diag);
    }

    // Prefix mate IDs with occurrence path if in a sub-assembly to prevent ID collisions
    for (const m of solverResult.evaluatedMates) {
      const qualifiedMate: EvaluatedAssemblyMate = {
        ...m,
        id: parentOccurrencePath ? `${parentOccurrencePath}/${m.id}` : m.id,
        instanceAId: parentOccurrencePath ? `${parentOccurrencePath}/${m.instanceAId}` : m.instanceAId,
        instanceBId: parentOccurrencePath ? `${parentOccurrencePath}/${m.instanceBId}` : m.instanceBId
      };
      accumulatedMates.push(qualifiedMate);
    }

    // 2. Iterate through each instance in this assembly level
    for (const inst of currentAssemblyDoc.assembly.instances) {
      const occurrencePath = parentOccurrencePath
        ? `${parentOccurrencePath}/${inst.instanceId}`
        : inst.instanceId;

      const isSuppressed = parentSuppressed || !!inst.isSuppressed;

      // Solved local transform relative to this assembly
      const solvedLocalTransform = solverResult.transforms.get(inst.instanceId);
      const localPos = solvedLocalTransform ? solvedLocalTransform.position : inst.position;
      const localRot = solvedLocalTransform ? solvedLocalTransform.rotation : inst.rotation;

      // Local 4x4 matrix
      const localMatrix = AssemblyTransformMatrix.fromTranslationAndRotation(localPos, localRot);

      // Composed world 4x4 matrix: M_world = M_parent × M_local
      const worldMatrix = AssemblyTransformMatrix.multiply(parentWorldMatrix, localMatrix);

      // Handedness validation (Real Kinematic Truth)
      if (!AssemblyTransformMatrix.preservesHandedness(worldMatrix)) {
        diagnostics.push(`[SECP_KINEMATIC_ERROR] Reflection/Handedness change detected at occurrence: '${occurrencePath}'`);
      }

      const worldTransform = AssemblyTransformMatrix.decompose(worldMatrix);

      if (!resolver) {
        // No resolver provided: emit unresolved leaf component
        accumulatedComponents.push({
          id: occurrencePath,
          name: `Instance_${inst.instanceId}`,
          partId: inst.documentId,
          instanceId: inst.instanceId,
          documentId: inst.documentId,
          revision: 'REV-A',
          occurrencePath,
          depth: currentDepth,
          position: worldTransform.position,
          rotation: worldTransform.rotation,
          matrix: [...worldMatrix.m],
          colorHex: inst.colorHex || '#94a3b8',
          visible: !isSuppressed,
          suppressed: isSuppressed
        });
        continue;
      }

      // Check if the referenced document exists in active stack (Cycle Detection)
      if (activeStack.includes(inst.documentId)) {
        const cycleStartIndex = activeStack.indexOf(inst.documentId);
        const cyclePath = [...activeStack.slice(cycleStartIndex), inst.documentId].join(' → ');
        const errorMsg = `[SECP_ASSEMBLY_CYCLE_DETECTED] [SECP_DOC_CYCLIC] Cyclic document reference detected: ${cyclePath}`;
        diagnostics.push(errorMsg);

        accumulatedComponents.push({
          id: occurrencePath,
          name: `Instance_${inst.instanceId}`,
          partId: inst.documentId,
          instanceId: inst.instanceId,
          documentId: inst.documentId,
          revision: 'REV-A',
          occurrencePath,
          depth: currentDepth,
          position: worldTransform.position,
          rotation: worldTransform.rotation,
          matrix: [...worldMatrix.m],
          colorHex: inst.colorHex || '#ef4444',
          visible: !isSuppressed,
          suppressed: isSuppressed,
          solid: undefined,
          resolutionStatus: 'CYCLE_ERROR',
          resolutionError: errorMsg
        });
        continue;
      }

      // Lookup child document in resolver
      const childDoc = resolver ? resolver.resolve(inst.documentId, inst.revision) : undefined;

      if (!childDoc) {
        // Truthful Missing Child Defense
        const revisionStr = inst.revision ? `, requested revision: ${inst.revision}` : '';
        const errorMsg = `[SECP_DOC_MISSING] Instance '${inst.instanceId}' (occurrence: '${occurrencePath}') references missing document: '${inst.documentId}'${revisionStr}`;
        diagnostics.push(errorMsg);

        accumulatedComponents.push({
          id: occurrencePath,
          name: `Instance_${inst.instanceId}`,
          partId: inst.documentId,
          instanceId: inst.instanceId,
          documentId: inst.documentId,
          revision: 'REV-A',
          occurrencePath,
          depth: currentDepth,
          position: worldTransform.position,
          rotation: worldTransform.rotation,
          matrix: [...worldMatrix.m],
          colorHex: inst.colorHex || '#ef4444',
          visible: !isSuppressed,
          suppressed: isSuppressed,
          solid: undefined,
          resolutionStatus: 'MISSING',
          resolutionError: errorMsg
        });
        continue;
      }

      // Check if the child document is an ASSEMBLY or a PART
      const isSubAssembly = childDoc.type === 'ASSEMBLY' || (childDoc.assembly && childDoc.assembly.instances && childDoc.assembly.instances.length > 0);

      if (isSubAssembly) {
        // Push child sub-assembly ID to active stack for branch cycle protection
        activeStack.push(inst.documentId);

        // Add sub-assembly instance to components list (PATCH-040)
        accumulatedComponents.push({
          id: occurrencePath,
          name: `AssemblyInstance_${inst.instanceId}`,
          partId: inst.documentId,
          instanceId: inst.instanceId,
          documentId: inst.documentId,
          revision: typeof childDoc.revision === 'number' ? `REV-${String.fromCharCode(64 + childDoc.revision)}` : (childDoc.revision || 'REV-A'),
          occurrencePath,
          depth: currentDepth,
          position: worldTransform.position,
          rotation: worldTransform.rotation,
          matrix: [...worldMatrix.m],
          colorHex: inst.colorHex || '#64748b',
          visible: !isSuppressed,
          suppressed: isSuppressed,
          solid: undefined, // Assemblies don't have their own single solid usually
          resolutionStatus: 'RESOLVED'
        });

        // Evaluate sub-assembly document as a full document to trigger its own PLM projection (PATCH-040)
        // Guard against cycles: only evaluate if childDoc is not already visited in evaluation context
        const visitedSet = options?.context?.visitedDocIds ? new Set(options.context.visitedDocIds) : new Set<string>();
        if (!visitedSet.has(childDoc.documentId)) {
          visitedSet.add(childDoc.documentId);
          activeStack.forEach(id => visitedSet.add(id));
          DocumentEvaluator.evaluate(childDoc, {
            generateMesh: false, // Mesh for sub-assembly not needed here
            context: {
              ...options?.context,
              resolver,
              depth: currentDepth + 1,
              maxDepth,
              visitedDocIds: visitedSet
            }
          });
        }

        // Recursively evaluate sub-assembly node
        this.traverseAssemblyNode(
          childDoc,
          worldMatrix,
          occurrencePath,
          currentDepth + 1,
          isSuppressed,
          activeStack,
          accumulatedComponents,
          accumulatedMates,
          diagnostics,
          resolver,
          maxDepth,
          options
        );

        // Pop from active stack upon exiting branch
        activeStack.pop();
      } else {
        // Leaf PART document evaluation
        diagnostics.push(`[SECP_DOC_RESOLVED] Occurrence '${occurrencePath}' successfully resolved part document: '${inst.documentId}'`);

        // Evaluate child part via DocumentEvaluator
        const childResult = DocumentEvaluator.evaluate(childDoc, {
          generateMesh: options?.generateMesh ?? true,
          generateCFD: options?.generateCFD,
          generateCAM: options?.generateCAM,
          tolerancePolicy: options?.tolerancePolicy,
          context: {
            resolver,
            depth: currentDepth + 1,
            maxDepth
          }
        });

        if (childResult.diagnostics && childResult.diagnostics.length > 0) {
          for (const cd of childResult.diagnostics) {
            diagnostics.push(cd);
          }
        }

        let derivedSolid: CadSolidEntity | undefined = undefined;

        if (!childResult.success) {
          const errorMsg = `[SECP_CHILD_EVAL_FAILED] Occurrence '${occurrencePath}' child document '${inst.documentId}' evaluation failed.`;
          diagnostics.push(errorMsg);

          accumulatedComponents.push({
            id: occurrencePath,
            name: `Instance_${inst.instanceId}`,
            partId: inst.documentId,
            instanceId: inst.instanceId,
            documentId: inst.documentId,
            revision: typeof childDoc.revision === 'number' ? `REV-${String.fromCharCode(64 + childDoc.revision)}` : (childDoc.revision || 'REV-A'),
            occurrencePath,
            depth: currentDepth,
            position: worldTransform.position,
            rotation: worldTransform.rotation,
            matrix: [...worldMatrix.m],
            colorHex: inst.colorHex || '#94a3b8',
            visible: !isSuppressed,
            suppressed: isSuppressed,
            solid: undefined,
            resolutionStatus: 'EVALUATION_ERROR',
            resolutionError: errorMsg
          });
        } else {
          // Derive runtime CadSolidEntity from child evaluatedShape if present
          if (childResult.evaluatedShape) {
            const baseSolid = CadGeometryKernel.deriveCadSolidFromEvaluation(childResult);
            if (baseSolid) {
              // Transform center of gravity by world matrix
              const baseCogMm = {
                x: SECP_UNIT_CONTRACT.metresToMm(baseSolid.centerOfGravity.x),
                y: SECP_UNIT_CONTRACT.metresToMm(baseSolid.centerOfGravity.y),
                z: SECP_UNIT_CONTRACT.metresToMm(baseSolid.centerOfGravity.z)
              };
              const transformedCogMm = AssemblyTransformMatrix.transformPoint(worldMatrix, baseCogMm);

              derivedSolid = {
                ...baseSolid,
                id: `${baseSolid.id}_occ_${occurrencePath.replace(/\//g, '_')}`,
                name: `${baseSolid.name}_${occurrencePath.replace(/\//g, '_')}`,
                position: { ...worldTransform.position },
                rotation: { ...worldTransform.rotation },
                scale: { x: 1, y: 1, z: 1 },
                colorHex: inst.colorHex || baseSolid.colorHex,
                dimensions: {
                  dx: SECP_UNIT_CONTRACT.metresToMm(baseSolid.dimensions.dx),
                  dy: SECP_UNIT_CONTRACT.metresToMm(baseSolid.dimensions.dy),
                  dz: SECP_UNIT_CONTRACT.metresToMm(baseSolid.dimensions.dz)
                },
                volumeM3: baseSolid.volumeM3,
                centerOfGravity: {
                  x: SECP_UNIT_CONTRACT.mmToMetres(transformedCogMm.x),
                  y: SECP_UNIT_CONTRACT.mmToMetres(transformedCogMm.y),
                  z: SECP_UNIT_CONTRACT.mmToMetres(transformedCogMm.z)
                }
              };
            }
          }

          accumulatedComponents.push({
            id: occurrencePath,
            name: `Instance_${inst.instanceId}`,
            partId: inst.documentId,
            instanceId: inst.instanceId,
            documentId: inst.documentId,
            revision: typeof childDoc.revision === 'number' ? `REV-${String.fromCharCode(64 + childDoc.revision)}` : (childDoc.revision || 'REV-A'),
            occurrencePath,
            depth: currentDepth,
            position: worldTransform.position,
            rotation: worldTransform.rotation,
            matrix: [...worldMatrix.m],
            colorHex: inst.colorHex || '#94a3b8',
            visible: !isSuppressed,
            suppressed: isSuppressed,
            solid: derivedSolid,
            resolutionStatus: 'RESOLVED'
          });
        }
      }
    }
  }
}
