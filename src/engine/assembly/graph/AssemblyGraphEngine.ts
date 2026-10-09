/**
 * PATCH-113: Assembly Graph Master Engine
 * Master orchestration engine for assembly graph creation, validation, querying, diffing and manufacturing evidence binding
 */

import { AssemblyGraph } from "./AssemblyGraph";
import { AssemblyGraphValidator } from "./AssemblyGraphValidator";
import { AssemblyGraphQueryEngine } from "./AssemblyGraphQueryEngine";
import { AssemblyGraphDiffEngine } from "./AssemblyGraphDiffEngine";
import { AssemblyBOMEngine } from "./AssemblyBOMEngine";
import { AssemblyPhysicalPropertiesEngine } from "./AssemblyPhysicalPropertiesEngine";
import { AssemblyGraphCanonicalizer } from "./AssemblyGraphCanonicalizer";
import { AssemblyGraphStore } from "./AssemblyGraphStore";
import {
  AssemblyValidationReport,
  AssemblyEngineeringBOM,
  AssemblyPhysicalProperties,
  InterferenceCandidate,
  AssemblyDiffReport,
  AssemblySnapshot,
  AssemblyDependencySnapshot,
  PartDefinition,
  AssemblyOccurrence,
  AssemblyConstraint,
  AssemblyInterface,
  AssemblyConfiguration,
  UnitSystemConfig,
  AssemblyLifecycleState,
  OccurrenceConfigurationState,
  AssemblyNodeType
} from "./types";
import { TransformMatrix } from "./TransformMatrix";

export class AssemblyGraphEngine {
  /**
   * Create a new Assembly Graph and register it in store
   */
  public static createAssembly(params: {
    assemblyId: string;
    assemblyRevision?: string;
    name: string;
    description?: string;
    unitSystem?: UnitSystemConfig;
    lifecycleState?: AssemblyLifecycleState;
    createdBy?: string;
  }): AssemblyGraph {
    const graph = new AssemblyGraph({
      assemblyId: params.assemblyId,
      assemblyRevision: params.assemblyRevision,
      name: params.name,
      description: params.description,
      unitSystem: params.unitSystem,
      lifecycleState: params.lifecycleState,
      provenance: {
        createdBy: params.createdBy || "SYSTEM_ENGINEER",
        createdAt: Date.now(),
        source: "SECP_ASSEMBLY_GRAPH_ENGINE",
        sourceRevision: "v2.0"
      }
    });

    AssemblyGraphStore.saveAssembly(graph, params.createdBy || "SYSTEM_ENGINEER", "CREATE");
    return graph;
  }

  /**
   * Add a Part Occurrence to an Assembly
   */
  public static addOccurrence(
    assemblyId: string,
    params: {
      occurrenceId: string;
      name: string;
      nodeType: AssemblyNodeType;
      partId: string;
      partRevision: string;
      parentOccurrenceId?: string;
      tx?: number;
      ty?: number;
      tz?: number;
      rxDeg?: number;
      ryDeg?: number;
      rzDeg?: number;
      configurationState?: OccurrenceConfigurationState;
      isFixed?: boolean;
    },
    revision?: string,
    actorId: string = "SYSTEM_ENGINEER"
  ): AssemblyOccurrence {
    const graph = AssemblyGraphStore.getAssembly(assemblyId, revision);
    if (!graph) {
      throw new Error(`Assembly ${assemblyId} not found`);
    }

    const localT = TransformMatrix.create(
      params.tx || 0,
      params.ty || 0,
      params.tz || 0,
      params.rxDeg || 0,
      params.ryDeg || 0,
      params.rzDeg || 0
    );

    const occ = graph.addOccurrence({
      occurrenceId: params.occurrenceId,
      name: params.name,
      nodeType: params.nodeType,
      partId: params.partId,
      partRevision: params.partRevision,
      parentOccurrenceId: params.parentOccurrenceId,
      localTransform: localT,
      configurationState: params.configurationState,
      isFixed: params.isFixed
    });

    AssemblyGraphStore.saveAssembly(graph, actorId, "ADD_OCCURRENCE");
    return occ;
  }

