import { 
  EngineeringWorkflow, 
  EngineeringWorkflowTask, 
  WorkflowDefinition, 
  WorkflowExecutionContext, 
  WorkflowStatus, 
  WorkflowTaskStatus,
  EngineeringVerdictType
} from './types';
import { CapabilityResolver } from '../capabilities/CapabilityResolver';
import { CapabilityPolicyEvaluator } from '../capabilities/CapabilityPolicyEvaluator';
import { EngineeringObjectLockManager } from './EngineeringObjectLockManager';
import { WorkflowValidator } from './WorkflowValidator';
import { WorkflowRepository } from './WorkflowRepository';
import { WorkflowDependencyGraph } from './WorkflowDependencyGraph';
import { EngineeringEventStore } from '../event-model/EngineeringEventStore';
import { EvidenceBus } from '../evidence-bus/EvidenceBus';
import * as crypto from 'crypto';

export class EngineeringWorkflowEngine {
  private resolver: CapabilityResolver;
  private repository: WorkflowRepository;
  private lockManager: EngineeringObjectLockManager;
  private eventStore: EngineeringEventStore;

  // Track dynamic transient runtime states securely to isolate multiple concurrent runs
  private activeExecutions: Map<string, WorkflowExecutionContext> = new Map();
  private activeWorkflows: Map<string, EngineeringWorkflow> = new Map();
  private taskStatuses: Map<string, Map<string, WorkflowTaskStatus>> = new Map(); // executionId -> (taskId -> status)
  private taskInputs: Map<string, Map<string, any>> = new Map(); // executionId -> (taskId -> input)
  private taskOutputs: Map<string, Map<string, any>> = new Map(); // executionId -> (taskId -> output)
  private taskAttempts: Map<string, Map<string, number>> = new Map(); // executionId -> (taskId -> attempts)
  private taskEvidence: Map<string, Map<string, string[]>> = new Map(); // executionId -> (taskId -> evidenceIds)
  private activeLocks: Map<string, string[]> = new Map(); // executionId -> list of active objectIds locked

  constructor(
    resolver: CapabilityResolver,
    repository: WorkflowRepository = new WorkflowRepository(),
    lockManager: EngineeringObjectLockManager = new EngineeringObjectLockManager(),
    eventStore: EngineeringEventStore = EngineeringEventStore.getInstance()
  ) {
    this.resolver = resolver;
    this.repository = repository;
    this.lockManager = lockManager;
    this.eventStore = eventStore;
  }

  // ============================================================================
  // CORE API
  // ============================================================================

  public createWorkflow(definition: WorkflowDefinition, name: string, description?: string): EngineeringWorkflow {
    // 1. Initial Validation
    const validation = WorkflowValidator.validate(definition, this.resolver);
    const status: WorkflowStatus = validation.isValid ? "READY" : "DRAFT";

    const workflow: EngineeringWorkflow = {
      id: definition.id,
      version: definition.version,
      name,
      description,
      status,
      objectIds: Array.from(new Set(definition.tasks.flatMap(t => t.objectIds))),
      taskIds: definition.tasks.map(t => t.id),
      requiredCapabilities: Array.from(new Set(definition.tasks.map(t => t.capabilityId))),
      policyIds: definition.tasks.flatMap(t => t.metadata?.policies as string[] || []),
      deterministic: !!definition.metadata?.deterministic,
      replayable: !!definition.metadata?.replayable,
      evidenceIds: [],
      metadata: definition.metadata || {}
    };

    // Deep freeze task definition within metadata to preserve it
    workflow.metadata.tasks = JSON.parse(JSON.stringify(definition.tasks));

    this.repository.saveWorkflow(workflow);
    this.activeWorkflows.set(workflow.id, workflow);

    this.emitEvent('WORKFLOW_CREATED', workflow.id, 'SYSTEM_INIT', {
      workflowId: workflow.id,
      version: workflow.version,
      status
    });

    return workflow;
  }

  public validateWorkflow(workflowId: string): { isValid: boolean; errors: string[] } {
    const workflow = this.repository.getWorkflow(workflowId);
    if (!workflow) {
      return { isValid: false, errors: [`Workflow '${workflowId}' not found.`] };
    }

    const tasks = this.getWorkflowTasks(workflowId);
    const definition: WorkflowDefinition = {
      id: workflow.id,
      version: workflow.version,
      tasks,
      entryTaskIds: [],
      outputTaskIds: []
    };

    const result = WorkflowValidator.validate(definition, this.resolver);

    this.emitEvent('WORKFLOW_VALIDATED', workflowId, 'SYSTEM_VALIDATOR', {
      isValid: result.isValid,
      errors: result.errors
    });

    return result;
  }

