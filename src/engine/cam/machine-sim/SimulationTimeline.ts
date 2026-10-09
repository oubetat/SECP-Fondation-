/**
 * SECP Industrial OS - PATCH-264: Machine Simulation Engine
 * Simulation Timeline & Recorder: Complete Machine State History & Playback Controls
 */

import {
  MachineStateSnapshot,
  CollisionRecord,
  MachineLimitViolation,
  KinematicAnomalyRecord,
} from './MachineSimulationTypes';

export class SimulationRecorder {
  private snapshots: MachineStateSnapshot[] = [];
  private collisions: CollisionRecord[] = [];
  private violations: MachineLimitViolation[] = [];
  private anomalies: KinematicAnomalyRecord[] = [];

  public reset(): void {
    this.snapshots = [];
    this.collisions = [];
    this.violations = [];
    this.anomalies = [];
  }

  public recordSnapshot(snapshot: MachineStateSnapshot): void {
    this.snapshots.push(snapshot);
  }

  public recordCollision(collision: CollisionRecord): void {
    this.collisions.push(collision);
  }

  public recordViolation(violation: MachineLimitViolation): void {
    this.violations.push(violation);
  }

  public recordAnomaly(anomaly: KinematicAnomalyRecord): void {
    this.anomalies.push(anomaly);
  }

  public getSnapshots(): MachineStateSnapshot[] {
    return this.snapshots;
  }

  public getCollisions(): CollisionRecord[] {
    return this.collisions;
  }

  public getViolations(): MachineLimitViolation[] {
    return this.violations;
  }

  public getAnomalies(): KinematicAnomalyRecord[] {
    return this.anomalies;
  }

  public getSnapshotAtStep(stepIndex: number): MachineStateSnapshot | undefined {
    return this.snapshots[stepIndex];
  }

  public getSnapshotAtBlock(blockIndex: number): MachineStateSnapshot | undefined {
    return this.snapshots.find(s => s.blockIndex === blockIndex);
  }

  public getFirstCollisionSnapshot(): MachineStateSnapshot | undefined {
    const firstColl = this.collisions[0];
    if (!firstColl) return undefined;
    return this.snapshots.find(s => s.blockIndex === firstColl.blockIndex);
  }
}
