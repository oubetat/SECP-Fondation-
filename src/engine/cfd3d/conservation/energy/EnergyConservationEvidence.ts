/**
 * SECP Industrial OS v2 — Energy Conservation Framework
 * PATCH-059: Energy Conservation Evidence Generator
 */

import { EnergyConservationReport } from './EnergyConservationReport';
import { EnergyConservationStatus, EnergyFormulation } from './EnergyConservationTypes';

export interface EnergyConservationEvidenceRecord {
  readonly caseId: string;
  readonly meshHash: string;
  readonly fieldStateHash: string;
  readonly boundaryConditionHash: string;
  readonly materialStateHash: string;
  readonly physicsModelHash: string;
  readonly energyFormulationHash: string;
  readonly policyHash: string;
  readonly convectiveEnergyFlux: number;
  readonly pressureWork: number;
  readonly viscousWork: number;
  readonly conductiveHeatTransfer: number;
  readonly volumetricHeatSource: number;
  readonly bodyForcePower: number;
  readonly accumulation: number;
  readonly globalImbalance: number;
  readonly maxLocalImbalance: number;
  readonly verdict: EnergyConservationStatus;
  readonly formulation: EnergyFormulation;
  readonly diagnostics: string[];
  readonly timestamp: string;
  readonly provenanceSignature: string;
}

export class EnergyConservationEvidence {
  public static generate(
    caseId: string,
    report: EnergyConservationReport,
    boundaryConditionHash: string,
    materialStateHash: string,
    physicsModelHash: string,
    policyHash: string
  ): EnergyConservationEvidenceRecord {
    const energyFormulationHash = this.computeHash(`formulation:${report.formulation}`);
    const payload = `${caseId}|${report.meshHash}|${report.fieldStateHash}|${report.globalImbalance}|${report.status}|${report.formulation}`;
    const provenanceSignature = this.computeHash(payload);

    return {
      caseId,
      meshHash: report.meshHash,
      fieldStateHash: report.fieldStateHash,
      boundaryConditionHash,
      materialStateHash,
      physicsModelHash,
      energyFormulationHash,
      policyHash,
      convectiveEnergyFlux: report.totalConvectiveFlux,
      pressureWork: report.pressureWork,
      viscousWork: report.viscousWork,
      conductiveHeatTransfer: report.conductiveHeatTransfer,
      volumetricHeatSource: report.volumetricHeatSource,
      bodyForcePower: report.bodyForcePower,
      accumulation: report.accumulation,
      globalImbalance: report.globalImbalance,
      maxLocalImbalance: report.maxLocalImbalance,
      verdict: report.status,
      formulation: report.formulation,
      diagnostics: report.diagnostics,
      timestamp: report.timestamp,
      provenanceSignature
    };
  }

  private static computeHash(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = (hash << 5) - hash + data.charCodeAt(i);
      hash |= 0;
    }
    return `secp059-hash-${Math.abs(hash).toString(16)}`;
  }
}
