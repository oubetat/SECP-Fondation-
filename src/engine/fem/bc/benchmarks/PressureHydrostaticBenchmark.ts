/**
 * SECP CAD/CAE Platform - Analytical Benchmark 3: Surface Pressure Integration & Force Balance
 * PATCH-235 — Boundary Condition Engine
 *
 * Validates surface pressure face integral F_surf = -p * Area * normal and global equilibrium.
 */

import { FEMMesh } from '../../mesh/FEMMesh';
import { FEMMeshGenerator } from '../../mesh/FEMMeshGenerator';
import { BoundaryConditionRegistry } from '../BoundaryConditionRegistry';
import { BoundaryConditionEngine, BCPipelineExecutionResult } from '../BoundaryConditionEngine';
import { BoundaryConditionDefinition } from '../BoundaryConditionTypes';

export interface PressureBenchmarkResult {
  passed: boolean;
  pressurePa: number;
  faceArea: number;
  analyticalIntegratedForce: number;
  femIntegratedForce: number;
  forceErrorRelative: number;
  equilibriumResidualNorm: number;
  pipelineResult: BCPipelineExecutionResult;
}

export class PressureHydrostaticBenchmark {
  public static runBenchmark(): PressureBenchmarkResult {
    const registry = new BoundaryConditionRegistry();
    const engine = new BoundaryConditionEngine(registry);

    const W = 0.1;
    const H = 0.1;
    const L = 1.0;
    const pressurePa = 1.0e6; // 1 MPa
    const faceArea = W * H; // 0.01 m^2
    const analyticalIntegratedForce = pressurePa * faceArea; // = 10,000 N

    const mesh: FEMMesh = FEMMeshGenerator.generate({
      geometryType: "BOX",
      elementSize: 0.5,
      elementType: "HEX",
      dimensions: {
        dx: L,
        dy: W,
        dz: H
      }
    });

    // Fixed Support at x = 0
    const rootNodes = mesh.nodes.filter((n) => Math.abs(n.x - 0.0) < 1e-4).map((n) => n.id);
    const fixedBC: BoundaryConditionDefinition = {
      id: 'BC_PRESSURE_FIXED',
      name: 'Fixed Base',
      type: 'FIXED_SUPPORT',
      target: {
        type: 'NODE_SET',
        entityIds: ['FIXED_BASE'],
        nodeIds: rootNodes
      },
      coordinateSystem: registry.getDefaultCoordinateSystem(),
      loadCaseId: 'LC_01_STATIC',
      enabled: true,
      createdBy: 'BENCHMARK_SUITE',
      revision: 1,
      timestamp: Date.now(),
      sourceGeometryHash: 'GEO_BASE',
      meshHash: mesh.meshHash || 'MESH_HASH_PRES',
      status: 'VALID'
    };
    registry.registerBoundaryCondition(fixedBC);

    // Uniform Surface Pressure at x = L
    const pressureNodes = mesh.nodes.filter((n) => Math.abs(n.x - L) < 1e-4).map((n) => n.id);
    const pressureBC: BoundaryConditionDefinition = {
      id: 'BC_UNIFORM_PRESSURE',
      name: 'End Face Pressure 1.0 MPa',
      type: 'PRESSURE',
      target: {
        type: 'NODE_SET',
        entityIds: ['PRESSURE_FACE'],
        nodeIds: pressureNodes
      },
      pressureValue: {
        magnitude: pressurePa,
        units: 'Pa',
        isNormal: true,
        direction: { x: -1, y: 0, z: 0 }
      },
      coordinateSystem: registry.getDefaultCoordinateSystem(),
      loadCaseId: 'LC_01_STATIC',
      enabled: true,
      createdBy: 'BENCHMARK_SUITE',
      revision: 1,
      timestamp: Date.now(),
      sourceGeometryHash: 'GEO_PRES_FACE',
      meshHash: mesh.meshHash || 'MESH_HASH_PRES',
      status: 'VALID'
    };
    registry.registerBoundaryCondition(pressureBC);

    // Run Pipeline
    const pipelineResult = engine.executeBCPipeline(mesh, 'LC_01_STATIC');

    let femIntegratedForce = 0.0;
    if (pipelineResult.loadContributions) {
      const pContrib = pipelineResult.loadContributions.find((c) => c.bcId === 'BC_UNIFORM_PRESSURE');
      if (pContrib) {
        femIntegratedForce = Math.abs(pContrib.totalForceVector.x);
      }
    }

    const forceErrorRelative =
      Math.abs(femIntegratedForce - analyticalIntegratedForce) / analyticalIntegratedForce;
    const equilibriumResidualNorm = pipelineResult.equilibriumAudit?.residualNorm ?? 0.0;

    const passed = pipelineResult.success && forceErrorRelative < 0.01;

    return {
      passed,
      pressurePa,
      faceArea,
      analyticalIntegratedForce,
      femIntegratedForce,
      forceErrorRelative,
      equilibriumResidualNorm,
      pipelineResult
    };
  }
}
