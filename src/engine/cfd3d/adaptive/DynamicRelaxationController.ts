/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * G1-B5: Dynamic Relaxation Controller
 *
 * Adaptively manages under-relaxation factors for pressure and momentum 
 * based on convergence history and residual stability.
 */

import { DynamicRelaxationState } from './AdaptiveCFDTypes';

export class DynamicRelaxationController {
  private alphaP: number;
  private alphaU: number;
  private alphaE: number = 0.8;
  private adaptationCount = 0;
  private history: DynamicRelaxationState['history'] = [];
  private prevResidual: number = Infinity;
  private oscillationCount = 0;

  constructor(initialAlphaP: number = 0.3, initialAlphaU: number = 0.7) {
    this.alphaP = initialAlphaP;
    this.alphaU = initialAlphaU;
  }

  public getState(): DynamicRelaxationState {
    return {
      alphaPressure: this.alphaP,
      alphaMomentum: this.alphaU,
      alphaEnergy: this.alphaE,
      alphaTurbulence: 0.5,
      alphaDensity: 1.0,
      adaptationCount: this.adaptationCount,
      history: [...this.history]
    };
  }

  /**
   * Updates relaxation factors based on the current residual trend.
   */
  public updateRelaxation(iter: number, currentResidual: number): void {
    let changed = false;
    let reason = '';

    // Detect oscillation
    if (currentResidual > this.prevResidual) {
      this.oscillationCount++;
    } else {
      this.oscillationCount = Math.max(0, this.oscillationCount - 1);
    }

    if (this.oscillationCount >= 3 || currentResidual > this.prevResidual * 1.5) {
      // Numerical instability or oscillation -> Harden
      this.alphaU = Math.max(0.1, this.alphaU * 0.8);
      this.alphaP = Math.max(0.05, this.alphaP * 0.8);
      this.oscillationCount = 0;
      changed = true;
      reason = 'INSTABILITY_DETECTED_HARDENING';
    } else if (iter > 20 && this.oscillationCount === 0 && currentResidual < this.prevResidual * 0.95) {
      // Smooth convergence -> Accelerate
      this.alphaU = Math.min(0.9, this.alphaU * 1.05);
      this.alphaP = Math.min(0.7, this.alphaP * 1.05);
      changed = true;
      reason = 'SMOOTH_CONVERGENCE_ACCELERATING';
    }

    if (changed) {
      this.adaptationCount++;
      this.history.push({
        iter,
        alphaP: this.alphaP,
        alphaU: this.alphaU,
        reason
      });
      // Limit history size
      if (this.history.length > 50) this.history.shift();
    }

    this.prevResidual = currentResidual;
  }
}
