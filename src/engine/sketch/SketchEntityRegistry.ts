/**
 * SECP CAD Kernel — Sketch Entity Registry
 * Phase 2 (PATCH-024)
 */

import { SketchEntity } from './SketchEntity';
import { EngineeringIdentity } from '../identity/CanonicalEngineeringIdentity';

export class SketchEntityRegistry {
  private entities: Map<string, SketchEntity> = new Map();
  private readonly sketchId: EngineeringIdentity;

  constructor(sketchId: EngineeringIdentity) {
    this.sketchId = sketchId;
  }

  public add(entity: SketchEntity): void {
    if (entity.sketchId.projectId !== this.sketchId.projectId) {
      throw new Error(`Entity sketchId ${entity.sketchId.projectId} mismatch with registry sketchId ${this.sketchId.projectId}`);
    }
    const id = entity.id.projectId;
    if (this.entities.has(id)) {
      throw new Error(`Entity with ID ${id} already exists in registry`);
    }
    // Registry must not mutate entities silently. Immutable replacement semantics preferred.
    this.entities.set(id, { ...entity });
  }

  public get(id: string): SketchEntity | undefined {
    return this.entities.get(id);
  }

  public has(id: string): boolean {
    return this.entities.has(id);
  }

  public remove(id: string): void {
    this.entities.delete(id);
  }

  public update(id: string, entity: SketchEntity): void {
    if (!this.entities.has(id)) {
      throw new Error(`Entity with ID ${id} does not exist in registry`);
    }
    if (entity.id.projectId !== id) {
      throw new Error(`Entity ID mismatch during update: ${entity.id.projectId} vs ${id}`);
    }
    if (entity.sketchId.projectId !== this.sketchId.projectId) {
      throw new Error(`Entity sketchId ${entity.sketchId.projectId} mismatch with registry sketchId ${this.sketchId.projectId}`);
    }
    this.entities.set(id, { ...entity });
  }

  public list(): readonly SketchEntity[] {
    return Array.from(this.entities.values());
  }

  public clear(): void {
    this.entities.clear();
  }
}
