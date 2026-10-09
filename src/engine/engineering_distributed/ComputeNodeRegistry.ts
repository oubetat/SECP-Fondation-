/**
 * SECP Industrial OS - PATCH-303 Compute Node Registry
 * Manages Node Lifecycle, Identity, Heartbeats, Capability Discovery & Resource Accounting
 */

import {
  ComputeNode,
  NodeCapabilities,
  NodeId,
  NodeStatus,
  NodeType,
  ResourceAccounting,
  TaskId,
} from './DistributedComputeTypes303';

export class ComputeNodeRegistry {
  private nodes: Map<NodeId, ComputeNode> = new Map();
  private heartbeatTimeoutMs: number = 5000;

  constructor(heartbeatTimeoutMs: number = 5000) {
    this.heartbeatTimeoutMs = heartbeatTimeoutMs;
  }

  /**
   * Register a new compute node in the cluster
   */
  public registerNode(
    nodeId: NodeId,
    nodeType: NodeType,
    capabilities: NodeCapabilities,
    ipOrAddress: string,
    authTokenHash: string
  ): ComputeNode {
    const existing = this.nodes.get(nodeId);
    if (existing && existing.status !== 'OFFLINE' && existing.status !== 'FAILED') {
      // Re-joining or re-authenticating
      existing.status = 'AVAILABLE';
      existing.lastHeartbeat = Date.now();
      existing.ipOrAddress = ipOrAddress;
      existing.authTokenHash = authTokenHash;
      existing.capabilities = capabilities;
      return existing;
    }

    const node: ComputeNode = {
      nodeId,
      nodeType,
      capabilities,
      status: 'AVAILABLE',
      version: 'DISTRIBUTED_PROTOCOL_V1',
      ipOrAddress,
      authTokenHash,
      lastHeartbeat: Date.now(),
      accounting: {
        requestedCpuCores: 0,
        requestedMemoryBytes: 0,
        reservedCpuCores: 0,
        reservedMemoryBytes: 0,
        usedCpuCores: 0,
        usedMemoryBytes: 0,
        releasedCpuCores: 0,
        releasedMemoryBytes: 0,
        gpuReserved: false,
        wasmReserved: false,
      },
      activeTasks: [],
      totalCompletedTasks: 0,
      totalFailedTasks: 0,
    };

    this.nodes.set(nodeId, node);
    return node;
  }

  /**
   * Process incoming heartbeat from node
   */
  public recordHeartbeat(nodeId: NodeId): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    node.lastHeartbeat = Date.now();
    if (node.status === 'OFFLINE' || node.status === 'FAILED') {
      node.status = 'AVAILABLE';
    }
    return true;
  }

  /**
   * Check for unresponsive nodes exceeding heartbeat timeout
   */
  public sweepHeartbeats(): NodeId[] {
    const now = Date.now();
    const unresponsive: NodeId[] = [];

    for (const [id, node] of this.nodes.entries()) {
      if (node.status !== 'OFFLINE' && node.status !== 'FAILED') {
        if (now - node.lastHeartbeat > this.heartbeatTimeoutMs) {
          node.status = 'FAILED';
          unresponsive.push(id);
        }
      }
    }
    return unresponsive;
  }

  /**
   * Capability matching: Checks if node satisfies requirements
   */
  public matchesCapabilities(
    nodeId: NodeId,
    requiredCapabilities: string[],
    reqCpu: number = 1,
    reqMemBytes: number = 256 * 1024 * 1024,
    reqGpu: boolean = false,
    reqWasm: boolean = false
  ): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;
    if (node.status !== 'AVAILABLE' && node.status !== 'BUSY') return false;

    // CPU & Memory check
    const availCpu = node.capabilities.cpuCores - node.accounting.reservedCpuCores;
    const availMem = node.capabilities.memoryBytes - node.accounting.reservedMemoryBytes;

    if (availCpu < reqCpu) return false;
    if (availMem < reqMemBytes) return false;

    if (reqGpu && !node.capabilities.hasWebGpu) return false;
    if (reqWasm && !node.capabilities.hasWasm) return false;

    // Required kernel names check
    for (const kernel of requiredCapabilities) {
      if (!node.capabilities.supportedKernels.includes(kernel)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Reserve resources for a task
   */
  public reserveResources(
    nodeId: NodeId,
    taskId: TaskId,
    reqCpu: number,
    reqMemBytes: number,
    reqGpu: boolean = false,
    reqWasm: boolean = false
  ): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    node.accounting.requestedCpuCores += reqCpu;
    node.accounting.requestedMemoryBytes += reqMemBytes;

    node.accounting.reservedCpuCores += reqCpu;
    node.accounting.reservedMemoryBytes += reqMemBytes;
    node.accounting.usedCpuCores += reqCpu;
    node.accounting.usedMemoryBytes += reqMemBytes;

    if (reqGpu) node.accounting.gpuReserved = true;
    if (reqWasm) node.accounting.wasmReserved = true;

    if (!node.activeTasks.includes(taskId)) {
      node.activeTasks.push(taskId);
    }

    if (node.activeTasks.length >= node.capabilities.workerCount) {
      node.status = 'BUSY';
    }

    return true;
  }

  /**
   * Release resources after task completion or failure
   */
  public releaseResources(
    nodeId: NodeId,
    taskId: TaskId,
    reqCpu: number,
    reqMemBytes: number,
    isSuccess: boolean = true
  ): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    node.accounting.reservedCpuCores = Math.max(
      0,
      node.accounting.reservedCpuCores - reqCpu
    );
    node.accounting.reservedMemoryBytes = Math.max(
      0,
      node.accounting.reservedMemoryBytes - reqMemBytes
    );

    node.accounting.releasedCpuCores += reqCpu;
    node.accounting.releasedMemoryBytes += reqMemBytes;

    node.activeTasks = node.activeTasks.filter((id) => id !== taskId);

    if (isSuccess) {
      node.totalCompletedTasks++;
    } else {
      node.totalFailedTasks++;
    }

    if (node.status === 'BUSY' && node.activeTasks.length < node.capabilities.workerCount) {
      node.status = 'AVAILABLE';
    }

    if (node.status === 'DRAINING' && node.activeTasks.length === 0) {
      node.status = 'OFFLINE';
    }
  }

  /**
   * Drain node for maintenance/removal
   */
  public drainNode(nodeId: NodeId): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    if (node.activeTasks.length === 0) {
      node.status = 'OFFLINE';
    } else {
      node.status = 'DRAINING';
    }
    return true;
  }

  public getNode(nodeId: NodeId): ComputeNode | undefined {
    return this.nodes.get(nodeId);
  }

  public getAllNodes(): ComputeNode[] {
    return Array.from(this.nodes.values());
  }

  public getAvailableNodes(): ComputeNode[] {
    return Array.from(this.nodes.values()).filter(
      (n) => n.status === 'AVAILABLE' || n.status === 'BUSY'
    );
  }

  public clear(): void {
    this.nodes.clear();
  }
}
