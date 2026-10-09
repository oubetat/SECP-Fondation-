import { AIInputContract, OODStatus } from './types';

export class AIOutOfDistributionDetector {
  public static detectOOD(inputs: Record<string, any>, contract: AIInputContract): { status: OODStatus; details: string } {
    let nearBoundary = false;

    for (const range of contract.ranges) {
      const val = inputs[range.field];
      if (val === undefined) {
        return { status: 'UNKNOWN', details: `Missing input field: ${range.field}` };
      }

      if (typeof val === 'number') {
        if (val < range.min || val > range.max) {
          return {
            status: 'OUT_OF_DISTRIBUTION',
            details: `Input ${range.field}=${val} ${range.unit} is outside valid domain [${range.min}, ${range.max}]`
          };
        }

        const span = range.max - range.min;
        const distToMin = (val - range.min) / span;
        const distToMax = (range.max - val) / span;

        if (distToMin < 0.05 || distToMax < 0.05) {
          nearBoundary = true;
        }
      }
    }

    if (nearBoundary) {
      return { status: 'NEAR_BOUNDARY', details: 'Input is operating near qualification domain boundary' };
    }

    return { status: 'IN_DOMAIN', details: 'Input is strictly within qualification domain' };
  }
}
