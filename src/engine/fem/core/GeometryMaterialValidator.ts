/**
 * SECP Industrial OS — Programmable Material Engineering (SECP-PROGRAMMABLE-MATERIAL-V4)
 * GeometryMaterialValidator.ts
 * 
 * Production-grade validation pipeline for Geometry-Bound Material Assignments.
 * Enforces revision consistency, domain coverage, coordinate frame validity,
 * and fail-closed gatekeeping prior to FEM solution.
 */

import { FEMModel } from "./FEMTypes";
import {
  CoordinateFrameTransformEngine,
  GeometryDomainAuditor,
  GeometryMaterialAssignment
} from "./GeometryMaterialAssignment";

export interface AssignmentValidationResult {
  ok: boolean;
  assignmentId: string;
  state: GeometryMaterialAssignment["state"];
  error?: string;
  diagnostics?: {
    geometryMatched: boolean;
    revisionMatched: boolean;
    materialMatched: boolean;
    domainCoverageOk: boolean;
    meshBoundingBoxLocal?: any;
    fieldDomain?: any;
  };
}

export class GeometryMaterialValidator {
  private static SUPPORTED_SPATIAL_FORMULATIONS = new Set(["BAR_1D", "TET4_3D"]);

  /**
   * Validates a single GeometryMaterialAssignment against the model, geometry metadata,
   * mesh elements, and spatial material fields.
   */
  public static validateAssignment(
    assignment: GeometryMaterialAssignment,
    model: FEMModel
  ): AssignmentValidationResult {
    // 1. Mandatory Identity Checks
    if (!assignment.assignmentId || assignment.assignmentId.trim() === "") {
      assignment.state = "REJECTED";
      assignment.rejectionReason = "Assignment ID cannot be empty";
      return { ok: false, assignmentId: assignment.assignmentId, state: "REJECTED", error: assignment.rejectionReason };
    }

    if (!assignment.canonicalGeometryId || assignment.canonicalGeometryId.trim() === "") {
      assignment.state = "REJECTED";
      assignment.rejectionReason = "Canonical Geometry ID is required for geometry-bound material assignment";
      return { ok: false, assignmentId: assignment.assignmentId, state: "REJECTED", error: assignment.rejectionReason };
    }

    if (!assignment.geometryRevisionId || assignment.geometryRevisionId.trim() === "") {
      assignment.state = "REJECTED";
      assignment.rejectionReason = "Geometry Revision ID is required";
      return { ok: false, assignmentId: assignment.assignmentId, state: "REJECTED", error: assignment.rejectionReason };
    }

    // 2. Geometry Metadata & Revision Consistency (if declared on model)
    if (model.geometryMetadata) {
      if (model.geometryMetadata.geometryId !== assignment.canonicalGeometryId) {
        assignment.state = "REJECTED";
        assignment.rejectionReason = `[GEOMETRY_MISMATCH] Model geometry '${model.geometryMetadata.geometryId}' does not match assignment geometry '${assignment.canonicalGeometryId}'.`;
        return { ok: false, assignmentId: assignment.assignmentId, state: "REJECTED", error: assignment.rejectionReason };
      }
      if (model.geometryMetadata.geometryRevision !== assignment.geometryRevisionId) {
        assignment.state = "REJECTED";
        assignment.rejectionReason = `[GEOMETRY_REVISION_MISMATCH] Model geometry revision '${model.geometryMetadata.geometryRevision}' does not match assignment revision '${assignment.geometryRevisionId}'.`;
        return { ok: false, assignmentId: assignment.assignmentId, state: "REJECTED", error: assignment.rejectionReason };
      }
    }

    // 3. Material Existence Check
    const baseMaterial = model.materials.get(assignment.materialId);
    if (!baseMaterial) {
      assignment.state = "REJECTED";
      assignment.rejectionReason = `[MATERIAL_NOT_FOUND] Material '${assignment.materialId}' not defined in model materials.`;
      return { ok: false, assignmentId: assignment.assignmentId, state: "REJECTED", error: assignment.rejectionReason };
    }

    // Passed basic reference checks -> VALIDATED
    assignment.state = "VALIDATED";

    // Passed geometry binding -> BOUND_TO_GEOMETRY
    assignment.state = "BOUND_TO_GEOMETRY";

    // 4. Spatial Field Validation (if assigned)
    if (assignment.spatialFieldId) {
      if (!model.spatialMaterialFields || !model.spatialMaterialFields.has(assignment.spatialFieldId)) {
        assignment.state = "REJECTED";
        assignment.rejectionReason = `[SPATIAL_FIELD_NOT_FOUND] Spatial material field '${assignment.spatialFieldId}' not found in model.`;
        return { ok: false, assignmentId: assignment.assignmentId, state: "REJECTED", error: assignment.rejectionReason };
      }

      const field = model.spatialMaterialFields.get(assignment.spatialFieldId)!;

      // Check field base material matches assignment material
      if (field.baseMaterialId && field.baseMaterialId !== assignment.materialId) {
        assignment.state = "REJECTED";
        assignment.rejectionReason = `[SPATIAL_FIELD_MATERIAL_MISMATCH] Field base material '${field.baseMaterialId}' does not match assignment material '${assignment.materialId}'.`;
        return { ok: false, assignmentId: assignment.assignmentId, state: "REJECTED", error: assignment.rejectionReason };
      }

      // Check field geometry matches assignment geometry
      if (field.canonicalGeometryId && field.canonicalGeometryId !== assignment.canonicalGeometryId) {
        assignment.state = "REJECTED";
        assignment.rejectionReason = `[FIELD_GEOMETRY_MISMATCH] Field canonical geometry '${field.canonicalGeometryId}' does not match assignment geometry '${assignment.canonicalGeometryId}'.`;
        return { ok: false, assignmentId: assignment.assignmentId, state: "REJECTED", error: assignment.rejectionReason };
      }

      // Check field revision matches assignment geometry revision
      if (field.canonicalRevisionId && field.canonicalRevisionId !== assignment.geometryRevisionId) {
        assignment.state = "REJECTED";
        assignment.rejectionReason = `[FIELD_REVISION_MISMATCH] Field revision '${field.canonicalRevisionId}' does not match assignment geometry revision '${assignment.geometryRevisionId}'.`;
        return { ok: false, assignmentId: assignment.assignmentId, state: "REJECTED", error: assignment.rejectionReason };
      }

      // 5. Mesh Domain Coverage Audit
      // Identify elements bound to this assignment
      const boundElems: string[] = assignment.boundElementIds || [];
      if (boundElems.length === 0) {
        // Collect all elements referencing this spatial field or material
        for (const [elemId, elem] of model.elements.entries()) {
          if (elem.spatialFieldId === assignment.spatialFieldId || elem.materialId === assignment.materialId) {
            boundElems.push(elemId);
          }
        }
      }

      if (boundElems.length > 0) {
        // Verify formulations are supported
        for (const elemId of boundElems) {
          const elem = model.elements.get(elemId);
          if (elem) {
            if (!this.SUPPORTED_SPATIAL_FORMULATIONS.has(elem.formulationId)) {
              assignment.state = "REJECTED";
              assignment.rejectionReason = `[UNSUPPORTED_FORMULATION_SPATIAL_FIELD] Formulation '${elem.formulationId}' on element '${elemId}' does not support spatial material mapping.`;
              return { ok: false, assignmentId: assignment.assignmentId, state: "REJECTED", error: assignment.rejectionReason };
            }
          }
        }

        // Compute element node bounding box in local coordinate frame
        const localNodes = new Map<string, any>();
        for (const elemId of boundElems) {
          const elem = model.elements.get(elemId);
          if (elem) {
            for (const nid of elem.nodeIds) {
              const node = model.nodes.get(nid);
              if (node && !localNodes.has(nid)) {
                const pLocal = CoordinateFrameTransformEngine.toLocal(
                  { x: node.x, y: node.y, z: node.z },
                  assignment.coordinateFrame
                );
                localNodes.set(nid, { nodeId: nid, ...pLocal });
              }
            }
          }
        }

        const meshBBoxLocal = GeometryDomainAuditor.computeBoundingBox(localNodes);

        if (field.domain) {
          const isCovered = GeometryDomainAuditor.isContained(meshBBoxLocal, field.domain);
          if (!isCovered && assignment.coveragePolicy === "FULL_COVERAGE_MANDATORY") {
            assignment.state = "REJECTED";
            assignment.rejectionReason = `[GEOMETRY_COVERAGE_FAILURE] Mesh bounding box [(${meshBBoxLocal.min.x.toFixed(2)}, ${meshBBoxLocal.min.y.toFixed(2)}, ${meshBBoxLocal.min.z.toFixed(2)}) - (${meshBBoxLocal.max.x.toFixed(2)}, ${meshBBoxLocal.max.y.toFixed(2)}, ${meshBBoxLocal.max.z.toFixed(2)})] exceeds spatial field domain [(${field.domain.min.x}, ${field.domain.min.y}, ${field.domain.min.z}) - (${field.domain.max.x}, ${field.domain.max.y}, ${field.domain.max.z})].`;
            return {
              ok: false,
              assignmentId: assignment.assignmentId,
              state: "REJECTED",
              error: assignment.rejectionReason,
              diagnostics: {
                geometryMatched: true,
                revisionMatched: true,
                materialMatched: true,
                domainCoverageOk: false,
                meshBoundingBoxLocal: meshBBoxLocal,
                fieldDomain: field.domain
              }
            };
          }
        }

        // Passed mesh checks -> BOUND_TO_MESH
        assignment.state = "BOUND_TO_MESH";
      }
    } else {
      // Non-spatial homogeneous assignment
      assignment.state = "BOUND_TO_MESH";
    }

    // Ready for analysis
    assignment.state = "READY_FOR_ANALYSIS";

    return {
      ok: true,
      assignmentId: assignment.assignmentId,
      state: "READY_FOR_ANALYSIS",
      diagnostics: {
        geometryMatched: true,
        revisionMatched: true,
        materialMatched: true,
        domainCoverageOk: true
      }
    };
  }

  /**
   * Pre-flight model gatekeeper: validates all assignments prior to solve.
   * Throws if any assignment is invalid or rejected.
   */
  public static preFlightCheck(model: FEMModel): void {
    if (model.materialAssignments) {
      for (const [assignmentId, assignment] of model.materialAssignments.entries()) {
        const result = this.validateAssignment(assignment, model);
        if (!result.ok) {
          throw new Error(`[MATERIAL_ASSIGNMENT_ERROR] Assignment '${assignmentId}' failed pre-flight gate: ${result.error}`);
        }
      }
    }
  }
}
