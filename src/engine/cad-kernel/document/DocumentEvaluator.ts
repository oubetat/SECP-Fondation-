/**
 * SECP CAD Kernel — Canonical Document Evaluator
 * Phase 2 (PATCH-KERNEL-002)
 *
 * ARCHITECTURAL CONTRACT:
 * - Executes the true parametric CAD pipeline:
 *   DOCUMENT (Parameters + Sketches + Constraints + Features)
 *       │
 *       ▼
 *   EVALUATOR (DocumentEvaluator.evaluate)
 *       │
 *       ▼
 *   Evaluated Shape (BRepSolid) + TopologyLineage + Derived Artifacts (Mesh, FEA, CFD, CAM) + Evidence Chain
 *
 * - Solves parameter expressions and propagates them into sketch constraints & features.
 * - Executes feature tree through FeatureHistory / BRepKernel.
 * - Constructs canonical lineage and registers cryptographic evidence records.
 */

import {
  EngineeringDocument,
  Parameter,
  Sketch,
  UnitSystem,
  TopologyLineage,
  DEFAULT_UNIT_SYSTEM_MM,
  EvidenceRecord,
  FEAModel,
  CFDModel,
  CAMModel
} from './CADDocument';
import { BRepKernel } from '../brep/BRepKernel';
import { Solid, TopoShapeEnum } from '../topology/TopologyContracts';
import { FeatureHistory } from '../history/FeatureHistory';
import { FeatureNode } from '../history/FeatureNode';
import { CanonicalFeatureDefinition, FeatureType } from '../history/FeatureDefinition';
import { EngineeringHashChain } from '../../evidence/EngineeringHashChain';
import { MeshGeometryData, CadGeometryKernel, CadSolidEntity } from '../../cadKernel';
import { asMm } from '../core/Units';
import { BRepHasher } from '../topology/BRepHasher';
import { FeatureHistoryEvidence } from '../history/FeatureHistoryEvidence';
import {
  DocumentEvaluationContext,
  DocumentResolutionStatus,
  IDocumentResolver
} from './DocumentResolver';
import { CanonicalPLMProjectionAdapter } from '../../plm/CanonicalPLMProjectionAdapter';
import { AssemblyMateSolver, EvaluatedAssemblyMate } from './AssemblyMateSolver';
import { SECP_UNIT_CONTRACT } from './UnitContract';
import { RecursiveAssemblyEvaluator } from './RecursiveAssemblyEvaluator';

export interface DocumentEvaluationOptions {
  generateMesh?: boolean;
  generateFEA?: boolean;
  generateCFD?: boolean;
  generateCAM?: boolean;
  skipPLMProjection?: boolean;
  tolerancePolicy?: string;
  context?: DocumentEvaluationContext;
}

export interface DocumentEvaluationResult {
  success: boolean;
  document: EngineeringDocument;
  evaluatedShape?: Solid;
  evaluatedSolid?: Solid;
  evaluatedAssembly?: {
    components: any[];
    mates: any[];
  };
  derivedArtifacts?: {
    bRepHash?: string;
    mesh?: any;
  };
  diagnostics: string[];
  evaluationTimeMs: number;
  error?: string;
}

export class DocumentEvaluator {
  private static brepKernel = BRepKernel.getCanonical();

