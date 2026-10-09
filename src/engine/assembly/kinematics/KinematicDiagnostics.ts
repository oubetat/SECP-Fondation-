import { KinematicBody } from './KinematicBody';
import { KinematicJoint, IDEALIZED_JOINT_DOF } from './KinematicJointModel';

export interface KinematicGraphAnalysis {
  valid: boolean;
  groundBodyId?: string;
  hasCycles: boolean;
  cycleNodes: string[][];
  disconnectedBodyIds: string[];
  reachableBodyIds: string[];
  adjacency: Record<string, string[]>;
  spanningTreeEdges: Array<{ jointId: string; parentId: string; childId: string }>;
  loopClosingJoints: Array<{ joint: KinematicJoint; loopPath: string[] }>;
  reason?: string;
}

export interface SystemDOFAnalysis {
  totalInitialDOF: number;
  totalConstrainedDOF: number;
  totalSystemMotionDOF: number;
  perBodyDOF: Record<string, { initialDOF: number; remainingDOF: number }>;
  perJointDOF: Record<string, { jointType: string; allowedDOF: number; constrainedDOF: number }>;
}

export class KinematicDiagnostics {
  /**
   * Builds kinematic graph and analyzes connectivity, cycles, and ground reference
   */
  public static analyzeKinematicGraph(
    bodies: KinematicBody[],
    joints: KinematicJoint[]
  ): KinematicGraphAnalysis {
    const groundedBodies = bodies.filter(b => b.grounded);
    const groundBodyId = groundedBodies.length > 0 ? groundedBodies[0].bodyId : undefined;

    const adjacency: Record<string, string[]> = {};
    const bodyMap = new Map<string, KinematicBody>();
    for (const b of bodies) {
      adjacency[b.bodyId] = [];
      bodyMap.set(b.bodyId, b);
    }

    const enabledJoints = joints.filter(j => j.enabled && !j.suppressed);

    for (const j of enabledJoints) {
      if (!adjacency[j.parentBodyId] || !adjacency[j.childBodyId]) {
        return {
          valid: false,
          groundBodyId,
          hasCycles: false,
          cycleNodes: [],
          disconnectedBodyIds: bodies.map(b => b.bodyId),
          reachableBodyIds: [],
          adjacency,
          spanningTreeEdges: [],
          loopClosingJoints: [],
          reason: `Joint ${j.jointId} references non-existent body ID (${j.parentBodyId} or ${j.childBodyId})`,
        };
      }
      adjacency[j.parentBodyId].push(j.childBodyId);
      adjacency[j.childBodyId].push(j.parentBodyId);
    }

    if (groundedBodies.length > 1) {
      return {
        valid: false,
        groundBodyId,
        hasCycles: false,
        cycleNodes: [],
        disconnectedBodyIds: [],
        reachableBodyIds: [],
        adjacency,
        spanningTreeEdges: [],
        loopClosingJoints: [],
        reason: `Contradictory grounding: found ${groundedBodies.length} grounded bodies (${groundedBodies.map(b => b.bodyId).join(', ')})`,
      };
    }

    if (!groundBodyId && bodies.length > 0) {
      return {
        valid: false,
        groundBodyId: undefined,
        hasCycles: false,
        cycleNodes: [],
        disconnectedBodyIds: bodies.map(b => b.bodyId),
        reachableBodyIds: [],
        adjacency,
        spanningTreeEdges: [],
        loopClosingJoints: [],
        reason: 'No grounded reference body defined in assembly',
      };
    }

    // BFS / DFS from ground body to find reachable tree and detect cycles
    const visited = new Set<string>();
    const parentInTree = new Map<string, string>();
    const treeJoints: Array<{ jointId: string; parentId: string; childId: string }> = [];
    const loopClosingJoints: Array<{ joint: KinematicJoint; loopPath: string[] }> = [];
    const cycleNodes: string[][] = [];

    if (groundBodyId) {
      const queue: string[] = [groundBodyId];
      visited.add(groundBodyId);

      // Track edge used to reach node
      const edgeToNode = new Map<string, string>();

      while (queue.length > 0) {
        const u = queue.shift()!;

        // Find outgoing joints connecting u to neighbors
        const connectingJoints = enabledJoints.filter(
          j => j.parentBodyId === u || j.childBodyId === u
        );

        for (const j of connectingJoints) {
          const v = j.parentBodyId === u ? j.childBodyId : j.parentBodyId;
          const parentId = u;
          const childId = v;

          if (!visited.has(v)) {
            visited.add(v);
            parentInTree.set(v, u);
            edgeToNode.set(v, j.jointId);
            treeJoints.push({ jointId: j.jointId, parentId: j.parentBodyId, childId: j.childBodyId });
            queue.push(v);
          } else if (parentInTree.get(u) !== v && edgeToNode.get(u) !== j.jointId) {
            // Found a back-edge / cycle
            const cyclePath = [u, v];
            cycleNodes.push(cyclePath);
            loopClosingJoints.push({ joint: j, loopPath: cyclePath });
          }
        }
      }
    }

    const reachableBodyIds = Array.from(visited);
    const disconnectedBodyIds = bodies
      .map(b => b.bodyId)
      .filter(id => !visited.has(id));

    const hasCycles = cycleNodes.length > 0;

    return {
      valid: disconnectedBodyIds.length === 0 && !hasCycles,
      groundBodyId,
      hasCycles,
      cycleNodes,
      disconnectedBodyIds,
      reachableBodyIds,
      adjacency,
      spanningTreeEdges: treeJoints,
      loopClosingJoints,
      reason: disconnectedBodyIds.length > 0
        ? `Disconnected bodies found: ${disconnectedBodyIds.join(', ')}`
        : hasCycles
        ? `Closed kinematic loop detected with ${cycleNodes.length} cycle(s)`
        : undefined,
    };
  }

  /**
   * Computes idealized and actual system degrees of freedom
   */
  public static analyzeDegreesOfFreedom(
    bodies: KinematicBody[],
    joints: KinematicJoint[]
  ): SystemDOFAnalysis {
    let totalInitialDOF = 0;
    const perBodyDOF: Record<string, { initialDOF: number; remainingDOF: number }> = {};

    for (const b of bodies) {
      const init = b.grounded ? 0 : 6;
      totalInitialDOF += init;
      perBodyDOF[b.bodyId] = { initialDOF: init, remainingDOF: init };
    }

    let totalConstrainedDOF = 0;
    let totalSystemMotionDOF = 0;
    const perJointDOF: Record<string, { jointType: string; allowedDOF: number; constrainedDOF: number }> = {};

    const enabledJoints = joints.filter(j => j.enabled && !j.suppressed);

    for (const j of enabledJoints) {
      const allowed = IDEALIZED_JOINT_DOF[j.jointType] ?? 0;
      const constrained = 6 - allowed;
      totalConstrainedDOF += constrained;
      totalSystemMotionDOF += allowed;

      perJointDOF[j.jointId] = {
        jointType: j.jointType,
        allowedDOF: allowed,
        constrainedDOF: constrained,
      };

      if (perBodyDOF[j.childBodyId]) {
        perBodyDOF[j.childBodyId].remainingDOF = Math.max(
          0,
          perBodyDOF[j.childBodyId].remainingDOF - constrained
        );
      }
    }

    return {
      totalInitialDOF,
      totalConstrainedDOF,
      totalSystemMotionDOF,
      perBodyDOF,
      perJointDOF,
    };
  }
}
