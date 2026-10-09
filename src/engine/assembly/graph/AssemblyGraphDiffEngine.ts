/**
 * PATCH-113: Assembly Graph Semantic Diff Engine
 * Performs deep semantic comparison between assembly revisions
 */

import { AssemblyGraph } from "./AssemblyGraph";
import {
  AssemblyDiffItem,
  AssemblyDiffReport,
  ComponentDiffType,
  Matrix4x4
} from "./types";

export class AssemblyGraphDiffEngine {
  /**
   * Compare two transforms with epsilon tolerance
   */
  private static areTransformsEqual(a?: Matrix4x4, b?: Matrix4x4, tolerance: number = 1e-5): boolean {
    if (!a || !b) return a === b;
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (Math.abs(a[r][c] - b[r][c]) > tolerance) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Compute semantic diff between graph A and graph B
   */
  public static diff(graphA: AssemblyGraph, graphB: AssemblyGraph): AssemblyDiffReport {
    const diffItems: AssemblyDiffItem[] = [];
    let addedCount = 0;
    let removedCount = 0;
    let movedCount = 0;
    let modifiedCount = 0;

    const occsA = graphA.occurrences;
    const occsB = graphB.occurrences;

    // 1. Check for Removed & Modified Occurrences
    for (const [id, occA] of occsA) {
      if (id === graphA.rootOccurrenceId) continue; // Skip root container

      const occB = occsB.get(id);
      if (!occB) {
        // Occurrence was removed
        removedCount++;
        diffItems.push({
          diffType: ComponentDiffType.REMOVED_COMPONENT,
          occurrenceId: id,
          partId: occA.partId,
          beforeRevision: occA.partRevision,
          description: `Component occurrence ${id} (${occA.name}) was removed.`
        });
      } else {
        // Check if Part Definition replaced
        if (occA.partId !== occB.partId) {
          modifiedCount++;
          diffItems.push({
            diffType: ComponentDiffType.REPLACED_COMPONENT,
            occurrenceId: id,
            partId: occB.partId,
            beforeRevision: `${occA.partId}:${occA.partRevision}`,
            afterRevision: `${occB.partId}:${occB.partRevision}`,
            description: `Component ${id} part definition was replaced from ${occA.partId} to ${occB.partId}.`
          });
        }
        // Check if Part Revision changed
        else if (occA.partRevision !== occB.partRevision) {
          modifiedCount++;
          diffItems.push({
            diffType: ComponentDiffType.REVISION_CHANGED,
            occurrenceId: id,
            partId: occA.partId,
            beforeRevision: occA.partRevision,
            afterRevision: occB.partRevision,
            description: `Component ${id} part revision changed from ${occA.partRevision} to ${occB.partRevision}.`
          });
        }

        // Check if Geometric Transform moved
        if (!this.areTransformsEqual(occA.localTransform.matrix, occB.localTransform.matrix)) {
          movedCount++;
          diffItems.push({
            diffType: ComponentDiffType.MOVED_COMPONENT,
            occurrenceId: id,
            partId: occA.partId,
            beforeTransform: occA.localTransform.matrix,
            afterTransform: occB.localTransform.matrix,
            description: `Component ${id} transform was modified.`
          });
        }

        // Check if Configuration State changed
        if (occA.configurationState !== occB.configurationState) {
          modifiedCount++;
          diffItems.push({
            diffType: ComponentDiffType.CONFIGURATION_CHANGED,
            occurrenceId: id,
            partId: occA.partId,
            beforeState: occA.configurationState,
            afterState: occB.configurationState,
            description: `Component ${id} configuration state changed from ${occA.configurationState} to ${occB.configurationState}.`
          });
        }
      }
    }

    // 2. Check for Added Occurrences
    for (const [id, occB] of occsB) {
      if (id === graphB.rootOccurrenceId) continue;
      if (!occsA.has(id)) {
        addedCount++;
        diffItems.push({
          diffType: ComponentDiffType.ADDED_COMPONENT,
          occurrenceId: id,
          partId: occB.partId,
          afterRevision: occB.partRevision,
          afterTransform: occB.localTransform.matrix,
          description: `Component occurrence ${id} (${occB.name}, Part: ${occB.partId}:${occB.partRevision}) was added.`
        });
      }
    }

    // 3. Check for Constraint Diffs
    for (const [id, cB] of graphB.constraints) {
      const cA = graphA.constraints.get(id);
      if (!cA) {
        modifiedCount++;
        diffItems.push({
          diffType: ComponentDiffType.CONSTRAINT_CHANGED,
          occurrenceId: cB.sourceOccurrenceId,
          description: `Constraint ${id} (${cB.name}, ${cB.constraintType}) was added.`
        });
      } else if (cA.constraintType !== cB.constraintType || cA.status !== cB.status || cA.offsetMm !== cB.offsetMm) {
        modifiedCount++;
        diffItems.push({
          diffType: ComponentDiffType.CONSTRAINT_CHANGED,
          occurrenceId: cB.sourceOccurrenceId,
          description: `Constraint ${id} (${cB.name}) properties were modified.`
        });
      }
    }

    for (const [id, cA] of graphA.constraints) {
      if (!graphB.constraints.has(id)) {
        modifiedCount++;
        diffItems.push({
          diffType: ComponentDiffType.CONSTRAINT_CHANGED,
          occurrenceId: cA.sourceOccurrenceId,
          description: `Constraint ${id} (${cA.name}) was removed.`
        });
      }
    }

    // 4. Check for Interface Diffs
    for (const [id, iB] of graphB.interfaces) {
      const iA = graphA.interfaces.get(id);
      if (!iA) {
        modifiedCount++;
        diffItems.push({
          diffType: ComponentDiffType.INTERFACE_CHANGED,
          occurrenceId: iB.sourceOccurrenceId,
          description: `Interface ${id} (${iB.name}, ${iB.interfaceType}) was added.`
        });
      }
    }

    const isIdentical = diffItems.length === 0;

    return {
      assemblyId: graphB.assemblyId,
      sourceRevision: graphA.assemblyRevision,
      targetRevision: graphB.assemblyRevision,
      isIdentical,
      diffItems,
      addedCount,
      removedCount,
      movedCount,
      modifiedCount
    };
  }
}
