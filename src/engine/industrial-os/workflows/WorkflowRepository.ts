import { EngineeringWorkflow, WorkflowExecutionContext } from './types';
import { EngineeringEvent } from '../event-model/types';

export interface WorkflowPersistenceAdapter {
  saveWorkflow(workflow: EngineeringWorkflow): void;
  getWorkflow(id: string): EngineeringWorkflow | undefined;
  saveExecution(execution: WorkflowExecutionContext): void;
  getExecution(id: string): WorkflowExecutionContext | undefined;
  appendExecutionEvent(executionId: string, event: EngineeringEvent): void;
  getExecutionEvents(executionId: string): EngineeringEvent[];
}

export class InMemoryPersistenceAdapter implements WorkflowPersistenceAdapter {
  private workflows: Map<string, EngineeringWorkflow> = new Map();
  private executions: Map<string, WorkflowExecutionContext> = new Map();
  private executionEvents: Map<string, EngineeringEvent[]> = new Map();

  public saveWorkflow(workflow: EngineeringWorkflow): void {
    this.workflows.set(workflow.id, JSON.parse(JSON.stringify(workflow)));
  }

  public getWorkflow(id: string): EngineeringWorkflow | undefined {
    const raw = this.workflows.get(id);
    return raw ? JSON.parse(JSON.stringify(raw)) : undefined;
  }

  public saveExecution(execution: WorkflowExecutionContext): void {
    this.executions.set(execution.executionId, JSON.parse(JSON.stringify(execution)));
  }

  public getExecution(id: string): WorkflowExecutionContext | undefined {
    const raw = this.executions.get(id);
    return raw ? JSON.parse(JSON.stringify(raw)) : undefined;
  }

  public appendExecutionEvent(executionId: string, event: EngineeringEvent): void {
    if (!this.executionEvents.has(executionId)) {
      this.executionEvents.set(executionId, []);
    }
    this.executionEvents.get(executionId)!.push(event);
  }

  public getExecutionEvents(executionId: string): EngineeringEvent[] {
    return this.executionEvents.get(executionId) || [];
  }
}

export class WorkflowRepository {
  private adapter: WorkflowPersistenceAdapter;

  constructor(adapter: WorkflowPersistenceAdapter = new InMemoryPersistenceAdapter()) {
    this.adapter = adapter;
  }

  public setAdapter(adapter: WorkflowPersistenceAdapter): void {
    this.adapter = adapter;
  }

  public saveWorkflow(workflow: EngineeringWorkflow): void {
    this.adapter.saveWorkflow(workflow);
  }

  public getWorkflow(id: string): EngineeringWorkflow | undefined {
    return this.adapter.getWorkflow(id);
  }

  public saveExecution(execution: WorkflowExecutionContext): void {
    this.adapter.saveExecution(execution);
  }

  public getExecution(id: string): WorkflowExecutionContext | undefined {
    return this.adapter.getExecution(id);
  }

  public appendExecutionEvent(executionId: string, event: EngineeringEvent): void {
    this.adapter.appendExecutionEvent(executionId, event);
  }

  public getExecutionEvents(executionId: string): EngineeringEvent[] {
    return this.adapter.getExecutionEvents(executionId);
  }
}
