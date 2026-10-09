import { LargeDeformationVerdict, LargeDeformationFailureType } from "./types";

export interface LoadStepParams {
  maxIterations: number;
  toleranceResidual: number;
  toleranceDisplacement: number;
  minIncrementSize: number;
  maxIncrementSize: number;
}

export class LoadStepController {
  private currentStep: number = 0;
  private totalLoad: number = 1.0;
  private currentLoad: number = 0.0;
  private nextIncrement: number = 0.1;
  private history: any[] = [];

  constructor(private params: LoadStepParams) {}

  getCurrentLoadFactor(): number {
    return this.currentLoad;
  }

  getNextIncrementSize(): number {
    return this.nextIncrement;
  }

  /**
   * Called when an increment converges.
   */
  onConvergence(iterations: number): void {
    this.currentLoad += this.nextIncrement;
    this.currentStep++;
    
    // Adapt step size: if converged fast, increase
    if (iterations < 5) {
      this.nextIncrement = Math.min(this.params.maxIncrementSize, this.nextIncrement * 1.5);
    }
    
    // Ensure we don't overshoot 1.0
    if (this.currentLoad + this.nextIncrement > this.totalLoad) {
      this.nextIncrement = this.totalLoad - this.currentLoad;
    }
  }

  /**
   * Called when an increment fails to converge.
   * Performs cutback if possible.
   */
  onFailure(): { retry: boolean; newIncrement: number } {
    this.nextIncrement /= 2;
    if (this.nextIncrement < this.params.minIncrementSize) {
      return { retry: false, newIncrement: this.nextIncrement };
    }
    return { retry: true, newIncrement: this.nextIncrement };
  }

  isFinished(): boolean {
    return this.currentLoad >= this.totalLoad - 1e-10;
  }

  getReport() {
    return {
      currentStep: this.currentStep,
      currentLoad: this.currentLoad,
      isFinished: this.isFinished()
    };
  }
}
