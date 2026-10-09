/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-261 — Tool Snapshot & Invalidation Engine
 * 
 * Captures immutable snapshots of tools and assemblies when assigned to CAM operations.
 * Detects catalog modifications, compares geometry/parameter revisions, and manages
 * automatic invalidation of downstream toolpaths, collision checks, and stock simulations.
 */

import {
  CAMTool,
  ToolAssembly,
  ToolSnapshot,
  ToolChangeInvalidationReport,
  ToolUUID
} from './ToolTypes';
import { generateDeterministicHash, generateDeterministicHashSync } from '../../../lib/hash';

export class ToolSnapshotManager {
  private static snapshots: Map<string, ToolSnapshot> = new Map();

  /**
   * Captures an immutable snapshot of a tool (and optional assembly) for an operation
   */
  public static async captureSnapshot(
    tool: CAMTool,
    assembly?: ToolAssembly,
    operationId?: string,
    operationName?: string
  ): Promise<ToolSnapshot> {
    const capturedAtTimestamp = Date.now();
    const snapshotId = `SNAP_${tool.toolUUID.substring(0, 8)}_${generateDeterministicHashSync({
      toolUUID: tool.toolUUID,
      operationId,
      ts: capturedAtTimestamp
    }).substring(0, 16)}`;

    const snapshotPayload = {
      snapshotId,
      toolUUID: tool.toolUUID,
      toolVersion: tool.version.versionString,
      geometryHash: tool.geometry.geometryHash,
      assemblyHash: assembly?.assemblyHash || 'NO_ASSEMBLY',
      dimensions: tool.geometry.dimensions,
      cuttingParameters: tool.cuttingParameters,
      operationId: operationId || 'GENERAL'
    };

    const snapshotHash = await generateDeterministicHash(snapshotPayload);

    // Deep clone tool and assembly to prevent retrospective mutation
    const frozenTool: CAMTool = JSON.parse(JSON.stringify(tool));
    const frozenAssembly: ToolAssembly | undefined = assembly ? JSON.parse(JSON.stringify(assembly)) : undefined;

    const snapshot: ToolSnapshot = {
      snapshotId,
      toolUUID: tool.toolUUID,
      toolVersion: tool.version.versionString,
      toolName: tool.name,
      toolType: tool.type,
      capturedAtTimestamp,
      geometryHash: tool.geometry.geometryHash,
      snapshotHash,
      frozenTool,
      frozenAssembly,
      assignedOperationId: operationId,
      assignedOperationName: operationName
    };

    this.snapshots.set(snapshotId, snapshot);
    return snapshot;
  }

  /**
   * Retrieves a snapshot by ID
   */
  public static getSnapshot(snapshotId: string): ToolSnapshot | undefined {
    return this.snapshots.get(snapshotId);
  }

  /**
   * Evaluates if changes between a snapshot and the current catalog tool require CAM invalidation
   */
  public static evaluateChangeInvalidation(
    snapshot: ToolSnapshot,
    currentTool: CAMTool,
    currentAssembly?: ToolAssembly
  ): ToolChangeInvalidationReport {
    const snapGeom = snapshot.frozenTool.geometry;
    const currGeom = currentTool.geometry;

    const geometryChanged = snapGeom.geometryHash !== currGeom.geometryHash;
    
    // Check specific dimension differences
    const snapDims = snapGeom.dimensions;
    const currDims = currGeom.dimensions;
    const dimensionsChanged = 
      snapDims.cuttingDiameterMm !== currDims.cuttingDiameterMm ||
      snapDims.cuttingLengthMm !== currDims.cuttingLengthMm ||
      snapDims.overallLengthMm !== currDims.overallLengthMm ||
      snapDims.shankDiameterMm !== currDims.shankDiameterMm ||
      snapDims.cornerRadiusMm !== currDims.cornerRadiusMm ||
      snapDims.tipAngleDeg !== currDims.tipAngleDeg ||
      snapDims.fluteCount !== currDims.fluteCount;

    // Check parameter differences
    const parametersChanged = JSON.stringify(snapshot.frozenTool.cuttingParameters) !== JSON.stringify(currentTool.cuttingParameters);

    // Check holder differences
    let holderChanged = false;
    if (snapshot.frozenAssembly && currentAssembly) {
      holderChanged = snapshot.frozenAssembly.assemblyHash !== currentAssembly.assemblyHash;
    } else if (Boolean(snapshot.frozenAssembly) !== Boolean(currentAssembly)) {
      holderChanged = true;
    }

    const invalidationRequired = geometryChanged || dimensionsChanged || parametersChanged || holderChanged;

    const reasons: string[] = [];
    if (geometryChanged) reasons.push('Geometry hash altered');
    if (dimensionsChanged) reasons.push('Tool dimensions modified');
    if (parametersChanged) reasons.push('Cutting speeds/feeds updated');
    if (holderChanged) reasons.push('Tool holder or stickout length changed');

    return {
      toolUUID: currentTool.toolUUID,
      currentCatalogVersion: currentTool.version.versionString,
      snapshotVersion: snapshot.toolVersion,
      geometryChanged,
      dimensionsChanged,
      parametersChanged,
      holderChanged,
      invalidationRequired,
      affectedOperations: snapshot.assignedOperationId ? [snapshot.assignedOperationId] : [],
      invalidationReason: reasons.length > 0 ? reasons.join('; ') : 'No changes detected'
    };
  }

  /**
   * Clears all snapshot records (for testing & reset)
   */
  public static clearSnapshots(): void {
    this.snapshots.clear();
  }
}
