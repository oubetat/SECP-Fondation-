/**
 * SECP Industrial OS — Engineering Truth Platform
 * PATCH-240 — FEM Verification Gate
 */

import { FemVerificationPipeline, PipelineExecutionReport } from './FemVerificationPipeline';
import { BRepSolid, BRepShell, BRepFace } from '../../cad-kernel/topology/BRepTopology';
import { Orientation } from '../../cad-kernel/topology/TopologyContracts';
import { MeshVerificationEngine } from './MeshVerificationEngine';
import { FEMMesh } from '../mesh/FEMMesh';
import { BoundaryConditionEngine } from '../bc/BoundaryConditionEngine';

export interface GateTestResult {
  modelName: string;
  verdict: 'PASS' | 'FAIL';
  pipelineReport: PipelineExecutionReport;
  convergence?: any;
}

export interface GateReport {
  overallVerdict: 'PASS' | 'FAIL';
  totalModelsSolved: number;
  totalVerificationsPassed: number;
  testResults: GateTestResult[];
  gateEvidence: string;
  timestamp: string;
}

/**
 * HardAcceptanceGate240: Final authority for FEM verification.
 */
export class HardAcceptanceGate240 {
  public static runVerificationSuite(): GateReport {
    const testResults: GateTestResult[] = [];

    // Model A: Plate with Hole
    const plate = this.createModel('PLATE_01', 6, 1);
    const reportA = FemVerificationPipeline.execute(plate, 0.1, { youngModulus: 2.1e11, poissonRatio: 0.3, yieldStrength: 250e6 }, 
      (mesh, engine) => this.setupTensileLoad(mesh, engine, 10000));
    testResults.push({ modelName: 'Plate with Hole', verdict: reportA.success ? 'PASS' : 'FAIL', pipelineReport: reportA });

    // Model B: Generic Bracket
    const bracket = this.createModel('BRACKET_01', 6, 0);
    const reportB = FemVerificationPipeline.execute(bracket, 0.15, { youngModulus: 70e9, poissonRatio: 0.33, yieldStrength: 150e6 }, 
      (mesh, engine) => this.setupCantileverLoad(mesh, engine, 5000));
    testResults.push({ modelName: 'Generic Bracket', verdict: reportB.success ? 'PASS' : 'FAIL', pipelineReport: reportB });

    const totalPassed = testResults.filter(r => r.verdict === 'PASS').length;
    return {
      overallVerdict: totalPassed === testResults.length ? 'PASS' : 'FAIL',
      totalModelsSolved: testResults.length,
      totalVerificationsPassed: totalPassed,
      testResults,
      gateEvidence: `GATE_240_${Date.now()}`,
      timestamp: new Date().toISOString()
    };
  }

  private static setupTensileLoad(mesh: FEMMesh, engine: BoundaryConditionEngine, load: number) {
    const leftNodes = mesh.nodes.filter(n => n.x === 0).map(n => n.id);
    const rightNodes = mesh.nodes.filter(n => n.x > 0.9).map(n => n.id);
    engine.getRegistry().registerBoundaryCondition({ id: 'BC_F', name: 'Fixed', type: 'FIXED_SUPPORT', target: { type: 'NODE_SET', nodeIds: leftNodes }, dofValues: [{ dof: 'UX', isPrescribed: true, value: 0 }, { dof: 'UY', isPrescribed: true, value: 0 }, { dof: 'UZ', isPrescribed: true, value: 0 }], loadCaseId: 'LC_01_STATIC' } as any);
    engine.getRegistry().registerBoundaryCondition({ id: 'BC_L', name: 'Load', type: 'NODAL_FORCE', target: { type: 'NODE_SET', nodeIds: rightNodes }, forceValue: { fx: load, fy: 0, fz: 0 }, loadCaseId: 'LC_01_STATIC' } as any);
  }

  private static setupCantileverLoad(mesh: FEMMesh, engine: BoundaryConditionEngine, load: number) {
    const bottomNodes = mesh.nodes.filter(n => n.z === 0).map(n => n.id);
    const topNodes = mesh.nodes.filter(n => n.z > 0.9).map(n => n.id);
    engine.getRegistry().registerBoundaryCondition({ id: 'BC_S', name: 'Support', type: 'FIXED_SUPPORT', target: { type: 'NODE_SET', nodeIds: bottomNodes }, dofValues: [{ dof: 'UX', isPrescribed: true, value: 0 }, { dof: 'UY', isPrescribed: true, value: 0 }, { dof: 'UZ', isPrescribed: true, value: 0 }], loadCaseId: 'LC_01_STATIC' } as any);
    engine.getRegistry().registerBoundaryCondition({ id: 'BC_P', name: 'Pressure', type: 'NODAL_FORCE', target: { type: 'NODE_SET', nodeIds: topNodes }, forceValue: { fx: 0, fy: 0, fz: -load }, loadCaseId: 'LC_01_STATIC' } as any);
  }

  private static createModel(id: string, f: number, s: number): BRepSolid {
    const shell = new BRepShell(`${id}_S`, []);
    for (let i = 0; i < f; i++) shell.orientedFaces.push({ face: new BRepFace(`${id}_F${i}`, { type: 'PLANAR' } as any, null as any), orientation: Orientation.FORWARD });
    const inners = [];
    for (let i = 0; i < s; i++) inners.push(new BRepShell(`${id}_I${i}`, []));
    return new BRepSolid(id, shell, inners);
  }
}