  public prepareWorkflow(workflowId: string, objectIds: string[]): { executionId: string; context: WorkflowExecutionContext } {
    const workflow = this.repository.getWorkflow(workflowId);
    if (!workflow) {
      throw new Error(`Workflow '${workflowId}' not found.`);
    }

    const executionId = `EXEC-${crypto.randomBytes(16).toString("hex")}`;
    const correlationId = `CORR-${crypto.randomBytes(16).toString("hex")}`;

    const objectRevisionMap: Record<string, string> = {};
    for (const id of objectIds) {
      objectRevisionMap[id] = 'REV-1'; // Stable initial tracking revision
    }

    const context: WorkflowExecutionContext = {
      executionId,
      workflowId,
      workflowVersion: workflow.version,
      startedAt: new Date().toISOString(),
      objectRevisionMap,
      inputHash: crypto.createHash('sha256').update(JSON.stringify(objectRevisionMap)).digest('hex'),
      correlationId,
      eventIds: [],
      evidenceIds: [],
      metadata: {}
    };

    this.activeExecutions.set(executionId, context);
    this.repository.saveExecution(context);

    // Initialise task tracking states
    const statusMap = new Map<string, WorkflowTaskStatus>();
    const inputsMap = new Map<string, any>();
    const outputsMap = new Map<string, any>();
    const attemptsMap = new Map<string, number>();
    const evidenceMap = new Map<string, string[]>();

    const tasks = this.getWorkflowTasks(workflowId);
    for (const task of tasks) {
      statusMap.set(task.id, 'PENDING');
      attemptsMap.set(task.id, 0);
      evidenceMap.set(task.id, []);
    }

    this.taskStatuses.set(executionId, statusMap);
    this.taskInputs.set(executionId, inputsMap);
    this.taskOutputs.set(executionId, outputsMap);
    this.taskAttempts.set(executionId, attemptsMap);
    this.taskEvidence.set(executionId, evidenceMap);
    this.activeLocks.set(executionId, []);

    return { executionId, context };
  }

  public async startWorkflow(executionId: string): Promise<void> {
    const context = this.activeExecutions.get(executionId);
    if (!context) {
      throw new Error(`Execution isolation context '${executionId}' not found.`);
    }

    const workflow = this.repository.getWorkflow(context.workflowId);
    if (!workflow) {
      throw new Error(`Workflow '${context.workflowId}' not found.`);
    }

    workflow.status = 'RUNNING';
    this.repository.saveWorkflow(workflow);

    this.emitEvent('WORKFLOW_STARTED', workflow.id, executionId, {
      executionId,
      correlationId: context.correlationId
    });

    await this.runSchedulingLoop(executionId);
  }

  public pauseWorkflow(executionId: string): void {
    const context = this.activeExecutions.get(executionId);
    if (!context) return;

    const workflow = this.repository.getWorkflow(context.workflowId);
    if (workflow) {
      workflow.status = 'PAUSED';
      this.repository.saveWorkflow(workflow);

      this.emitEvent('WORKFLOW_PAUSED', workflow.id, executionId, {
        executionId,
        correlationId: context.correlationId
      });
    }
  }

  public async resumeWorkflow(executionId: string): Promise<void> {
    const context = this.activeExecutions.get(executionId);
    if (!context) return;

    const workflow = this.repository.getWorkflow(context.workflowId);
    if (workflow && workflow.status === 'PAUSED') {
      workflow.status = 'RUNNING';
      this.repository.saveWorkflow(workflow);

      this.emitEvent('WORKFLOW_RESUMED', workflow.id, executionId, {
        executionId,
        correlationId: context.correlationId
      });

      await this.runSchedulingLoop(executionId);
    }
  }

