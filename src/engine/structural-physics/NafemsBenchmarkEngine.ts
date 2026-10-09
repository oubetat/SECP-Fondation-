import { RealNafemsBenchmarkEngine } from './RealNafemsBenchmarkEngine';

export class NafemsBenchmarkEngine {
  public static runQuadPatchTest(): boolean {
    return RealNafemsBenchmarkEngine.runRealQuadPatchTest();
  }
}
