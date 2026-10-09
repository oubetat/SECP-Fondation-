/**
 * PATCH-277: Engineering Selection System
 * Manages selection state, entity resolution, and bi-directional tree mapping.
 */

import { 
  SelectionState277, 
  SelectionFilter, 
  HitResult, 
  SelectionEvent
} from './SelectionTypes277';
import { PersistentEntityId, SelectionType } from './ViewportTypes276';

export class EngineeringSelectionSystem {
  private state: SelectionState277;
  private history: SelectionState277[] = [];
  private listeners: ((event: SelectionEvent) => void)[] = [];

  constructor(revision: string) {
    this.state = {
      selectedEntities: [],
      activeEntity: null,
      preselectedEntity: null,
      mode: 'SINGLE',
      filter: {
        allowedTypes: ['FACE', 'EDGE', 'BODY', 'PART', 'VERTEX'],
        allowMeshEntities: true,
        allowSimulationRegions: true,
        allowToolpathEntities: true
      },
      modelRevision: revision,
      timestamp: new Date().toISOString()
    };
  }

  public getState(): SelectionState277 {
    return { ...this.state };
  }

  public setFilter(filter: SelectionFilter) {
    this.state.filter = filter;
    this.validateCurrentSelection();
  }

  public preselect(hit: HitResult | null) {
    if (!hit) {
      this.state.preselectedEntity = null;
      return;
    }

    if (this.isTypeAllowed(hit.entityType)) {
      this.state.preselectedEntity = {
        entityId: hit.entityId,
        entityType: hit.entityType,
        parentPartId: hit.parentPartId,
        parentBodyId: hit.parentBodyId
      };
    } else {
      this.state.preselectedEntity = null;
    }
  }

  public select(hit: HitResult | null, multi: boolean = false) {
    this.pushToHistory();

    if (!hit) {
      if (!multi) this.clearSelection();
      return;
    }

    if (!this.isTypeAllowed(hit.entityType)) return;

    const entity: PersistentEntityId = {
      entityId: hit.entityId,
      entityType: hit.entityType,
      parentPartId: hit.parentPartId,
      parentBodyId: hit.parentBodyId
    };

    if (multi) {
      const index = this.state.selectedEntities.findIndex(e => e.entityId === entity.entityId);
      if (index >= 0) {
        this.state.selectedEntities.splice(index, 1);
        this.notify('REMOVED', [entity]);
      } else {
        this.state.selectedEntities.push(entity);
        this.notify('ADDED', [entity]);
      }
    } else {
      this.state.selectedEntities = [entity];
      this.state.activeEntity = entity;
      this.notify('CHANGED', [entity]);
    }

    this.state.timestamp = new Date().toISOString();
  }

  public clearSelection() {
    if (this.state.selectedEntities.length === 0) return;
    const removed = [...this.state.selectedEntities];
    this.state.selectedEntities = [];
    this.state.activeEntity = null;
    this.notify('CLEARED', removed);
  }

  public validateRevision(newRevision: string) {
    if (this.state.modelRevision !== newRevision) {
      console.warn(`PATCH-277: Revision mismatch. Current: ${this.state.modelRevision}, New: ${newRevision}. Clearing stale selection.`);
      this.clearSelection();
      this.state.modelRevision = newRevision;
    }
  }

  private isTypeAllowed(type: SelectionType): boolean {
    return this.state.filter.allowedTypes.includes(type);
  }

  private validateCurrentSelection() {
    const valid = this.state.selectedEntities.filter(e => this.isTypeAllowed(e.entityType));
    if (valid.length !== this.state.selectedEntities.length) {
      this.state.selectedEntities = valid;
      this.notify('CHANGED', valid);
    }
  }

  private pushToHistory() {
    this.history.push(JSON.parse(JSON.stringify(this.state)));
    if (this.history.length > 50) this.history.shift();
  }

  private notify(type: SelectionEvent['type'], entities: PersistentEntityId[]) {
    const event: SelectionEvent = {
      type,
      entities,
      mode: this.state.mode,
      revision: this.state.modelRevision,
      source: 'VIEWPORT'
    };
    this.listeners.forEach(l => l(event));
  }

  public addListener(l: (event: SelectionEvent) => void) {
    this.listeners.push(l);
  }
}
