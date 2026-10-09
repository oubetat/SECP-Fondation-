import * as crypto from "crypto";
import { MaterialStateData, ConstitutiveUpdateResult } from "./types";
import { MaterialStateHasher } from "./MaterialStateHasher";

export interface MaterialEvidenceArtifact {
  evidenceId: string;
  materialId: string;
  modelType: string;
  parameterHash: string;
  previousStateHash: string;
  strainIncrement: number[];
  trialStress: number[];
  yieldFunctionValue: number;
  plasticMultiplier: number;
  updatedStress: number[];
  updatedPlasticStrain: number[];
  equivalentPlasticStrain: number;
  tangentHash: string;
  convergenceStatus: string;
  committedStateHash: string;
  chainHash: string;
  timestamp: string;
}

export class MaterialEvidence {
  static createEvidence(
    materialId: string,
    modelType: string,
    params: Record<string, any>,
    prevState: MaterialStateData,
    strainIncrement: number[],
    updateResult: ConstitutiveUpdateResult,
    newState: MaterialStateData,
    previousChainHash: string = "GENESIS_MATERIAL_CHAIN_HASH"
  ): MaterialEvidenceArtifact {
    const parameterHash = crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex');
    const previousStateHash = prevState.stateHash || MaterialStateHasher.hashState(prevState);
    const committedStateHash = newState.stateHash || MaterialStateHasher.hashState(newState);

    // Tangent matrix hash
    const tangentData = updateResult.tangent.data.map(row => row.map(v => Number(v.toFixed(10))));
    const tangentHash = crypto.createHash('sha256').update(JSON.stringify(tangentData)).digest('hex');

    const timestamp = new Date().toISOString();
    const evidenceId = `MEVID_${materialId}_${newState.stepId}_${newState.incrementId}`;

    const canonicalEvidencePayload = {
      evidenceId,
      materialId,
      modelType,
      parameterHash,
      previousStateHash,
      strainIncrement: strainIncrement.map(v => Number(v.toFixed(12))),
      yieldFunctionValue: Number(updateResult.yieldFunctionValue.toFixed(12)),
      plasticMultiplier: Number(updateResult.plasticMultiplier.toFixed(12)),
      updatedStress: updateResult.stress.map(v => Number(v.toFixed(12))),
      updatedPlasticStrain: updateResult.plasticStrain.map(v => Number(v.toFixed(12))),
      equivalentPlasticStrain: Number(updateResult.equivalentPlasticStrain.toFixed(12)),
      tangentHash,
      convergenceStatus: updateResult.verdict,
      committedStateHash,
      previousChainHash
    };

    const chainHash = crypto.createHash('sha256').update(JSON.stringify(canonicalEvidencePayload)).digest('hex');

    return {
      evidenceId,
      materialId,
      modelType,
      parameterHash,
      previousStateHash,
      strainIncrement: [...strainIncrement],
      trialStress: updateResult.stress,
      yieldFunctionValue: updateResult.yieldFunctionValue,
      plasticMultiplier: updateResult.plasticMultiplier,
      updatedStress: [...updateResult.stress],
      updatedPlasticStrain: [...updateResult.plasticStrain],
      equivalentPlasticStrain: updateResult.equivalentPlasticStrain,
      tangentHash,
      convergenceStatus: updateResult.verdict,
      committedStateHash,
      chainHash,
      timestamp
    };
  }

  static verifyEvidenceChain(
    evidenceChain: MaterialEvidenceArtifact[]
  ): { isValid: boolean; error?: string } {
    let prevHash = "GENESIS_MATERIAL_CHAIN_HASH";

    for (let i = 0; i < evidenceChain.length; i++) {
      const evid = evidenceChain[i];
      const payload = {
        evidenceId: evid.evidenceId,
        materialId: evid.materialId,
        modelType: evid.modelType,
        parameterHash: evid.parameterHash,
        previousStateHash: evid.previousStateHash,
        strainIncrement: evid.strainIncrement.map(v => Number(v.toFixed(12))),
        yieldFunctionValue: Number(evid.yieldFunctionValue.toFixed(12)),
        plasticMultiplier: Number(evid.plasticMultiplier.toFixed(12)),
        updatedStress: evid.updatedStress.map(v => Number(v.toFixed(12))),
        updatedPlasticStrain: evid.updatedPlasticStrain.map(v => Number(v.toFixed(12))),
        equivalentPlasticStrain: Number(evid.equivalentPlasticStrain.toFixed(12)),
        tangentHash: evid.tangentHash,
        convergenceStatus: evid.convergenceStatus,
        committedStateHash: evid.committedStateHash,
        previousChainHash: prevHash
      };

      const computedChainHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
      if (computedChainHash !== evid.chainHash) {
        return {
          isValid: false,
          error: `Chain hash mismatch at index ${i} (${evid.evidenceId}): expected ${evid.chainHash}, computed ${computedChainHash}`
        };
      }

      prevHash = evid.chainHash;
    }

    return { isValid: true };
  }
}
