export class EngineeringCamera {
  constructor(preset: string) {}
  public getState(): any {
    return { preset: 'ISOMETRIC' };
  }
  public setPreset(preset: string): void {}
}
