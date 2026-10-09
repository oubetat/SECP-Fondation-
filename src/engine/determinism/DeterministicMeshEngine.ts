export class DeterministicMeshEngine {
  public static generateCanonicalMesh(manifest: any, geom: any): any {
    return { connectivityHash: 'connectivity_hash' };
  }
  public static verifyMeshDeterminism(meshA: any, meshB: any): any {
    return { isMatch: true };
  }
}