  public cancelWorkflow(executionId: string): void {
    const context = this.activeExecutions.get(executionId);
    if (!context) return;

    const workflow = this.repository.getWorkflow(context.workflowId);
    if (workflow) {
      workflow.status = 'CANCELLED';
      this.repository.saveWorkflow(workflow);

      // Clean active locks
      const locks = this.activeLocks.get(executionId) || [];
      for (const objId of locks) {
        this.lockManager.release(objId, executionId);
      }
      this.activeLocks.set(executionId, []);

      // Cancel unfinished tasks
      const statusMap = this.taskStatuses.get(executionId);
      if (statusMap) {
        for (const [taskId, status] of statusMap.entries()) {
          if (status === 'PENDING' || status === 'READY' || status === 'RUNNING') {
            statusMap.set(taskId, 'CANCELLED');
          }
        }
      }

      this.emitEvent('WORKFLOW_CANCELLED', workflow.id, executionId, {
        executionId,
        correlationId: context.correlationId
      });
    }
  }

  public async retryTask(executionId: string, taskId: string): Promise<void> {
    const context = this.activeExecutions.get(executionId);
    if (!context) throw new Error(`Execution context not found.`);

    const statusMap = this.taskStatuses.get(executionId);
    if (!statusMap) throw new Error(`Statuses not initialized.`);

    const currentStatus = statusMap.get(taskId);
    if (currentStatus !== 'FAILED') {
      throw new Error(`Cannot retry task '${taskId}' (Current status is '${currentStatus}').`);
    }

    statusMap.set(taskId, 'READY');

    this.emitEvent('TASK_RETRIED', context.workflowId, executionId, {
      executionId,
      taskId,
      previousStatus: 'FAILED',
      status: 'READY'
    });

    const workflow = this.repository.getWorkflow(context.workflowId);
    if (workflow && workflow.status !== 'RUNNING') {
      workflow.status = 'RUNNING';
      this.repository.saveWorkflow(workflow);
    }

    await this.runSchedulingLoop(executionId);
  }

  public getWorkflowStatus(workflowId: string): WorkflowStatus {
    const workflow = this.repository.getWorkflow(workflowId);
    return workflow ? workflow.status : 'DRAFT';
  }

  public getExecutionHistory(workflowId: string): WorkflowExecutionContext[] {
    const history: WorkflowExecutionContext[] = [];
    for (const ctx of this.activeExecutions.values()) {
      if (ctx.workflowId === workflowId) {
        history.push(ctx);
      }
    }
    return history;
  }

  public getWorkflowVerdict(executionId: string): EngineeringVerdictType {
    const context = this.activeExecutions.get(executionId);
    if (!context) return 'INVALID';

    const workflow = this.repository.getWorkflow(context.workflowId);
    if (!workflow) return 'INVALID';

    const statusMap = this.taskStatuses.get(executionId);
    if (!statusMap) return 'INCONCLUSIVE';

    const tasks = this.getWorkflowTasks(workflow.id);
    const taskList = Array.from(statusMap.entries());

    // 1. Is there any failed task?
    const hasFailures = taskList.some(([_, status]) => status === 'FAILED');
    if (hasFailures) return 'FAIL';

    // 2. Is there any unproven or blocked task?
    const hasUnproven = taskList.some(([_, status]) => status === 'UNPROVEN');
    if (hasUnproven) return 'UNPROVEN';

    const hasBlocked = taskList.some(([_, status]) => status === 'BLOCKED');
    if (hasBlocked) return 'UNPROVEN';

    // 3. Are all tasks finished?
    const finishedStates: WorkflowTaskStatus[] = ['COMPLETED', 'SKIPPED', 'CANCELLED', 'UNPROVEN'];
    const allFinished = taskList.every(([_, status]) => finishedStates.includes(status));
    if (!allFinished) return 'INCONCLUSIVE';

    // 4. Evidence Linkage check
    if (tasks.length > 0 && context.evidenceIds.length === 0) {
      return 'UNPROVEN';
    }

    return 'PASS';
  }

  // ============================================================================
  // AD-HOC FULL FLOW RUNNER
  // ============================================================================

  public async executeWorkflow(definition: WorkflowDefinition, objectIds: string[], inputs?: any): Promise<WorkflowExecutionContext> {
    const validation = WorkflowValidator.validate(definition, this.resolver);
    if (!validation.isValid) {
      throw new Error(`Workflow validation failed: ${validation.errors.join(', ')}`);
    }

    const workflow = this.createWorkflow(definition, definition.id, definition.id);
    const { executionId, context } = this.prepareWorkflow(workflow.id, objectIds);

    if (inputs) {
      const inputsMap = this.taskInputs.get(executionId);
      if (inputsMap) {
        for (const [id, value] of Object.entries(inputs)) {
          inputsMap.set(id, value);
        }
      }
    }

    await this.startWorkflow(executionId);
    return this.activeExecutions.get(executionId)!;
  }

