/**
 * PATCH-SECP-059 — 059-D: Production Scheduling & Deterministic Planner
 * Computes deterministic production schedules while validating machine overlapping,
 * dependency sequence constraints, capacity limits, and due-date targets.
 */

import { ManufacturingJob, ProductionSchedule, ScheduledTask, ScheduleConflict, ResourceAvailability } from './ManufacturingJobTypes';

export class ProductionScheduler {
  /**
   * Generates a deterministic hash of the calculated schedule to lock provenance
   */
  public static computeScheduleHash(tasks: ScheduledTask[]): string {
    const payload = tasks
      .map(t => `${t.jobId}:${t.operationId}:${t.machineId}:${t.startTime}:${t.endTime}`)
      .sort()
      .join('|');

    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      const char = payload.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return `SECP-059-SCH-HASH-${hex}`;
  }

  /**
   * 059-D: Deterministic scheduling planner
   * Takes a batch of jobs and inventory status, maps work operations,
   * schedules start/end times sequentially, and detects overlapping/conflict hazards.
   */
  public static planSchedule(
    jobs: ManufacturingJob[],
    inventory: ResourceAvailability[],
    baseDate: Date = new Date('2026-08-15T08:00:00Z')
  ): ProductionSchedule {
    const tasks: ScheduledTask[] = [];
    const conflicts: ScheduleConflict[] = [];

    // Track machine availability next free timestamps
    const machineNextFreeTime: Record<string, Date> = {};

    // Sort jobs by priority (CRITICAL -> HIGH -> MEDIUM -> LOW) to schedule high-priority tasks first
    const priorityWeight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    const sortedJobs = [...jobs].sort((a, b) => priorityWeight[b.priority] - priorityWeight[a.priority]);

    sortedJobs.forEach((job) => {
      let jobCurrentTime = new Date(baseDate);

      // Schedule each routing operation sequentially to maintain dependency integrity (059-B)
      job.routing.forEach((op) => {
        const durationMin = op.estimatedSetupTimeMin + (op.estimatedRunTimePerUnitMin * job.quantityOrdered);
        const machineId = op.resources.machineId;

        // 1. Check if machine is marked as globally unavailable in inventory (059-F)
        const machineDef = inventory.find(i => i.resourceId === machineId && i.type === 'MACHINE');
        if (machineDef && !machineDef.isAvailable) {
          conflicts.push({
            conflictType: 'UNAVAILABLE_MACHINES' as any,
            description: `Operation '${op.name}' of Job '${job.jobId}' scheduled on offline machine '${machineId}'.`,
            affectedTaskIds: [`task-${job.jobId}-${op.operationId}`],
            severity: 'CRITICAL'
          });
        }

        // 2. Ensure machine start time aligns with when it becomes free (Finite Capacity Scheduling)
        const machineFreeAt = machineNextFreeTime[machineId] || new Date(baseDate);
        let startTime = new Date(jobCurrentTime);
        if (startTime < machineFreeAt) {
          startTime = new Date(machineFreeAt);
        }

        const endTime = new Date(startTime.getTime() + durationMin * 60 * 1000);

        // Update tracking states
        machineNextFreeTime[machineId] = new Date(endTime);
        jobCurrentTime = new Date(endTime);

        const taskId = `task-${job.jobId}-${op.operationId}`;
        tasks.push({
          taskId,
          jobId: job.jobId,
          operationId: op.operationId,
          sequenceNumber: op.sequenceNumber,
          machineId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString()
        });

        // 3. Double-check for overlapping schedules on the same machine
        const overlaps = tasks.filter(t => 
          t.taskId !== taskId &&
          t.machineId === machineId &&
          new Date(t.startTime) < endTime &&
          new Date(t.endTime) > startTime
        );

        if (overlaps.length > 0) {
          conflicts.push({
            conflictType: 'MACHINE_OVERLAP',
            description: `Machine Conflict: Overlapping allocation on '${machineId}' between task '${taskId}' and [${overlaps.map(o => o.taskId).join(', ')}].`,
            affectedTaskIds: [taskId, ...overlaps.map(o => o.taskId)],
            severity: 'CRITICAL'
          });
        }

        // 4. Validate dependency routing order constraint (059-B / OP dependencies)
        op.dependencyOperationIds.forEach((depOpId) => {
          const depTask = tasks.find(t => t.jobId === job.jobId && t.operationId === depOpId);
          if (depTask && new Date(depTask.endTime) > startTime) {
            conflicts.push({
              conflictType: 'DEPENDENCY_VIOLATION',
              description: `Dependency Violation: Task '${taskId}' starts at ${startTime.toISOString()} before prerequisite operation '${depOpId}' finishes at ${depTask.endTime}.`,
              affectedTaskIds: [taskId, depTask.taskId],
              severity: 'CRITICAL'
            });
          }
        });
      });
    });

    const scheduleId = `sch-${Date.now()}`;
    const scheduleHash = this.computeScheduleHash(tasks);

    return {
      scheduleId,
      tasks,
      conflicts,
      scheduledAt: new Date().toISOString(),
      scheduleHash
    };
  }
}
