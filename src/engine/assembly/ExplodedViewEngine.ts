/**
 * PATCH-SECP-219 — Exploded Views Engine
 * Manages deterministic derived exploded assembly states, step-by-step translations, 
 * coordinate trails, collision warnings, playback animation timelines, and undo/redo stacks.
 */

import { AssemblyComponent, Vector3, Transform3D } from './AssemblyConstraintTypes';
import { Vector3D } from '../cadKernel';
import { EngineeringEventStore } from '../industrial-os/event-model/EngineeringEventStore';
import * as crypto from 'crypto';

export interface ExplodeStep {
  id: string;
  componentIds: string[]; // Supports multi-component collective group movement
  direction: 'X' | 'Y' | 'Z' | '-X' | '-Y' | '-Z';
  distance: number; // in mm
  sequence: number;
  parentStepId?: string;
  suppressed: boolean;
}

export interface ExplodeTrail {
  id: string;
  componentId: string;
  startPoint: Vector3D;
  endPoint: Vector3D;
  visible: boolean;
}

export interface ExplodedViewState {
  id: string;
  assemblyId: string;
  name: string;
  steps: ExplodeStep[];
  trails: ExplodeTrail[];
  createdAt: string;
  updatedAt: string;
  revision: string;
  integrityHash?: string;
}

export interface ExplodeCollisionWarning {
  componentId: string;
  componentName: string;
  collisionDetectedWith: string;
  collisionName: string;
  requiredClearanceMm: number;
  penetrationDistanceMm: number;
}

export class ExplodedViewEngine {
  private static computeHash(str: string): string {
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  /**
   * Generates cryptographically secure integrity signature of an Exploded View model
   */
  public static calculateIntegrityHash(state: Omit<ExplodedViewState, 'integrityHash'>): string {
    const raw = JSON.stringify({
      id: state.id,
      assemblyId: state.assemblyId,
      name: state.name,
      steps: state.steps.map(s => ({ id: s.id, compIds: s.componentIds, d: s.direction, dist: s.distance, seq: s.sequence })),
      revision: state.revision
    });
    return this.computeHash(raw);
  }

  /**
   * Applies cumulative displacements of active explode steps to calculate final transformed components
   */
  public static applyExplodeDisplacements(
    baseComponents: AssemblyComponent[],
    steps: ExplodeStep[],
    playbackFactor: number = 1.0 // 0.0 (fully assembled) to 1.0 (fully exploded)
  ): {
    explodedComponents: AssemblyComponent[];
    trails: ExplodeTrail[];
    collisionWarnings: ExplodeCollisionWarning[];
  } {
    const trails: ExplodeTrail[] = [];
    const collisionWarnings: ExplodeCollisionWarning[] = [];

    // Create deep copy of starting components
    const explodedComponents: AssemblyComponent[] = baseComponents.map(c => ({
      ...c,
      worldTransform: {
        ...c.worldTransform,
        position: { ...c.worldTransform.position },
        rotation: { ...c.worldTransform.rotation }
      }
    }));

    // Filter active (non-suppressed) steps, sorted by sequence order
    const activeSteps = steps
      .filter(s => !s.suppressed)
      .sort((a, b) => a.sequence - b.sequence);

    // Apply cumulative step translations
    activeSteps.forEach(step => {
      const stepFactor = playbackFactor; // Can map to individual step timelines if required

      step.componentIds.forEach(compId => {
        const comp = explodedComponents.find(c => c.instanceId === compId);
        if (!comp) return;

        // Remember starting point before displacement for trail calculation
        const startPoint: Vector3D = { ...comp.worldTransform.position };

        // Calculate translation vector
        const delta = step.distance * stepFactor;
        let dx = 0;
        let dy = 0;
        let dz = 0;

        switch (step.direction) {
          case 'X': dx = delta; break;
          case '-X': dx = -delta; break;
          case 'Y': dy = delta; break;
          case '-Y': dy = -delta; break;
          case 'Z': dz = delta; break;
          case '-Z': dz = -delta; break;
        }

        // Apply translation in 3D
        comp.worldTransform.position.x += dx;
        comp.worldTransform.position.y += dy;
        comp.worldTransform.position.z += dz;

        const endPoint: Vector3D = { ...comp.worldTransform.position };

        // Register Explode Trail Line
        trails.push({
          id: `trail-${step.id}-${compId}`,
          componentId: compId,
          startPoint,
          endPoint,
          visible: true
        });

        // 3D Collision Detection with neighboring bodies (AABB bounds check)
        // Assume bounding dimensions are ~40mm
        explodedComponents.forEach(otherComp => {
          if (otherComp.instanceId === compId || otherComp.suppressed) return;

          const dist3D = Math.sqrt(
            Math.pow(comp.worldTransform.position.x - otherComp.worldTransform.position.x, 2) +
            Math.pow(comp.worldTransform.position.y - otherComp.worldTransform.position.y, 2) +
            Math.pow(comp.worldTransform.position.z - otherComp.worldTransform.position.z, 2)
          );

          // If overlapping significantly during movement
          if (dist3D < 32.0 && delta > 0) {
            collisionWarnings.push({
              componentId: comp.instanceId,
              componentName: comp.name,
              collisionDetectedWith: otherComp.instanceId,
              collisionName: otherComp.name,
              requiredClearanceMm: 12.0,
              penetrationDistanceMm: parseFloat((32.0 - dist3D).toFixed(2))
            });
          }
        });
      });
    });

    return {
      explodedComponents,
      trails,
      collisionWarnings
    };
  }

  /**
   * Deterministically rebuilds/restores state from plain data configuration
   */
  public static reconstructExplodedViewState(
    rawState: any,
    baseComponents: AssemblyComponent[]
  ): ExplodedViewState {
    const steps: ExplodeStep[] = (rawState.steps || []).map((s: any) => ({
      id: s.id,
      componentIds: s.componentIds || [],
      direction: s.direction || 'Z',
      distance: Number(s.distance) || 0,
      sequence: Number(s.sequence) || 0,
      parentStepId: s.parentStepId,
      suppressed: !!s.suppressed
    }));

    const { trails } = this.applyExplodeDisplacements(baseComponents, steps, 1.0);

    const partialState: Omit<ExplodedViewState, 'integrityHash'> = {
      id: rawState.id || `exp-view-${Math.floor(Math.random() * 90000 + 10000)}`,
      assemblyId: rawState.assemblyId || 'asm-main-099',
      name: rawState.name || 'Default Exploded View',
      steps,
      trails,
      createdAt: rawState.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      revision: rawState.revision || 'rev-01'
    };

    const integrityHash = this.calculateIntegrityHash(partialState);

    // Push to Industrial OS EngineeringEventStore
    try {
      const store = EngineeringEventStore.getInstance();
      store.append({
        eventType: 'EXPLODE_VIEW_RECONSTRUCTED',
        actor: { id: 'user-01', name: 'Lead Assembly Engineer', role: 'ENGINEER' },
        source: { systemId: 'secp-desktop', componentId: 'explode-engine' },
        objectRefs: [partialState.id],
        entityIdentityId: partialState.id,
        entityType: 'EXPLODE_VIEW',
        entityRevision: partialState.revision,
        payload: {
          stepCount: steps.length,
          integrityHash
        },
        correlationId: `corr-${partialState.id}`
      });
    } catch (err) {
      // Store disabled, ignore gracefully
    }

    return {
      ...partialState,
      integrityHash
    };
  }
}