  // ============================================================================
  // INTERNALS & ENGINE COORDINATION
  // ============================================================================

  public getWorkflowTasks(workflowId: string): EngineeringWorkflowTask[] {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return [];
    
    const definition = this.repository.getWorkflow(workflowId);
    if (definition && definition.metadata?.tasks) {
      return definition.metadata.tasks as EngineeringWorkflowTask[];
    }
    return (workflow.metadata.tasks as EngineeringWorkflowTask[]) || [];
  }

  public setWorkflowTasks(workflowId: string, tasks: EngineeringWorkflowTask[]) {
    const workflow = this.repository.getWorkflow(workflowId);
    if (workflow) {
      workflow.metadata.tasks = tasks;
      this.repository.saveWorkflow(workflow);
    }
    const active = this.activeWorkflows.get(workflowId);
    if (active) {
      active.metadata.tasks = tasks;
    }
  }

  private buildDependencyGraph(tasks: EngineeringWorkflowTask[]): WorkflowDependencyGraph {
    const graph = new WorkflowDependencyGraph();
    for (const task of tasks) {
      for (const depId of task.dependsOn) {
        graph.addDependency(task.id, depId);
      }
      graph.getDependencies(task.id);
    }
    return graph;
  }

  private async runSchedulingLoop(executionId: string): Promise<void> {
    const context = this.activeExecutions.get(executionId);
    if (!context) return;

    const workflow = this.repository.getWorkflow(context.workflowId);
    if (!workflow || workflow.status !== 'RUNNING') return;

    const tasks = this.getWorkflowTasks(workflow.id);
    const graph = this.buildDependencyGraph(tasks);
    const statusMap = this.taskStatuses.get(executionId);
    if (!statusMap) return;

    let progressMade = true;

    while (progressMade && workflow.status === 'RUNNING') {
      progressMade = false;

      const completedIds = Array.from(statusMap.entries())
        .filter(([_, status]) => status === 'COMPLETED' || status === 'SKIPPED' || status === 'CANCELLED' || status === 'UNPROVEN')
        .map(([taskId]) => taskId);

      const readyTaskIds = graph.getReadyTasks(completedIds, tasks.map(t => t.id));

      const runnableTaskIds = readyTaskIds.filter(id => {
        const current = statusMap.get(id);
        return current === 'PENDING' || current === 'READY';
      });

      if (runnableTaskIds.length === 0) {
        break;
      }

      const tasksToRun: EngineeringWorkflowTask[] = [];
      const currentLocks = this.activeLocks.get(executionId) || [];

      // Sort stably if deterministic = true
      if (workflow.deterministic) {
        runnableTaskIds.sort();
      }

      for (const id of runnableTaskIds) {
        const task = tasks.find(t => t.id === id)!;
        
        // Lock detection
        const hasLockConflict = task.objectIds.some(objId => {
          return this.lockManager.isLocked(objId) && this.lockManager.getOwner(objId) !== executionId;
        });

        if (hasLockConflict) {
          statusMap.set(id, 'BLOCKED');
          this.emitEvent('TASK_BLOCKED', workflow.id, executionId, {
            taskId: id,
            reason: `Resource Lock Conflict on objects: [${task.objectIds.join(', ')}]`
          });
          continue;
        }

        // Acquire resource locks
        let lockSuccess = true;
        for (const objId of task.objectIds) {
          if (!this.lockManager.acquire(objId, executionId)) {
            lockSuccess = false;
            break;
          }
        }

        if (!lockSuccess) {
          for (const objId of task.objectIds) {
            if (this.lockManager.getOwner(objId) === executionId) {
              this.lockManager.release(objId, executionId);
            }
          }
          statusMap.set(id, 'BLOCKED');
          this.emitEvent('TASK_BLOCKED', workflow.id, executionId, {
            taskId: id,
            reason: `Resource Lock acquisition failed.`
          });
          continue;
        }

        const mergedLocks = Array.from(new Set([...currentLocks, ...task.objectIds]));
        this.activeLocks.set(executionId, mergedLocks);

        tasksToRun.push(task);
      }

      if (tasksToRun.length > 0) {
        progressMade = true;
        // Parallel Task Orchestrator Execution
        const runPromises = tasksToRun.map(task => this.executeSingleTask(executionId, task));
        await Promise.all(runPromises);
      }
    }

    this.finalizeWorkflowStatus(executionId);
  }

