export class GCodeModalState {
  public x: number = 0;
  public y: number = 0;
  public z: number = 0;
  public a: number = 0;
  public c: number = 0;
  
  public f: number = 0;
  public s: number = 0;
  public t: number = 0;

  public motionMode: 'G0' | 'G1' | null = null;
  public spindleState: 'M3' | 'M4' | 'M5' | null = null;
  public absMode: boolean = true; // G90
  public unitMode: 'G20' | 'G21' | null = null;

  public programEnded: boolean = false; // M30

  public clone(): GCodeModalState {
    const s = new GCodeModalState();
    s.x = this.x; s.y = this.y; s.z = this.z;
    s.a = this.a; s.c = this.c;
    s.f = this.f; s.s = this.s; s.t = this.t;
    s.motionMode = this.motionMode;
    s.spindleState = this.spindleState;
    s.absMode = this.absMode;
    s.unitMode = this.unitMode;
    s.programEnded = this.programEnded;
    return s;
  }
}
