/**
 * SECP Industrial OS v3 — PATCH-180: Assembly Dirty Tracker
 * Fine-grained dirty state tracking for sub-millisecond incremental updates.
 */

import { InstanceID, NodeID, DirtyFlags } from './MassiveAssemblyTypes';

export class AssemblyDirtyTracker {
  private instanceDirtyMap: Map<InstanceID, number> = new Map();
  private nodeDirtyMap: Map<NodeID, number> = new Map();

  public markInstanceDirty(instanceId: InstanceID, flag: DirtyFlags): void {
    const curr = this.instanceDirtyMap.get(instanceId) || DirtyFlags.CLEAN;
    this.instanceDirtyMap.set(instanceId, curr | flag);
  }

  public markNodeDirty(nodeId: NodeID, flag: DirtyFlags): void {
    const curr = this.nodeDirtyMap.get(nodeId) || DirtyFlags.CLEAN;
    this.nodeDirtyMap.set(nodeId, curr | flag);
  }

  public isInstanceDirty(instanceId: InstanceID, flag: DirtyFlags): boolean {
    const curr = this.instanceDirtyMap.get(instanceId) || DirtyFlags.CLEAN;
    return (curr & flag) !== 0;
  }

  public getDirtyInstances(): { instanceId: InstanceID; flags: number }[] {
    const list: { instanceId: InstanceID; flags: number }[] = [];
    for (const [id, flags] of this.instanceDirtyMap.entries()) {
      if (flags !== DirtyFlags.CLEAN) {
        list.push({ instanceId: id, flags });
      }
    }
    return list;
  }

  public clearAll(): void {
    this.instanceDirtyMap.clear();
    this.nodeDirtyMap.clear();
  }
}
