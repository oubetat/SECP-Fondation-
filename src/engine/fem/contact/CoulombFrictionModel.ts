export class CoulombFrictionModel {
  constructor(public mu: number, public tangentStiffness: number) {}

  public computeTangentialTraction(normalPressure: number, slipIncrement: number[]): { tangentialTraction: number[] } {
    return {
      tangentialTraction: [0, 0]
    };
  }
}
