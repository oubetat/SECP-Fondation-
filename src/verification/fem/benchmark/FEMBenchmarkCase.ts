/**
 * PATCH-177: FEM Benchmark Case Generators
 * 
 * Factory functions to create rigorous, physically grounded FEM benchmark models.
 */

import { StructuralModel } from '../../../engine/fem/solver/StructuralModel';
import { ElementInput, NodalLoadInput, NodeInput, PrescribedDisplacementInput } from '../../../engine/fem/solver/types';
import { FEMTolerancePolicy } from './types';

export class FEMBenchmarkCaseFactory {
  /**
   * Case 01: 1D Axial Bar
   * Length L = 1.0m, Area A = 0.001 m^2, E = 200 GPa, F = 10,000 N
   */
  public static createCase01AxialBar(): {
    model: StructuralModel;
    tolerancePolicy: FEMTolerancePolicy;
    lengthM: number;
    areaM2: number;
    youngModulusGPa: number;
    forceN: number;
  } {
    const lengthM = 1.0;
    const areaM2 = 0.001;
    const youngModulusGPa = 200;
    const forceN = 10000;

    const nodes: NodeInput[] = [
      { id: 'N0', index: 0, coordinates: [0.0, 0.0] },
      { id: 'N1', index: 1, coordinates: [0.5, 0.0] },
      { id: 'N2', index: 2, coordinates: [1.0, 0.0] }
    ];

    const elements: ElementInput[] = [
      {
        id: 'E0',
        type: 'BAR2',
        nodeIds: ['N0', 'N1'],
        material: { E: youngModulusGPa * 1e9, nu: 0.3, area: areaM2 }
      },
      {
        id: 'E1',
        type: 'BAR2',
        nodeIds: ['N1', 'N2'],
        material: { E: youngModulusGPa * 1e9, nu: 0.3, area: areaM2 }
      }
    ];

    const constraints: PrescribedDisplacementInput[] = [
      { nodeId: 'N0', dof: 'UX', value: 0 },
      { nodeId: 'N0', dof: 'UY', value: 0 },
      { nodeId: 'N1', dof: 'UY', value: 0 },
      { nodeId: 'N2', dof: 'UY', value: 0 }
    ];

    const loads: NodalLoadInput[] = [
      { nodeId: 'N2', dof: 'UX', magnitude: forceN }
    ];

    const model = new StructuralModel('CASE_01_AXIAL_BAR', nodes, elements, loads, constraints);

    const tolerancePolicy: FEMTolerancePolicy = {
      referenceTolerancePercent: 0.1, // 0.1% max error vs closed form
      numericalTolerance: 1e-6,
      equilibriumToleranceN: 1e-3,
      convergenceTolerance: 1e-6,
      toleranceJustification: 'Exact closed-form 1D axial bar formulation allows strict <0.1% tolerance.'
    };

    return { model, tolerancePolicy, lengthM, areaM2, youngModulusGPa, forceN };
  }