  private async executeSingleTask(executionId: string, task: EngineeringWorkflowTask): Promise<void> {
    const context = this.activeExecutions.get(executionId)!;
    const statusMap = this.taskStatuses.get(executionId)!;
    const attemptsMap = this.taskAttempts.get(executionId)!;
    const inputsMap = this.taskInputs.get(executionId)!;
    const outputsMap = this.taskOutputs.get(executionId)!;
    const evidenceMap = this.taskEvidence.get(executionId)!;

    statusMap.set(task.id, 'RUNNING');
    const currentAttempt = (attemptsMap.get(task.id) || 0) + 1;
    attemptsMap.set(task.id, currentAttempt);

    this.emitEvent('TASK_STARTED', context.workflowId, executionId, {
      executionId,
      taskId: task.id,
      attempt: currentAttempt
    });

    try {
      // 1. Resolver Verification
      const resolved = this.resolver.resolve(task.capabilityId);
      if (resolved.status === 'UNPROVEN') {
        statusMap.set(task.id, 'UNPROVEN');
        task.status = 'UNPROVEN';
        this.emitEvent('TASK_COMPLETED', context.workflowId, executionId, {
          executionId,
          taskId: task.id,
          status: 'UNPROVEN',
          reason: 'Capability lacks proven evidence certification'
        });
        return;
      }

      if (!resolved.executable) {
        throw new Error(`Capability '${task.capabilityId}' is not executable (Status: ${resolved.status}). Missing requirements: [${resolved.missingRequirements.join(', ')}]`);
      }

      // 2. Policy Evaluation
      const capabilityDef = this.resolver['registry'].get(task.capabilityId)!;
      for (const objId of task.objectIds) {
        const dummyObject = { id: objId, objectType: 'GEOMETRY', status: 'ACTIVE' };
        
        const decision = CapabilityPolicyEvaluator.evaluate('Engineer-WorkflowRuntime', capabilityDef, dummyObject);
        if (!decision.allowed) {
          throw new Error(`Policy Rejection: ${decision.reason}`);
        }

        const opCheck = this.resolver.canOperateOn(capabilityDef, dummyObject);
        if (!opCheck.allowed) {
          throw new Error(`Operation Rejection: ${opCheck.reason}`);
        }
      }

      // 3. Aggregate inherited inputs
      const inheritedInputs: any = {};
      for (const depId of task.dependsOn) {
        const depOutput = outputsMap.get(depId);
        if (depOutput) {
          Object.assign(inheritedInputs, depOutput);
        }
      }

      const inputPayload = Object.assign({}, inheritedInputs, inputsMap.get(task.id) || {}, task.input || {});
      inputsMap.set(task.id, inputPayload);

      // 4. Execution
      const provider = this.resolver.getProviderFor(task.capabilityId);
      if (!provider) {
        throw new Error(`No provider available for capability: ${task.capabilityId}`);
      }

      const output = await provider.execute(task.capabilityId, inputPayload);
      outputsMap.set(task.id, output);

      // Publish task evidence via EvidenceBus
      try {
        const evidenceBus = EvidenceBus.getInstance();
        const pubResult = evidenceBus.publishSync({
          evidenceType: 'WORKFLOW_EVIDENCE',
          sourceCapability: task.capabilityId,
          sourceOperation: `executeTask:${task.id}`,
          workflowId: context.workflowId,
          runId: executionId,
          taskId: task.id,
          engineeringObjectId: task.objectIds[0],
          correlationId: `CORR-${executionId}`,
          payload: {
            taskId: task.id,
            attempt: currentAttempt,
            output,
            objectIds: task.objectIds
          }
        });
        if (pubResult.success && pubResult.evidenceId) {
          const evidenceList = evidenceMap.get(task.id) || [];
          evidenceList.push(pubResult.evidenceId);
          evidenceMap.set(task.id, evidenceList);
          if (!context.evidenceIds.includes(pubResult.evidenceId)) {
            context.evidenceIds.push(pubResult.evidenceId);
          }
        }
      } catch {
        // Continue with inherited evidence fallback
      }

      // Link static capability evidence IDs
      const evidenceList = evidenceMap.get(task.id) || [];
      for (const evId of resolved.evidenceIds) {
        if (!evidenceList.includes(evId)) {
          evidenceList.push(evId);
        }
        if (!context.evidenceIds.includes(evId)) {
          context.evidenceIds.push(evId);
        }
      }
      evidenceMap.set(task.id, evidenceList);

      statusMap.set(task.id, 'COMPLETED');
      task.status = 'COMPLETED';

      this.emitEvent('TASK_COMPLETED', context.workflowId, executionId, {
        executionId,
        taskId: task.id,
        attempt: currentAttempt,
        output
      });

    } catch (error: any) {
      const maxAttempts = task.retryPolicy?.maxAttempts || 1;
      if (currentAttempt < maxAttempts) {
        this.emitEvent('TASK_FAILED', context.workflowId, executionId, {
          executionId,
          taskId: task.id,
          attempt: currentAttempt,
          error: error.message,
          willRetry: true
        });

        // Trigger retry directly
        await this.executeSingleTask(executionId, task);
      } else {
        statusMap.set(task.id, 'FAILED');
        task.status = 'FAILED';

        this.emitEvent('TASK_FAILED', context.workflowId, executionId, {
          executionId,
          taskId: task.id,
          attempt: currentAttempt,
          error: error.message,
          willRetry: false
        });

        this.propagateFailure(executionId, task.id);
      }
    } finally {
      // Release current locks
      for (const objId of task.objectIds) {
        this.lockManager.release(objId, executionId);
      }
    }
  }

