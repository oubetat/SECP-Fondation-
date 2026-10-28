/**
 * SECP Industrial OS — Engineering Truth OS
 * UnifiedThermoElectroMechanicalSolver3D.ts
 *
 * SECP-PHYSICS-EXPANSION-003: Bidirectional Thermo-Electro-Mechanical Coupling.
 * Implements a Picard iteration loop between:
 * 1. 3D Electrical Conduction (Ohm's Law with Temperature-Dependent Conductivity).
 * 2. 3D Thermal Conduction (Joule Heating Source).
 * 3. 3D Nonlinear Mechanical Equilibrium (Thermal Expansion & Temperature-Dependent Elasticity/Yield).
 * 4. Geometric Feedback (Deformed Mesh used for Electrical/Thermal evaluation).
 */

import { Matrix } from "../../fem/core/MathUtils";
import { 
  FEMModel, 
  FEMNode, 
  FEMElement, 
  FEMMaterial, 
  DOFComponent,
  StructuralFieldRecovery
} from "../../fem/core/FEMTypes";
import { FEMDOFManager } from "../../fem/core/FEMDOFManager";
import { NonlinearEquilibriumSolver, NonlinearAnalysisResult } from "../../fem/core/NonlinearEquilibriumSolver";
import { TET4LargeDeformationPlasticFormulation } from "../../fem/core/TET4LargeDeformationPlasticFormulation";
import { BidirectionalElectrothermalSolver3D, ElectrothermalNode3D, ElectrothermalTetElement3D, ElectricalBoundaryCondition, ThermalBoundaryCondition } from "./BidirectionalElectrothermalSolver3D";
import { ElectrostaticSolver3D } from "./ElectrostaticSolver3D";

export interface MultiphysicsOptions {
  maxCouplingIterations?: number;
  convergenceTolerance?: number; // Relative change in field
  relaxationFactor?: number;
  nonlinearOptions?: any;
}

export interface MultiphysicsResult {
  status: 'CONVERGED' | 'NON_CONVERGED' | 'FAILED';
  success: boolean;
  totalIterations: number;
  finalNodalPotentials: Map<string, number>;
  finalNodalTemperatures: Map<string, number>;
  finalNodalDisplacements: Float64Array;
  mechanicalResult?: NonlinearAnalysisResult;
  totalElectricalPower: number;
  totalThermalHeat: number;
  iterationHistory: any[];
}

export class UnifiedThermoElectroMechanicalSolver3D {
  private nonlinearSolver = new NonlinearEquilibriumSolver();
  private plasticFormulation = new TET4LargeDeformationPlasticFormulation();

