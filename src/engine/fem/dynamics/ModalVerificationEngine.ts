/**
 * SECP Industrial OS — FEM Core Structural Dynamics (SECP-FEM-UPGRADE-007)
 * ModalVerificationEngine.ts
 * 
 * Provides model generators, benchmark evaluators, sensitivity checkers,
 * and adversarial testing suites for structural modal analysis verification.
 */

import { DOFComponent, FEMElement, FEMMaterial, FEMModel, FEMNode, FEMSection } from "../core/FEMTypes";
import { FEMDOFManager } from "../core/FEMDOFManager";
import { FEMElementFormulation } from "../core/FEMElementFormulation";
import { Bar1DFormulation } from "../core/Bar1DFormulation";
import { Beam2DFormulation } from "../core/Beam2DFormulation";
import { Frame2DFormulation } from "../core/Frame2DFormulation";
import { CST2DFormulation } from "../core/CST2DFormulation";
import { Q42DFormulation } from "../core/Q42DFormulation";
import { T62DFormulation } from "../core/T62DFormulation";
import { TET43DFormulation } from "../core/TET43DFormulation";
import { GlobalAssemblyEngine } from "../core/GlobalAssemblyEngine";
import { MassMatrixEngine, MassMatrixType } from "./MassMatrixEngine";
import { ModalAnalysisResult, StructuralModalSolver } from "./StructuralModalSolver";

export interface BenchmarkResult {
  modelName: string;
  numElements: number;
  modeIndex: number;
  numericalFrequencyHz: number;
  analyticalFrequencyHz: number;
  relativeErrorPercent: number;
  passed: boolean;
}

export class ModalVerificationEngine {
  private globalAssembly = new GlobalAssemblyEngine();
  private massEngine = new MassMatrixEngine();
  private modalSolver = new StructuralModalSolver();

  /**
   * Generates a 1D axial bar model discretized with N elements.
   * Fixed at x = 0, free at x = L.
   */
  public createAxialBarModel(
    N: number,
    L = 1000, // mm
    A = 100, // mm^2
    E = 210000, // MPa
    rho = 7.85e-9 // tonne/mm^3
  ): { model: FEMModel; formulations: Map<string, FEMElementFormulation> } {
    const nodes = new Map<string, FEMNode>();
    const elements = new Map<string, FEMElement>();
    const materials = new Map<string, FEMMaterial>();
    const sections = new Map<string, FEMSection>();

    materials.set("mat1", { materialId: "mat1", E, nu: 0.3, density: rho });
    sections.set("sec1", { sectionId: "sec1", area: A });

    const dx = L / N;
    for (let i = 0; i <= N; i++) {
      nodes.set(`node_${i + 1}`, { nodeId: `node_${i + 1}`, x: i * dx, y: 0, z: 0 });
    }

    for (let i = 0; i < N; i++) {
      elements.set(`elem_${i + 1}`, {
        elementId: `elem_${i + 1}`,
        nodeIds: [`node_${i + 1}`, `node_${i + 2}`],
        materialId: "mat1",
        sectionId: "sec1",
        formulationId: "BAR_1D"
      });
    }

    const boundaryConditions = [
      { nodeId: "node_1", dof: DOFComponent.UX, value: 0 }
    ];

    const model: FEMModel = {
      nodes,
      elements,
      materials,
      sections,
      loads: [],
      boundaryConditions
    };

    const formulations = new Map<string, FEMElementFormulation>([
      ["BAR_1D", new Bar1DFormulation()]
    ]);

    return { model, formulations };
  }

  /**
   * Analytical exact natural frequency for cantilever axial bar.
   * f_n = (2n - 1) / (4L) * sqrt(E / rho)
   */
  public getAxialBarAnalyticalFrequency(
    modeIndex: number,
    L = 1000,
    E = 210000,
    rho = 7.85e-9
  ): number {
    const c = Math.sqrt(E / rho);
    return ((2 * modeIndex - 1) * c) / (4 * L);
  }

  /**
   * Generates a 2D cantilever beam model discretized with N FRAME_2D elements.
   * Fixed UX, UY, RZ at node 1 (x=0). Free at node N+1 (x=L).
   */
  public createCantileverBeamModel(
    N: number,
    L = 1000, // mm
    A = 100, // mm^2
    I = 833.333, // mm^4
    E = 210000, // MPa
    rho = 7.85e-9 // tonne/mm^3
  ): { model: FEMModel; formulations: Map<string, FEMElementFormulation> } {
    const nodes = new Map<string, FEMNode>();
    const elements = new Map<string, FEMElement>();
    const materials = new Map<string, FEMMaterial>();
    const sections = new Map<string, FEMSection>();

    materials.set("mat1", { materialId: "mat1", E, nu: 0.3, density: rho });
    sections.set("sec1", { sectionId: "sec1", area: A, I });

    const dx = L / N;
    for (let i = 0; i <= N; i++) {
      nodes.set(`node_${i + 1}`, { nodeId: `node_${i + 1}`, x: i * dx, y: 0, z: 0 });
    }

    for (let i = 0; i < N; i++) {
      elements.set(`elem_${i + 1}`, {
        elementId: `elem_${i + 1}`,
        nodeIds: [`node_${i + 1}`, `node_${i + 2}`],
        materialId: "mat1",
        sectionId: "sec1",
        formulationId: "FRAME_2D"
      });
    }

    const boundaryConditions = [
      { nodeId: "node_1", dof: DOFComponent.UX, value: 0 },
      { nodeId: "node_1", dof: DOFComponent.UY, value: 0 },
      { nodeId: "node_1", dof: DOFComponent.RZ, value: 0 },
    ];

    const model: FEMModel = {
      nodes,
      elements,
      materials,
      sections,
      loads: [],
      boundaryConditions
    };

    const formulations = new Map<string, FEMElementFormulation>([
      ["FRAME_2D", new Frame2DFormulation()],
      ["BEAM_2D", new Beam2DFormulation()]
    ]);

    return { model, formulations };
  }

  /**
   * Analytical exact natural bending frequency for Euler-Bernoulli cantilever beam.
   * f_1 = 3.516015 / (2*pi*L^2) * sqrt(E*I / (rho*A))
   * f_2 = 22.0345 / (2*pi*L^2) * sqrt(E*I / (rho*A))
   * f_3 = 61.6972 / (2*pi*L^2) * sqrt(E*I / (rho*A))
   */
  public getCantileverBeamAnalyticalFrequency(
    modeIndex: number,
    L = 1000,
    A = 100,
    I = 833.333,
    E = 210000,
    rho = 7.85e-9
  ): number {
    const betaLValues = [1.875104, 4.694091, 7.854757, 10.995541];
    const betaL = betaLValues[modeIndex - 1] || ((2 * modeIndex - 1) * Math.PI) / 2;
    const factor = (betaL * betaL) / (2 * Math.PI * L * L);
    const stiffnessMassRatio = Math.sqrt((E * I) / (rho * A));
    return factor * stiffnessMassRatio;
  }

  /**
   * Solve modal problem for a given FEMModel and formulations map.
   */
  public solveModal(
    model: FEMModel,
    formulations: Map<string, FEMElementFormulation>,
    type: MassMatrixType = 'CONSISTENT'
  ): ModalAnalysisResult {
    const dofManager = new FEMDOFManager();
    dofManager.buildDOFs(model, formulations);

    const { K_sparse } = this.globalAssembly.assembleSparse(model, dofManager, formulations);
    const M_sparse = this.massEngine.assembleSparseMassMatrix(model, dofManager, { type });

    return this.modalSolver.solve(model, dofManager, K_sparse, M_sparse);
  }
}
