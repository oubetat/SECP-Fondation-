/**
 * PATCH-279: Engineering Section System
 * Manages section plane definitions, offset calculations, and revision tracking.
 */

import { SectionState279, SectionPlane279, SectionBox279 } from './SectionTypes279';

export class EngineeringSectionSystem {
  private state: SectionState279;
  private listeners: ((state: SectionState279) => void)[] = [];

  constructor(revision: string) {
    this.state = {
      activeSections: [],
      box: null,
      displayMode: 'CAP_SOLID',
      scope: 'ENTIRE_MODEL',
      modelRevision: revision,
      isStale: false
    };
  }

  public addPlane(name: string, origin: [number, number, number], normal: [number, number, number]): string {
    const id = `SEC-${Math.random().toString(36).substr(2, 9)}`;
    const newPlane: SectionPlane279 = {
      id,
      name,
      origin,
      normal,
      offset: 0,
      flip: false,
      active: true,
      locked: false
    };
    this.state.activeSections.push(newPlane);
    this.notify();
    return id;
  }

  public updatePlane(id: string, updates: Partial<SectionPlane279>) {
    const index = this.state.activeSections.findIndex(p => p.id === id);
    if (index !== -1) {
      this.state.activeSections[index] = { ...this.state.activeSections[index], ...updates };
      this.notify();
    }
  }

  public removePlane(id: string) {
    this.state.activeSections = this.state.activeSections.filter(p => p.id !== id);
    this.notify();
  }

  public setBox(box: SectionBox279 | null) {
    this.state.box = box;
    this.notify();
  }

  public toggleSection(id: string) {
    const plane = this.state.activeSections.find(p => p.id === id);
    if (plane) {
      plane.active = !plane.active;
      this.notify();
    }
  }

  public validateRevision(revision: string) {
    if (this.state.modelRevision !== revision) {
      this.state.isStale = true;
      this.state.modelRevision = revision;
      this.notify();
    }
  }

  public resolveStale() {
    this.state.isStale = false;
    this.notify();
  }

  private notify() {
    this.listeners.forEach(l => l({ ...this.state }));
  }

  public addListener(l: (state: SectionState279) => void) {
    this.listeners.push(l);
  }

  public getState(): SectionState279 {
    return { ...this.state };
  }
}
