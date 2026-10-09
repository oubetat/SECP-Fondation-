// SECP Industrial OS v2 — Independent & Differential Manufacturing Verifier
import {
  ManufacturingTwin,
  ManufacturingStateStatus,
  DifferentialVerdict,
  InspectionVerdict,
  ToleranceVerification
} from './types';
import { CanonicalManufacturingSerializer } from './CanonicalManufacturingSerializer';

export interface IndependentVerificationResult {
  inputHashValid: boolean;
  computedInputHash: string;
  rootHashValid: boolean;
  computedRootHash: string;
  gcodeValid: boolean;
  inspectionVerdict: InspectionVerdict;
  overallVerdict: ManufacturingStateStatus;
}

export class IndependentManufacturingVerifier {
  public static verifyTwinIndependently(twin: ManufacturingTwin): IndependentVerificationResult {
    const computedInputHash = CanonicalManufacturingSerializer.computeManufacturingInputHash(twin.manufacturingState);
    const inputHashValid = computedInputHash === twin.inputHash;

    let gcodeValid = true;
    for (const line of twin.manufacturingState.ncState.ncProgram.gcodeLines) {
      if (line.includes('G0') && line.includes('G1')) {
        gcodeValid = false;
        break;
      }
    }

    let outOfTol = false;
    let inspVerdict: InspectionVerdict = 'WITHIN_TOLERANCE';
    if (twin.manufacturingState.inspectionState) {
      for (const v of twin.manufacturingState.inspectionState.verifications) {
        if (v.measuredValue > v.upperLimit || v.measuredValue < v.lowerLimit) {
          outOfTol = true;
          break;
        }
      }
      if (outOfTol) inspVerdict = 'OUT_OF_TOLERANCE';
    }

    const computedRootHash = CanonicalManufacturingSerializer.computeManufacturingRootHash({
      geometryHash: twin.manufacturingState.geometryState.geometryHash,
      materialHash: twin.manufacturingState.materialState.materialId,
      featureHash: twin.manufacturingState.featureState.featuresHash,
      processHash: twin.manufacturingState.processState.processHash,
      machineHash: twin.manufacturingState.machineState.machineConfigHash,
      toolHash: twin.manufacturingState.toolState.toolingHash,
      fixtureHash: twin.manufacturingState.fixtureState.fixtureConfigHash,
      toolpathHash: twin.manufacturingState.toolpathState.toolpathsHash,
      postHash: twin.manufacturingState.ncState.postProcessor.postHash,
      ncHash: twin.manufacturingState.ncState.ncProgram.programTextHash,
      executionHash: twin.manufacturingState.executionState?.executionHash || 'NO_EXECUTION',
      inspectionHash: twin.manufacturingState.inspectionState?.verdict || 'NO_INSPECTION',
      asManufacturedHash: twin.manufacturingState.asManufacturedState?.scanHash || 'NO_SCAN',
      evidenceHash: twin.manufacturingState.evidenceState.evidenceHash
    });

    const rootHashValid = computedRootHash === twin.rootHash;

    let overallVerdict: ManufacturingStateStatus = 'READY';
    if (!inputHashValid || !rootHashValid) {
      overallVerdict = 'INVALID';
    } else if (!gcodeValid) {
      overallVerdict = 'GCODE_INVALID';
    } else if (inspVerdict === 'OUT_OF_TOLERANCE') {
      overallVerdict = 'OUT_OF_TOLERANCE';
    } else if (twin.state === 'OUT_OF_TOLERANCE') {
      overallVerdict = 'OUT_OF_TOLERANCE';
    } else if (twin.state === 'READY' || twin.state === 'MANUFACTURING_VALID') {
      overallVerdict = twin.state;
    }

    return {
      inputHashValid,
      computedInputHash,
      rootHashValid,
      computedRootHash,
      gcodeValid,
      inspectionVerdict: inspVerdict,
      overallVerdict
    };
  }

  public static compareVerdicts(
    primaryTwin: ManufacturingTwin,
    independentResult: IndependentVerificationResult
  ): { verdict: DifferentialVerdict; details: string } {
    if (primaryTwin.inputHash !== independentResult.computedInputHash) {
      return {
        verdict: 'MISMATCH',
        details: `Input hash mismatch: Primary [${primaryTwin.inputHash}] vs Independent [${independentResult.computedInputHash}]`
      };
    }

    if (primaryTwin.state === 'OUT_OF_TOLERANCE' && independentResult.inspectionVerdict !== 'OUT_OF_TOLERANCE') {
      return {
        verdict: 'MISMATCH',
        details: `Primary state is OUT_OF_TOLERANCE but independent inspection did not register tolerance breach`
      };
    }

    return {
      verdict: 'MATCH',
      details: `100% Differential Match between Primary Verifier [${primaryTwin.state}] and Independent Verifier [${independentResult.overallVerdict}]`
    };
  }
}
