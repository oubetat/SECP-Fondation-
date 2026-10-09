/**
 * PATCH-113: Assembly Graph Query & Impact Analysis Engine
 * Deterministic traversal, graph querying, and change impact propagation analysis
 */

import { AssemblyGraph } from "./AssemblyGraph";
import {
  AssemblyOccurrence,
  AssemblyNode,
  AssemblyConstraint,
  AssemblyInterface,
  AssemblyConfiguration,
  PartDefinition
} from "./types";

export interface PartRevisionImpactReport {
  partId: string;
  sourceRevision: string;
  targetRevision: string;
  affectedOccurrenceIds: string[];
  affectedInstancePaths: string[];
  affectedConstraintIds: string[];
  affectedInterfaceIds: string[];
  affectedConfigurationIds: string[];
  requiresExplicitChangeOrder: boolean;
}

export class AssemblyGraphQueryEngine {
  /**
   * Find Part Definition by ID & Revision (or latest if revision omitted)
   */
  public static findPart(graph: AssemblyGraph, partId: string, partRevision?: string): PartDefinition | null {
    if (partRevision) {
      return graph.partDefinitions.get(`${partId}:${partRevision}`) || null;
    }
    for (const [key, part] of graph.partDefinitions) {
      if (part.partId === partId) return part;
    }
    return null;
  }

  /**
   * Find Occurrence by ID
   */
  public static findOccurrence(graph: AssemblyGraph, occurrenceId: string): AssemblyOccurrence | null {
    return graph.occurrences.get(occurrenceId) || null;
  }

  /**
   * Find direct children of an occurrence (sorted deterministically by occurrenceId)
   */
  public static findChildren(graph: AssemblyGraph, occurrenceId: string): AssemblyOccurrence[] {
    return Array.from(graph.occurrences.values())
      .filter(o => o.parentOccurrenceId === occurrenceId)
      .sort((a, b) => a.occurrenceId.localeCompare(b.occurrenceId));
  }

  /**
   * Find parent occurrence
   */
  public static findParent(graph: AssemblyGraph, occurrenceId: string): AssemblyOccurrence | null {
    const occ = graph.occurrences.get(occurrenceId);
    if (!occ || !occ.parentOccurrenceId) return null;
    return graph.occurrences.get(occ.parentOccurrenceId) || null;
  }

  /**
   * Find all ancestors up to root (ordered from immediate parent to root)
   */
  public static ancestors(graph: AssemblyGraph, occurrenceId: string): AssemblyOccurrence[] {
    const res: AssemblyOccurrence[] = [];
    let curr = this.findParent(graph, occurrenceId);
    while (curr) {
      res.push(curr);
      curr = this.findParent(graph, curr.occurrenceId);
    }
    return res;
  }

  /**
   * Find all descendants in DFS order deterministically
   */
  public static descendants(graph: AssemblyGraph, occurrenceId: string): AssemblyOccurrence[] {
    const res: AssemblyOccurrence[] = [];
    const traverse = (currId: string) => {
      const children = this.findChildren(graph, currId);
      for (const child of children) {
        res.push(child);
        traverse(child.occurrenceId);
      }
    };
    traverse(occurrenceId);
    return res;
  }

  /**
   * Find siblings of an occurrence
   */
  public static siblings(graph: AssemblyGraph, occurrenceId: string): AssemblyOccurrence[] {
    const occ = graph.occurrences.get(occurrenceId);
    if (!occ || !occ.parentOccurrenceId) return [];
    return this.findChildren(graph, occ.parentOccurrenceId)
      .filter(o => o.occurrenceId !== occurrenceId);
  }

  /**
   * Find all constraints connected to an occurrence
   */
  public static findConstraints(graph: AssemblyGraph, occurrenceId: string): AssemblyConstraint[] {
    return Array.from(graph.constraints.values())
      .filter(c => c.sourceOccurrenceId === occurrenceId || c.targetOccurrenceId === occurrenceId)
      .sort((a, b) => a.constraintId.localeCompare(b.constraintId));
  }

  /**
   * Find all interfaces connected to an occurrence
   */
  public static findInterfaces(graph: AssemblyGraph, occurrenceId: string): AssemblyInterface[] {
    return Array.from(graph.interfaces.values())
      .filter(i => i.sourceOccurrenceId === occurrenceId || i.targetOccurrenceId === occurrenceId)
      .sort((a, b) => a.interfaceId.localeCompare(b.interfaceId));
  }

  /**
   * Find all occurrences that instantiate a specific partId
   */
  public static findOccurrencesByPart(graph: AssemblyGraph, partId: string, partRevision?: string): AssemblyOccurrence[] {
    return Array.from(graph.occurrences.values())
      .filter(o => o.partId === partId && (!partRevision || o.partRevision === partRevision))
      .sort((a, b) => a.occurrenceId.localeCompare(b.occurrenceId));
  }

  /**
   * Impact Analysis: What is affected if Part Revision changes?
   * Rule: No silent propagation — impact is accurately detected and reported.
   */
  public static analyzePartRevisionImpact(
    graph: AssemblyGraph,
    partId: string,
    sourceRevision: string,
    targetRevision: string
  ): PartRevisionImpactReport {
    const affectedOccurrences = this.findOccurrencesByPart(graph, partId, sourceRevision);
    const affectedOccurrenceIds = affectedOccurrences.map(o => o.occurrenceId);
    const affectedInstancePaths = affectedOccurrences.map(o => o.instancePath);

    const affectedConstraintIds: string[] = [];
    for (const c of graph.constraints.values()) {
      if (affectedOccurrenceIds.includes(c.sourceOccurrenceId) || affectedOccurrenceIds.includes(c.targetOccurrenceId)) {
        affectedConstraintIds.push(c.constraintId);
      }
    }

    const affectedInterfaceIds: string[] = [];
    for (const iface of graph.interfaces.values()) {
      if (affectedOccurrenceIds.includes(iface.sourceOccurrenceId) || affectedOccurrenceIds.includes(iface.targetOccurrenceId)) {
        affectedInterfaceIds.push(iface.interfaceId);
      }
    }

    const affectedConfigurationIds: string[] = [];
    for (const config of graph.configurations.values()) {
      const hasImpact = Object.keys(config.occurrenceStates).some(id => affectedOccurrenceIds.includes(id));
      if (hasImpact) {
        affectedConfigurationIds.push(config.configurationId);
      }
    }

    return {
      partId,
      sourceRevision,
      targetRevision,
      affectedOccurrenceIds,
      affectedInstancePaths,
      affectedConstraintIds,
      affectedInterfaceIds,
      affectedConfigurationIds,
      requiresExplicitChangeOrder: true
    };
  }
}