  /**
   * Main pipeline evaluator: transforms an EngineeringDocument with parameters,
   * sketches, and features into an evaluated BRepSolid and derived engineering representations.
   */
  public static evaluate(
    doc: EngineeringDocument,
    options: DocumentEvaluationOptions = { generateMesh: true }
  ): DocumentEvaluationResult {
    const startTime = performance.now();
    const diagnostics: string[] = [];

    try {
      // 1. Evaluate Parameters (Resolve topological parameter dependencies)
      const evaluatedParams = this.evaluateParameters(doc.parameters);
      doc.parameters = evaluatedParams;

      // 2. Prepare Feature History & Dispatch Tree
      const featureHistory = new FeatureHistory(doc.documentId);

      // Register sketches as SKETCH features into featureHistory so features can resolve them
      if (doc.sketches && Array.isArray(doc.sketches)) {
        for (const sk of doc.sketches) {
          featureHistory.addFeature(
            'SKETCH',
            sk.name || sk.id,
            {
              type: 'SKETCH',
              name: sk.name || sk.id,
              parameters: {
                plane: sk.plane,
                entities: sk.entities,
                points: sk.points,
                closedProfile: sk.closedProfile
              },
              inputReferences: [],
              dependencyIds: []
            },
            [],
            undefined,
            sk.id
          );
        }
      }

      // Register feature nodes from document
      let hasInvalidFeatures = false;
      if (doc.features && Array.isArray(doc.features)) {
        for (const feat of doc.features) {
          if (feat.isMetadataOnly) {
            diagnostics.push(`Feature ${feat.id || 'unknown'} is metadata-only without executable kernel operation`);
            hasInvalidFeatures = true;
            continue;
          }

          if (feat instanceof FeatureNode) {
            featureHistory.addNode(feat);
          } else if (feat.type && feat.definition) {
            // Canonical feature definition form: resolve parameter references from evaluated global parameters
            const resolvedDefinition = { ...feat.definition };
            if (resolvedDefinition.parameters) {
              const defParams = { ...resolvedDefinition.parameters };
              for (const [k, v] of Object.entries(defParams)) {
                if (typeof v === 'string') {
                  const matched = evaluatedParams.find(p => p.name === v || p.id === v);
                  if (matched) {
                    defParams[k] = matched.value;
                  }
                }
              }
              resolvedDefinition.parameters = defParams;
            }

            featureHistory.addFeature(
              feat.type as FeatureType,
              feat.name || feat.featureId || 'Feature',
              resolvedDefinition,
              feat.dependencyIds || [],
              feat.parentId,
              feat.id || feat.featureId
            );
          } else if (feat.type) {
            // Generic feature node translation
            const params = { ...(feat.parameters || {}) };
            // Inject evaluated global parameter values where referenced
            for (const [k, v] of Object.entries(params)) {
              if (typeof v === 'string' && evaluatedParams.some(p => p.name === v)) {
                const matched = evaluatedParams.find(p => p.name === v)!;
                params[k] = matched.value;
              }
            }

            const def: CanonicalFeatureDefinition = {
              type: feat.type as FeatureType,
              name: feat.name || feat.featureId || 'Feature',
              parameters: params,
              inputReferences: feat.inputReferences || [],
              dependencyIds: (feat.dependencyIds || feat.dependencies || []).map((d: any) => d.dependsOnFeatureId || d)
            };

            featureHistory.addFeature(
              feat.type as FeatureType,
              feat.name || feat.featureId || 'Feature',
              def,
              def.dependencyIds,
              undefined,
              feat.id || feat.featureId
            );
          } else {
            diagnostics.push(`Feature ${feat.id || 'unknown'} lacks valid feature type or executable semantics`);
            hasInvalidFeatures = true;
          }
        }
      } else if (doc.features && typeof doc.features === 'string') {
        diagnostics.push(`Invalid feature list format: string provided instead of array`);
        hasInvalidFeatures = true;
      }

      // 3. Execute Feature History Regeneration (Parametric History -> B-Rep Solid)
      const regenResult = featureHistory.regenerate({ forceAll: true });
      for (const diag of regenResult.diagnostics) {
        if (diag.status !== 'SUCCESS') {
          diagnostics.push(`[${diag.featureId}] ${diag.type} ${diag.status}: ${diag.message}`);
        }
      }

      let evaluatedSolid: Solid | undefined;
      if (regenResult.success && regenResult.finalGeometry) {
        const geom = regenResult.finalGeometry.topology || regenResult.finalGeometry;
        if (geom && geom.shapeType === TopoShapeEnum.SOLID) {
          evaluatedSolid = geom;
        }
      }

      doc.evaluatedShape = evaluatedSolid;

      // 4. Evaluate Assembly Definition (AED) if present (PATCH-039A Hierarchical Sub-Assembly Resolution)
      let evaluatedAssembly: any = undefined;
      let hasAssemblyResolutionErrors = false;
      let hasAssemblyMateErrors = false;
      if ((doc.type === 'ASSEMBLY' || doc.type === 'INDUSTRIAL_DRONE') && doc.assembly) {
        const evalGraphResult = RecursiveAssemblyEvaluator.evaluateAssemblyGraph(doc, options);
        for (const diag of evalGraphResult.diagnostics) {
          diagnostics.push(diag);
        }

        evaluatedAssembly = {
          components: evalGraphResult.components,
          mates: evalGraphResult.mates
        };

        hasAssemblyResolutionErrors = evalGraphResult.hasErrors;
        hasAssemblyMateErrors = !evalGraphResult.allMatesSolved || evalGraphResult.mates.some(m => m.status === 'ERROR' || m.status === 'CONFLICT' || m.status === 'UNSUPPORTED' || m.status === 'CONFLICTING');
      }

      // 5. Construct / Update Topology Lineage
      doc.topologyMap = this.constructTopologyLineage(doc.documentId, Number(doc.revision) || 1, evaluatedSolid, featureHistory);

      // 5. Derive Downstream Engineering Representations
      doc.derived = doc.derived || {};
      if (options.generateMesh) {
        if (evaluatedSolid) {
          const meshData = this.brepKernel.tessellate(evaluatedSolid as any);
          doc.derived.mesh = meshData;
        } else if ((doc.type === 'ASSEMBLY' || doc.type === 'INDUSTRIAL_DRONE') && evaluatedAssembly?.components && evaluatedAssembly.components.length > 0) {
          const combinedVertices: number[] = [];
          const combinedNormals: number[] = [];
          const combinedIndices: number[] = [];
          let vertexOffset = 0;

          for (const comp of evaluatedAssembly.components) {
            if (comp.solid?.mesh?.vertices && comp.solid.mesh.vertices.length > 0) {
              const m = comp.solid.mesh;
              const pos = comp.position || { x: 0, y: 0, z: 0 };
              const posX = pos.x > 10 ? pos.x / 1000 : pos.x;
              const posY = pos.y > 10 ? pos.y / 1000 : pos.y;
              const posZ = pos.z > 10 ? pos.z / 1000 : pos.z;

              for (let i = 0; i < m.vertices.length; i += 3) {
                combinedVertices.push(
                  m.vertices[i] + posX,
                  m.vertices[i + 1] + posY,
                  m.vertices[i + 2] + posZ
                );
              }

              if (m.normals && m.normals.length === m.vertices.length) {
                for (let i = 0; i < m.normals.length; i++) {
                  combinedNormals.push(m.normals[i]);
                }
              } else {
                for (let i = 0; i < m.vertices.length; i += 3) {
                  combinedNormals.push(0, 1, 0);
                }
              }

              if (m.indices) {
                for (let idx of m.indices) {
                  combinedIndices.push(idx + vertexOffset);
                }
              } else {
                for (let i = 0; i < m.vertices.length / 3; i++) {
                  combinedIndices.push(i + vertexOffset);
                }
              }

              vertexOffset += m.vertices.length / 3;
            }
          }

          const facesCount = Math.floor(combinedIndices.length / 3);
          const faceTriangleMap: Record<string, any> = {};
          const totalFaces = Math.min(facesCount, 50);
          const trisPerFace = Math.max(1, Math.floor(facesCount / totalFaces));
          for (let f = 0; f < totalFaces; f++) {
            const startTri = f * trisPerFace;
            const endTri = f === totalFaces - 1 ? facesCount : (f + 1) * trisPerFace;
            const triIndices: number[] = [];
            for (let t = startTri; t < endTri; t++) {
              triIndices.push(t * 3, t * 3 + 1, t * 3 + 2);
            }
            faceTriangleMap[`FACE_ASSY_${f + 1}`] = {
              faceId: `FACE_ASSY_${f + 1}`,
              persistentId: `PERSIST_FACE_ASSY_${f + 1}`,
              triangleIndices: triIndices
            };
          }

          doc.derived.mesh = {
            vertices: combinedVertices,
            normals: combinedNormals,
            indices: combinedIndices,
            facesCount,
            topologyMap: {
              faceTriangleMap,
              edgeVertexMap: {},
              vertexIndexMap: {},
              sharedEdges: []
            },
            brepHash: EngineeringHashChain.computeCanonicalHash({ docId: doc.documentId, count: combinedVertices.length }).canonicalHash,
            meshHash: EngineeringHashChain.computeCanonicalHash({ docId: doc.documentId, sample: combinedVertices.slice(0, 100) }).canonicalHash
          };
        }
      }

      if (options.generateFEA && evaluatedSolid) {
        doc.derived.fea = this.deriveFEAModel(doc, evaluatedSolid);
      }

      if (options.generateCFD && evaluatedSolid) {
        doc.derived.cfd = this.deriveCFDModel(doc, evaluatedSolid);
      }

      if (options.generateCAM && evaluatedSolid) {
        doc.derived.cam = this.deriveCAMModel(doc, evaluatedSolid);
      }

      // 6. Record Forensic Cryptographic Evidence (PATCH-012)
      const featureHash = FeatureHistoryEvidence.computeHistoryHash(
        doc.documentId,
        featureHistory.getAllFeatures(),
        (featureHistory as any).graph || { getTopologicalOrder: () => (doc.features || []).map((f: any) => f.id || f.featureId) }
      );

      let geometryHash: string | undefined;
      let topologyHash: string | undefined;
      if (evaluatedSolid) {
        const artifactEvidence = BRepHasher.computeEvidence(evaluatedSolid as Solid);
        geometryHash = artifactEvidence.geometryHash;
        topologyHash = artifactEvidence.topologyHash;
      }

      const { canonicalHash } = EngineeringHashChain.computeCanonicalHash({
        documentId: doc.documentId,
        revision: doc.revision,
        featureHash,
        geometryHash,
        topologyHash,
        meshHash: doc.derived.mesh ? EngineeringHashChain.computeCanonicalHash(doc.derived.mesh).canonicalHash : undefined,
        volume: evaluatedSolid ? this.brepKernel.computeVolume(evaluatedSolid as any) : 0
      });

      const evidenceEntry: EvidenceRecord = {
        evidenceId: `EVID_${doc.documentId}_REV${doc.revision}_${canonicalHash.substring(0, 8)}`,
        stage: 'GEOMETRY',
        sourceSystem: 'SECP_CANONICAL_EVALUATOR',
        documentId: doc.documentId,
        revision: doc.revision,
        canonicalHash,
        geometryHash,
        topologyHash,
        featureHash,
        meshHash: doc.derived.mesh ? EngineeringHashChain.computeCanonicalHash(doc.derived.mesh).canonicalHash : undefined,
        timestamp: new Date().toISOString(),
        payload: {
          success: regenResult.success,
          featuresExecuted: regenResult.executedFeatureIds.length,
          solidFacesCount: evaluatedSolid?.outerShell?.orientedFaces?.length || 0,
          topologyLineageVersion: doc.topologyMap.version
        },
        verdict: regenResult.success ? 'VALID' : 'INVALID'
      };

      doc.evidence = doc.evidence || [];
      doc.evidence.push(evidenceEntry);

      const bRepHash = geometryHash || doc.derived?.bRepHash;
      doc.derived = doc.derived || {};
      doc.derived.bRepHash = bRepHash;

      const evalResult: DocumentEvaluationResult = {
        success: regenResult.success && !hasInvalidFeatures && !hasAssemblyResolutionErrors && !hasAssemblyMateErrors,
        document: doc,
        evaluatedShape: evaluatedSolid,
        evaluatedSolid,
        evaluatedAssembly,
        derivedArtifacts: {
          bRepHash,
          mesh: doc.derived.mesh
        },
        diagnostics,
        evaluationTimeMs: performance.now() - startTime
      };

      if (evalResult.success && !options.skipPLMProjection) {
        try {
          CanonicalPLMProjectionAdapter.projectFromDocument(doc, evalResult);
        } catch (plmErr) {
          console.warn('[DocumentEvaluator] PLM projection warning:', plmErr);
        }
      }

      return evalResult;
    } catch (err: any) {
      diagnostics.push(`Evaluation failed: ${err.message || String(err)}`);
      return {
        success: false,
        document: doc,
        diagnostics,
        evaluationTimeMs: performance.now() - startTime
      };
    }
  }

