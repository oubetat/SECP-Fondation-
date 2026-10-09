/**
 * SECP Industrial OS v3 — Real CAM Kernel
 * PATCH-261 — CAM Tool Library Unified Facade Engine
 * 
 * Central controller coordinating Tool Repository, Geometry Engine, Assembly Engine,
 * Cutting Parameters Calculator, Validator, Snapshot Invalidation Manager, and Evidence Generator.
 */

import {
  CAMTool,
  ToolUUID,
  ToolType,
  ToolCategory,
  ToolDimensions,
  ToolMaterial,
  ToolCoating,
  ToolAssembly,
  ToolHolderDefinition,
  ToolSnapshot,
  ToolEvidence,
  ToolValidationResult,
  ToolChangeInvalidationReport,
  HolderInterfaceType,
  LibraryScope
} from './ToolTypes';
import { ToolRepository } from './ToolRepository';
import { ToolGeometryEngine } from './ToolGeometryEngine';
import { ToolAssemblyEngine } from './ToolAssemblyEngine';
import { ToolCuttingCalculator } from './ToolCuttingCalculator';
import { ToolValidator } from './ToolValidator';
import { ToolSnapshotManager } from './ToolSnapshotManager';
import { ToolEvidenceGenerator } from './ToolEvidenceGenerator';

export class ToolLibraryEngine {
  /**
   * Initializes the tool library with standard presets
   */
  public static async initialize(): Promise<void> {
    await ToolRepository.initialize();
  }

  /**
   * Retrieves all tools in the library
   */
  public static getAllTools(includeArchived: boolean = false): CAMTool[] {
    return ToolRepository.getAllTools(includeArchived);
  }

  /**
   * Retrieves a tool by UUID
   */
  public static getToolByUUID(uuid: ToolUUID): CAMTool | undefined {
    return ToolRepository.getToolByUUID(uuid);
  }

  /**
   * Searches and filters tools
   */
  public static searchTools(filters: {
    query?: string;
    type?: ToolType;
    category?: ToolCategory;
    material?: ToolMaterial;
    coating?: ToolCoating;
    minDiameterMm?: number;
    maxDiameterMm?: number;
    fluteCount?: number;
    holderInterface?: HolderInterfaceType;
    scope?: LibraryScope;
  }): CAMTool[] {
    return ToolRepository.searchTools(filters);
  }

  /**
   * Creates a new tool
   */
  public static async createTool(params: {
    toolId: string;
    name: string;
    type: ToolType;
    category: ToolCategory;
    dimensions: ToolDimensions;
    material: ToolMaterial;
    coating: ToolCoating;
    scope?: LibraryScope;
    projectId?: string;
    manufacturerName?: string;
  }): Promise<CAMTool> {
    return ToolRepository.createTool(params);
  }

  /**
   * Updates an existing tool (handling revision increment)
   */
  public static async updateTool(
    toolUUID: ToolUUID,
    updates: Partial<{
      name: string;
      dimensions: ToolDimensions;
      material: ToolMaterial;
      coating: ToolCoating;
      changeNote: string;
    }>
  ): Promise<CAMTool> {
    return ToolRepository.updateTool(toolUUID, updates);
  }

  /**
   * Duplicates a tool
   */
  public static async duplicateTool(sourceUUID: ToolUUID, newToolId?: string): Promise<CAMTool> {
    return ToolRepository.duplicateTool(sourceUUID, newToolId);
  }

  /**
   * Archives a tool
   */
  public static async archiveTool(toolUUID: ToolUUID): Promise<void> {
    await ToolRepository.archiveTool(toolUUID);
  }

  /**
   * Restores an archived tool
   */
  public static async restoreTool(toolUUID: ToolUUID): Promise<void> {
    await ToolRepository.restoreTool(toolUUID);
  }

  /**
   * Standard holders catalog
   */
  public static getStandardHolders(): ToolHolderDefinition[] {
    return ToolAssemblyEngine.getStandardHolders();
  }

  /**
   * Creates a tool assembly
   */
  public static async createAssembly(
    tool: CAMTool,
    holder: ToolHolderDefinition,
    stickOutMm?: number
  ): Promise<ToolAssembly> {
    return ToolAssemblyEngine.createAssembly(tool, holder, stickOutMm);
  }

  /**
   * Captures a tool snapshot for CAM toolpaths
   */
  public static async captureSnapshot(
    tool: CAMTool,
    assembly?: ToolAssembly,
    operationId?: string,
    operationName?: string
  ): Promise<ToolSnapshot> {
    return ToolSnapshotManager.captureSnapshot(tool, assembly, operationId, operationName);
  }

  /**
   * Evaluates if changes between snapshot and catalog require toolpath invalidation
   */
  public static evaluateChangeInvalidation(
    snapshot: ToolSnapshot,
    currentTool: CAMTool,
    currentAssembly?: ToolAssembly
  ): ToolChangeInvalidationReport {
    return ToolSnapshotManager.evaluateChangeInvalidation(snapshot, currentTool, currentAssembly);
  }

  /**
   * Validates tool entity
   */
  public static validateTool(tool: CAMTool): ToolValidationResult {
    return ToolValidator.validateTool(tool);
  }

  /**
   * Generates manufacturing evidence
   */
  public static async generateEvidence(
    tool: CAMTool,
    assembly?: ToolAssembly,
    snapshot?: ToolSnapshot
  ): Promise<ToolEvidence> {
    return ToolEvidenceGenerator.generateEvidence(tool, assembly, snapshot);
  }

  /**
   * Exports library to JSON
   */
  public static exportLibraryJson(toolUUIDs?: ToolUUID[]): string {
    return ToolRepository.exportLibraryJson(toolUUIDs);
  }

  /**
   * Imports library from JSON
   */
  public static async importLibraryJson(jsonString: string): Promise<{ importedCount: number; errors: string[] }> {
    return ToolRepository.importLibraryJson(jsonString);
  }

  /**
   * Retrieves audit logs
   */
  public static getAuditTrail(toolUUID?: ToolUUID) {
    return ToolRepository.getAuditTrail(toolUUID);
  }
}
