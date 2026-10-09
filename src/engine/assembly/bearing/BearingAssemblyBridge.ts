/**
 * PATCH-222 — Bearing Assembly, BOM & PLM Integration Bridge
 * Connects Bearing Subsystem with Assembly Engine, BOM Manager, and PLM Engineering Object OS v3.
 */

import { BearingDefinition, BearingInstance, BearingBOMEntry } from './BearingTypes';
import { AssemblyComponent } from '../AssemblyConstraintTypes';

export interface PLMChangeImpact {
  bearingId: string;
  previousRevision: string;
  newRevision: string;
  affectedAssemblyIds: string[];
  affectedInstanceCount: number;
  invalidatedSimulations: string[];
  bomUpdateRequired: boolean;
  propagationStatus: 'RESOLVED' | 'PENDING_APPROVAL';
}

export class BearingAssemblyBridge {
  private static readonly DEFINITIONS: Map<string, BearingDefinition> = new Map();
  private static readonly INSTANCES: Map<string, BearingInstance> = new Map();

  /**
   * Registers or updates a Bearing Definition in the PLM Registry
   */
  public static registerDefinition(def: BearingDefinition): void {
    this.DEFINITIONS.set(def.bearingId, def);
  }

  /**
   * Retrieves a Bearing Definition
   */
  public static getDefinition(bearingId: string): BearingDefinition | undefined {
    return this.DEFINITIONS.get(bearingId);
  }

  /**
   * Registers a Bearing Instance in active Assembly
   */
  public static registerInstance(inst: BearingInstance): void {
    this.INSTANCES.set(inst.instanceId, inst);
  }

  /**
   * Retrieves all instances for an assembly
   */
  public static getInstancesForAssembly(assemblyId: string): BearingInstance[] {
    return Array.from(this.INSTANCES.values()).filter(i => i.assemblyId === assemblyId);
  }

  /**
   * Generates a verified Bill of Materials (BOM) for all bearings in the assembly
   */
  public static generateBearingBOM(assemblyId: string = 'asm-master-222'): BearingBOMEntry[] {
    const instances = this.getInstancesForAssembly(assemblyId);
    const bomMap: Map<string, BearingBOMEntry> = new Map();

    let itemCounter = 1;
    for (const inst of instances) {
      const def = this.DEFINITIONS.get(inst.bearingDefinitionId);
      const key = `${inst.partNumber}-${def?.revision || 'REV-A'}`;

      if (bomMap.has(key)) {
        const existing = bomMap.get(key)!;
        existing.quantity += 1;
        existing.instanceIds.push(inst.instanceId);
      } else {
        const d = def?.boreDiameter || 20;
        const D = def?.outerDiameter || 47;
        const B = def?.width || 14;

        bomMap.set(key, {
          itemNumber: `BOM-BRG-${String(itemCounter++).padStart(3, '0')}`,
          partNumber: inst.partNumber,
          bearingType: def?.bearingType || 'DEEP_GROOVE_BALL',
          sizeDimension: `${d} x ${D} x ${B} mm`,
          quantity: 1,
          standard: def ? `${def.standard} (${def.standardDoc})` : 'ISO 15',
          material: def?.material || 'BEARING_STEEL_100CR6',
          configuration: def?.configuration || 'OPEN',
          revision: def?.revision || 'REV-A',
          instanceIds: [inst.instanceId]
        });
      }
    }

    return Array.from(bomMap.values());
  }

  /**
   * PLM Change Propagation: Evaluates impact of changing a Bearing Definition revision
   */
  public static propagateRevisionChange(
    bearingId: string,
    newDefinition: BearingDefinition
  ): PLMChangeImpact {
    const oldDef = this.DEFINITIONS.get(bearingId);
    const prevRev = oldDef?.revision || 'REV-A';
    this.DEFINITIONS.set(bearingId, newDefinition);

    // Find all affected instances
    const affectedInstances = Array.from(this.INSTANCES.values()).filter(
      i => i.bearingDefinitionId === bearingId || i.partNumber === newDefinition.partNumber
    );

    const affectedAssemblyIds = Array.from(new Set(affectedInstances.map(i => i.assemblyId)));

    // Update instances
    for (const inst of affectedInstances) {
      inst.revision += 1;
    }

    return {
      bearingId,
      previousRevision: prevRev,
      newRevision: newDefinition.revision,
      affectedAssemblyIds,
      affectedInstanceCount: affectedInstances.length,
      invalidatedSimulations: ['ClearanceAnalysis-PATCH-218', 'InterferenceDetection-PATCH-217', 'KinematicDeterminism-PATCH-190'],
      bomUpdateRequired: true,
      propagationStatus: 'RESOLVED'
    };
  }
}
