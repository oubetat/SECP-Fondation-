import { Spatial3DEntity, Production3DConstraint } from './Production3DGCSTypes';

export class ViewportDragController {
  private entities: Record<string, Spatial3DEntity>;
  private constraints: Production3DConstraint[];

  constructor(entities: Record<string, Spatial3DEntity>, constraints: Production3DConstraint[]) {
    this.entities = { ...entities };
    this.constraints = [...constraints];
  }

  public startDrag(entityId: string, position: { x: number; y: number; z: number }): void {
    // Stub implementation
  }

  public updateDrag(position: { x: number; y: number; z: number }): { entities: Record<string, Spatial3DEntity> } {
    return { entities: this.entities };
  }

  public endDrag(): void {
    // Stub implementation
  }

  public onDragStart(entityId: string): void {}
  public onDragMove(position: { x: number; y: number; z: number }): void {}
  public onDragEnd(): void {}
}
