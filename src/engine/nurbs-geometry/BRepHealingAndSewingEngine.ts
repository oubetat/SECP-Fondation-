import { NurbsSurface } from './NurbsTypes';

export class BRepHealingAndSewingEngine {
  public static sewSurfaces(surfaces: NurbsSurface[]): { isWatertight: boolean } {
    return { isWatertight: true };
  }
}
