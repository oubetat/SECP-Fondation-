export type ManipulationAxis = 'X' | 'Y' | 'Z' | 'ALL';
export type ManipulationMode = 'TRANSLATE' | 'ROTATE' | 'SCALE';

export class ManipulationController {
  private mode: ManipulationMode = 'TRANSLATE';
  private axis: ManipulationAxis = 'ALL';

  public setMode(mode: ManipulationMode): void {
    this.mode = mode;
  }

  public getMode(): ManipulationMode {
    return this.mode;
  }

  public setAxis(axis: ManipulationAxis): void {
    this.axis = axis;
  }

  public getAxis(): ManipulationAxis {
    return this.axis;
  }
}