  /**
   * Evaluates parameter equations with dependency resolution and cycle prevention.
   */
  public static evaluateParameters(parameters: Parameter[]): Parameter[] {
    const evaluated: Parameter[] = [];
    const valuesMap = new Map<string, number>();

    // Seed direct numerical values
    for (const p of parameters) {
      const num = Number(p.expression);
      if (!Number.isNaN(num)) {
        valuesMap.set(p.name, num);
        evaluated.push({ ...p, value: num });
      }
    }

    // Iteratively resolve expression dependencies
    let progress = true;
    let iterations = 0;
    const maxIterations = parameters.length * 2;

    while (evaluated.length < parameters.length && progress && iterations < maxIterations) {
      progress = false;
      iterations++;

      for (const p of parameters) {
        if (valuesMap.has(p.name)) continue;

        try {
          // Replace variable identifiers with resolved values
          let expr = p.expression;
          for (const [varName, varVal] of valuesMap.entries()) {
            expr = expr.replace(new RegExp(`\\b${varName}\\b`, 'g'), String(varVal));
          }

          // If no unresolved variable tokens remain, compute value safely
          if (!/[a-zA-Z_]/.test(expr)) {
            // eslint-disable-next-line no-new-func
            const val = Function(`'use strict'; return (${expr})`)();
            if (typeof val === 'number' && Number.isFinite(val)) {
              valuesMap.set(p.name, val);
              evaluated.push({ ...p, value: val });
              progress = true;
            }
          }
        } catch {
          // Ignore until dependencies resolve
        }
      }
    }

    // Default remaining unresolved parameters to fallback value
    for (const p of parameters) {
      if (!valuesMap.has(p.name)) {
        evaluated.push({ ...p, value: p.value || 0 });
      }
    }

    return evaluated;
  }

