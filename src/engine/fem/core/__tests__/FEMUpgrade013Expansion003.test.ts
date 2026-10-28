/**
 * SECP Industrial OS — Engineering Truth OS
 * FEMUpgrade013Expansion003.test.ts
 *
 * SECP-PHYSICS-EXPANSION-003: Nonlinear Thermo-Electro-Mechanical Coupling, 
 * Material Evolution & Structural Stability.
 */

import { describe, it, expect } from 'vitest';
import { FEMModel, FEMNode, FEMElement, FEMMaterial, FEMSection, DOFComponent } from '../FEMTypes';
import { FEMDOFManager } from '../FEMDOFManager';
import { NonlinearEquilibriumSolver } from '../NonlinearEquilibriumSolver';
import { TET4LargeDeformationPlasticFormulation } from '../TET4LargeDeformationPlasticFormulation';
import { UnifiedThermoElectroMechanicalSolver3D } from '../../../physics/electromagnetics/UnifiedThermoElectroMechanicalSolver3D';
import { ElectricalBoundaryCondition, ThermalBoundaryCondition } from '../../../physics/electromagnetics/BidirectionalElectrothermalSolver3D';

describe('SECP-PHYSICS-EXPANSION-003: Nonlinear Multiphysics Coupling', () => {

  it('A1-A2: should verify incremental equilibrium and loading path dependence', async () => {
    // Cantilever beam with large deformation and plasticity
    const nodes = new Map<string, FEMNode>([
      ["N0", { nodeId: "N0", x: 0, y: 0, z: 0 }],
      ["N1", { nodeId: "N1", x: 1, y: 0, z: 0 }],
      ["N2", { nodeId: "N2", x: 1, y: 0.1, z: 0 }],
      ["N3", { nodeId: "N3", x: 0, y: 0.1, z: 0 }],
      ["N4", { nodeId: "N4", x: 0, y: 0, z: 0.1 }],
      ["N5", { nodeId: "N5", x: 1, y: 0, z: 0.1 }],
      ["N6", { nodeId: "N6", x: 1, y: 0.1, z: 0.1 }],
      ["N7", { nodeId: "N7", x: 0, y: 0.1, z: 0.1 }]
    ]);

    const materials = new Map<string, FEMMaterial>([
      ["M1", { 
        materialId: "M1", 
        E: 210000, 
        nu: 0.3, 
        yieldStress: 250, 
        tangentModulus: 1000 
      }]
    ]);

    const elements = new Map<string, FEMElement>([
      ["E1", { elementId: "E1", nodeIds: ["N0", "N1", "N3", "N4"], materialId: "M1", sectionId: "S1", formulationId: "TET4_NL_PLASTIC" }],
      ["E2", { elementId: "E2", nodeIds: ["N1", "N2", "N3", "N6"], materialId: "M1", sectionId: "S1", formulationId: "TET4_NL_PLASTIC" }],
      ["E3", { elementId: "E3", nodeIds: ["N1", "N4", "N5", "N6"], materialId: "M1", sectionId: "S1", formulationId: "TET4_NL_PLASTIC" }],
      ["E4", { elementId: "E4", nodeIds: ["N3", "N4", "N6", "N7"], materialId: "M1", sectionId: "S1", formulationId: "TET4_NL_PLASTIC" }],
      ["E5", { elementId: "E5", nodeIds: ["N1", "N3", "N4", "N6"], materialId: "M1", sectionId: "S1", formulationId: "TET4_NL_PLASTIC" }]
    ]);

    const model: FEMModel = {
      nodes,
      elements,
      materials,
      sections: new Map(),
      loads: [{ nodeId: "N2", dof: DOFComponent.UY, value: -10000 }], // Heavy load to cause plasticity
      boundaryConditions: [
        { nodeId: "N0", dof: DOFComponent.UX, value: 0 },
        { nodeId: "N0", dof: DOFComponent.UY, value: 0 },
        { nodeId: "N0", dof: DOFComponent.UZ, value: 0 },
        { nodeId: "N3", dof: DOFComponent.UX, value: 0 },
        { nodeId: "N3", dof: DOFComponent.UY, value: 0 },
        { nodeId: "N3", dof: DOFComponent.UZ, value: 0 },
        { nodeId: "N4", dof: DOFComponent.UX, value: 0 },
        { nodeId: "N4", dof: DOFComponent.UY, value: 0 },
        { nodeId: "N4", dof: DOFComponent.UZ, value: 0 },
        { nodeId: "N7", dof: DOFComponent.UX, value: 0 },
        { nodeId: "N7", dof: DOFComponent.UY, value: 0 },
        { nodeId: "N7", dof: DOFComponent.UZ, value: 0 }
      ]
    };

    const dofManager = new FEMDOFManager();
    const formulations = new Map([["TET4_NL_PLASTIC", new TET4LargeDeformationPlasticFormulation()]]);
    dofManager.buildDOFs(model, formulations);
    const solver = new NonlinearEquilibriumSolver();

    const result = await solver.solve(model, dofManager, formulations, {
      maxLoadSteps: 5,
      relativeTolerance: 1e-5
    });

    expect(result.converged).toBe(true);
    expect(result.steps).toBeGreaterThan(1);
    
    // Check for plasticity
    const state = result.stateManager.getElementStates("E1", false)[0];
    expect(state.yieldFlag).toBe(true);
    expect(state.equivalentPlasticStrain).toBeGreaterThan(0);
  });

  it('B4: should verify temperature-dependent material response', async () => {
    // Simple bar under tension with varying temperature
    const materials = new Map<string, FEMMaterial>([
      ["M1", { 
        materialId: "M1", 
        E: 200000, 
        nu: 0.3, 
        yieldStress: 300, 
        tangentModulus: 1000,
        alphaE: 0.001, // 0.1% reduction per degree
        alphaY: 0.002, // 0.2% reduction per degree
        refTempC: 20.0
      }]
    ]);

    const nodes = new Map<string, FEMNode>([
      ["N0", { nodeId: "N0", x: 0, y: 0, z: 0 }],
      ["N1", { nodeId: "N1", x: 0.1, y: 0, z: 0 }],
      ["N2", { nodeId: "N2", x: 0, y: 0.1, z: 0 }],
      ["N3", { nodeId: "N3", x: 0, y: 0, z: 0.1 }]
    ]);

    const elements = new Map<string, FEMElement>([
      ["E1", { elementId: "E1", nodeIds: ["N0", "N1", "N2", "N3"], materialId: "M1", sectionId: "S1", formulationId: "TET4_NL_PLASTIC" }]
    ]);

    const model: FEMModel = {
      nodes, elements, materials, sections: new Map(),
      loads: [],
      boundaryConditions: [
        { nodeId: "N0", dof: DOFComponent.UX, value: 0 },
        { nodeId: "N0", dof: DOFComponent.UY, value: 0 },
        { nodeId: "N0", dof: DOFComponent.UZ, value: 0 },
        { nodeId: "N2", dof: DOFComponent.UX, value: 0 },
        { nodeId: "N2", dof: DOFComponent.UY, value: 0 },
        { nodeId: "N2", dof: DOFComponent.UZ, value: 0 },
        { nodeId: "N3", dof: DOFComponent.UX, value: 0 },
        { nodeId: "N3", dof: DOFComponent.UY, value: 0 },
        { nodeId: "N3", dof: DOFComponent.UZ, value: 0 }
      ],
      nodalTemperatures: new Map([["N0", 120], ["N1", 120], ["N2", 120], ["N3", 120]]) // dT = 100
    };

    const dofManager = new FEMDOFManager();
    const formulations = new Map([["TET4_NL_PLASTIC", new TET4LargeDeformationPlasticFormulation()]]);
    dofManager.buildDOFs(model, formulations);
    const solver = new NonlinearEquilibriumSolver();

    const result = await solver.solve(model, dofManager, formulations, { maxLoadSteps: 1 });
    
    // At 120 C, yield stress should be 300 * (1 - 0.002 * 100) = 300 * 0.8 = 240 MPa
    const state = result.stateManager.getElementStates("E1", false)[0];
    expect(state.yieldStress).toBeCloseTo(240.0, 1);
  });

  it('C1-C5: should verify bidirectional thermo-electro-mechanical coupling', async () => {
    // 3D Bar with electrical potential across it, causing heating, causing expansion and property shift
    const nodes = new Map<string, FEMNode>([
      ["N0", { nodeId: "N0", x: 0, y: 0, z: 0 }],
      ["N1", { nodeId: "N1", x: 0.1, y: 0, z: 0 }],
      ["N2", { nodeId: "N2", x: 0.1, y: 0.01, z: 0 }],
      ["N3", { nodeId: "N3", x: 0, y: 0.01, z: 0 }],
      ["N4", { nodeId: "N4", x: 0, y: 0, z: 0.01 }],
      ["N5", { nodeId: "N5", x: 0.1, y: 0, z: 0.01 }],
      ["N6", { nodeId: "N6", x: 0.1, y: 0.01, z: 0.01 }],
      ["N7", { nodeId: "N7", x: 0, y: 0.01, z: 0.01 }]
    ]);

    const materials = new Map<string, FEMMaterial>([
      ["M1", { 
        materialId: "M1", 
        E: 70000, // Aluminum-ish
        nu: 0.33, 
        yieldStress: 100, 
        tangentModulus: 500,
        thermalExpansionCoeff: 23e-6,
        alphaE: 0.0005,
        alphaY: 0.001,
        refTempC: 20.0
      }]
    ]);

    const elements = new Map<string, FEMElement>([
      ["E1", { elementId: "E1", nodeIds: ["N0", "N1", "N3", "N4"], materialId: "M1", sectionId: "S1", formulationId: "TET4_NL_PLASTIC" }],
      ["E2", { elementId: "E2", nodeIds: ["N1", "N2", "N3", "N6"], materialId: "M1", sectionId: "S1", formulationId: "TET4_NL_PLASTIC" }],
      ["E3", { elementId: "E3", nodeIds: ["N1", "N4", "N5", "N6"], materialId: "M1", sectionId: "S1", formulationId: "TET4_NL_PLASTIC" }],
      ["E4", { elementId: "E4", nodeIds: ["N3", "N4", "N6", "N7"], materialId: "M1", sectionId: "S1", formulationId: "TET4_NL_PLASTIC" }],
      ["E5", { elementId: "E5", nodeIds: ["N1", "N3", "N4", "N6"], materialId: "M1", sectionId: "S1", formulationId: "TET4_NL_PLASTIC" }]
    ]);

    const model: FEMModel = {
      nodes, elements, materials, sections: new Map(),
      loads: [],
      boundaryConditions: [
        { nodeId: "N0", dof: DOFComponent.UX, value: 0 },
        { nodeId: "N0", dof: DOFComponent.UY, value: 0 },
        { nodeId: "N0", dof: DOFComponent.UZ, value: 0 },
        { nodeId: "N3", dof: DOFComponent.UX, value: 0 },
        { nodeId: "N3", dof: DOFComponent.UY, value: 0 },
        { nodeId: "N3", dof: DOFComponent.UZ, value: 0 },
        { nodeId: "N4", dof: DOFComponent.UX, value: 0 },
        { nodeId: "N4", dof: DOFComponent.UY, value: 0 },
        { nodeId: "N4", dof: DOFComponent.UZ, value: 0 },
        { nodeId: "N7", dof: DOFComponent.UX, value: 0 },
        { nodeId: "N7", dof: DOFComponent.UY, value: 0 },
        { nodeId: "N7", dof: DOFComponent.UZ, value: 0 }
      ]
    };

    const electricalBCs: ElectricalBoundaryCondition[] = [
      { nodeId: "N0", potential: 5.0 },
      { nodeId: "N3", potential: 5.0 },
      { nodeId: "N4", potential: 5.0 },
      { nodeId: "N7", potential: 5.0 },
      { nodeId: "N1", potential: 0.0 },
      { nodeId: "N2", potential: 0.0 },
      { nodeId: "N5", potential: 0.0 },
      { nodeId: "N6", potential: 0.0 }
    ];

    const thermalBCs: ThermalBoundaryCondition[] = [
      { nodeId: "N0", type: 'PRESCRIBED', temperatureC: 20.0 },
      { nodeId: "N3", type: 'PRESCRIBED', temperatureC: 20.0 },
      { nodeId: "N4", type: 'PRESCRIBED', temperatureC: 20.0 },
      { nodeId: "N7", type: 'PRESCRIBED', temperatureC: 20.0 }
    ];

    const dofManager = new FEMDOFManager();
    const formulations = new Map([["TET4_NL_PLASTIC", new TET4LargeDeformationPlasticFormulation()]]);
    dofManager.buildDOFs(model, formulations);
    const multiSolver = new UnifiedThermoElectroMechanicalSolver3D();

    const result = await multiSolver.solve(model, dofManager, electricalBCs, thermalBCs, {
      maxCouplingIterations: 8,
      convergenceTolerance: 1e-2
    });

    expect(result.success).toBe(true);
    expect(result.totalIterations).toBeGreaterThan(1);
    
    // Check if temperature increased due to Joule heating
    const maxT = Math.max(...Array.from(result.finalNodalTemperatures.values()));
    expect(maxT).toBeGreaterThan(20.0);

    // Check if expansion occurred (N1 should move in +X)
    const dofN1X = dofManager.getDOF("N1", DOFComponent.UX)!;
    expect(result.finalNodalDisplacements[dofN1X.globalId]).toBeGreaterThan(0);
  });
});
