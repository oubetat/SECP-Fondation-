import { ManufacturingJob, ResourceAvailability, RoutingOperation } from './ManufacturingJobTypes';

export interface ScheduleTask {
  taskId: string;
  jobId: string;
  operationId: string;
  sequenceNumber: number;
  startTime: string;
  endTime: string;
}

export interface ScheduleConflict {
  conflictType: 'MACHINE_OVERLAP' | 'RESOURCE_SHORTAGE' | 'CAPABILITY_MISMATCH';
  description: string;
  jobIds: string[];
}

export interface ProductionSchedule {
  tasks: ScheduleTask[];
  conflicts: ScheduleConflict[];
}

export class ProductionScheduler {
  public static planSchedule(
    jobs: ManufacturingJob[],
    inventory: ResourceAvailability[]
  ): ProductionSchedule {
    const tasks: ScheduleTask[] = [];
    const conflicts: ScheduleConflict[] = [];

    // Let's generate chronological tasks for the jobs
    let currentBaseTime = new Date('2026-08-30T09:00:00.000Z');

    jobs.forEach(job => {
      let jobTime = new Date(currentBaseTime.getTime());
      
      job.routing.forEach(op => {
        const durationMs = (op.estimatedSetupTimeMin + op.estimatedRunTimePerUnitMin * job.quantityOrdered) * 60 * 1000;
        const startTime = jobTime.toISOString();
        const endTime = new Date(jobTime.getTime() + durationMs).toISOString();

        tasks.push({
          taskId: `task-${job.jobId}-${op.operationId}`,
          jobId: job.jobId,
          operationId: op.operationId,
          sequenceNumber: op.sequenceNumber,
          startTime,
          endTime
        });

        // Advance job time chronologically for dependencies
        jobTime = new Date(jobTime.getTime() + durationMs + 5000); // 5 seconds buffer
      });
    });

    // Overlap conflict detection if multiple jobs use the same machine at the same time
    if (jobs.length > 1) {
      // Check for overlap of machine HAAS / rough mill
      const machineUsage: Record<string, { startTime: string; endTime: string; jobId: string }[]> = {};
      
      tasks.forEach(t => {
        const op = jobs.find(j => j.jobId === t.jobId)?.routing.find(o => o.operationId === t.operationId);
        const machineId = op?.resources.machineId;
        if (machineId) {
          if (!machineUsage[machineId]) {
            machineUsage[machineId] = [];
          }
          machineUsage[machineId].push({
            startTime: t.startTime,
            endTime: t.endTime,
            jobId: t.jobId
          });
        }
      });

      Object.entries(machineUsage).forEach(([machineId, usages]) => {
        if (usages.length > 1) {
          conflicts.push({
            conflictType: 'MACHINE_OVERLAP',
            description: `Multiple jobs scheduled on machine ${machineId} simultaneously`,
            jobIds: usages.map(u => u.jobId)
          });
        }
      });
    }

    return {
      tasks,
      conflicts
    };
  }

  public static computeScheduleHash(tasks: ScheduleTask[]): string {
    const payload = tasks.map(t => `${t.taskId}:${t.startTime}->${t.endTime}`).join('|');
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      hash = (hash << 5) - hash + payload.charCodeAt(i);
      hash |= 0;
    }
    return `SECP-059-SCHED-HASH-${Math.abs(hash).toString(16).toUpperCase()}`;
  }
}
