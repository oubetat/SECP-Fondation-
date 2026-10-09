/**
 * PATCH-113: Assembly Graph Validator
 * Rigorous multi-rule validator detecting cycles, orphans, missing definitions, broken constraints & transforms
 */

import {
  AssemblyNode,
  AssemblyOccurrence,
  AssemblyEdge,
  AssemblyConstraint,
  AssemblyInterface,
  AssemblyConfiguration,
  PartDefinition,
  AssemblyValidationError,
  AssemblyValidationReport,
  AssemblyErrorCode,
  ValidationSeverity,
  AssemblyEdgeType
} from "./types";
import { TransformMatrix } from "./TransformMatrix";

export class AssemblyGraphValidator {
  /**
   * Validate entire Assembly Graph
   */
  public static validate(data: {
    assemblyId: string;
    assemblyRevision: string;
    nodes: Map<string, AssemblyNode> | AssemblyNode[];
    occurrences: Map<string, AssemblyOccurrence> | AssemblyOccurrence[];
    edges: Map<string, AssemblyEdge> | AssemblyEdge[];
    constraints: AssemblyConstraint[];
    interfaces: AssemblyInterface[];
    configurations: AssemblyConfiguration[];
    partDefinitions: Map<string, PartDefinition> | PartDefinition[];
    rootOccurrenceId?: string;
  }): AssemblyValidationReport {
    const errors: AssemblyValidationError[] = [];
    const nodeErrors: AssemblyValidationError[] = [];
    const edgeErrors: AssemblyValidationError[] = [];
    const referenceErrors: AssemblyValidationError[] = [];
    const transformErrors: AssemblyValidationError[] = [];
    const constraintErrors: AssemblyValidationError[] = [];
    const configurationErrors: AssemblyValidationError[] = [];
    const revisionErrors: AssemblyValidationError[] = [];
    const cycleErrors: AssemblyValidationError[] = [];
    const orphanErrors: AssemblyValidationError[] = [];

    // Helper conversions
    const nodeMap = data.nodes instanceof Map ? data.nodes : new Map(data.nodes.map(n => [n.nodeId, n]));
    const occMap = data.occurrences instanceof Map ? data.occurrences : new Map(data.occurrences.map(o => [o.occurrenceId, o]));
    const edgeList = Array.isArray(data.edges) ? data.edges : Array.from(data.edges.values());
    const partDefList = data.partDefinitions instanceof Map ? Array.from(data.partDefinitions.values()) : data.partDefinitions;
    const partMap = new Map<string, PartDefinition>(partDefList.map(p => [`${p.partId}:${p.partRevision}`, p]));
    const rawPartIdMap = new Map<string, PartDefinition>(partDefList.map(p => [p.partId, p]));

    const addErr = (err: AssemblyValidationError, bucket?: AssemblyValidationError[]) => {
      errors.push(err);
      if (bucket) bucket.push(err);
    };

    // 1. Duplicate ID validation
    const seenNodeIds = new Set<string>();
    const nodeArray = Array.isArray(data.nodes) ? data.nodes : Array.from(data.nodes.values());
    for (const node of nodeArray) {
      if (seenNodeIds.has(node.nodeId)) {
        addErr({
          errorCode: AssemblyErrorCode.DUPLICATE_NODE_ID,
          severity: ValidationSeverity.CRITICAL,
          message: `Duplicate Assembly Node ID detected: ${node.nodeId}`,
          nodeId: node.nodeId
        }, nodeErrors);
      }
      seenNodeIds.add(node.nodeId);
    }

    const seenOccIds = new Set<string>();
    const occArray = Array.isArray(data.occurrences) ? data.occurrences : Array.from(data.occurrences.values());
    for (const occ of occArray) {
      if (seenOccIds.has(occ.occurrenceId)) {
        addErr({
          errorCode: AssemblyErrorCode.DUPLICATE_OCCURRENCE_ID,
          severity: ValidationSeverity.CRITICAL,
          message: `Duplicate Assembly Occurrence ID detected: ${occ.occurrenceId}`,
          occurrenceId: occ.occurrenceId
        }, nodeErrors);
      }
      seenOccIds.add(occ.occurrenceId);
    }

    const seenEdgeIds = new Set<string>();
    for (const edge of edgeList) {
      if (seenEdgeIds.has(edge.edgeId)) {
        addErr({
          errorCode: AssemblyErrorCode.DUPLICATE_EDGE_ID,
          severity: ValidationSeverity.ERROR,
          message: `Duplicate Assembly Edge ID detected: ${edge.edgeId}`,
          edgeId: edge.edgeId
        }, edgeErrors);
      }
      seenEdgeIds.add(edge.edgeId);
    }

    // 2. Part Definition & Revision Integrity
    for (const [occId, occ] of occMap) {
      if (occ.nodeType === "PART" || occ.nodeType === "COMPONENT" || occ.nodeType === "FASTENER") {
        if (!occ.partId || occ.partId.trim() === "") {
          addErr({
            errorCode: AssemblyErrorCode.MISSING_PART_DEFINITION,
            severity: ValidationSeverity.CRITICAL,
            message: `Occurrence ${occId} has empty partId`,
            occurrenceId: occId
          }, referenceErrors);
        } else {
          const fullKey = `${occ.partId}:${occ.partRevision}`;
          const partDef = partMap.get(fullKey);
          if (!partDef) {
            // Check if partId exists with different revision
            const anyPart = rawPartIdMap.get(occ.partId);
            if (anyPart) {
              addErr({
                errorCode: AssemblyErrorCode.INVALID_REVISION_REFERENCE,
                severity: ValidationSeverity.CRITICAL,
                message: `Occurrence ${occId} references Part ${occ.partId} revision ${occ.partRevision}, but master has ${anyPart.partRevision}`,
                occurrenceId: occId
              }, revisionErrors);
            } else {
              addErr({
                errorCode: AssemblyErrorCode.MISSING_PART_DEFINITION,
                severity: ValidationSeverity.CRITICAL,
                message: `Occurrence ${occId} references unknown Part Definition: ${occ.partId}`,
                occurrenceId: occId
              }, referenceErrors);
            }
          }
        }
      }
    }

    // 3. Parent References & Orphan Detection
    let rootOccCount = 0;
    for (const [occId, occ] of occMap) {
      if (occ.parentOccurrenceId === null || occ.parentOccurrenceId === undefined || occ.parentOccurrenceId === "") {
        rootOccCount++;
        if (data.rootOccurrenceId && occ.occurrenceId !== data.rootOccurrenceId && rootOccCount > 1) {
          addErr({
            errorCode: AssemblyErrorCode.ORPHAN_OCCURRENCE,
            severity: ValidationSeverity.ERROR,
            message: `Occurrence ${occId} has no parent but is not the declared root occurrence`,
            occurrenceId: occId
          }, orphanErrors);
        }
      } else {
        if (!occMap.has(occ.parentOccurrenceId)) {
          addErr({
            errorCode: AssemblyErrorCode.INVALID_PARENT_REFERENCE,
            severity: ValidationSeverity.CRITICAL,
            message: `Occurrence ${occId} references non-existent parentOccurrenceId: ${occ.parentOccurrenceId}`,
            occurrenceId: occId
          }, referenceErrors);
        }
      }
    }

    // 4. Containment Cycle Detection (DFS on parentOccurrenceId graph)
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const checkCycle = (currId: string, path: string[]): boolean => {
      visited.add(currId);
      recStack.add(currId);

      const children = Array.from(occMap.values()).filter(o => o.parentOccurrenceId === currId);
      for (const child of children) {
        if (!visited.has(child.occurrenceId)) {
          if (checkCycle(child.occurrenceId, [...path, child.occurrenceId])) {
            return true;
          }
        } else if (recStack.has(child.occurrenceId)) {
          addErr({
            errorCode: AssemblyErrorCode.CONTAINMENT_CYCLE,
            severity: ValidationSeverity.CRITICAL,
            message: `Containment cycle detected: ${path.join(" -> ")} -> ${child.occurrenceId}`,
            occurrenceId: child.occurrenceId
          }, cycleErrors);
          return true;
        }
      }

      recStack.delete(currId);
      return false;
    };

    for (const [occId] of occMap) {
      if (!visited.has(occId)) {
        checkCycle(occId, [occId]);
      }
    }

    // 5. Transform Sanity Validation
    for (const [occId, occ] of occMap) {
      if (occ.localTransform && !TransformMatrix.isValidTransform(occ.localTransform.matrix)) {
        addErr({
          errorCode: AssemblyErrorCode.INVALID_TRANSFORM,
          severity: ValidationSeverity.CRITICAL,
          message: `Occurrence ${occId} has invalid or non-homogeneous local transform matrix`,
          occurrenceId: occId
        }, transformErrors);
      }
      if (occ.worldTransform && !TransformMatrix.isValidTransform(occ.worldTransform.matrix)) {
        addErr({
          errorCode: AssemblyErrorCode.INVALID_TRANSFORM,
          severity: ValidationSeverity.CRITICAL,
          message: `Occurrence ${occId} has invalid or non-homogeneous world transform matrix`,
          occurrenceId: occId
        }, transformErrors);
      }
    }

    // 6. Constraint Topology Reference Validation
    for (const c of data.constraints) {
      if (!occMap.has(c.sourceOccurrenceId)) {
        addErr({
          errorCode: AssemblyErrorCode.BROKEN_REFERENCE,
          severity: ValidationSeverity.ERROR,
          message: `Constraint ${c.constraintId} (${c.name}) source occurrence not found: ${c.sourceOccurrenceId}`,
          constraintId: c.constraintId
        }, constraintErrors);
      }
      if (!occMap.has(c.targetOccurrenceId)) {
        addErr({
          errorCode: AssemblyErrorCode.BROKEN_REFERENCE,
          severity: ValidationSeverity.ERROR,
          message: `Constraint ${c.constraintId} (${c.name}) target occurrence not found: ${c.targetOccurrenceId}`,
          constraintId: c.constraintId
        }, constraintErrors);
      }
      if (c.sourceOccurrenceId === c.targetOccurrenceId) {
        addErr({
          errorCode: AssemblyErrorCode.BROKEN_REFERENCE,
          severity: ValidationSeverity.WARNING,
          message: `Constraint ${c.constraintId} binds occurrence ${c.sourceOccurrenceId} to itself`,
          constraintId: c.constraintId
        }, constraintErrors);
      }
    }

    // 7. Interfaces Validation
    for (const iface of data.interfaces) {
      if (!occMap.has(iface.sourceOccurrenceId)) {
        addErr({
          errorCode: AssemblyErrorCode.BROKEN_REFERENCE,
          severity: ValidationSeverity.ERROR,
          message: `Interface ${iface.interfaceId} (${iface.name}) source occurrence not found: ${iface.sourceOccurrenceId}`
        }, referenceErrors);
      }
      if (!occMap.has(iface.targetOccurrenceId)) {
        addErr({
          errorCode: AssemblyErrorCode.BROKEN_REFERENCE,
          severity: ValidationSeverity.ERROR,
          message: `Interface ${iface.interfaceId} (${iface.name}) target occurrence not found: ${iface.targetOccurrenceId}`
        }, referenceErrors);
      }
    }

    // 8. Configuration Validation
    for (const config of data.configurations) {
      for (const occId of Object.keys(config.occurrenceStates)) {
        if (!occMap.has(occId)) {
          addErr({
            errorCode: AssemblyErrorCode.INVALID_CONFIGURATION,
            severity: ValidationSeverity.WARNING,
            message: `Configuration ${config.configurationId} references non-existent occurrence: ${occId}`,
            occurrenceId: occId
          }, configurationErrors);
        }
      }
    }

    // Summary calculation
    const criticalOrErrorCount = errors.filter(e => e.severity === ValidationSeverity.CRITICAL || e.severity === ValidationSeverity.ERROR).length;
    const warningCount = errors.filter(e => e.severity === ValidationSeverity.WARNING).length;

    return {
      assemblyId: data.assemblyId,
      assemblyRevision: data.assemblyRevision,
      graphValid: criticalOrErrorCount === 0,
      totalErrors: criticalOrErrorCount,
      totalWarnings: warningCount,
      nodeErrors,
      edgeErrors,
      referenceErrors,
      transformErrors,
      constraintErrors,
      configurationErrors,
      revisionErrors,
      cycleErrors,
      orphanErrors,
      allErrors: errors,
      evaluatedAt: Date.now()
    };
  }
}
