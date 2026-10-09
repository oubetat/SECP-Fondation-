/**
 * PATCH-SECP-229 — Kinematic Motion Dependency Graph Engine
 * 
 * Builds DAG of motion dependencies:
 *  Driver -> Joint -> Body -> Motion Link -> Dependent Joint -> Dependent Body
 * 
 * Performs topological sorting, detects cyclic dependencies, conflicting drivers,
 * over-constrained chains, and unresolved kinematic dependencies.
 */

import {
  RigidBodyKinematicState,
  JointKinematicConstraint,
  MotionLinkKinematicConstraint,
  KinematicMotionDriver
} from './KinematicModelTypes';

export interface GraphNode {
  id: string;
  type: 'DRIVER' | 'JOINT' | 'BODY' | 'MOTION_LINK';
  name: string;
  inDegree: number;
  outDegree: number;
}

export interface GraphEdge {
  fromId: string;
  toId: string;
  label: string;
}

export interface DependencyGraphAnalysis {
  nodes: GraphNode[];
  edges: GraphEdge[];
  topologicalOrder: string[];
  hasCycle: boolean;
  cycleNodes?: string[];
  conflictingDriverJointIds: string[];
  unresolvedJointIds: string[];
  overConstrainedNodes: string[];
}

export class KinematicDependencyGraph {

  /**
   * Analyzes kinematic dependencies and builds DAG
   */
  public static analyzeDependencies(
    bodies: Map<string, RigidBodyKinematicState>,
    joints: JointKinematicConstraint[],
    motionLinks: MotionLinkKinematicConstraint[],
    drivers: KinematicMotionDriver[]
  ): DependencyGraphAnalysis {
    const nodesMap = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const adjList = new Map<string, string[]>();
    const inDegreeMap = new Map<string, number>();

    // Register Body Nodes
    bodies.forEach((b, id) => {
      nodesMap.set(id, { id, type: 'BODY', name: b.name, inDegree: 0, outDegree: 0 });
      adjList.set(id, []);
      inDegreeMap.set(id, 0);
    });

    // Register Joint Nodes
    joints.forEach(j => {
      nodesMap.set(j.id, { id: j.id, type: 'JOINT', name: j.name, inDegree: 0, outDegree: 0 });
      adjList.set(j.id, []);
      inDegreeMap.set(j.id, 0);

      // Edge: Joint -> BodyB (Child)
      edges.push({ fromId: j.id, toId: j.bodyBId, label: 'Drives Body' });
    });

    // Register Driver Nodes
    const driverTargetCountMap = new Map<string, number>();
    drivers.filter(d => d.enabled).forEach(d => {
      nodesMap.set(d.id, { id: d.id, type: 'DRIVER', name: d.name, inDegree: 0, outDegree: 0 });
      adjList.set(d.id, []);
      inDegreeMap.set(d.id, 0);

      // Edge: Driver -> Joint
      edges.push({ fromId: d.id, toId: d.targetJointId, label: 'Actuates' });

      driverTargetCountMap.set(
        d.targetJointId,
        (driverTargetCountMap.get(d.targetJointId) ?? 0) + 1
      );
    });

    // Register Motion Link Nodes
    motionLinks.forEach(m => {
      nodesMap.set(m.id, { id: m.id, type: 'MOTION_LINK', name: m.name, inDegree: 0, outDegree: 0 });
      adjList.set(m.id, []);
      inDegreeMap.set(m.id, 0);

      // Edges: DriverJoint -> MotionLink -> FollowerJoint
      edges.push({ fromId: m.driverJointId, toId: m.id, label: 'Couples' });
      edges.push({ fromId: m.id, toId: m.followerJointId, label: 'Transfers Motion' });
    });

    // Build Adjacency Matrix & In-Degrees
    edges.forEach(e => {
      if (!adjList.has(e.fromId)) adjList.set(e.fromId, []);
      adjList.get(e.fromId)!.push(e.toId);

      inDegreeMap.set(e.toId, (inDegreeMap.get(e.toId) ?? 0) + 1);

      const fromNode = nodesMap.get(e.fromId);
      const toNode = nodesMap.get(e.toId);
      if (fromNode) fromNode.outDegree++;
      if (toNode) toNode.inDegree++;
    });

    // Topological Sort (Kahn's Algorithm)
    const queue: string[] = [];
    inDegreeMap.forEach((deg, nodeId) => {
      if (deg === 0) queue.push(nodeId);
    });

    const topologicalOrder: string[] = [];
    const tempInDegrees = new Map(inDegreeMap);

    while (queue.length > 0) {
      const u = queue.shift()!;
      topologicalOrder.push(u);

      const neighbors = adjList.get(u) ?? [];
      neighbors.forEach(v => {
        const currDeg = (tempInDegrees.get(v) ?? 1) - 1;
        tempInDegrees.set(v, currDeg);
        if (currDeg === 0) queue.push(v);
      });
    }

    const hasCycle = topologicalOrder.length < nodesMap.size;
    const cycleNodes = hasCycle
      ? Array.from(nodesMap.keys()).filter(id => !topologicalOrder.includes(id))
      : undefined;

    // Detect conflicting drivers (multiple drivers targeting same joint)
    const conflictingDriverJointIds: string[] = [];
    driverTargetCountMap.forEach((count, jointId) => {
      if (count > 1) conflictingDriverJointIds.push(jointId);
    });

    // Detect unresolved joints (joints on movable bodies without driver or motion link connection)
    const unresolvedJointIds: string[] = [];
    joints.forEach(j => {
      const bodyB = bodies.get(j.bodyBId);
      if (bodyB && !bodyB.isGroundGround && !bodyB.isFixedGround) {
        const hasDriver = drivers.some(d => d.enabled && d.targetJointId === j.id);
        const hasLink = motionLinks.some(l => l.followerJointId === j.id || l.driverJointId === j.id);
        if (!hasDriver && !hasLink && j.type !== 'FIXED') {
          unresolvedJointIds.push(j.id);
        }
      }
    });

    // Detect over-constrained nodes
    const overConstrainedNodes: string[] = [];
    nodesMap.forEach((node, id) => {
      if (node.type === 'JOINT' && node.inDegree > 2) {
        overConstrainedNodes.push(id);
      }
    });

    return {
      nodes: Array.from(nodesMap.values()),
      edges,
      topologicalOrder,
      hasCycle,
      cycleNodes,
      conflictingDriverJointIds,
      unresolvedJointIds,
      overConstrainedNodes
    };
  }
}