  public async solve(
    model: FEMModel,
    dofManager: FEMDOFManager,
    electricalBCs: ElectricalBoundaryCondition[],
    thermalBCs: ThermalBoundaryCondition[],
    options: MultiphysicsOptions = {}
  ): Promise<MultiphysicsResult> {
    const maxIter = options.maxCouplingIterations ?? 10;
    const tol = options.convergenceTolerance ?? 1e-3;
    const omega = options.relaxationFactor ?? 0.7;

    const formulations = new Map<string, any>();
    for (const [elemId, elem] of model.elements) {
      formulations.set(elem.formulationId, this.plasticFormulation);
    }

    let currentNodalTemperatures = new Map<string, number>();
    for (const [nodeId, node] of model.nodes) {
      const tbc = thermalBCs.find(b => b.nodeId === nodeId && b.type === 'PRESCRIBED');
      currentNodalTemperatures.set(nodeId, tbc?.temperatureC ?? 20.0);
    }

    let currentU = new Float64Array(dofManager.getTotalDOFCount());
    const iterationHistory: any[] = [];
    let converged = false;

    let lastPotentials = new Map<string, number>();
    let totalElecPower = 0;
    let totalThermHeat = 0;

    for (let iter = 1; iter <= maxIter; iter++) {
      // 1. Prepare de-formed geometry for Electrical/Thermal solvers
      const deformedNodes: ElectrothermalNode3D[] = [];
      for (const [nodeId, node] of model.nodes) {
        const dofX = dofManager.getDOF(nodeId, DOFComponent.UX);
        const dofY = dofManager.getDOF(nodeId, DOFComponent.UY);
        const dofZ = dofManager.getDOF(nodeId, DOFComponent.UZ);
        deformedNodes.push({
          id: nodeId,
          x: node.x + (dofX ? currentU[dofX.globalId] : 0),
          y: node.y + (dofY ? currentU[dofY.globalId] : 0),
          z: node.z + (dofZ ? currentU[dofZ.globalId] : 0)
        });
      }

      const etElements: ElectrothermalTetElement3D[] = [];
      for (const [elemId, elem] of model.elements) {
        const mat = model.materials.get(elem.materialId)!;
        etElements.push({
          id: elemId,
          nodeIds: elem.nodeIds as [string, string, string, string],
          nominalConductivity: 1e4, // Assuming fixed nominal for now, could be in FEMMaterial
          tempCoefficient: 0.0039,
          thermalConductivity: 200,
          referenceTempC: mat.refTempC ?? 20.0
        });
      }

      // 2. Solve Electrical-Thermal Coupling for current geometry
      const etSolver = new BidirectionalElectrothermalSolver3D();
      const etResult = etSolver.solve(deformedNodes, etElements, electricalBCs, thermalBCs, {
        maxIterations: 5, // Inner loops
        toleranceK: 1e-2,
        relaxationFactor: 0.7
      });

      lastPotentials = etResult.nodalPotentialsV;
      const newNodalTemps = etResult.nodalTemperaturesC;
      totalElecPower = etResult.totalElectricalPowerWatts;
      totalThermHeat = etResult.totalThermalHeatWatts;

      // 3. Update Model with New Temperatures
      model.nodalTemperatures = newNodalTemps;

      // 4. Solve Mechanical Equilibrium
      const mechResult = await this.nonlinearSolver.solve(model, dofManager, formulations, {
        ...options.nonlinearOptions,
        initialLoadFactor: 0.2, 
        maxLoadSteps: 5
      });

      if (!mechResult.converged) {
        throw new Error(`[COUPLING_FAILURE] Mechanical equilibrium failed to converge at iteration ${iter}`);
      }

      const newU = mechResult.U;

      // 5. Check Coupling Convergence (Relative change in displacement and temperature)
      let maxDeltaU = 0;
      let uNorm = 0;
      for (let i = 0; i < newU.length; i++) {
        const du = Math.abs(newU[i] - currentU[i]);
        if (du > maxDeltaU) maxDeltaU = du;
        uNorm += newU[i] * newU[i];
      }
      uNorm = Math.sqrt(uNorm);
      const relDU = maxDeltaU / Math.max(uNorm, 1e-6);

      let maxDeltaT = 0;
      for (const [nodeId, t] of newNodalTemps) {
        const dt = Math.abs(t - (currentNodalTemperatures.get(nodeId) ?? 20.0));
        if (dt > maxDeltaT) maxDeltaT = dt;
      }
      const relDT = maxDeltaT / 100.0; // Scale by 100 C range roughly

      iterationHistory.push({
        iteration: iter,
        relDU,
        relDT,
        maxT: Math.max(...Array.from(newNodalTemps.values())),
        maxU: Math.max(...Array.from(newU).map(Math.abs))
      });

      // Apply Relaxation
      for (let i = 0; i < currentU.length; i++) {
        currentU[i] = omega * newU[i] + (1.0 - omega) * currentU[i];
      }
      for (const [nodeId, t] of newNodalTemps) {
        const oldT = currentNodalTemperatures.get(nodeId) ?? 20.0;
        currentNodalTemperatures.set(nodeId, omega * t + (1.0 - omega) * oldT);
      }

      if (relDU < tol && relDT < tol) {
        converged = true;
        break;
      }
    }

    return {
      status: converged ? 'CONVERGED' : 'NON_CONVERGED',
      success: converged,
      totalIterations: iterationHistory.length,
      finalNodalPotentials: lastPotentials,
      finalNodalTemperatures: currentNodalTemperatures,
      finalNodalDisplacements: currentU,
      totalElectricalPower: totalElecPower,
      totalThermalHeat: totalThermHeat,
      iterationHistory
    };
  }
}
