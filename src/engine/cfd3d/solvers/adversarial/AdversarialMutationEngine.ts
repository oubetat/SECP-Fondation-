/**
 * SECP Industrial OS v2 — CFD Ascension Framework
 * PATCH-075: Adversarial Mutation & Attack Engine
 */

import { MutationType, AdversarialMutation } from './AdversarialTypes';

export class AdversarialMutationEngine {
  public static injectNaNIntoField(
    values: readonly number[],
    indexToCorrupt: number = 0
  ): { readonly mutated: number[]; readonly mutation: AdversarialMutation } {
    const mutated = [...values];
    mutated[indexToCorrupt] = NaN;

    const mutation: AdversarialMutation = {
      mutationId: `mut-nan-${Date.now().toString(36)}`,
      sourceCaseId: 'base-case',
      targetCaseId: 'mut-nan-case',
      mutationType: 'NAN_INJECTION',
      affectedArtifact: 'field-array',
      beforeHash: 'hash-orig',
      afterHash: 'hash-nan',
      mutationParameters: { corruptedIndex: indexToCorrupt },
      timestamp: new Date().toISOString(),
      generatorVersion: '2.0.0'
    };

    return { mutated, mutation };
  }

  public static injectInfinityIntoField(
    values: readonly number[],
    indexToCorrupt: number = 0
  ): { readonly mutated: number[]; readonly mutation: AdversarialMutation } {
    const mutated = [...values];
    mutated[indexToCorrupt] = Infinity;

    const mutation: AdversarialMutation = {
      mutationId: `mut-inf-${Date.now().toString(36)}`,
      sourceCaseId: 'base-case',
      targetCaseId: 'mut-inf-case',
      mutationType: 'INF_INJECTION',
      affectedArtifact: 'field-array',
      beforeHash: 'hash-orig',
      afterHash: 'hash-inf',
      mutationParameters: { corruptedIndex: indexToCorrupt },
      timestamp: new Date().toISOString(),
      generatorVersion: '2.0.0'
    };

    return { mutated, mutation };
  }

  public static injectMassImbalance(
    fluxes: { readonly massIn: number; readonly massOut: number },
    imbalanceMagnitude: number = 0.5
  ): { readonly mutatedFluxes: { readonly massIn: number; readonly massOut: number }; readonly mutation: AdversarialMutation } {
    const mutatedFluxes = {
      massIn: fluxes.massIn,
      massOut: fluxes.massOut + imbalanceMagnitude
    };

    const mutation: AdversarialMutation = {
      mutationId: `mut-mass-${Date.now().toString(36)}`,
      sourceCaseId: 'base-case',
      targetCaseId: 'mut-mass-case',
      mutationType: 'MASS_IMBALANCE',
      affectedArtifact: 'boundary-fluxes',
      beforeHash: 'hash-orig-flux',
      afterHash: 'hash-imbalanced-flux',
      mutationParameters: { imbalanceMagnitude },
      timestamp: new Date().toISOString(),
      generatorVersion: '2.0.0'
    };

    return { mutatedFluxes, mutation };
  }

  public static injectResidualReset(
    residualHistory: readonly number[]
  ): { readonly mutated: number[]; readonly mutation: AdversarialMutation } {
    const mutated = [...residualHistory];
    if (mutated.length >= 3) {
      mutated[mutated.length - 2] = 0.05;
      mutated[mutated.length - 1] = 1e-8; // artificial jump of > 6 orders of magnitude
    }

    const mutation: AdversarialMutation = {
      mutationId: `mut-reset-${Date.now().toString(36)}`,
      sourceCaseId: 'base-case',
      targetCaseId: 'mut-reset-case',
      mutationType: 'RESIDUAL_RESET',
      affectedArtifact: 'residual-history',
      beforeHash: 'hash-orig-res',
      afterHash: 'hash-reset-res',
      mutationParameters: { resetIteration: mutated.length },
      timestamp: new Date().toISOString(),
      generatorVersion: '2.0.0'
    };

    return { mutated, mutation };
  }

  public static injectResidualStagnation(
    length: number = 20,
    stagnantValue: number = 0.005
  ): { readonly mutated: number[]; readonly mutation: AdversarialMutation } {
    const mutated: number[] = [];
    for (let i = 0; i < length; i++) {
      mutated.push(stagnantValue + (i % 2 === 0 ? 1e-7 : -1e-7));
    }

    const mutation: AdversarialMutation = {
      mutationId: `mut-stag-${Date.now().toString(36)}`,
      sourceCaseId: 'base-case',
      targetCaseId: 'mut-stag-case',
      mutationType: 'RESIDUAL_STAGNATION',
      affectedArtifact: 'residual-history',
      beforeHash: 'hash-orig-res',
      afterHash: 'hash-stag-res',
      mutationParameters: { length, stagnantValue },
      timestamp: new Date().toISOString(),
      generatorVersion: '2.0.0'
    };

    return { mutated, mutation };
  }

  public static injectMeshInversion(
    volumes: readonly number[]
  ): { readonly mutated: number[]; readonly mutation: AdversarialMutation } {
    const mutated = [...volumes];
    if (mutated.length > 0) {
      mutated[0] = -Math.abs(mutated[0]) || -1.0;
    }

    const mutation: AdversarialMutation = {
      mutationId: `mut-mesh-${Date.now().toString(36)}`,
      sourceCaseId: 'base-case',
      targetCaseId: 'mut-mesh-case',
      mutationType: 'MESH_INVERTED_CELL',
      affectedArtifact: 'mesh-volumes',
      beforeHash: 'hash-orig-mesh',
      afterHash: 'hash-inverted-mesh',
      mutationParameters: { invertedCellIndex: 0 },
      timestamp: new Date().toISOString(),
      generatorVersion: '2.0.0'
    };

    return { mutated, mutation };
  }
}
