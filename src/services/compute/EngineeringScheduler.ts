import {
  EngineeringTask,
  ComputeResource,
  ExecutionState,
  ExecutionEvidence
} from '../../engine/engineering_compute/types';
import { ExecutionGraph } from './ExecutionGraph';
import { EngineeringWorker } from './EngineeringWorker';

export interface ComputeJob {
  jobId: string;
  tasks: EngineeringTask[];
  resources: ComputeResource[];
  state: ExecutionState;
  evidenceList: ExecutionEvidence[];
  createdAt: string;
  tenantId?: string;
}

export class EngineeringScheduler {
  private static jobs = new Map<string, ComputeJob>();

  public static createJob(jobId: string, tasks: EngineeringTask[], resources: ComputeResource[]): ComputeJob {
    const dagCheck = ExecutionGraph.validateDAG(tasks);
    if (!dagCheck.valid) {
      throw new Error(`Invalid DAG: ${dagCheck.error}`);
    }

    const job: ComputeJob = {
      jobId,
      tasks,
      resources,
      state: 'QUEUED',
      evidenceList: [],
      createdAt: new Date().toISOString()
    };

    this.jobs.set(jobId, job);
    return job;
  }

  public static getJob(jobId: string): ComputeJob | undefined {
    return this.jobs.get(jobId);
  }

  public static async executeJob(jobId: string): Promise<ComputeJob> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    job.state = 'RUNNING';

    for (const task of job.tasks) {
      task.state = 'RUNNING';

      // Pick available resource
      const availableResource = job.resources.find(r => r.availability) || job.resources[0];
      const worker = new EngineeringWorker(`W-${availableResource.resourceId}`, availableResource);

      const res = await worker.executeTask(task);
      if (res.success && res.outputs) {
        task.state = 'COMPLETED';
        task.outputs = res.outputs;
        if (res.evidence) {
          job.evidenceList.push(res.evidence);
        }
      } else {
        task.state = 'FAILED';
        job.state = 'FAILED';
        return job;
      }
    }

    job.state = 'COMPLETED';
    return job;
  }

  public static cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    job.state = 'CANCELLED';
    job.tasks.forEach(t => {
      if (t.state !== 'COMPLETED') {
        t.state = 'CANCELLED';
      }
    });
    return true;
  }

  public static retryJob(jobId: string): ComputeJob {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    job.state = 'QUEUED';
    job.tasks.forEach(t => {
      t.state = 'QUEUED';
    });

    return job;
  }
}
