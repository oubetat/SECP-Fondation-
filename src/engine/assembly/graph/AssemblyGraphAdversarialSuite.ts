/**
 * PATCH-113: Assembly Graph Adversarial & Negative Test Suite
 * Evaluates 10 hard negative attacks and integrity constraints
 */

import { AssemblyGraph } from "./AssemblyGraph";
import { AssemblyGraphValidator } from "./AssemblyGraphValidator";
import { AssemblyGraphStore } from "./AssemblyGraphStore";
import { AssemblyGraphCanonicalizer } from "./AssemblyGraphCanonicalizer";
import {
  AssemblyNodeType,
  OccurrenceConfigurationState,
  AssemblyErrorCode,
  PartDefinition,
  AssemblyLifecycleState,
  ConstraintType,
  ConstraintStatus
} from "./types";
import { TransformMatrix } from "./TransformMatrix";

export interface AdversarialTestResult {
  testId: string;
  name: string;
  attackVector: string;
  expectedErrorCode?: AssemblyErrorCode | string;
  actualResult: string;
  passed: boolean;
  details?: Record<string, any>;
}

export interface AssemblyAdversarialSuiteReport {
  timestamp: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  results: AdversarialTestResult[];
  verdict: "PASS" | "FAIL";
}

export class AssemblyGraphAdversarialSuite {
  public static runAllTests(): AssemblyAdversarialSuiteReport {
    const results: AdversarialTestResult[] = [];

    // Helper part definition
    const validPart: PartDefinition = {
      partId: "P_VAL_001",
      partRevision: "R1",
      name: "Valid Base Plate",
      unitSystem: { unitSystem: "SI", lengthUnit: "mm", angleUnit: "deg", massUnit: "kg" },
      geometryReference: { geometryId: "G1", geometryRevision: "1.0", geometryHash: "H1", topologyType: "SOLID" },
      massKg: 2.5,
      centerOfMassLocal: { x: 0, y: 0, z: 0 },
      boundingBoxLocal: { min: { x: -50, y: -50, z: 0 }, max: { x: 50, y: 50, z: 20 } },
      isFlexible: false,
      lifecycleState: AssemblyLifecycleState.RELEASED,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // -------------------------------------------------------------
    // Test 1: Duplicate Occurrence ID Injection
    // -------------------------------------------------------------
    {
      const graph = new AssemblyGraph({ assemblyId: "ASM_ADV_01", name: "Adv Test 1" });
      graph.registerPartDefinition(validPart);
      graph.addOccurrence({
        occurrenceId: "OCC_DUP_01",
        name: "Instance 1",
        nodeType: AssemblyNodeType.PART,
        partId: validPart.partId,
        partRevision: validPart.partRevision
      });

      // Manually force duplicate occurrence in raw map
      const duplicateOcc = { ...graph.occurrences.get("OCC_DUP_01")! };
      const rawOccList = [...Array.from(graph.occurrences.values()), duplicateOcc];

      const val = AssemblyGraphValidator.validate({
        assemblyId: graph.assemblyId,
        assemblyRevision: graph.assemblyRevision,
        nodes: graph.nodes,
        occurrences: rawOccList,
        edges: graph.edges,
        constraints: Array.from(graph.constraints.values()),
        interfaces: Array.from(graph.interfaces.values()),
        configurations: Array.from(graph.configurations.values()),
        partDefinitions: graph.partDefinitions,
        rootOccurrenceId: graph.rootOccurrenceId
      });

      const caught = val.nodeErrors.some(e => e.errorCode === AssemblyErrorCode.DUPLICATE_OCCURRENCE_ID);
      results.push({
        testId: "ADV-113-01",
        name: "Duplicate Occurrence ID Injection",
        attackVector: "Inject duplicate occurrence ID into assembly topology",
        expectedErrorCode: AssemblyErrorCode.DUPLICATE_OCCURRENCE_ID,
        actualResult: caught ? "DUPLICATE_OCCURRENCE_ID caught" : "Duplicate bypassed",
        passed: caught
      });
    }

    // -------------------------------------------------------------
    // Test 2: Missing Part Definition
    // -------------------------------------------------------------
    {
      const graph = new AssemblyGraph({ assemblyId: "ASM_ADV_02", name: "Adv Test 2" });
      graph.addOccurrence({
        occurrenceId: "OCC_GHOST_01",
        name: "Ghost Part",
        nodeType: AssemblyNodeType.PART,
        partId: "P_NON_EXISTENT_999",
        partRevision: "1.0"
      });

      const val = AssemblyGraphValidator.validate({
        assemblyId: graph.assemblyId,
        assemblyRevision: graph.assemblyRevision,
        nodes: graph.nodes,
        occurrences: graph.occurrences,
        edges: graph.edges,
        constraints: Array.from(graph.constraints.values()),
        interfaces: Array.from(graph.interfaces.values()),
        configurations: Array.from(graph.configurations.values()),
        partDefinitions: graph.partDefinitions,
        rootOccurrenceId: graph.rootOccurrenceId
      });

      const caught = val.referenceErrors.some(e => e.errorCode === AssemblyErrorCode.MISSING_PART_DEFINITION);
      results.push({
        testId: "ADV-113-02",
        name: "Missing Part Definition Detection",
        attackVector: "Instantiate occurrence pointing to un-registered Part Definition",
        expectedErrorCode: AssemblyErrorCode.MISSING_PART_DEFINITION,
        actualResult: caught ? "MISSING_PART_DEFINITION caught" : "Missing part allowed",
        passed: caught
      });
    }

    // -------------------------------------------------------------
    // Test 3: Invalid Parent Occurrence Reference
    // -------------------------------------------------------------
    {
      const graph = new AssemblyGraph({ assemblyId: "ASM_ADV_03", name: "Adv Test 3" });
      graph.registerPartDefinition(validPart);
      const brokenOcc = {
        occurrenceId: "OCC_BROKEN_PARENT",
        name: "Broken Parent Occ",
        nodeType: AssemblyNodeType.PART,
        partId: validPart.partId,
        partRevision: validPart.partRevision,
        assemblyId: graph.assemblyId,
        assemblyRevision: graph.assemblyRevision,
        parentOccurrenceId: "OCC_NON_EXISTENT_PARENT",
        instancePath: "INVALID/PATH",
        localTransform: TransformMatrix.create(),
        worldTransform: TransformMatrix.create(),
        configurationState: OccurrenceConfigurationState.ACTIVE,
        lifecycleState: AssemblyLifecycleState.DRAFT,
        geometryReference: validPart.geometryReference,
        isFixed: false
      };
      graph.occurrences.set(brokenOcc.occurrenceId, brokenOcc);

      const val = AssemblyGraphValidator.validate({
        assemblyId: graph.assemblyId,
        assemblyRevision: graph.assemblyRevision,
        nodes: graph.nodes,
        occurrences: graph.occurrences,
        edges: graph.edges,
        constraints: Array.from(graph.constraints.values()),
        interfaces: Array.from(graph.interfaces.values()),
        configurations: Array.from(graph.configurations.values()),
        partDefinitions: graph.partDefinitions,
        rootOccurrenceId: graph.rootOccurrenceId
      });

      const caught = val.referenceErrors.some(e => e.errorCode === AssemblyErrorCode.INVALID_PARENT_REFERENCE);
      results.push({
        testId: "ADV-113-03",
        name: "Invalid Parent Occurrence Reference",
        attackVector: "Set parentOccurrenceId to non-existent ID",
        expectedErrorCode: AssemblyErrorCode.INVALID_PARENT_REFERENCE,
        actualResult: caught ? "INVALID_PARENT_REFERENCE caught" : "Invalid parent accepted",
        passed: caught
      });
    }

    // -------------------------------------------------------------
    // Test 4: Containment Cycle Detection (A -> B -> C -> A)
    // -------------------------------------------------------------
    {
      const graph = new AssemblyGraph({ assemblyId: "ASM_ADV_04", name: "Adv Test 4" });
      graph.registerPartDefinition(validPart);

      // Create cycle: Root -> OccA -> OccB -> OccC -> OccA
      const occA = graph.addOccurrence({ occurrenceId: "OCC_CYC_A", name: "Cycle A", nodeType: AssemblyNodeType.SUBASSEMBLY, partId: validPart.partId, partRevision: validPart.partRevision });
      const occB = graph.addOccurrence({ occurrenceId: "OCC_CYC_B", name: "Cycle B", nodeType: AssemblyNodeType.SUBASSEMBLY, partId: validPart.partId, partRevision: validPart.partRevision, parentOccurrenceId: occA.occurrenceId });
      const occC = graph.addOccurrence({ occurrenceId: "OCC_CYC_C", name: "Cycle C", nodeType: AssemblyNodeType.SUBASSEMBLY, partId: validPart.partId, partRevision: validPart.partRevision, parentOccurrenceId: occB.occurrenceId });

      // Force cyclic parentage: A's parent becomes C
      occA.parentOccurrenceId = occC.occurrenceId;

      const val = AssemblyGraphValidator.validate({
        assemblyId: graph.assemblyId,
        assemblyRevision: graph.assemblyRevision,
        nodes: graph.nodes,
        occurrences: graph.occurrences,
        edges: graph.edges,
        constraints: Array.from(graph.constraints.values()),
        interfaces: Array.from(graph.interfaces.values()),
        configurations: Array.from(graph.configurations.values()),
        partDefinitions: graph.partDefinitions,
        rootOccurrenceId: graph.rootOccurrenceId
      });

      const caught = val.cycleErrors.some(e => e.errorCode === AssemblyErrorCode.CONTAINMENT_CYCLE);
      results.push({
        testId: "ADV-113-04",
        name: "Containment Cycle Detection",
        attackVector: "Introduce cyclic loop in containment hierarchy",
        expectedErrorCode: AssemblyErrorCode.CONTAINMENT_CYCLE,
        actualResult: caught ? "CONTAINMENT_CYCLE caught" : "Cycle allowed",
        passed: caught
      });
    }

    // -------------------------------------------------------------
    // Test 5: Invalid Transform with NaNs
    // -------------------------------------------------------------
    {
      const graph = new AssemblyGraph({ assemblyId: "ASM_ADV_05", name: "Adv Test 5" });
      graph.registerPartDefinition(validPart);
      const occ = graph.addOccurrence({ occurrenceId: "OCC_NAN_TRANSFORM", name: "NaN Trans", nodeType: AssemblyNodeType.PART, partId: validPart.partId, partRevision: validPart.partRevision });

      // Inject NaN into matrix
      occ.localTransform.matrix[0][0] = NaN;

      const val = AssemblyGraphValidator.validate({
        assemblyId: graph.assemblyId,
        assemblyRevision: graph.assemblyRevision,
        nodes: graph.nodes,
        occurrences: graph.occurrences,
        edges: graph.edges,
        constraints: Array.from(graph.constraints.values()),
        interfaces: Array.from(graph.interfaces.values()),
        configurations: Array.from(graph.configurations.values()),
        partDefinitions: graph.partDefinitions,
        rootOccurrenceId: graph.rootOccurrenceId
      });

      const caught = val.transformErrors.some(e => e.errorCode === AssemblyErrorCode.INVALID_TRANSFORM);
      results.push({
        testId: "ADV-113-05",
        name: "Invalid Transform Matrix Detection",
        attackVector: "Inject NaN/Infinity into 4x4 transform matrix",
        expectedErrorCode: AssemblyErrorCode.INVALID_TRANSFORM,
        actualResult: caught ? "INVALID_TRANSFORM caught" : "NaN transform accepted",
        passed: caught
      });
    }

    // -------------------------------------------------------------
    // Test 6: Broken Constraint Target Reference
    // -------------------------------------------------------------
    {
      const graph = new AssemblyGraph({ assemblyId: "ASM_ADV_06", name: "Adv Test 6" });
      graph.registerPartDefinition(validPart);
      const occA = graph.addOccurrence({ occurrenceId: "OCC_CONST_A", name: "Const A", nodeType: AssemblyNodeType.PART, partId: validPart.partId, partRevision: validPart.partRevision });

      graph.addConstraint({
        constraintId: "C_BROKEN_01",
        name: "Broken Constraint",
        constraintType: ConstraintType.COINCIDENT,
        sourceOccurrenceId: occA.occurrenceId,
        targetOccurrenceId: "OCC_MISSING_TARGET_99",
        sourceRef: { occurrenceId: occA.occurrenceId, topologyType: "FACE" },
        targetRef: { occurrenceId: "OCC_MISSING_TARGET_99", topologyType: "FACE" },
        status: ConstraintStatus.VALID
      });

      const val = AssemblyGraphValidator.validate({
        assemblyId: graph.assemblyId,
        assemblyRevision: graph.assemblyRevision,
        nodes: graph.nodes,
        occurrences: graph.occurrences,
        edges: graph.edges,
        constraints: Array.from(graph.constraints.values()),
        interfaces: Array.from(graph.interfaces.values()),
        configurations: Array.from(graph.configurations.values()),
        partDefinitions: graph.partDefinitions,
        rootOccurrenceId: graph.rootOccurrenceId
      });

      const caught = val.constraintErrors.some(e => e.errorCode === AssemblyErrorCode.BROKEN_REFERENCE);
      results.push({
        testId: "ADV-113-06",
        name: "Broken Constraint Reference",
        attackVector: "Constraint target occurrence does not exist in graph",
        expectedErrorCode: AssemblyErrorCode.BROKEN_REFERENCE,
        actualResult: caught ? "BROKEN_REFERENCE caught" : "Broken constraint allowed",
        passed: caught
      });
    }

    // -------------------------------------------------------------
    // Test 7: Transform Mutation alters Assembly Graph Hash
    // -------------------------------------------------------------
    {
      const graph1 = new AssemblyGraph({ assemblyId: "ASM_ADV_07", name: "Adv Test 7" });
      graph1.registerPartDefinition(validPart);
      graph1.addOccurrence({
        occurrenceId: "OCC_MUT_01",
        name: "Mut Occ",
        nodeType: AssemblyNodeType.PART,
        partId: validPart.partId,
        partRevision: validPart.partRevision,
        localTransform: TransformMatrix.create(10, 20, 30)
      });
      const hash1 = graph1.computeFingerprint().graphHash;

      // Graph 2 with slightly different transform (10.0001 mm)
      const graph2 = new AssemblyGraph({ assemblyId: "ASM_ADV_07", name: "Adv Test 7" });
      graph2.registerPartDefinition(validPart);
      graph2.addOccurrence({
        occurrenceId: "OCC_MUT_01",
        name: "Mut Occ",
        nodeType: AssemblyNodeType.PART,
        partId: validPart.partId,
        partRevision: validPart.partRevision,
        localTransform: TransformMatrix.create(10.05, 20, 30)
      });
      const hash2 = graph2.computeFingerprint().graphHash;

      const hashesDiffer = hash1 !== hash2;
      results.push({
        testId: "ADV-113-07",
        name: "Geometric Mutation Tamper Detection",
        attackVector: "Mutate component transform and ensure hash differs deterministically",
        actualResult: hashesDiffer ? `Hash changed (${hash1.slice(0, 8)} vs ${hash2.slice(0, 8)})` : "Hash false stability detected",
        passed: hashesDiffer
      });
    }

    // -------------------------------------------------------------
    // Test 8: Determinism Contract (Input A == Input B == Input C)
    // -------------------------------------------------------------
    {
      const buildGraph = () => {
        const g = new AssemblyGraph({ assemblyId: "ASM_DET_100", name: "Determinism Test" });
        g.registerPartDefinition(validPart);
        g.addOccurrence({ occurrenceId: "OCC_D1", name: "Occ D1", nodeType: AssemblyNodeType.PART, partId: validPart.partId, partRevision: validPart.partRevision, localTransform: TransformMatrix.create(5, 10, 15) });
        g.addOccurrence({ occurrenceId: "OCC_D2", name: "Occ D2", nodeType: AssemblyNodeType.PART, partId: validPart.partId, partRevision: validPart.partRevision, localTransform: TransformMatrix.create(25, 30, 35) });
        return g.computeFingerprint().graphHash;
      };

      const hA = buildGraph();
      const hB = buildGraph();
      const hC = buildGraph();

      const deterministic = hA === hB && hB === hC;
      results.push({
        testId: "ADV-113-08",
        name: "Graph Construction Determinism",
        attackVector: "Repeat independent construction runs from identical inputs",
        actualResult: deterministic ? `Hashes match perfectly (${hA.slice(0, 8)})` : "Non-deterministic hashing",
        passed: deterministic
      });
    }

    // -------------------------------------------------------------
    // Test 9: Concurrent Modification Conflict Protection
    // -------------------------------------------------------------
    {
      AssemblyGraphStore.clear();
      const baseGraph = new AssemblyGraph({ assemblyId: "ASM_CONCUR_01", assemblyRevision: "R1", name: "Concur Graph" });
      AssemblyGraphStore.saveAssembly(baseGraph);

      // User A reads graph (version 1)
      const userAGraph = AssemblyGraphStore.getAssembly("ASM_CONCUR_01", "R1")!;
      // User B reads graph (version 1)
      const userBGraph = AssemblyGraphStore.getAssembly("ASM_CONCUR_01", "R1")!;

      // User A makes a change and saves (version becomes 2 in store)
      userAGraph.version = 2;
      AssemblyGraphStore.saveAssembly(userAGraph);

      // User B tries to save with stale version 1
      let conflictCaught = false;
      try {
        userBGraph.version = 1;
        AssemblyGraphStore.saveAssembly(userBGraph);
      } catch (err: any) {
        conflictCaught = err.message.includes("CONCURRENT_MODIFICATION");
      }

      results.push({
        testId: "ADV-113-09",
        name: "Concurrent Modification Protection",
        attackVector: "User B saves stale version over User A's updated revision",
        expectedErrorCode: "CONCURRENT_MODIFICATION",
        actualResult: conflictCaught ? "CONCURRENT_MODIFICATION thrown" : "Lost update permitted",
        passed: conflictCaught
      });
    }

    // -------------------------------------------------------------
    // Test 10: Revision Integrity Check (No Silent Substitution)
    // -------------------------------------------------------------
    {
      const graph = new AssemblyGraph({ assemblyId: "ASM_ADV_10", name: "Revision Integrity" });
      // Register part as R1
      graph.registerPartDefinition({ ...validPart, partRevision: "R1" });
      // Occurrence explicitly claims it uses R2
      graph.addOccurrence({
        occurrenceId: "OCC_REV_MISMATCH",
        name: "Mismatch Occ",
        nodeType: AssemblyNodeType.PART,
        partId: validPart.partId,
        partRevision: "R2" // Mismatch
      });

      const val = AssemblyGraphValidator.validate({
        assemblyId: graph.assemblyId,
        assemblyRevision: graph.assemblyRevision,
        nodes: graph.nodes,
        occurrences: graph.occurrences,
        edges: graph.edges,
        constraints: Array.from(graph.constraints.values()),
        interfaces: Array.from(graph.interfaces.values()),
        configurations: Array.from(graph.configurations.values()),
        partDefinitions: graph.partDefinitions,
        rootOccurrenceId: graph.rootOccurrenceId
      });

      const caught = val.revisionErrors.some(e => e.errorCode === AssemblyErrorCode.INVALID_REVISION_REFERENCE);
      results.push({
        testId: "ADV-113-10",
        name: "No Silent Revision Substitution",
        attackVector: "Occurrence points to unreleased/non-existent revision of a known part",
        expectedErrorCode: AssemblyErrorCode.INVALID_REVISION_REFERENCE,
        actualResult: caught ? "INVALID_REVISION_REFERENCE caught" : "Silent substitution allowed",
        passed: caught
      });
    }

    const passedCount = results.filter(r => r.passed).length;

    return {
      timestamp: Date.now(),
      totalTests: results.length,
      passedTests: passedCount,
      failedTests: results.length - passedCount,
      results,
      verdict: passedCount === results.length ? "PASS" : "FAIL"
    };
  }
}
