/**
 * PATCH-278: Engineering Gizmo System
 * Manages gizmo orchestration, coordinate frames, and transform preview logic.
 */

import * as THREE from 'three';
import { 
  GizmoState278, 
  TransformMode, 
  CoordinateSystem, 
  TransformTransaction,
  TransformState
} from './GizmoTypes278';
import { PersistentEntityId } from './ViewportTypes276';

export class EngineeringGizmoSystem {
  private state: GizmoState278;
  private listeners: ((state: GizmoState278) => void)[] = [];
  private transactionHistory: TransformTransaction[] = [];

  constructor() {
    this.state = {
      activeEntity: null,
      mode: 'TRANSLATE',
      coordinateSystem: 'GLOBAL',
      origin: [0, 0, 0],
      orientation: [0, 0, 0, 1],
      activeHandle: null,
      snap: {
        enabled: true,
        gridSize: 1.0,
        angleStep: 15,
        increment: 5.0,
        snapToEntities: true
      },
      previewTransform: {
        translation: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1]
      },
      isDragging: false
    };
  }

  public syncWithSelection(selection: PersistentEntityId | null, pivot: [number, number, number]) {
    this.state.activeEntity = selection;
    this.state.origin = pivot;
    this.resetPreview();
    this.notify();
  }

  public setMode(mode: TransformMode) {
    this.state.mode = mode;
    this.notify();
  }

  public setCoordinateSystem(cs: CoordinateSystem) {
    this.state.coordinateSystem = cs;
    this.notify();
  }

  public startDragging(handleId: string) {
    this.state.isDragging = true;
    this.state.activeHandle = handleId;
    this.notify();
  }

  public updatePreview(deltaTranslation: [number, number, number], deltaRotation: [number, number, number, number]) {
    if (!this.state.isDragging) return;

    // Apply snapping logic if enabled
    let tx = deltaTranslation[0];
    let ty = deltaTranslation[1];
    let tz = deltaTranslation[2];

    if (this.state.snap.enabled) {
      tx = Math.round(tx / this.state.snap.increment) * this.state.snap.increment;
      ty = Math.round(ty / this.state.snap.increment) * this.state.snap.increment;
      tz = Math.round(tz / this.state.snap.increment) * this.state.snap.increment;
    }

    this.state.previewTransform.translation = [tx, ty, tz];
    // In a real implementation, we would multiply quaternions for rotation
    this.state.previewTransform.rotation = deltaRotation;
    
    this.notify();
  }

  public stopDragging(commit: boolean): TransformTransaction | null {
    if (!this.state.isDragging) return null;

    let transaction: TransformTransaction | null = null;

    if (commit && this.state.activeEntity) {
      transaction = {
        transactionId: `TX-${Date.now()}`,
        entityId: this.state.activeEntity.entityId,
        before: {
          position: [...this.state.origin],
          rotation: [...this.state.orientation],
          scale: [1, 1, 1]
        },
        after: {
          position: [
            this.state.origin[0] + this.state.previewTransform.translation[0],
            this.state.origin[1] + this.state.previewTransform.translation[1],
            this.state.origin[2] + this.state.previewTransform.translation[2]
          ],
          rotation: this.state.previewTransform.rotation,
          scale: [1, 1, 1]
        },
        revision: 'REV-NEW',
        timestamp: new Date().toISOString()
      };
      this.transactionHistory.push(transaction);
      
      // Update origin to new committed state
      this.state.origin = [...transaction.after.position] as [number, number, number];
    }

    this.state.isDragging = false;
    this.state.activeHandle = null;
    this.resetPreview();
    this.notify();

    return transaction;
  }

  private resetPreview() {
    this.state.previewTransform = {
      translation: [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1]
    };
  }

  private notify() {
    this.listeners.forEach(l => l({ ...this.state }));
  }

  public addListener(l: (state: GizmoState278) => void) {
    this.listeners.push(l);
  }

  public getState(): GizmoState278 {
    return { ...this.state };
  }
}