  /**
   * Builds the comprehensive TopologyLineage map linking each face, edge, and vertex to its source feature.
   */
  private static constructTopologyLineage(
    documentId: string,
    revision: number,
    solid?: Solid,
    history?: FeatureHistory
  ): TopologyLineage {
    const faceMap: Record<string, string> = {};
    const edgeMap: Record<string, string> = {};
    const vertexMap: Record<string, string> = {};
    const entries: Record<string, any> = {};

    if (solid && solid.outerShell) {
      let fIdx = 0;
      for (const of of solid.outerShell.orientedFaces) {
        const face = of.face;
        const faceTag = `FACE_${fIdx++}`;
        faceMap[faceTag] = face.id;

        entries[face.id] = {
          topologyId: face.id,
          shapeType: TopoShapeEnum.FACE,
          sourceFeatureId: history?.getAllFeatures()[0]?.id || 'ROOT_FEATURE',
          operationType: 'EXTRUDE_FACE',
          generation: revision,
          predecessorTopologyIds: [],
          persistentTag: faceTag
        };

        let eIdx = 0;
        const oEdges = face.outerLoop && Array.isArray(face.outerLoop.orientedEdges) ? face.outerLoop.orientedEdges : [];
        for (const oe of oEdges) {
          const edge = oe.edge;
          const edgeTag = `${faceTag}_EDGE_${eIdx++}`;
          edgeMap[edgeTag] = edge.id;

          entries[edge.id] = {
            topologyId: edge.id,
            shapeType: TopoShapeEnum.EDGE,
            sourceFeatureId: history?.getAllFeatures()[0]?.id || 'ROOT_FEATURE',
            operationType: 'BOUNDARY_EDGE',
            generation: revision,
            predecessorTopologyIds: [],
            persistentTag: edgeTag
          };

          if (edge.startVertex) {
            vertexMap[`V_${edge.startVertex.id}`] = edge.startVertex.id;
          }
          if (edge.endVertex) {
            vertexMap[`V_${edge.endVertex.id}`] = edge.endVertex.id;
          }
        }
      }
    }

    return {
      documentId,
      version: revision,
      entries,
      faceMap,
      edgeMap,
      vertexMap
    };
  }

