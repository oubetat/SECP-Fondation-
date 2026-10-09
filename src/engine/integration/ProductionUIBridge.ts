/**
 * PATCH-SECP-084: Production UI Bridge
 * The central reactive service bridge that connects UI components directly to the
 * ProductionExecutionBroker.
 */

import {
  ProductionEngineeringCommand,
  ProductionExecutionResult,
  ProductionOperationType,
  ProductionEntityReference
} from './contracts/ProductionCommandContracts';
import { ProductionExecutionBroker } from './ProductionExecutionBroker';

export interface ActiveSelectionState {
  entityId: string;
  entityName: string;
  revisionId: string;
  selectedOperation: ProductionOperationType;
}

export class ProductionUIBridge {
  private static instance: ProductionUIBridge;
  private listeners: (() => void)[] = [];

  private currentSelection: ActiveSelectionState = {
    entityId: 'CAD-SOLID-001',
    entityName: 'Main Base Solid Component',
    revisionId: 'REV-2026-08-15-01',
    selectedOperation: 'CLASS_A_SURFACING_ZEBRA'
  };

  private latestExecutionMap: Map<ProductionOperationType, ProductionExecutionResult> = new Map();
  private executionHistory: ProductionExecutionResult[] = [];
  private isExecuting: boolean = false;

  public static getInstance(): ProductionUIBridge {
    if (!ProductionUIBridge.instance) {
      ProductionUIBridge.instance = new ProductionUIBridge();
    }
    return ProductionUIBridge.instance;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  public setSelection(selection: Partial<ActiveSelectionState>) {
    this.currentSelection = { ...this.currentSelection, ...selection };
    this.notify();
  }

  public getSelection(): ActiveSelectionState {
    return this.currentSelection;
  }

  public getLatestExecution(op: ProductionOperationType): ProductionExecutionResult | undefined {
    return this.latestExecutionMap.get(op);
  }

  public getHistory(): ProductionExecutionResult[] {
    return this.executionHistory;
  }

  public getIsExecuting(): boolean {
    return this.isExecuting;
  }

  /**
   * Dispatch a real production engineering operation from the UI.
   */
  public async dispatchProductionOperation(
    operationType: ProductionOperationType,
    config: any = {}
  ): Promise<ProductionExecutionResult> {
    this.isExecuting = true;
    this.notify();

    const entityRef: ProductionEntityReference = {
      entityId: this.currentSelection.entityId,
      entityName: this.currentSelection.entityName,
      revisionId: this.currentSelection.revisionId
    };

    const engineIdMap: Record<ProductionOperationType, string> = {
      BREP_HEALING_SEWING: 'BRepHealingAndSewingEngine',
      CLASS_A_SURFACING_ZEBRA: 'SECP083ClassASurfaceCore',
      LINEAR_STRUCTURAL_FEA: 'StructuralAnalysisEngine',
      NONLINEAR_FEA_CONTACT: 'StructuralAnalysisEngine',
      CFD_3D_FVM_FLOW: 'Fvm3DNavierStokesSolver',
      CAM_5AXIS_SIMULTANEOUS: 'SECP083FiveAxisToolpathEngine',
      ASSEMBLY_KINEMATICS_SOLVE: 'AssemblyEngine',
      STEP_AP242_PMI_WORKFLOW: 'BRepHealingAndSewingEngine'
    };

    const command: ProductionEngineeringCommand = {
      commandId: `CMD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      operationType,
      engineId: engineIdMap[operationType],
      entityRef,
      config,
      submittedBy: 'Production UI User',
      submittedAt: new Date().toISOString()
    };

    const result = await ProductionExecutionBroker.executeCommand(command);

    this.latestExecutionMap.set(operationType, result);
    this.executionHistory.unshift(result);
    this.isExecuting = false;
    this.notify();

    return result;
  }
}
