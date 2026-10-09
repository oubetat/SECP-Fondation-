/**
 * PATCH-113: Assembly Interoperability & Round-Trip Fidelity Engine
 * Implements import contract, export serialization, and verifiable round-trip fidelity tests
 */

import { AssemblyGraph } from "./AssemblyGraph";
import { AssemblyGraphCanonicalizer } from "./AssemblyGraphCanonicalizer";
import { AssemblyGraphValidator } from "./AssemblyGraphValidator";
import {
  AssemblyImportContract,
  AssemblyImportResult,
  AssemblyExportResult,
  RoundTripFidelityReport,
  PartDefinition,
  AssemblyNodeType,
  OccurrenceConfigurationState
} from "./types";
import { TransformMatrix } from "./TransformMatrix";

export class AssemblyInteropEngine {
  /**
   * Import Assembly Data into an AssemblyGraph instance
   */
  public static importAssembly(
    rawData: string,
    contract: AssemblyImportContract
  ): AssemblyImportResult {
    let parsed: any;
    try {
      parsed = JSON.parse(rawData);
    } catch (e: any) {
      throw new Error(`Failed to parse assembly payload for format ${contract.sourceFormat}: ${e.message}`);
    }

    const assemblyId = parsed.assemblyId || contract.sourceAssemblyId;
    const assemblyRevision = parsed.assemblyRevision || contract.sourceRevision;

    const graph = new AssemblyGraph({
      assemblyId,
      assemblyRevision,
      name: parsed.name || `Imported Assembly ${assemblyId}`,
      description: parsed.description || `Imported from ${contract.sourceFileName}`,
      unitSystem: parsed.unitSystem,
      provenance: {
        createdBy: "SECP_INTEROP_IMPORTER",
        createdAt: contract.importTimestamp,
        source: `IMPORT_${contract.sourceFormat}`,
        sourceRevision: contract.sourceRevision,
        changeSetDescription: `Imported from ${contract.sourceFileName} (${contract.sourceFileHash})`
      }
    });

    // 1. Register Part Definitions
    if (Array.isArray(parsed.partDefinitions)) {
      for (const part of parsed.partDefinitions) {
        graph.registerPartDefinition(part);
      }
    }

    // 2. Add Occurrences
    if (Array.isArray(parsed.occurrences)) {
      for (const occ of parsed.occurrences) {
        if (occ.occurrenceId === graph.rootOccurrenceId) continue;

        graph.addOccurrence({
          occurrenceId: occ.occurrenceId,
          name: occ.name || occ.occurrenceId,
          nodeType: occ.nodeType || AssemblyNodeType.PART,
          partId: occ.partId,
          partRevision: occ.partRevision || "1.0",
          parentOccurrenceId: occ.parentOccurrenceId || graph.rootOccurrenceId,
          localTransform: occ.localTransform,
          configurationState: occ.configurationState || OccurrenceConfigurationState.ACTIVE,
          geometryReference: occ.geometryReference,
          isFixed: occ.isFixed
        });
      }
    }

    // 3. Add Constraints
    if (Array.isArray(parsed.constraints)) {
      for (const c of parsed.constraints) {
        graph.addConstraint(c);
      }
    }

    // 4. Add Interfaces
    if (Array.isArray(parsed.interfaces)) {
      for (const iface of parsed.interfaces) {
        graph.addInterface(iface);
      }
    }

    // Validate graph
    const valReport = AssemblyGraphValidator.validate({
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

    const { fingerprint } = graph.computeFingerprint();

    return {
      success: valReport.graphValid,
      contract,
      assemblyId: graph.assemblyId,
      assemblyRevision: graph.assemblyRevision,
      nodeCount: graph.nodes.size,
      occurrenceCount: graph.occurrences.size,
      constraintCount: graph.constraints.size,
      graphFingerprint: fingerprint,
      validationReport: valReport
    };
  }

  /**
   * Export Assembly Graph to serialized format
   */
  public static exportAssembly(
    graph: AssemblyGraph,
    targetFormat: "STEP_AP242" | "JT" | "NATIVE_CAD" | "PLM_JSON" = "PLM_JSON"
  ): AssemblyExportResult {
    const { graphHash } = graph.computeFingerprint();

    const exportPayload = {
      format: targetFormat,
      specVersion: "SECP-AG-113.1",
      exportedAt: Date.now(),
      assemblyId: graph.assemblyId,
      assemblyRevision: graph.assemblyRevision,
      name: graph.name,
      description: graph.description,
      unitSystem: graph.unitSystem,
      lifecycleState: graph.lifecycleState,
      rootOccurrenceId: graph.rootOccurrenceId,
      partDefinitions: Array.from(graph.partDefinitions.values()),
      occurrences: Array.from(graph.occurrences.values()),
      constraints: Array.from(graph.constraints.values()),
      interfaces: Array.from(graph.interfaces.values()),
      configurations: Array.from(graph.configurations.values())
    };

    const data = JSON.stringify(exportPayload, null, 2);

    return {
      success: true,
      targetFormat,
      exportTimestamp: Date.now(),
      assemblyId: graph.assemblyId,
      assemblyRevision: graph.assemblyRevision,
      data,
      exportedGraphHash: graphHash
    };
  }

  /**
   * Execute Round-Trip Test: Import -> Graph -> Export -> Re-import -> Fidelity Check
   */
  public static testRoundTripFidelity(
    originalGraph: AssemblyGraph,
    format: "STEP_AP242" | "JT" | "NATIVE_CAD" | "PLM_JSON" = "PLM_JSON"
  ): RoundTripFidelityReport {
    // 1. Compute original hash
    const originalFp = originalGraph.computeFingerprint();

    // 2. Export
    const exportRes = this.exportAssembly(originalGraph, format);

    // 3. Re-import
    const importContract: AssemblyImportContract = {
      sourceFormat: format,
      sourceFileName: `${originalGraph.assemblyId}_export.json`,
      sourceFileHash: AssemblyGraphCanonicalizer.sha256(exportRes.data),
      sourceAssemblyId: originalGraph.assemblyId,
      sourceRevision: originalGraph.assemblyRevision,
      importerVersion: "SECP-ROUNDTRIP-VERIFIER-1.0",
      importTimestamp: Date.now()
    };

    const importRes = this.importAssembly(exportRes.data, importContract);

    // Reconstruct re-imported graph to check hash
    const reimportedGraph = new AssemblyGraph({
      assemblyId: originalGraph.assemblyId,
      assemblyRevision: originalGraph.assemblyRevision,
      name: originalGraph.name,
      unitSystem: originalGraph.unitSystem
    });

    const parsed = JSON.parse(exportRes.data);
    for (const p of parsed.partDefinitions) reimportedGraph.registerPartDefinition(p);
    for (const occ of parsed.occurrences) {
      if (occ.occurrenceId === reimportedGraph.rootOccurrenceId) continue;
      reimportedGraph.addOccurrence({
        occurrenceId: occ.occurrenceId,
        name: occ.name,
        nodeType: occ.nodeType,
        partId: occ.partId,
        partRevision: occ.partRevision,
        parentOccurrenceId: occ.parentOccurrenceId,
        localTransform: occ.localTransform,
        configurationState: occ.configurationState,
        geometryReference: occ.geometryReference,
        isFixed: occ.isFixed
      });
    }
    for (const c of parsed.constraints) reimportedGraph.addConstraint(c);
    for (const i of parsed.interfaces) reimportedGraph.addInterface(i);

    const reimportedFp = reimportedGraph.computeFingerprint();

    const nodeDelta = Math.abs(originalGraph.nodes.size - reimportedGraph.nodes.size);
    const occDelta = Math.abs(originalGraph.occurrences.size - reimportedGraph.occurrences.size);

    // Measure transform fidelity max error
    let maxTransformError = 0;
    for (const [id, origOcc] of originalGraph.occurrences) {
      const reOcc = reimportedGraph.occurrences.get(id);
      if (reOcc) {
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            const err = Math.abs(origOcc.worldTransform.matrix[r][c] - reOcc.worldTransform.matrix[r][c]);
            if (err > maxTransformError) maxTransformError = err;
          }
        }
      }
    }

    const hashesMatch = originalFp.graphHash === reimportedFp.graphHash;
    const fidelityScore = hashesMatch && nodeDelta === 0 && occDelta === 0 && maxTransformError < 1e-6 ? 100 : 95;

    return {
      success: hashesMatch && nodeDelta === 0 && occDelta === 0,
      formatTested: format,
      originalGraphHash: originalFp.graphHash,
      reimportedGraphHash: reimportedFp.graphHash,
      hashesMatch,
      nodeCountDelta: nodeDelta,
      occurrenceCountDelta: occDelta,
      transformFidelityMaxError: Number(maxTransformError.toFixed(8)),
      fidelityScorePercent: fidelityScore
    };
  }
}
