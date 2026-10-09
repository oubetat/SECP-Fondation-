/**
 * PATCH-281: Engineering PMI System
 * Manages semantic annotations, entity associations, and revision lifecycle.
 */

import { 
  PMIState281, 
  PMIAnnotation, 
  PMIAnnotationType, 
  PMIStatus 
} from './PMITypes281';
import { PersistentEntityId } from './ViewportTypes276';

export class EngineeringPMISystem {
  private state: PMIState281;
  private listeners: ((state: PMIState281) => void)[] = [];

  constructor(revision: string) {
    this.state = {
      annotations: [],
      activePMI: null,
      modelRevision: revision
    };
  }

  public addAnnotation(
    type: PMIAnnotationType, 
    entities: PersistentEntityId[], 
    semanticData: any,
    position: [number, number, number] = [0, 0, 0]
  ): string {
    const id = `PMI-${Math.random().toString(36).substr(2, 9)}`;
    const newAnnotation: PMIAnnotation = {
      id,
      type,
      semanticData,
      referencedEntities: entities,
      coordinateSystem: 'GLOBAL',
      placement: {
        position,
        orientation: [0, 0, 0, 1]
      },
      visibility: true,
      revision: this.state.modelRevision,
      status: 'VALID'
    };

    this.state.annotations.push(newAnnotation);
    this.notify();
    return id;
  }

  public updateAnnotation(id: string, updates: Partial<PMIAnnotation>) {
    const index = this.state.annotations.findIndex(a => a.id === id);
    if (index !== -1) {
      this.state.annotations[index] = { ...this.state.annotations[index], ...updates };
      this.notify();
    }
  }

  public deleteAnnotation(id: string) {
    this.state.annotations = this.state.annotations.filter(a => a.id !== id);
    this.notify();
  }

  public validateRevision(revision: string) {
    if (this.state.modelRevision !== revision) {
      this.state.modelRevision = revision;
      this.state.annotations.forEach(a => {
        if (a.revision !== revision) {
          a.status = 'STALE';
        }
      });
      this.notify();
    }
  }

  public setVisibility(id: string, visible: boolean) {
    const annotation = this.state.annotations.find(a => a.id === id);
    if (annotation) {
      annotation.visibility = visible;
      this.notify();
    }
  }

  private notify() {
    this.listeners.forEach(l => l({ ...this.state }));
  }

  public addListener(l: (state: PMIState281) => void) {
    this.listeners.push(l);
  }

  public getState(): PMIState281 {
    return { ...this.state };
  }
}