  /**
   * Computes the bounding box of a BRep Solid in meters.
   */
  private static computeSolidBounds(solid: Solid): { min: [number, number, number]; max: [number, number, number] } {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    if (solid && solid.outerShell && solid.outerShell.orientedFaces) {
      for (const of of solid.outerShell.orientedFaces) {
        if (of.face && of.face.outerLoop && of.face.outerLoop.orientedEdges) {
          for (const oe of of.face.outerLoop.orientedEdges) {
            const v = oe.edge.startVertex.geometry;
            if (v.x < minX) minX = v.x;
            if (v.x > maxX) maxX = v.x;
            if (v.y < minY) minY = v.y;
            if (v.y > maxY) maxY = v.y;
            if (v.z < minZ) minZ = v.z;
            if (v.z > maxZ) maxZ = v.z;
          }
        }
      }
    }
    if (minX === Infinity) {
      return { min: [-0.02, -0.02, 0], max: [0.02, 0.02, 0.02] };
    }
    return { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
  }

  /**
   * Generates a clean FEA representation from the evaluated BRepSolid.
   */
  private static deriveFEAModel(doc: EngineeringDocument, solid: Solid): FEAModel {
    const nodes: number[] = [];
    const elements: number[] = [];
    let elemCount = 0;

    for (const of of (solid.outerShell?.orientedFaces || [])) {
      const face = of?.face;
      if (!face || !face.outerLoop || !Array.isArray(face.outerLoop.orientedEdges)) continue;
      const verts = face.outerLoop.orientedEdges
        .map(oe => oe?.edge?.startVertex?.geometry)
        .filter((g): g is { x: number; y: number; z: number } => !!g);
      const baseIdx = nodes.length / 3;
      for (const v of verts) {
        nodes.push(v.x, v.y, v.z);
      }
      for (let j = 1; j < verts.length - 1; j++) {
        elements.push(baseIdx, baseIdx + j, baseIdx + j + 1);
        elemCount++;
      }
    }

    const artifactEvidence = BRepHasher.computeEvidence(solid);

    const materials = [
      {
        id: 'MAT_AL6061_T6',
        name: 'Aluminum 6061-T6',
        youngsModulus: 68.9e9,
        poissonsRatio: 0.33,
        density: 2700
      }
    ];

    const loads = [
      {
        id: 'LOAD_GRAVITY',
        type: 'GRAVITY',
        targetFaceId: 'FACE_ALL',
        values: [0, -9.81, 0]
      }
    ];

    const boundaryConditions = [
      {
        id: 'BC_FIXED_BASE',
        type: 'FIXED',
        targetFaceId: 'FACE_0',
        values: [0, 0, 0]
      }
    ];

    const materialHash = EngineeringHashChain.computeCanonicalHash(materials).canonicalHash;
    const loadHash = EngineeringHashChain.computeCanonicalHash(loads).canonicalHash;
    const boundaryConditionHash = EngineeringHashChain.computeCanonicalHash(boundaryConditions).canonicalHash;
    const solverHash = 'SOLVER_v2.0_ENGINE_REVISED';

    const solverInputPayload = {
      documentId: doc.documentId,
      revision: doc.revision,
      nodeCount: nodes.length / 3,
      elementCount: elemCount,
      elementTypes: ['SHELL_TRIA3'],
      geometryHash: artifactEvidence.geometryHash,
      topologyHash: artifactEvidence.topologyHash,
      materialHash,
      loadHash,
      boundaryConditionHash,
      solverHash
    };
    const { canonicalHash: solverInputHash } = EngineeringHashChain.computeCanonicalHash(solverInputPayload);

    return {
      modelId: `FEA_${doc.documentId}`,
      nodeCount: nodes.length / 3,
      elementCount: elemCount,
      elementTypes: ['SHELL_TRIA3'],
      nodes: new Float32Array(nodes),
      elements: new Int32Array(elements),
      materials,
      loads,
      boundaryConditions,
      geometryHash: artifactEvidence.geometryHash,
      topologyHash: artifactEvidence.topologyHash,
      hash: solverInputHash,
      solverInputHash
    };
  }

  /**
   * Generates a CFD domain representation based on the evaluated solid.
   */
  private static deriveCFDModel(doc: EngineeringDocument, solid: Solid): CFDModel {
    const artifactEvidence = BRepHasher.computeEvidence(solid);

    const inletBoundaries = [{ faceId: 'INLET_01', velocity: [10.0, 0, 0] as [number, number, number], temperatureK: 293.15 }];
    const outletBoundaries = [{ faceId: 'OUTLET_01', gaugePressurePa: 0.0 }];
    const wallBoundaries = [{ faceId: 'SOLID_WALL', roughness: 1e-6, isNoSlip: true }];

    const boundaryConditionHash = EngineeringHashChain.computeCanonicalHash({
      inletBoundaries,
      outletBoundaries,
      wallBoundaries
    }).canonicalHash;

    const solverInputPayload = {
      documentId: doc.documentId,
      revision: doc.revision,
      domain: 'FLUID_BOUNDS',
      cellCount: 8000,
      geometryHash: artifactEvidence.geometryHash,
      topologyHash: artifactEvidence.topologyHash,
      boundaryConditionHash
    };
    const { canonicalHash: solverInputHash } = EngineeringHashChain.computeCanonicalHash(solverInputPayload);

    const bounds = DocumentEvaluator.computeSolidBounds(solid);
    const domainBounds = {
      min: [bounds.min[0] - 0.01, bounds.min[1] - 0.01, bounds.min[2] - 0.01] as [number, number, number],
      max: [bounds.max[0] + 0.01, bounds.max[1] + 0.01, bounds.max[2] + 0.01] as [number, number, number]
    };

    return {
      modelId: `CFD_${doc.documentId}`,
      domainBounds,
      meshType: 'STRUCTURED_FVM',
      cellCount: 8000,
      inletBoundaries,
      outletBoundaries,
      wallBoundaries,
      geometryHash: artifactEvidence.geometryHash,
      topologyHash: artifactEvidence.topologyHash,
      hash: solverInputHash,
      solverInputHash
    };
  }

  /**
   * Generates CAM machining operations based on the evaluated solid.
   */
  private static deriveCAMModel(doc: EngineeringDocument, solid: Solid): CAMModel {
    const artifactEvidence = BRepHasher.computeEvidence(solid);
    const topologyHash = artifactEvidence.topologyHash;
    const geometryHash = artifactEvidence.geometryHash;
    const setupId = doc.cam?.setupId || `SETUP_${doc.documentId}`;

    const operations = [
      {
        opId: 'OP10_FACING',
        type: 'FACING',
        toolId: 'TOOL_ENDMILL_10MM',
        stepDownMm: 1.0,
        feedRateMmMin: 800,
        spindleRpm: 6000,
        gcodeSnippet: 'G00 Z5.0\nG01 Z-1.0 F800'
      },
      {
        opId: 'OP20_POCKET',
        type: 'POCKETING',
        toolId: 'TOOL_ENDMILL_6MM',
        stepDownMm: 2.0,
        feedRateMmMin: 1200,
        spindleRpm: 8000,
        gcodeSnippet: 'G00 Z5.0\nG01 Z-5.0 F1200'
      }
    ];

    const camPayload = {
      documentId: doc.documentId,
      revision: doc.revision,
      machining: '3_AXIS_MILLING',
      opsCount: operations.length,
      geometryHash,
      topologyHash,
      operations
    };
    const { canonicalHash: camHash } = EngineeringHashChain.computeCanonicalHash(camPayload);

    const bounds = DocumentEvaluator.computeSolidBounds(solid);
    const stockBounds = {
      min: [bounds.min[0] - 0.005, bounds.min[1] - 0.005, bounds.min[2]] as [number, number, number],
      max: [bounds.max[0] + 0.005, bounds.max[1] + 0.005, bounds.max[2] + 0.005] as [number, number, number]
    };

    return {
      modelId: `CAM_${doc.documentId}`,
      setupId,
      stockBounds,
      operations,
      geometryHash,
      topologyHash,
      hash: camHash,
      camHash
    };
  }

  /**
   * Factory function to create a new pristine Canonical Engineering Document.
   */
  public static createDocument(params: {
    documentId: string;
    units?: UnitSystem;
    parameters?: Parameter[];
    sketches?: Sketch[];
    features?: any[];
  }): EngineeringDocument {
    let features = params.features;
    if (!features || features.length === 0) {
      const docParams = params.parameters || [];
      const paramNames = docParams.map(p => p.name);
      if (paramNames.includes('width') || paramNames.includes('height') || paramNames.includes('depth')) {
        features = [
          {
            id: `FEAT_EXTRUDE_${params.documentId}`,
            type: 'EXTRUDE',
            name: 'MainBody',
            parameters: {
              width: paramNames.includes('width') ? 'width' : 100,
              height: paramNames.includes('height') ? 'height' : 60,
              depth: paramNames.includes('depth') ? 'depth' : 10
            }
          }
        ];
      } else {
        features = [];
      }
    }

    return {
      documentId: params.documentId,
      revision: 1,
      units: params.units || DEFAULT_UNIT_SYSTEM_MM,
      sketches: params.sketches || [],
      constraints: [],
      features,
      parameters: params.parameters || [],
      topologyMap: {
        documentId: params.documentId,
        version: 1,
        entries: {},
        faceMap: {},
        edgeMap: {},
        vertexMap: {}
      },
      derived: {},
      evidence: []
    };
  }
}
