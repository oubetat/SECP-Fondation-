/**
 * SECP CAD/CAE Platform - Boundary Condition Registry & OS Invalidation Manager
 * PATCH-235 — Boundary Condition Engine
 *
 * Manages boundary condition definitions, load cases, revisions, and coordinates
 * result invalidation across the Engineering Data OS (PATCH-181 / PATCH-190).
 */

import {
  BoundaryConditionDefinition,
  LoadCase,
  CoordinateSystem,
  BCDiagnosticIssue
} from './BoundaryConditionTypes';

export interface InvalidationEvent {
  eventId: string;
  triggerType: 'BC_ADDED' | 'BC_MODIFIED' | 'BC_DELETED' | 'MESH_CHANGED' | 'MATERIAL_CHANGED' | 'LOAD_CASE_CHANGED';
  timestamp: number;
  invalidatedResultIds: string[];
  bcRevision: number;
  configurationHash: string;
}

export class BoundaryConditionRegistry {
  private bcs: Map<string, BoundaryConditionDefinition> = new Map();
  private loadCases: Map<string, LoadCase> = new Map();
  private defaultCoordinateSystem: CoordinateSystem;
  private currentRevision: number = 1;
  private invalidationHistory: InvalidationEvent[] = [];

  constructor() {
    this.defaultCoordinateSystem = {
      id: 'CS_GLOBAL',
      name: 'Global Cartesian CS',
      type: 'GLOBAL',
      origin: { x: 0, y: 0, z: 0 },
      xAxis: { x: 1, y: 0, z: 0 },
      yAxis: { x: 0, y: 1, z: 0 },
      zAxis: { x: 0, y: 0, z: 1 }
    };

    // Initialize Default Static Load Case
    const defaultLC: LoadCase = {
      id: 'LC_01_STATIC',
      name: 'Load Case 01 — Static Main',
      type: 'STATIC',
      description: 'Primary static operational loading & support condition case',
      boundaryConditionIds: [],
      analysisSettings: {
        enforcementMethod: 'ROW_COLUMN_MODIFICATION',
        checkUnderConstrained: true,
        checkConflicts: true
      },
      revision: 1
    };
    this.loadCases.set(defaultLC.id, defaultLC);
  }

  public getDefaultCoordinateSystem(): CoordinateSystem {
    return this.defaultCoordinateSystem;
  }

  public getBoundaryCondition(id: string): BoundaryConditionDefinition | undefined {
    return this.bcs.get(id);
  }

  public getAllBoundaryConditions(): BoundaryConditionDefinition[] {
    return Array.from(this.bcs.values());
  }

  public getLoadCase(id: string): LoadCase | undefined {
    return this.loadCases.get(id);
  }

  public getAllLoadCases(): LoadCase[] {
    return Array.from(this.loadCases.values());
  }

  public registerBoundaryCondition(bc: BoundaryConditionDefinition): BoundaryConditionDefinition {
    this.currentRevision++;
    const registered: BoundaryConditionDefinition = {
      ...bc,
      revision: this.currentRevision,
      timestamp: Date.now()
    };
    this.bcs.set(registered.id, registered);

    // Link to load case
    const lc = this.loadCases.get(bc.loadCaseId);
    if (lc && !lc.boundaryConditionIds.includes(bc.id)) {
      lc.boundaryConditionIds.push(bc.id);
      lc.revision++;
    }

    this.triggerInvalidation('BC_ADDED', [bc.id]);
    return registered;
  }

  public updateBoundaryCondition(bc: BoundaryConditionDefinition): BoundaryConditionDefinition {
    this.currentRevision++;
    const updated: BoundaryConditionDefinition = {
      ...bc,
      revision: this.currentRevision,
      timestamp: Date.now()
    };
    this.bcs.set(updated.id, updated);
    this.triggerInvalidation('BC_MODIFIED', [bc.id]);
    return updated;
  }

  public removeBoundaryCondition(id: string): boolean {
    const bc = this.bcs.get(id);
    if (!bc) return false;

    this.bcs.delete(id);
    this.currentRevision++;

    // Unlink from load cases
    this.loadCases.forEach((lc) => {
      lc.boundaryConditionIds = lc.boundaryConditionIds.filter((bId) => bId !== id);
    });

    this.triggerInvalidation('BC_DELETED', [id]);
    return true;
  }

  public registerLoadCase(lc: LoadCase): LoadCase {
    this.loadCases.set(lc.id, lc);
    this.triggerInvalidation('LOAD_CASE_CHANGED', [lc.id]);
    return lc;
  }

  public computeBCConfigurationHash(): string {
    const allBCs = this.getAllBoundaryConditions();
    const sortedStr = allBCs
      .map((b) => `${b.id}:${b.type}:${b.enabled}:${b.revision}`)
      .sort()
      .join('|');

    return BoundaryConditionRegistry.simpleHash(sortedStr);
  }

  public triggerInvalidation(
    triggerType: InvalidationEvent['triggerType'],
    affectedIds: string[]
  ): InvalidationEvent {
    const event: InvalidationEvent = {
      eventId: `INV_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      triggerType,
      timestamp: Date.now(),
      invalidatedResultIds: ['PREVIOUS_FEM_SOLVE_RESULT_INVALIDATED'],
      bcRevision: this.currentRevision,
      configurationHash: this.computeBCConfigurationHash()
    };

    this.invalidationHistory.push(event);
    return event;
  }

  public getInvalidationHistory(): InvalidationEvent[] {
    return [...this.invalidationHistory];
  }

  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `BC_HASH_${Math.abs(hash).toString(16)}`;
  }
}
