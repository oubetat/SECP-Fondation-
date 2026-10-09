/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-067: Temporal Discretization Operators
 */

export class TemporalDiscretization {
  public static computeTimeDerivative(nextState: readonly number[], prevState: readonly number[], dt: number): number[] {
    const size = nextState.length;
    const derivative: number[] = [];
    for (let i = 0; i < size; i++) {
      derivative.push((nextState[i] - prevState[i]) / dt);
    }
    return derivative;
  }

  public static advanceExplicitEuler(
    state: readonly number[],
    rhs: readonly number[],
    dt: number
  ): number[] {
    const size = state.length;
    const nextState: number[] = [];
    for (let i = 0; i < size; i++) {
      nextState.push(state[i] + dt * rhs[i]);
    }
    return nextState;
  }
}