  private propagateFailure(executionId: string, failedTaskId: string): void {
    const statusMap = this.taskStatuses.get(executionId);
    if (!statusMap) return;

    const workflow = this.repository.getWorkflow(this.activeExecutions.get(executionId)!.workflowId);
    if (!workflow) return;

    const tasks = this.getWorkflowTasks(workflow.id);
    const graph = this.buildDependencyGraph(tasks);

    const dependents = graph.getDependents(failedTaskId);
    for (const depId of dependents) {
      const current = statusMap.get(depId);
      if (current === 'PENDING' || current === 'READY') {
        statusMap.set(depId, 'BLOCKED');
        this.emitEvent('TASK_BLOCKED', workflow.id, executionId, {
          taskId: depId,
          reason: `Upstream dependency task '${failedTaskId}' failed.`
        });
        this.propagateFailure(executionId, depId);
      }
    }
  }

  private finalizeWorkflowStatus(executionId: string): void {
    const context = this.activeExecutions.get(executionId)!;
    const workflow = this.repository.getWorkflow(context.workflowId);
    if (!workflow || workflow.status !== 'RUNNING') return;

    const statusMap = this.taskStatuses.get(executionId)!;
    const taskList = Array.from(statusMap.entries());

    const hasFailures = taskList.some(([_, status]) => status === 'FAILED');
    if (hasFailures) {
      workflow.status = 'FAILED';
      this.repository.saveWorkflow(workflow);
      this.emitEvent('WORKFLOW_FAILED', workflow.id, executionId, {
        executionId,
        reason: 'One or more tasks failed execution.'
      });
      return;
    }

    const finishedStates: WorkflowTaskStatus[] = ['COMPLETED', 'SKIPPED', 'CANCELLED', 'UNPROVEN'];
    const allFinished = taskList.every(([_, status]) => finishedStates.includes(status));

    if (allFinished) {
      const verdict = this.getWorkflowVerdict(executionId);
      workflow.status = verdict === 'PASS' ? 'COMPLETED' : 'UNPROVEN';
      this.repository.saveWorkflow(workflow);

      this.emitEvent('WORKFLOW_COMPLETED', workflow.id, executionId, {
        executionId,
        verdict
      });
    }
  }

  private emitEvent(
    eventType: any,
    workflowId: string,
    executionId: string,
    payload: Record<string, unknown>
  ): void {
    try {
      const event = this.eventStore.append({
        eventType,
        actor: { type: 'SYSTEM', id: 'workflow-engine' },
        source: { service: 'workflow-engine', component: 'orchestrator', version: '1.0' },
        objectRefs: [workflowId],
        payload: { ...payload, workflowId, executionId, timestamp: new Date().toISOString() },
        correlationId: executionId
      });
      this.repository.appendExecutionEvent(executionId, event);
    } catch (e) {
      // suppress
    }
  }
}
