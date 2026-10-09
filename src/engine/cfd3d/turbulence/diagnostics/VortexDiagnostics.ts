import { Fvm3DMesh, Vector3D } from '../../../cfd3d/Fvm3DTypes';

export class VortexDiagnostics {
  public static computeVelocityGradients(mesh: Fvm3DMesh, velocity: Vector3D[]): any {
    return velocity.map(() => ({
      dudx: 0, dudy: 0, dudz: 0,
      dvdx: 0, dvdy: 0, dvdz: 0,
      dwdx: 0, dwdy: 0, dwdz: 0
    }));
  }
}
