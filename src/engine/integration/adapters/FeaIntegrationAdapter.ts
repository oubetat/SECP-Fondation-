/**
 * PATCH-SECP-084: Structural FEA Integration Adapter
 * Connects production UI commands directly to StructuralFemEngine and SimulationFrameworkEngine.
 */

import { StructuralFemEngine } from '../../structuralFem';
import { SimulationFrameworkEngine, SimulationMesh } from '../../simulationFramework';
import {
  IndependentVerificationResult,
  ProductionEntityReference
} from '../contracts/ProductionCommandContracts';
import { FeaVisualizationContract } from '../contracts/VisualizationContracts';

export interface FeaAdapterInput {
  youngModulusGPa?: number;
  poissonsRatio?: number;
  yieldStrengthMPa?: number;
  forceLoadN?: number;
  meshWidthMm?: number;
  meshHeightMm?: number;
}

export interface FeaAdapterOutput {
  maxVonMisesStressMPa: number;
  maxDisplacementMm: number;
  safetyFactor: number;
  yieldStrengthMPa: number;
  isConverged: boolean;
  equilibriumResidualNorm: number;
  nodeCount: number;
  elementCount: number;
}

export class FeaIntegrationAdapter {
  public static executeStructuralFea(
    entityRef: ProductionEntityReference,
    config: FeaAdapterInput
  ): {
    numericalResult: FeaAdapterOutput;
    verificationResult: IndependentVerificationResult;
    visualizationData: FeaVisualizationContract;
  } {
    const youngE = config.youngModulusGPa || 200;
    const poisson = config.poissonsRatio || 0.3;
    const yieldStr = config.yieldStrengthMPa || 250;
    const loadN = config.forceLoadN || 15000;
    const w = config.meshWidthMm || 100;
    const h = config.meshHeightMm || 40;

    // 1. Generate Mesh
    const mesh: SimulationMesh = SimulationFrameworkEngine.generateStandardMesh(w, h, 12, 5);

    // 2. Solve FEA
    const feaResult = StructuralFemEngine.solveStructuralFea(mesh, youngE, poisson, yieldStr, loadN);

    // 3. Independent Verification Audit
    const residual = feaResult.validationReport.maxResidualError;
    const isConverged = feaResult.validationReport.isConverged;
    const isPhysicallyValid = feaResult.maxVonMisesStressMPa > 0 && feaResult.maxDisplacementMm > 0;
    const verificationPassed = isConverged && isPhysicallyValid && residual <= 1e-4;

    const numericalResult: FeaAdapterOutput = {
      maxVonMisesStressMPa: feaResult.maxVonMisesStressMPa,
      maxDisplacementMm: feaResult.maxDisplacementMm,
      safetyFactor: feaResult.safetyFactor,
      yieldStrengthMPa: feaResult.yieldStrengthMPa,
      isConverged,
      equilibriumResidualNorm: residual,
      nodeCount: mesh.nodeCount,
      elementCount: mesh.elementCount
    };

    const verificationResult: IndependentVerificationResult = {
      passed: verificationPassed,
      verifierName: 'IndependentFeaEquilibriumVerifier',
      checksPerformed: 3,
      residualMetric: residual,
      tolerance: 1e-4,
      verifierDetails: `Structural FEA Equilibrium Audit: MaxStress=${feaResult.maxVonMisesStressMPa.toFixed(1)}MPa, MaxDisp=${feaResult.maxDisplacementMm.toFixed(3)}mm, SafetyFactor=${feaResult.safetyFactor.toFixed(2)}, Residual=${residual.toExponential(3)}`
    };

    // 4. Build Visualization Contract
    const stressField = feaResult.nodeResults.map(nr => {
      const node = mesh.nodes.find(n => n.id === nr.nodeId);
      return {
        nodeId: nr.nodeId,
        stressMPa: nr.vonMisesStressMPa,
        x: node?.x || 0,
        y: node?.y || 0,
        z: node?.z || 0
      };
    });

    const displacementField = feaResult.nodeResults.map(nr => ({
      nodeId: nr.nodeId,
      dx: nr.displacementX,
      dy: nr.displacementY,
      dz: 0,
      magnitudeMm: nr.displacementMagnitudeMm
    }));

    const deformedMeshNodes = mesh.nodes.map(n => {
      const nr = feaResult.nodeResults.find(r => r.nodeId === n.id);
      return {
        id: n.id,
        x: n.x + (nr?.displacementX || 0),
        y: n.y + (nr?.displacementY || 0),
        z: n.z
      };
    });

    const visualizationData: FeaVisualizationContract = {
      nodeCount: mesh.nodeCount,
      elementCount: mesh.elementCount,
      maxVonMisesStressMPa: feaResult.maxVonMisesStressMPa,
      maxDisplacementMm: feaResult.maxDisplacementMm,
      minSafetyFactor: feaResult.safetyFactor,
      stressField,
      displacementField,
      deformedMeshNodes
    };

    return { numericalResult, verificationResult, visualizationData };
  }
}
