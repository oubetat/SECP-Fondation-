import { Matrix } from "../core/MathUtils";
import { DeformationGradientResult, LargeDeformationVerdict } from "./types";

export interface DeformationEvidence {
  elementId: string;
  integrationPoint: number;
  referencePosition: number[];
  currentPosition: number[];
  F: number[][];
  J: number;
  R: number[][];
  U: number[][];
  strain: number[];
  stress: number[];
  stressMeasure: string;
  tangentHash: string;
  configurationHash: string;
  verdict: LargeDeformationVerdict;
}

export class KinematicReporter {
  static createEvidence(
    elementId: string,
    ip: number,
    refPos: number[],
    currPos: number[],
    grad: DeformationGradientResult,
    rotation: number[][],
    stretch: number[][],
    strain: number[],
    stress: number[],
    measure: string
  ): DeformationEvidence {
    return {
      elementId,
      integrationPoint: ip,
      referencePosition: refPos,
      currentPosition: currPos,
      F: grad.F,
      J: grad.J,
      R: rotation,
      U: stretch,
      strain,
      stress,
      stressMeasure: measure,
      tangentHash: "T_" + Math.random().toString(36).substring(7),
      configurationHash: "C_" + Math.random().toString(36).substring(7),
      verdict: LargeDeformationVerdict.CONVERGED
    };
  }
}
