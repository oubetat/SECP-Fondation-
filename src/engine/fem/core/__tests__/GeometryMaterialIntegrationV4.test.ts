/**
 * SECP Industrial OS — SECP-PROGRAMMABLE-MATERIAL-V4-001
 * Engineering–Material Integration & Geometry-Bound Spatial Material Assignment
 * Comprehensive Verification, Qualification, Coordinate Invariance & Adversarial Suite.
 */

import { describe, it, expect } from "vitest";
import {
  GeometryMaterialAssignment,
  CoordinateFrameTransformEngine,
  GeometryDomainAuditor,
  AssignmentState
} from "../GeometryMaterialAssignment";
import { GeometryMaterialValidator } from "../GeometryMaterialValidator";
import { SpatialMaterialField } from "../SpatialMaterialField";
import { FEMCore } from "../FEMCore";
import { FEMModel, DOFComponent } from "../FEMTypes";
import { FEMEvidenceEngine } from "../FEMEvidenceEngine";

describe("SECP-PROGRAMMABLE-MATERIAL-V4: Geometry-Bound Spatial Material Engineering", () => {

  // =========================================================================
  // BENCHMARK 01: Lifecycle State Machine Transitions
  // =========================================================================
  describe("V4-BENCH-01: Lifecycle State Machine & Gate Transitions", () => {
    it("progresses monotonically through DECLARED -> VALIDATED -> BOUND_TO_GEOMETRY -> BOUND_TO_MESH -> READY_FOR_ANALYSIS", () => {
      const field = new SpatialMaterialField(
        "FIELD_V4_01",
        "PART_WING_SPAR",
        "REV_2026_A",
        "MAT_TI6AL4V",
        new Map([
          [
            "E",
            {
              propertyName: "E",
              evaluationType: "CONSTANT",
              expression: () => 114000,
              bounds: { lower: 100000, upper: 120000 },
              valueCategory: "TARGET",
              unit: "MPa"
            }
          ]
        ]),
        {
          min: { x: 0, y: -10, z: -10 },
          max: { x: 1000, y: 10, z: 10 }
        }
      );

      const assignment: GeometryMaterialAssignment = {
        assignmentId: "ASGN_01",
        canonicalGeometryId: "PART_WING_SPAR",
        geometryRevisionId: "REV_2026_A",
        materialId: "MAT_TI6AL4V",
        materialRevisionId: "REV_M1",
        spatialFieldId: "FIELD_V4_01",
        coordinateFrame: { frameType: "GLOBAL_CARTESIAN" },
        coveragePolicy: "FULL_COVERAGE_MANDATORY",
        state: "DECLARED"
      };

      const model: FEMModel = {
        geometryMetadata: {
          geometryId: "PART_WING_SPAR",
          geometryRevision: "REV_2026_A"
        },
        nodes: new Map([
          ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
          ["N2", { nodeId: "N2", x: 500, y: 0, z: 0 }],
          ["N3", { nodeId: "N3", x: 1000, y: 0, z: 0 }]
        ]),
        elements: new Map([
          ["E1", { elementId: "E1", nodeIds: ["N1", "N2"], materialId: "MAT_TI6AL4V", sectionId: "S1", formulationId: "BAR_1D", spatialFieldId: "FIELD_V4_01", assignmentId: "ASGN_01" }],
          ["E2", { elementId: "E2", nodeIds: ["N2", "N3"], materialId: "MAT_TI6AL4V", sectionId: "S1", formulationId: "BAR_1D", spatialFieldId: "FIELD_V4_01", assignmentId: "ASGN_01" }]
        ]),
        materials: new Map([["MAT_TI6AL4V", { materialId: "MAT_TI6AL4V", E: 114000, nu: 0.34 }]]),
        sections: new Map([["S1", { sectionId: "S1", area: 50.0 }]]),
        loads: [{ nodeId: "N3", dof: DOFComponent.UX, value: 1000 }],
        boundaryConditions: [{ nodeId: "N1", dof: DOFComponent.UX, value: 0 }],
        spatialMaterialFields: new Map([["FIELD_V4_01", field]]),
        materialAssignments: new Map([["ASGN_01", assignment]])
      };

      const result = GeometryMaterialValidator.validateAssignment(assignment, model);
      expect(result.ok).toBe(true);
      expect(assignment.state).toBe("READY_FOR_ANALYSIS");
      expect(result.diagnostics?.geometryMatched).toBe(true);
      expect(result.diagnostics?.revisionMatched).toBe(true);
      expect(result.diagnostics?.domainCoverageOk).toBe(true);
    });

    it("transitions directly to REJECTED when validation gate fails", () => {
      const assignment: GeometryMaterialAssignment = {
        assignmentId: "ASGN_FAIL",
        canonicalGeometryId: "WRONG_GEOMETRY",
        geometryRevisionId: "REV_A",
        materialId: "MAT_STEEL",
        materialRevisionId: "REV_M1",
        coordinateFrame: { frameType: "GLOBAL_CARTESIAN" },
        coveragePolicy: "FULL_COVERAGE_MANDATORY",
        state: "DECLARED"
      };

      const model: FEMModel = {
        geometryMetadata: {
          geometryId: "CANONICAL_GEOMETRY_01",
          geometryRevision: "REV_A"
        },
        nodes: new Map([["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }]]),
        elements: new Map(),
        materials: new Map([["MAT_STEEL", { materialId: "MAT_STEEL", E: 200000, nu: 0.3 }]]),
        sections: new Map(),
        loads: [],
        boundaryConditions: []
      };

      const result = GeometryMaterialValidator.validateAssignment(assignment, model);
      expect(result.ok).toBe(false);
      expect(assignment.state).toBe("REJECTED");
      expect(assignment.rejectionReason).toContain("[GEOMETRY_MISMATCH]");
    });
  });

  // =========================================================================
  // BENCHMARK 02: Coordinate Frame Transformations & Frame Invariance
  // =========================================================================
  describe("V4-BENCH-02: Coordinate Frame Transformation & Frame Invariance", () => {
    it("transforms global Cartesian coordinates to local part frame with translation and 3D rotation", () => {
      // 90 deg rotation around Z-axis: [x_global, y_global, z_global]
      // R = [ [0, -1, 0], [1, 0, 0], [0, 0, 1] ]
      // Translation position: [100, 50, 25]
      const frame = {
        frameType: "LOCAL_PART_FRAME" as const,
        frameId: "FRAME_WING_ATTACH",
        transform: {
          position: { x: 100, y: 50, z: 25 },
          rotationMatrix: [
            [0, -1, 0],
            [1,  0, 0],
            [0,  0, 1]
          ]
        }
      };

      // Point in local frame: x_local = 20, y_local = 10, z_local = 5
      // Expected global: R * x_local + position:
      // x_global = 0*20 - 1*10 + 0*5 + 100 = 90
      // y_global = 1*20 + 0*10 + 0*5 + 50  = 70
      // z_global = 0*20 + 0*10 + 1*5 + 25  = 30
      const pGlobal = { x: 90, y: 70, z: 30 };

      // Transform to local:
      const pLocal = CoordinateFrameTransformEngine.toLocal(pGlobal, frame);
      expect(pLocal.x).toBeCloseTo(20.0, 10);
      expect(pLocal.y).toBeCloseTo(10.0, 10);
      expect(pLocal.z).toBeCloseTo(5.0, 10);

      // Invert back to global:
      const pReconstructed = CoordinateFrameTransformEngine.toGlobal(pLocal, frame);
      expect(pReconstructed.x).toBeCloseTo(pGlobal.x, 10);
      expect(pReconstructed.y).toBeCloseTo(pGlobal.y, 10);
      expect(pReconstructed.z).toBeCloseTo(pGlobal.z, 10);
    });

    it("evaluates spatial material properties invariantly in local part frame under rigid body displacement", () => {
      // A part has an internal linear stiffness gradient along its local X-axis: E(x_local) = 100000 + 1000 * x_local
      const localField = new SpatialMaterialField(
        "FIELD_LOCAL_GRADIENT",
        "PART_BRACKET",
        "REV_1",
        "MAT_AL",
        new Map([
          [
            "E",
            {
              propertyName: "E",
              evaluationType: "ANALYTIC",
              expression: (p) => 100000 + 1000 * p.x,
              bounds: { lower: 50000, upper: 300000 },
              valueCategory: "TARGET",
              unit: "MPa"
            }
          ]
        ]),
        { min: { x: 0, y: -20, z: -20 }, max: { x: 100, y: 20, z: 20 } }
      );

      // Model A: Part located at local origin (global == local)
      const modelA: FEMModel = {
        geometryMetadata: {
          geometryId: "PART_BRACKET",
          geometryRevision: "REV_1",
          coordinateFrame: { frameType: "GLOBAL_CARTESIAN" }
        },
        nodes: new Map([
          ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
          ["N2", { nodeId: "N2", x: 100, y: 0, z: 0 }]
        ]),
        elements: new Map([
          ["E1", { elementId: "E1", nodeIds: ["N1", "N2"], materialId: "MAT_AL", sectionId: "S1", formulationId: "BAR_1D", spatialFieldId: "FIELD_LOCAL_GRADIENT" }]
        ]),
        materials: new Map([["MAT_AL", { materialId: "MAT_AL", E: 70000, nu: 0.33 }]]),
        sections: new Map([["S1", { sectionId: "S1", area: 10 }]]),
        loads: [{ nodeId: "N2", dof: DOFComponent.UX, value: 5000 }],
        boundaryConditions: [{ nodeId: "N1", dof: DOFComponent.UX, value: 0 }],
        spatialMaterialFields: new Map([["FIELD_LOCAL_GRADIENT", localField]])
      };

      // Model B: Same part translated to position (250, 500, 1000) in assembly
      const modelB: FEMModel = {
        geometryMetadata: {
          geometryId: "PART_BRACKET",
          geometryRevision: "REV_1",
          coordinateFrame: {
            frameType: "LOCAL_PART_FRAME",
            transform: { position: { x: 250, y: 500, z: 1000 } }
          }
        },
        nodes: new Map([
          ["N1", { nodeId: "N1", x: 250, y: 500, z: 1000 }],
          ["N2", { nodeId: "N2", x: 350, y: 500, z: 1000 }]
        ]),
        elements: new Map([
          ["E1", { elementId: "E1", nodeIds: ["N1", "N2"], materialId: "MAT_AL", sectionId: "S1", formulationId: "BAR_1D", spatialFieldId: "FIELD_LOCAL_GRADIENT" }]
        ]),
        materials: new Map([["MAT_AL", { materialId: "MAT_AL", E: 70000, nu: 0.33 }]]),
        sections: new Map([["S1", { sectionId: "S1", area: 10 }]]),
        loads: [{ nodeId: "N2", dof: DOFComponent.UX, value: 5000 }],
        boundaryConditions: [{ nodeId: "N1", dof: DOFComponent.UX, value: 0 }],
        spatialMaterialFields: new Map([["FIELD_LOCAL_GRADIENT", localField]])
      };

      const femCore = new FEMCore();
      const resA = femCore.solve(modelA);
      const resB = femCore.solve(modelB);

      // Both should evaluate E at local midpoint x_local = 50 -> E = 100000 + 1000*50 = 150000 MPa.
      // Expected delta = F*L / (E*A) = 5000 * 100 / (150000 * 10) = 500000 / 1500000 = 0.33333333 mm.
      const uA = resA.displacements.get("N2")!.UX;
      const uB = resB.displacements.get("N2")!.UX;

      expect(uA).toBeCloseTo(0.33333333, 6);
      expect(uB).toBeCloseTo(0.33333333, 6);
      expect(Math.abs(uA - uB)).toBeLessThan(1e-12);
    });
  });

  // =========================================================================
  // BENCHMARK 03: Spatial Domain Coverage Audit (Fail-Closed)
  // =========================================================================
  describe("V4-BENCH-03: Spatial Domain Coverage Audit", () => {
    it("passes validation when mesh domain is strictly within spatial field bounds", () => {
      const nodes = new Map([
        ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
        ["N2", { nodeId: "N2", x: 100, y: 50, z: 20 }]
      ]);
      const meshBBox = GeometryDomainAuditor.computeBoundingBox(nodes);

      const fieldDomain = {
        min: { x: -10, y: -10, z: -10 },
        max: { x: 150, y: 100, z: 50 }
      };

      expect(GeometryDomainAuditor.isContained(meshBBox, fieldDomain)).toBe(true);
    });

    it("rejects assignment fail-closed when mesh exceeds spatial field domain under FULL_COVERAGE_MANDATORY", () => {
      const field = new SpatialMaterialField(
        "FIELD_LIMITED",
        "GEOM_WING",
        "REV_1",
        "MAT_TI",
        new Map([
          [
            "E",
            {
              propertyName: "E",
              evaluationType: "CONSTANT",
              expression: () => 110000,
              bounds: { lower: 80000, upper: 150000 },
              valueCategory: "TARGET",
              unit: "MPa"
            }
          ]
        ]),
        {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 50, y: 50, z: 50 } // Too small for mesh extending to x=100!
        }
      );

      const assignment: GeometryMaterialAssignment = {
        assignmentId: "ASGN_COVERAGE_FAIL",
        canonicalGeometryId: "GEOM_WING",
        geometryRevisionId: "REV_1",
        materialId: "MAT_TI",
        materialRevisionId: "REV_M1",
        spatialFieldId: "FIELD_LIMITED",
        coordinateFrame: { frameType: "GLOBAL_CARTESIAN" },
        coveragePolicy: "FULL_COVERAGE_MANDATORY",
        state: "DECLARED"
      };

      const model: FEMModel = {
        geometryMetadata: { geometryId: "GEOM_WING", geometryRevision: "REV_1" },
        nodes: new Map([
          ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
          ["N2", { nodeId: "N2", x: 100, y: 0, z: 0 }] // Exceeds field x_max=50
        ]),
        elements: new Map([
          ["E1", { elementId: "E1", nodeIds: ["N1", "N2"], materialId: "MAT_TI", sectionId: "S1", formulationId: "BAR_1D", spatialFieldId: "FIELD_LIMITED" }]
        ]),
        materials: new Map([["MAT_TI", { materialId: "MAT_TI", E: 110000, nu: 0.3 }]]),
        sections: new Map([["S1", { sectionId: "S1", area: 10 }]]),
        loads: [],
        boundaryConditions: [],
        spatialMaterialFields: new Map([["FIELD_LIMITED", field]]),
        materialAssignments: new Map([["ASGN_COVERAGE_FAIL", assignment]])
      };

      const result = GeometryMaterialValidator.validateAssignment(assignment, model);
      expect(result.ok).toBe(false);
      expect(assignment.state).toBe("REJECTED");
      expect(assignment.rejectionReason).toContain("[GEOMETRY_COVERAGE_FAILURE]");
    });

    it("allows partial coverage when coveragePolicy is PARTIAL_PERMITTED", () => {
      const field = new SpatialMaterialField(
        "FIELD_PARTIAL",
        "GEOM_WING",
        "REV_1",
        "MAT_TI",
        new Map([
          [
            "E",
            {
              propertyName: "E",
              evaluationType: "CONSTANT",
              expression: () => 110000,
              bounds: { lower: 80000, upper: 150000 },
              valueCategory: "TARGET",
              unit: "MPa"
            }
          ]
        ]),
        {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 50, y: 50, z: 50 }
        }
      );

      const assignment: GeometryMaterialAssignment = {
        assignmentId: "ASGN_PARTIAL_OK",
        canonicalGeometryId: "GEOM_WING",
        geometryRevisionId: "REV_1",
        materialId: "MAT_TI",
        materialRevisionId: "REV_M1",
        spatialFieldId: "FIELD_PARTIAL",
        coordinateFrame: { frameType: "GLOBAL_CARTESIAN" },
        coveragePolicy: "PARTIAL_PERMITTED",
        state: "DECLARED"
      };

      const model: FEMModel = {
        geometryMetadata: { geometryId: "GEOM_WING", geometryRevision: "REV_1" },
        nodes: new Map([
          ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
          ["N2", { nodeId: "N2", x: 100, y: 0, z: 0 }]
        ]),
        elements: new Map([
          ["E1", { elementId: "E1", nodeIds: ["N1", "N2"], materialId: "MAT_TI", sectionId: "S1", formulationId: "BAR_1D", spatialFieldId: "FIELD_PARTIAL" }]
        ]),
        materials: new Map([["MAT_TI", { materialId: "MAT_TI", E: 110000, nu: 0.3 }]]),
        sections: new Map([["S1", { sectionId: "S1", area: 10 }]]),
        loads: [],
        boundaryConditions: [],
        spatialMaterialFields: new Map([["FIELD_PARTIAL", field]]),
        materialAssignments: new Map([["ASGN_PARTIAL_OK", assignment]])
      };

      const result = GeometryMaterialValidator.validateAssignment(assignment, model);
      expect(result.ok).toBe(true);
      expect(assignment.state).toBe("READY_FOR_ANALYSIS");
    });
  });

  // =========================================================================
  // BENCHMARK 04: Multi-Element 3D TET4 & 1D Bar with Geometry-Bound Spatial Field
  // =========================================================================
  describe("V4-BENCH-04: Multi-Element 3D Solid & 1D Bar Integrated Solve", () => {
    it("solves 3D continuum TET4 solid with geometry-bound linear spatial field", () => {
      const field = new SpatialMaterialField(
        "FIELD_TET_GRADIENT",
        "BLOCK_3D",
        "REV_001",
        "MAT_SOLID",
        new Map([
          [
            "E",
            {
              propertyName: "E",
              evaluationType: "ANALYTIC",
              expression: (p) => 200000 * (1 + 0.01 * p.x),
              bounds: { lower: 100000, upper: 400000 },
              valueCategory: "TARGET",
              unit: "MPa"
            }
          ],
          [
            "nu",
            {
              propertyName: "nu",
              evaluationType: "CONSTANT",
              expression: () => 0.28,
              bounds: { lower: 0.2, upper: 0.35 },
              valueCategory: "TARGET",
              unit: "dimensionless"
            }
          ]
        ]),
        {
          min: { x: -5, y: -5, z: -5 },
          max: { x: 50, y: 50, z: 50 }
        }
      );

      const assignment: GeometryMaterialAssignment = {
        assignmentId: "ASGN_TET",
        canonicalGeometryId: "BLOCK_3D",
        geometryRevisionId: "REV_001",
        materialId: "MAT_SOLID",
        materialRevisionId: "REV_M1",
        spatialFieldId: "FIELD_TET_GRADIENT",
        coordinateFrame: { frameType: "GLOBAL_CARTESIAN" },
        coveragePolicy: "FULL_COVERAGE_MANDATORY",
        state: "DECLARED"
      };

      // Construct a single regular tetrahedron
      const model: FEMModel = {
        geometryMetadata: { geometryId: "BLOCK_3D", geometryRevision: "REV_001" },
        nodes: new Map([
          ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
          ["N2", { nodeId: "N2", x: 10, y: 0, z: 0 }],
          ["N3", { nodeId: "N3", x: 0, y: 10, z: 0 }],
          ["N4", { nodeId: "N4", x: 0, y: 0, z: 10 }]
        ]),
        elements: new Map([
          ["T1", {
            elementId: "T1",
            nodeIds: ["N1", "N2", "N3", "N4"],
            materialId: "MAT_SOLID",
            sectionId: "S_SOLID",
            formulationId: "TET4_3D",
            spatialFieldId: "FIELD_TET_GRADIENT",
            assignmentId: "ASGN_TET"
          }]
        ]),
        materials: new Map([["MAT_SOLID", { materialId: "MAT_SOLID", E: 200000, nu: 0.28 }]]),
        sections: new Map([["S_SOLID", { sectionId: "S_SOLID" }]]),
        boundaryConditions: [
          { nodeId: "N1", dof: DOFComponent.UX, value: 0 },
          { nodeId: "N1", dof: DOFComponent.UY, value: 0 },
          { nodeId: "N1", dof: DOFComponent.UZ, value: 0 },
          { nodeId: "N3", dof: DOFComponent.UX, value: 0 },
          { nodeId: "N3", dof: DOFComponent.UY, value: 0 },
          { nodeId: "N3", dof: DOFComponent.UZ, value: 0 },
          { nodeId: "N4", dof: DOFComponent.UX, value: 0 },
          { nodeId: "N4", dof: DOFComponent.UY, value: 0 },
          { nodeId: "N4", dof: DOFComponent.UZ, value: 0 }
        ],
        loads: [
          { nodeId: "N2", dof: DOFComponent.UX, value: 10000 }
        ],
        spatialMaterialFields: new Map([["FIELD_TET_GRADIENT", field]]),
        materialAssignments: new Map([["ASGN_TET", assignment]])
      };

      const femCore = new FEMCore();
      const solveResult = femCore.solve(model);

      expect(solveResult).toBeDefined();
      expect(assignment.state).toBe("READY_FOR_ANALYSIS");
      const u2x = solveResult.displacements.get("N2")!.UX;
      expect(u2x).toBeGreaterThan(0);
      expect(Number.isFinite(u2x)).toBe(true);

      // Verify evidence package generation includes geometry and assignment hashes
      const evidence = FEMEvidenceEngine.generateEvidence(model, solveResult);
      expect(evidence.geometryHash).toBeDefined();
      expect(evidence.assignmentHash).toBeDefined();
      expect(evidence.geometryHash).not.toBe("NONE");
      expect(evidence.assignmentHash).not.toBe("NONE");

      // Verify staleness checker is fresh initially
      const freshness = FEMEvidenceEngine.isEvidenceStale(evidence, model, solveResult);
      expect(freshness.isStale).toBe(false);
    });
  });

  // =========================================================================
  // BENCHMARK 05: Homogeneous Baseline Invariance (Bit-Exact Match)
  // =========================================================================
  describe("V4-BENCH-05: Homogeneous Baseline Invariance", () => {
    it("yields bit-exact numerical solutions between classical model and geometry-bound constant field", () => {
      const E0 = 210000;
      const nu0 = 0.29;
      const A = 25.0;
      const L = 200.0;
      const F = 15000.0;

      // 1. Classical Model
      const modelClassical: FEMModel = {
        nodes: new Map([
          ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
          ["N2", { nodeId: "N2", x: 100, y: 0, z: 0 }],
          ["N3", { nodeId: "N3", x: L, y: 0, z: 0 }]
        ]),
        elements: new Map([
          ["E1", { elementId: "E1", nodeIds: ["N1", "N2"], materialId: "M1", sectionId: "S1", formulationId: "BAR_1D" }],
          ["E2", { elementId: "E2", nodeIds: ["N2", "N3"], materialId: "M1", sectionId: "S1", formulationId: "BAR_1D" }]
        ]),
        materials: new Map([["M1", { materialId: "M1", E: E0, nu: nu0 }]]),
        sections: new Map([["S1", { sectionId: "S1", area: A }]]),
        loads: [{ nodeId: "N3", dof: DOFComponent.UX, value: F }],
        boundaryConditions: [{ nodeId: "N1", dof: DOFComponent.UX, value: 0 }]
      };

      // 2. Geometry-Bound Model with Constant Spatial Field
      const constField = new SpatialMaterialField(
        "FIELD_CONST_V4",
        "CYLINDER_ROD",
        "REV_001",
        "M1",
        new Map([
          [
            "E",
            {
              propertyName: "E",
              evaluationType: "CONSTANT",
              expression: () => E0,
              bounds: { lower: 150000, upper: 250000 },
              valueCategory: "TARGET",
              unit: "MPa"
            }
          ]
        ]),
        { min: { x: -10, y: -10, z: -10 }, max: { x: 250, y: 10, z: 10 } }
      );

      const assignment: GeometryMaterialAssignment = {
        assignmentId: "ASGN_HOMO",
        canonicalGeometryId: "CYLINDER_ROD",
        geometryRevisionId: "REV_001",
        materialId: "M1",
        materialRevisionId: "REV_M1",
        spatialFieldId: "FIELD_CONST_V4",
        coordinateFrame: { frameType: "GLOBAL_CARTESIAN" },
        coveragePolicy: "FULL_COVERAGE_MANDATORY",
        state: "DECLARED"
      };

      const modelBound: FEMModel = {
        geometryMetadata: { geometryId: "CYLINDER_ROD", geometryRevision: "REV_001" },
        nodes: new Map([
          ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
          ["N2", { nodeId: "N2", x: 100, y: 0, z: 0 }],
          ["N3", { nodeId: "N3", x: L, y: 0, z: 0 }]
        ]),
        elements: new Map([
          ["E1", { elementId: "E1", nodeIds: ["N1", "N2"], materialId: "M1", sectionId: "S1", formulationId: "BAR_1D", spatialFieldId: "FIELD_CONST_V4", assignmentId: "ASGN_HOMO" }],
          ["E2", { elementId: "E2", nodeIds: ["N2", "N3"], materialId: "M1", sectionId: "S1", formulationId: "BAR_1D", spatialFieldId: "FIELD_CONST_V4", assignmentId: "ASGN_HOMO" }]
        ]),
        materials: new Map([["M1", { materialId: "M1", E: E0, nu: nu0 }]]),
        sections: new Map([["S1", { sectionId: "S1", area: A }]]),
        loads: [{ nodeId: "N3", dof: DOFComponent.UX, value: F }],
        boundaryConditions: [{ nodeId: "N1", dof: DOFComponent.UX, value: 0 }],
        spatialMaterialFields: new Map([["FIELD_CONST_V4", constField]]),
        materialAssignments: new Map([["ASGN_HOMO", assignment]])
      };

      const femCore = new FEMCore();
      const resClassical = femCore.solve(modelClassical);
      const resBound = femCore.solve(modelBound);

      const uClassical = resClassical.displacements.get("N3")!.UX;
      const uBound = resBound.displacements.get("N3")!.UX;

      // Analytical check: delta = F * L / (E * A) = 15000 * 200 / (210000 * 25) = 0.5714285714285714
      const expectedDelta = (F * L) / (E0 * A);

      expect(uClassical).toBeCloseTo(expectedDelta, 12);
      expect(uBound).toBeCloseTo(expectedDelta, 12);
      expect(Math.abs(uClassical - uBound)).toBeLessThan(1e-12);
    });
  });

  // =========================================================================
  // ADVERSARIAL BATTERY: V4-ADV-001 through V4-ADV-012
  // =========================================================================
  describe("Adversarial & Fault Injection Battery (V4-ADV-001 to V4-ADV-012)", () => {

    it("V4-ADV-001: Missing Canonical Geometry ID triggers REJECTED state", () => {
      const assignment: GeometryMaterialAssignment = {
        assignmentId: "ASGN_ADV_01",
        canonicalGeometryId: "",
        geometryRevisionId: "REV_1",
        materialId: "M1",
        materialRevisionId: "REV_M1",
        coordinateFrame: { frameType: "GLOBAL_CARTESIAN" },
        coveragePolicy: "FULL_COVERAGE_MANDATORY",
        state: "DECLARED"
      };

      const model: FEMModel = {
        nodes: new Map(),
        elements: new Map(),
        materials: new Map([["M1", { materialId: "M1", E: 200000, nu: 0.3 }]]),
        sections: new Map(),
        loads: [],
        boundaryConditions: []
      };

      const res = GeometryMaterialValidator.validateAssignment(assignment, model);
      expect(res.ok).toBe(false);
      expect(assignment.state).toBe("REJECTED");
      expect(assignment.rejectionReason).toContain("Canonical Geometry ID is required");
    });

    it("V4-ADV-002: Missing Geometry Revision ID triggers REJECTED state", () => {
      const assignment: GeometryMaterialAssignment = {
        assignmentId: "ASGN_ADV_02",
        canonicalGeometryId: "GEOM_01",
        geometryRevisionId: "",
        materialId: "M1",
        materialRevisionId: "REV_M1",
        coordinateFrame: { frameType: "GLOBAL_CARTESIAN" },
        coveragePolicy: "FULL_COVERAGE_MANDATORY",
        state: "DECLARED"
      };

      const model: FEMModel = {
        nodes: new Map(),
        elements: new Map(),
        materials: new Map([["M1", { materialId: "M1", E: 200000, nu: 0.3 }]]),
        sections: new Map(),
        loads: [],
        boundaryConditions: []
      };

      const res = GeometryMaterialValidator.validateAssignment(assignment, model);
      expect(res.ok).toBe(false);
      expect(assignment.state).toBe("REJECTED");
      expect(assignment.rejectionReason).toContain("Geometry Revision ID is required");
    });

    it("V4-ADV-003: Geometry ID mismatch between model and assignment triggers [GEOMETRY_MISMATCH]", () => {
      const assignment: GeometryMaterialAssignment = {
        assignmentId: "ASGN_ADV_03",
        canonicalGeometryId: "GEOM_ALPHA",
        geometryRevisionId: "REV_1",
        materialId: "M1",
        materialRevisionId: "REV_M1",
        coordinateFrame: { frameType: "GLOBAL_CARTESIAN" },
        coveragePolicy: "FULL_COVERAGE_MANDATORY",
        state: "DECLARED"
      };

      const model: FEMModel = {
        geometryMetadata: { geometryId: "GEOM_BETA", geometryRevision: "REV_1" },
        nodes: new Map(),
        elements: new Map(),
        materials: new Map([["M1", { materialId: "M1", E: 200000, nu: 0.3 }]]),
        sections: new Map(),
        loads: [],
        boundaryConditions: []
      };

      const res = GeometryMaterialValidator.validateAssignment(assignment, model);
      expect(res.ok).toBe(false);
      expect(assignment.state).toBe("REJECTED");
      expect(assignment.rejectionReason).toContain("[GEOMETRY_MISMATCH]");
    });

    it("V4-ADV-004: Geometry Revision mismatch between model and assignment triggers [GEOMETRY_REVISION_MISMATCH]", () => {
      const assignment: GeometryMaterialAssignment = {
        assignmentId: "ASGN_ADV_04",
        canonicalGeometryId: "GEOM_01",
        geometryRevisionId: "REV_2026_B",
        materialId: "M1",
        materialRevisionId: "REV_M1",
        coordinateFrame: { frameType: "GLOBAL_CARTESIAN" },
        coveragePolicy: "FULL_COVERAGE_MANDATORY",
        state: "DECLARED"
      };

      const model: FEMModel = {
        geometryMetadata: { geometryId: "GEOM_01", geometryRevision: "REV_2026_A" },
        nodes: new Map(),
        elements: new Map(),
        materials: new Map([["M1", { materialId: "M1", E: 200000, nu: 0.3 }]]),
        sections: new Map(),
        loads: [],
        boundaryConditions: []
      };

      const res = GeometryMaterialValidator.validateAssignment(assignment, model);
      expect(res.ok).toBe(false);
      expect(assignment.state).toBe("REJECTED");
      expect(assignment.rejectionReason).toContain("[GEOMETRY_REVISION_MISMATCH]");
    });

    const dummySpecs = () => new Map<string, any>([
      [
        "E",
        {
          propertyName: "E",
          evaluationType: "CONSTANT",
          expression: () => 200000,
          bounds: { lower: 100000, upper: 300000 },
          valueCategory: "TARGET",
          unit: "MPa"
        }
      ]
    ]);

    it("V4-ADV-005: Spatial field canonical geometry mismatch triggers [FIELD_GEOMETRY_MISMATCH]", () => {
      const field = new SpatialMaterialField(
        "FIELD_ADV_05",
        "GEOM_WING",
        "REV_1",
        "M1",
        dummySpecs()
      );

      const assignment: GeometryMaterialAssignment = {
        assignmentId: "ASGN_ADV_05",
        canonicalGeometryId: "GEOM_FUSELAGE",
        geometryRevisionId: "REV_1",
        materialId: "M1",
        materialRevisionId: "REV_M1",
        spatialFieldId: "FIELD_ADV_05",
        coordinateFrame: { frameType: "GLOBAL_CARTESIAN" },
        coveragePolicy: "FULL_COVERAGE_MANDATORY",
        state: "DECLARED"
      };

      const model: FEMModel = {
        geometryMetadata: { geometryId: "GEOM_FUSELAGE", geometryRevision: "REV_1" },
        nodes: new Map(),
        elements: new Map(),
        materials: new Map([["M1", { materialId: "M1", E: 200000, nu: 0.3 }]]),
        sections: new Map(),
        loads: [],
        boundaryConditions: [],
        spatialMaterialFields: new Map([["FIELD_ADV_05", field]])
      };

      const res = GeometryMaterialValidator.validateAssignment(assignment, model);
      expect(res.ok).toBe(false);
      expect(assignment.state).toBe("REJECTED");
      expect(assignment.rejectionReason).toContain("[FIELD_GEOMETRY_MISMATCH]");
    });

    it("V4-ADV-006: Spatial field revision mismatch triggers [FIELD_REVISION_MISMATCH]", () => {
      const field = new SpatialMaterialField(
        "FIELD_ADV_06",
        "GEOM_01",
        "REV_2025",
        "M1",
        dummySpecs()
      );

      const assignment: GeometryMaterialAssignment = {
        assignmentId: "ASGN_ADV_06",
        canonicalGeometryId: "GEOM_01",
        geometryRevisionId: "REV_2026",
        materialId: "M1",
        materialRevisionId: "REV_M1",
        spatialFieldId: "FIELD_ADV_06",
        coordinateFrame: { frameType: "GLOBAL_CARTESIAN" },
        coveragePolicy: "FULL_COVERAGE_MANDATORY",
        state: "DECLARED"
      };

      const model: FEMModel = {
        geometryMetadata: { geometryId: "GEOM_01", geometryRevision: "REV_2026" },
        nodes: new Map(),
        elements: new Map(),
        materials: new Map([["M1", { materialId: "M1", E: 200000, nu: 0.3 }]]),
        sections: new Map(),
        loads: [],
        boundaryConditions: [],
        spatialMaterialFields: new Map([["FIELD_ADV_06", field]])
      };

      const res = GeometryMaterialValidator.validateAssignment(assignment, model);
      expect(res.ok).toBe(false);
      expect(assignment.state).toBe("REJECTED");
      expect(assignment.rejectionReason).toContain("[FIELD_REVISION_MISMATCH]");
    });

    it("V4-ADV-007: Spatial field base material mismatch triggers [SPATIAL_FIELD_MATERIAL_MISMATCH]", () => {
      const field = new SpatialMaterialField(
        "FIELD_ADV_07",
        "GEOM_01",
        "REV_1",
        "MAT_ALUMINUM",
        dummySpecs()
      );

      const assignment: GeometryMaterialAssignment = {
        assignmentId: "ASGN_ADV_07",
        canonicalGeometryId: "GEOM_01",
        geometryRevisionId: "REV_1",
        materialId: "MAT_TITANIUM",
        materialRevisionId: "REV_M1",
        spatialFieldId: "FIELD_ADV_07",
        coordinateFrame: { frameType: "GLOBAL_CARTESIAN" },
        coveragePolicy: "FULL_COVERAGE_MANDATORY",
        state: "DECLARED"
      };

      const model: FEMModel = {
        geometryMetadata: { geometryId: "GEOM_01", geometryRevision: "REV_1" },
        nodes: new Map(),
        elements: new Map(),
        materials: new Map([
          ["MAT_TITANIUM", { materialId: "MAT_TITANIUM", E: 110000, nu: 0.3 }],
          ["MAT_ALUMINUM", { materialId: "MAT_ALUMINUM", E: 70000, nu: 0.33 }]
        ]),
        sections: new Map(),
        loads: [],
        boundaryConditions: [],
        spatialMaterialFields: new Map([["FIELD_ADV_07", field]])
      };

      const res = GeometryMaterialValidator.validateAssignment(assignment, model);
      expect(res.ok).toBe(false);
      expect(assignment.state).toBe("REJECTED");
      expect(assignment.rejectionReason).toContain("[SPATIAL_FIELD_MATERIAL_MISMATCH]");
    });

    it("V4-ADV-008: Non-existent base material triggers [MATERIAL_NOT_FOUND]", () => {
      const assignment: GeometryMaterialAssignment = {
        assignmentId: "ASGN_ADV_08",
        canonicalGeometryId: "GEOM_01",
        geometryRevisionId: "REV_1",
        materialId: "NON_EXISTENT_MAT",
        materialRevisionId: "REV_M1",
        coordinateFrame: { frameType: "GLOBAL_CARTESIAN" },
        coveragePolicy: "FULL_COVERAGE_MANDATORY",
        state: "DECLARED"
      };

      const model: FEMModel = {
        nodes: new Map(),
        elements: new Map(),
        materials: new Map([["M1", { materialId: "M1", E: 200000, nu: 0.3 }]]),
        sections: new Map(),
        loads: [],
        boundaryConditions: []
      };

      const res = GeometryMaterialValidator.validateAssignment(assignment, model);
      expect(res.ok).toBe(false);
      expect(assignment.state).toBe("REJECTED");
      expect(assignment.rejectionReason).toContain("[MATERIAL_NOT_FOUND]");
    });

    it("V4-ADV-009: Non-existent spatial field ID triggers [SPATIAL_FIELD_NOT_FOUND]", () => {
      const assignment: GeometryMaterialAssignment = {
        assignmentId: "ASGN_ADV_09",
        canonicalGeometryId: "GEOM_01",
        geometryRevisionId: "REV_1",
        materialId: "M1",
        materialRevisionId: "REV_M1",
        spatialFieldId: "GHOST_FIELD_ID",
        coordinateFrame: { frameType: "GLOBAL_CARTESIAN" },
        coveragePolicy: "FULL_COVERAGE_MANDATORY",
        state: "DECLARED"
      };

      const model: FEMModel = {
        nodes: new Map(),
        elements: new Map(),
        materials: new Map([["M1", { materialId: "M1", E: 200000, nu: 0.3 }]]),
        sections: new Map(),
        loads: [],
        boundaryConditions: []
      };

      const res = GeometryMaterialValidator.validateAssignment(assignment, model);
      expect(res.ok).toBe(false);
      expect(assignment.state).toBe("REJECTED");
      expect(assignment.rejectionReason).toContain("[SPATIAL_FIELD_NOT_FOUND]");
    });

    it("V4-ADV-010: Unsupported formulation assigned spatial field triggers [UNSUPPORTED_FORMULATION_SPATIAL_FIELD]", () => {
      const field = new SpatialMaterialField(
        "FIELD_ADV_10",
        "GEOM_01",
        "REV_1",
        "M1",
        dummySpecs()
      );

      const assignment: GeometryMaterialAssignment = {
        assignmentId: "ASGN_ADV_10",
        canonicalGeometryId: "GEOM_01",
        geometryRevisionId: "REV_1",
        materialId: "M1",
        materialRevisionId: "REV_M1",
        spatialFieldId: "FIELD_ADV_10",
        coordinateFrame: { frameType: "GLOBAL_CARTESIAN" },
        coveragePolicy: "FULL_COVERAGE_MANDATORY",
        state: "DECLARED"
      };

      // Assign spatial field to 2D continuum CST element (which does not yet support spatial fields in V4)
      const model: FEMModel = {
        geometryMetadata: { geometryId: "GEOM_01", geometryRevision: "REV_1" },
        nodes: new Map([
          ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
          ["N2", { nodeId: "N2", x: 10, y: 0, z: 0 }],
          ["N3", { nodeId: "N3", x: 0, y: 10, z: 0 }]
        ]),
        elements: new Map([
          ["C1", { elementId: "C1", nodeIds: ["N1", "N2", "N3"], materialId: "M1", sectionId: "S1", formulationId: "CST_2D", spatialFieldId: "FIELD_ADV_10" }]
        ]),
        materials: new Map([["M1", { materialId: "M1", E: 200000, nu: 0.3 }]]),
        sections: new Map([["S1", { sectionId: "S1", thickness: 1.0 }]]),
        loads: [],
        boundaryConditions: [],
        spatialMaterialFields: new Map([["FIELD_ADV_10", field]]),
        materialAssignments: new Map([["ASGN_ADV_10", assignment]])
      };

      const res = GeometryMaterialValidator.validateAssignment(assignment, model);
      expect(res.ok).toBe(false);
      expect(assignment.state).toBe("REJECTED");
      expect(assignment.rejectionReason).toContain("[UNSUPPORTED_FORMULATION_SPATIAL_FIELD]");
    });

    it("V4-ADV-011: Out-of-bounds evaluation with FAIL_CLOSED policy throws [SPATIAL_FIELD_OUT_OF_DOMAIN]", () => {
      const field = new SpatialMaterialField(
        "FIELD_ADV_11",
        "GEOM_01",
        "REV_1",
        "M1",
        new Map([
          [
            "E",
            {
              propertyName: "E",
              evaluationType: "CONSTANT",
              expression: () => 200000,
              bounds: { lower: 100000, upper: 300000 },
              valueCategory: "TARGET",
              unit: "MPa"
            }
          ]
        ]),
        { min: { x: 0, y: 0, z: 0 }, max: { x: 50, y: 50, z: 50 } },
        "FAIL_CLOSED"
      );

      // Evaluating outside max x=50
      expect(() => {
        field.evaluate({ x: 100, y: 25, z: 25 });
      }).toThrow(/\[SPATIAL_FIELD_OUT_OF_DOMAIN\]/);
    });

    it("V4-ADV-012: Invalidation detection when geometry or assignment revision is modified", () => {
      const field = new SpatialMaterialField(
        "FIELD_ADV_12",
        "GEOM_01",
        "REV_1",
        "M1",
        new Map([
          [
            "E",
            {
              propertyName: "E",
              evaluationType: "CONSTANT",
              expression: () => 200000,
              bounds: { lower: 100000, upper: 300000 },
              valueCategory: "TARGET",
              unit: "MPa"
            }
          ]
        ])
      );

      const assignment: GeometryMaterialAssignment = {
        assignmentId: "ASGN_ADV_12",
        canonicalGeometryId: "GEOM_01",
        geometryRevisionId: "REV_1",
        materialId: "M1",
        materialRevisionId: "REV_M1",
        spatialFieldId: "FIELD_ADV_12",
        coordinateFrame: { frameType: "GLOBAL_CARTESIAN" },
        coveragePolicy: "PARTIAL_PERMITTED",
        state: "READY_FOR_ANALYSIS"
      };

      const model: FEMModel = {
        geometryMetadata: { geometryId: "GEOM_01", geometryRevision: "REV_1" },
        nodes: new Map([
          ["N1", { nodeId: "N1", x: 0, y: 0, z: 0 }],
          ["N2", { nodeId: "N2", x: 50, y: 0, z: 0 }]
        ]),
        elements: new Map([
          ["E1", { elementId: "E1", nodeIds: ["N1", "N2"], materialId: "M1", sectionId: "S1", formulationId: "BAR_1D", spatialFieldId: "FIELD_ADV_12", assignmentId: "ASGN_ADV_12" }]
        ]),
        materials: new Map([["M1", { materialId: "M1", E: 200000, nu: 0.3 }]]),
        sections: new Map([["S1", { sectionId: "S1", area: 10 }]]),
        loads: [{ nodeId: "N2", dof: DOFComponent.UX, value: 1000 }],
        boundaryConditions: [{ nodeId: "N1", dof: DOFComponent.UX, value: 0 }],
        spatialMaterialFields: new Map([["FIELD_ADV_12", field]]),
        materialAssignments: new Map([["ASGN_ADV_12", assignment]])
      };

      const femCore = new FEMCore();
      const solveResult = femCore.solve(model);
      const evidence = FEMEvidenceEngine.generateEvidence(model, solveResult);

      // Initial state is not stale
      expect(FEMEvidenceEngine.isEvidenceStale(evidence, model, solveResult).isStale).toBe(false);

      // Mutate model geometry revision
      const modifiedModel: FEMModel = {
        ...model,
        geometryMetadata: { geometryId: "GEOM_01", geometryRevision: "REV_2_MUTATED" }
      };

      const staleCheck = FEMEvidenceEngine.isEvidenceStale(evidence, modifiedModel);
      expect(staleCheck.isStale).toBe(true);
      expect(staleCheck.reason).toContain("Geometry metadata or coordinate frame modified");
    });

  });

});
