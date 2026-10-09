/**
 * SECP DRONE-001B: Production Kernel Integration & Anti-Bypass Types
 * Classification: SECP Industrial OS Production Integration Proof
 */

import { Solid } from '../../cad-kernel/topology/TopologyContracts';
import { EngineeringDocument } from '../../cad-kernel/document/CADDocument';
import { StructuralFemResult } from '../../structuralFem';
import { CfdFlowResult } from '../../cfdEngine';
import { CamJobPackage } from '../../camEngine';
import { AssemblyMassProperties, InterferenceClash, AssemblyMate } from '../../assembly';

export interface ProductionKernelInvocationRecord {
  kernelName: string;
  runtimeEntry: string;
  caller: string;
  dispatcher: string;
  executionTimestamp: string;
  executionContext: string;
  inputDigest: string;
  outputDigest: string;
  callCount: number;
}

export interface ProductionTelemetryTrace {
  invocations: Record<string, ProductionKernelInvocationRecord>;
  totalKernelInvocations: number;
  dispatcherRoute: string;
  antiBypassPassed: boolean;
  activeKernels: string[];
}

export interface ProductionCadResult {
  document: EngineeringDocument;
  evaluatedSolid: Solid;
  componentSolids: Record<string, Solid>;
  volumeM3: number;
  surfaceAreaM2: number;
  topologySummary: {
    totalVertices: number;
    totalEdges: number;
    totalFaces: number;
    eulerChi: number;
    isWatertight: boolean;
    isManifold: boolean;
  };
  meshData: any;
  bRepHash: string;
}

export interface ProductionAssemblyResult {
  componentsCount: number;
  mates: AssemblyMate[];
  solvedMatesCount: number;
  residualErrorMaxMm: number;
  interferences: InterferenceClash[];
  massProperties: AssemblyMassProperties;
  tipToTipClearanceMm: number;
  propToFrameClearanceMm: number;
  cgDistanceToCenterMm: number;
}

export interface ProductionFeaResult {
  nominalFlightResult: StructuralFemResult;
  hardLanding8gResult: StructuralFemResult;
  armCantileverResult: StructuralFemResult;
  adversarialPayloadResult: StructuralFemResult;
  reducedArmThicknessResult: StructuralFemResult;
  loadSensitivity3gResult: StructuralFemResult;
  maxDisplacementMm: number;
  maxVonMisesStressMPa: number;
  minSafetyFactor: number;
}

export interface ProductionCfdResult {
  cruise15msResult: CfdFlowResult;
  maxSpeed25msResult: CfdFlowResult;
  gust30msResult: CfdFlowResult;
  continuityResidual: number;
  dragForceCruiseN: number;
  dragForceMaxSpeedN: number;
  reynoldsNumberCruise: number;
}

export interface ProductionCamResult {
  motorMountJob: CamJobPackage;
  totalEstimatedTimeMin: number;
  gCodeLineCount: number;
  gCodeText: string;
  clDataPointsCount: number;
  collisionFree: boolean;
  gougeFree: boolean;
}

export interface ProductionInteropResult {
  stepExportText: string;
  stepEntityCount: number;
  stepValid: boolean;
}

export interface Drone001BProductionProofPackage {
  proofId: string;
  timestamp: string;
  pipelineState: 'EXECUTED_PRODUCTION_STACK';
  telemetry: ProductionTelemetryTrace;
  cad: ProductionCadResult;
  assembly: ProductionAssemblyResult;
  fea: ProductionFeaResult;
  cfd: ProductionCfdResult;
  cam: ProductionCamResult;
  interop: ProductionInteropResult;
  independentVerification: {
    cadValid: boolean;
    assemblyValid: boolean;
    feaValid: boolean;
    cfdValid: boolean;
    camValid: boolean;
    antiBypassValid: boolean;
    overallValid: boolean;
    verificationDetails: Record<string, string>;
  };
  crossValidationAgainstOracleA: {
    geometryConsistent: boolean;
    massDiffPct: number;
    massConsistent: boolean;
    clearancesConsistent: boolean;
    feaStressDiffPct: number;
    feaConsistent: boolean;
    cfdDragDiffPct: number;
    cfdConsistent: boolean;
    camPathConsistent: boolean;
    overallCrossValidationPassed: boolean;
    comparisonLog: string[];
  };
  determinismProof: {
    runsCount: number;
    bitForBitIdentical: boolean;
    canonicalInputDigest: string;
    geometryResultDigest: string;
    assemblyStateDigest: string;
    feaResultDigest: string;
    cfdResultDigest: string;
    camResultDigest: string;
    evidencePackageDigest: string;
    merkleRootHash: string;
  };
  causalMutations: {
    armThicknessMutation: {
      applied: boolean;
      geometryHashChanged: boolean;
      meshHashChanged: boolean;
      feaStressChanged: boolean;
      causalLineageIntact: boolean;
    };
    loadCaseMutation: {
      applied: boolean;
      forceChanged: boolean;
      stressChanged: boolean;
      fosChanged: boolean;
      causalLineageIntact: boolean;
    };
    topologyMutation: {
      applied: boolean;
      topologyHashChanged: boolean;
      causalLineageIntact: boolean;
    };
  };
  verdict: 'FULLY PROVEN' | 'PARTIALLY PROVEN' | 'NOT PROVEN' | 'CRITICAL FAILURE';
  verdictRationale: string;
}