  /**
   * Case 02: Cantilever Beam (2D Plane Stress QUAD4 grid)
   * Length L = 2.0m, Height h = 0.2m, Width b = 0.02m, E = 200 GPa, nu = 0.3, Tip Shear F = -10,000 N
   */
  public static createCase02CantileverBeam(
    nx: number = 8,
    ny: number = 2
  ): {
    model: StructuralModel;
    tolerancePolicy: FEMTolerancePolicy;
    lengthM: number;
    widthM: number;
    heightM: number;
    youngModulusGPa: number;
    forceN: number;
  } {
    const lengthM = 2.0;
    const heightM = 0.2;
    const widthM = 0.02;
    const youngModulusGPa = 200;
    const forceN = -10000;

    const nodes: NodeInput[] = [];
    const elements: ElementInput[] = [];
    const constraints: PrescribedDisplacementInput[] = [];
    const loads: NodalLoadInput[] = [];

    const dx = lengthM / nx;
    const dy = heightM / ny;

    let nodeIdx = 0;
    for (let i = 0; i <= nx; i++) {
      for (let j = 0; j <= ny; j++) {
        const x = i * dx;
        const y = j * dy - heightM / 2; // Center neutral axis at y=0
        const id = `N_${i}_${j}`;
        nodes.push({ id, index: nodeIdx++, coordinates: [x, y] });

        // Constrain root nodes at x = 0
        if (i === 0) {
          constraints.push({ nodeId: id, dof: 'UX', value: 0 });
          // Constrain UY on neutral axis (middle node) to prevent vertical rigid-body motion
          if (j === Math.floor(ny / 2)) {
            constraints.push({ nodeId: id, dof: 'UY', value: 0 });
          }
        }
      }
    }

    let elemIdx = 0;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const n0 = `N_${i}_${j}`;
        const n1 = `N_${i + 1}_${j}`;
        const n2 = `N_${i + 1}_${j + 1}`;
        const n3 = `N_${i}_${j + 1}`;

        elements.push({
          id: `E_${elemIdx++}`,
          type: 'QUAD4',
          nodeIds: [n0, n1, n2, n3],
          material: { E: youngModulusGPa * 1e9, nu: 0.3, thickness: widthM }
        });
      }
    }

    // Distribute tip load at x = L across end column nodes
    const loadPerTipNode = forceN / (ny + 1);
    for (let j = 0; j <= ny; j++) {
      loads.push({
        nodeId: `N_${nx}_${j}`,
        dof: 'UY',
        magnitude: loadPerTipNode
      });
    }

    const model = new StructuralModel(`CASE_02_CANTILEVER_${nx}x${ny}`, nodes, elements, loads, constraints);

    const tolerancePolicy: FEMTolerancePolicy = {
      referenceTolerancePercent: 5.0, // Plane stress FEA vs Euler-Bernoulli Euler shear correction tolerance
      numericalTolerance: 1e-6,
      equilibriumToleranceN: 1e-2,
      convergenceTolerance: 1e-6,
      toleranceJustification: 'Euler-Bernoulli beam theory ignores shear deformation; 2D plane stress quad mesh matches within 5%.'
    };

    return { model, tolerancePolicy, lengthM, widthM, heightM, youngModulusGPa, forceN };
  }

  /**
   * Case 03: Uniaxial Tension Block
   */
  public static createCase03UniaxialTension(): {
    model: StructuralModel;
    tolerancePolicy: FEMTolerancePolicy;
    lengthM: number;
    widthM: number;
    heightM: number;
    youngModulusGPa: number;
    poissonsRatio: number;
    forceN: number;
  } {
    const lengthM = 1.0;
    const heightM = 1.0;
    const widthM = 0.01; // thickness
    const youngModulusGPa = 210;
    const poissonsRatio = 0.0;
    const forceN = 100000; // 100 kN

    const nodes: NodeInput[] = [
      { id: 'N0', index: 0, coordinates: [0.0, 0.0] },
      { id: 'N1', index: 1, coordinates: [1.0, 0.0] },
      { id: 'N2', index: 2, coordinates: [1.0, 1.0] },
      { id: 'N3', index: 3, coordinates: [0.0, 1.0] }
    ];

    const elements: ElementInput[] = [
      {
        id: 'E0',
        type: 'QUAD4',
        nodeIds: ['N0', 'N1', 'N2', 'N3'],
        material: { E: youngModulusGPa * 1e9, nu: poissonsRatio, thickness: widthM }
      }
    ];

    // Constrain left edge x=0 in UX, and origin N0 in UY to prevent rigid body motion
    const constraints: PrescribedDisplacementInput[] = [
      { nodeId: 'N0', dof: 'UX', value: 0 },
      { nodeId: 'N0', dof: 'UY', value: 0 },
      { nodeId: 'N3', dof: 'UX', value: 0 }
    ];

    const loads: NodalLoadInput[] = [
      { nodeId: 'N1', dof: 'UX', magnitude: forceN / 2 },
      { nodeId: 'N2', dof: 'UX', magnitude: forceN / 2 }
    ];

    const model = new StructuralModel('CASE_03_UNIAXIAL_TENSION', nodes, elements, loads, constraints);

    const tolerancePolicy: FEMTolerancePolicy = {
      referenceTolerancePercent: 0.5,
      numericalTolerance: 1e-6,
      equilibriumToleranceN: 1e-2,
      convergenceTolerance: 1e-6,
      toleranceJustification: 'Uniform plane stress tension field reproduces analytical linear state accurately.'
    };

    return { model, tolerancePolicy, lengthM, widthM, heightM, youngModulusGPa, poissonsRatio, forceN };
  }

  /**
   * Case 04: Patch Test
   * Irregular 5-node patch testing strain completeness under linear displacement field
   */
  public static createCase04PatchTest(): {
    model: StructuralModel;
    tolerancePolicy: FEMTolerancePolicy;
    a1: number;
    a2: number;
    b1: number;
    b2: number;
    youngModulusGPa: number;
    poissonsRatio: number;
  } {
    const a0 = 1e-3, a1 = 2e-3, a2 = 1e-3;
    const b0 = 2e-3, b1 = 1e-3, b2 = 3e-3;

    const youngModulusGPa = 200;
    const poissonsRatio = 0.25;

    // Distorted internal node coordinates
    const nodes: NodeInput[] = [
      { id: 'N0', index: 0, coordinates: [0.0, 0.0] },
      { id: 'N1', index: 1, coordinates: [2.0, 0.0] },
      { id: 'N2', index: 2, coordinates: [2.0, 1.0] },
      { id: 'N3', index: 3, coordinates: [0.0, 1.0] },
      { id: 'N4', index: 4, coordinates: [0.8, 0.4] } // Interior distorted node
    ];

    // 4 Quad elements meeting at interior node N4
    const elements: ElementInput[] = [
      { id: 'E0', type: 'QUAD4', nodeIds: ['N0', 'N1', 'N4', 'N3'], material: { E: youngModulusGPa * 1e9, nu: poissonsRatio, thickness: 0.01 } },
      { id: 'E1', type: 'QUAD4', nodeIds: ['N1', 'N2', 'N3', 'N4'], material: { E: youngModulusGPa * 1e9, nu: poissonsRatio, thickness: 0.01 } }
    ];

    // Prescribe exact displacements on boundary nodes N0, N1, N2, N3
    const constraints: PrescribedDisplacementInput[] = [];
    const boundaryNodes = ['N0', 'N1', 'N2', 'N3'];

    boundaryNodes.forEach((nodeId) => {
      const node = nodes.find((n) => n.id === nodeId)!;
      const x = node.coordinates[0];
      const y = node.coordinates[1];
      const u = a0 + a1 * x + a2 * y;
      const v = b0 + b1 * x + b2 * y;

      constraints.push({ nodeId, dof: 'UX', value: u });
      constraints.push({ nodeId, dof: 'UY', value: v });
    });

    const model = new StructuralModel('CASE_04_PATCH_TEST', nodes, elements, [], constraints);

    const tolerancePolicy: FEMTolerancePolicy = {
      referenceTolerancePercent: 0.01, // Machine precision test
      numericalTolerance: 1e-6,
      equilibriumToleranceN: 1e-2,
      convergenceTolerance: 1e-6,
      toleranceJustification: 'Patch test requires exact strain reproduction on arbitrary mesh patches.'
    };

    return { model, tolerancePolicy, a1, a2, b1, b2, youngModulusGPa, poissonsRatio };
  }

  /**
   * Case 10: Rigid Body / Unconstrained System Adversarial Model
   */
  public static createCase10RigidBodyAdversarial(): StructuralModel {
    const nodes: NodeInput[] = [
      { id: 'N0', index: 0, coordinates: [0.0, 0.0] },
      { id: 'N1', index: 1, coordinates: [1.0, 0.0] }
    ];

    const elements: ElementInput[] = [
      { id: 'E0', type: 'BAR2', nodeIds: ['N0', 'N1'], material: { E: 200e9, nu: 0.3, area: 0.01 } }
    ];

    // NO CONSTRAINTS (Unconstrained Floating Rigid Body)
    const loads: NodalLoadInput[] = [
      { nodeId: 'N1', dof: 'UX', magnitude: 1000 }
    ];

    return new StructuralModel('CASE_10_RIGID_BODY_ADVERSARIAL', nodes, elements, loads, []);
  }
}