  /**
   * Validate Assembly Graph
   */
  public static validate(assemblyId: string, revision?: string): AssemblyValidationReport {
    const graph = AssemblyGraphStore.getAssembly(assemblyId, revision);
    if (!graph) {
      throw new Error(`Assembly ${assemblyId} not found`);
    }

    return AssemblyGraphValidator.validate({
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
  }

  /**
   * Generate Engineering BOM
   */
  public static getBOM(assemblyId: string, configurationId?: string, revision?: string): AssemblyEngineeringBOM {
    const graph = AssemblyGraphStore.getAssembly(assemblyId, revision);
    if (!graph) {
      throw new Error(`Assembly ${assemblyId} not found`);
    }
    return AssemblyBOMEngine.generateBOM(graph, configurationId);
  }

  /**
   * Compute Physical Properties
   */
  public static getPhysicalProperties(assemblyId: string, configurationId?: string, revision?: string): AssemblyPhysicalProperties {
    const graph = AssemblyGraphStore.getAssembly(assemblyId, revision);
    if (!graph) {
      throw new Error(`Assembly ${assemblyId} not found`);
    }
    return AssemblyPhysicalPropertiesEngine.computePhysicalProperties(graph, configurationId);
  }

  /**
   * Find Interference Candidates
   */
  public static getInterferenceCandidates(assemblyId: string, clearanceMarginMm: number = 0.5, revision?: string): InterferenceCandidate[] {
    const graph = AssemblyGraphStore.getAssembly(assemblyId, revision);
    if (!graph) {
      throw new Error(`Assembly ${assemblyId} not found`);
    }
    return AssemblyPhysicalPropertiesEngine.findInterferenceCandidates(graph, clearanceMarginMm);
  }

  /**
   * Compare two assembly revisions
   */
  public static diffRevisions(assemblyId: string, revA: string, revB: string): AssemblyDiffReport {
    const graphA = AssemblyGraphStore.getAssembly(assemblyId, revA);
    const graphB = AssemblyGraphStore.getAssembly(assemblyId, revB);
    if (!graphA) throw new Error(`Assembly ${assemblyId} revision ${revA} not found`);
    if (!graphB) throw new Error(`Assembly ${assemblyId} revision ${revB} not found`);

    return AssemblyGraphDiffEngine.diff(graphA, graphB);
  }

  /**
   * Release Assembly Revision: Freezes snapshot, sets lifecycle to RELEASED
   */
  public static releaseRevision(
    assemblyId: string,
    revision: string,
    actorId: string = "RELEASE_MANAGER"
  ): { snapshot: AssemblySnapshot; dependencySnapshot: AssemblyDependencySnapshot } {
    const graph = AssemblyGraphStore.getAssembly(assemblyId, revision);
    if (!graph) throw new Error(`Assembly ${assemblyId} revision ${revision} not found`);

    // Validate first
    const report = AssemblyGraphValidator.validate({
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

    if (!report.graphValid) {
      throw new Error(`Cannot release invalid assembly graph ${assemblyId}:${revision} (Errors: ${report.totalErrors})`);
    }

    graph.lifecycleState = AssemblyLifecycleState.RELEASED;
    for (const [, occ] of graph.occurrences) {
      occ.lifecycleState = AssemblyLifecycleState.RELEASED;
    }
    for (const [, node] of graph.nodes) {
      node.lifecycleState = AssemblyLifecycleState.RELEASED;
    }

    const snapshot = graph.createSnapshot();
    const dependencySnapshot = AssemblyGraphCanonicalizer.createDependencySnapshot(
      graph.assemblyId,
      graph.assemblyRevision,
      Array.from(graph.occurrences.values())
    );

    AssemblyGraphStore.saveAssembly(graph, actorId, "RELEASE_REVISION");

    return { snapshot, dependencySnapshot };
  }
}
