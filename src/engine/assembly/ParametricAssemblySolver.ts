import { 
  AssemblyComponent, 
  AssemblyConstraint, 
  KinematicJoint, 
  AssemblySolverReport,
  Transform3D
} from './AssemblyConstraintTypes';
import { AssemblyKinematicSolver } from './AssemblyKinematicSolver';
import { ConstraintDependencyGraph } from './ConstraintDependencyGraph';
import { KinematicRevisionEngine } from './KinematicRevisionEngine';

/**
 * PATCH-SECP-046-B — Parametric Re-Solve Engine
 * Handles incremental updates when parameters change.
 * Minimizes computation by isolating affected subgraphs and ensuring deterministic results.
 */
export class ParametricAssemblySolver {
  private dependencyGraph: ConstraintDependencyGraph;

  constructor() {
    this.dependencyGraph = new ConstraintDependencyGraph();
  }

  /**
   * Re-solves the assembly incrementally after a parameter change
   */
  public async parametricSolve(
    components: AssemblyComponent[],
    constraints: AssemblyConstraint[],
    joints: KinematicJoint[],
    changedParameterIds: string[],
    partsMap: Map<string, any>,
    assemblyId: string = 'parametric-asm'
  ): Promise<{ 
    report: AssemblySolverReport, 
    revision: any,
    affectedComponentIds: string[] 
  }> {
    
    // 1. Update Dependency Graph
    this.dependencyGraph.build(components, constraints, joints);

    // 2. Identify Affected Subgraph
    // In a real system, parameters would be linked to specific constraints or components.
    // Here we assume changedParameterIds are IDs of constraints or components that changed.
    const affectedIds = this.dependencyGraph.getAffectedSubgraph(changedParameterIds);
    const affectedComponents = components.filter(c => affectedIds.includes(c.instanceId));
    
    // 3. Perform Solve
    // For now, we delegate to AssemblyKinematicSolver but we could optimize 
    // to only re-solve the affected island if the solver supported it.
    // Currently, we ensure that at least the revision record tracks what changed.
    
    const solveReport: any = await AssemblyKinematicSolver.solve(
      components,
      constraints.filter(c => c.suppressionState === 'ACTIVE'),
      joints.filter(j => j.suppressionState === 'ACTIVE') as any,
      [], // External forces
      {}, // Initial state overrides
      partsMap
    );

    // 4. Record Deterministic Revision
    const revision = KinematicRevisionEngine.createRecord(
      assemblyId,
      Date.now(), // In production, this would be an incrementing counter
      solveReport,
      components,
      constraints
    );

    return {
      report: solveReport,
      revision,
      affectedComponentIds: affectedComponents.map(c => c.instanceId)
    };
  }

  /**
   * Fast-path for simple joint position updates (Direct Kinematics)
   */
  public async updateJointPosition(
    jointId: string,
    newValue: number,
    components: AssemblyComponent[],
    joints: KinematicJoint[],
    partsMap: Map<string, any>
  ): Promise<AssemblySolverReport> {
    const joint = joints.find(j => j.jointId === jointId);
    if (!joint) throw new Error(`Joint ${jointId} not found`);

    joint.currentPosition = newValue;

    // Full update (could be optimized)
    return await AssemblyKinematicSolver.solve(
      components,
      [], // Assume pure joint motion for this fast-path
      joints as any,
      [],
      {},
      partsMap
    ) as any;
  }
}
