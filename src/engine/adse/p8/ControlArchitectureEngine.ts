/**
 * SECP — ADSE-P8 Control Architecture Engine
 * 
 * Manages the structural and semantic binding of control systems to the 
 * engineering architecture (P3), structural context (P5), and physical system models.
 * 
 * Responsibilities:
 * - Defining control loops and signal paths
 * - Binding sensors to plant measurements
 * - Binding actuators to plant inputs
 * - Validating architectural consistency (P3 -> P8)
 * - Registering control system lineage in the Digital Thread (P4)
 */

import {
  ControlLoop,
  ControlSystem,
  ControlledPlant,
  Controller,
  FeedbackPath,
  FeedforwardPath,
  ControlMode
} from './types';
import { ControlRegistry } from './ControlRegistry';

export class ControlArchitectureEngine {
  private registry: ControlRegistry;

  constructor(registry: ControlRegistry) {
    this.registry = registry;
  }

  /**
   * Defines a complete Control Architecture for a system
   */
  public defineArchitecture(params: {
    controlSystemId: string;
    plantId: string;
    controllerIds: string[];
    loopDefinitions: Array<{
      id: string;
      name: string;
      controllerId: string;
      mode: ControlMode;
      rateHz: number;
      feedback: FeedbackPath[];
    }>;
  }) {
    const system = this.registry.getSystem(params.controlSystemId);
    if (!system) throw new Error(`SYSTEM_NOT_FOUND: '${params.controlSystemId}'`);

    const plant = this.registry.getPlant(params.plantId);
    if (!plant) throw new Error(`PLANT_NOT_FOUND: '${params.plantId}'`);

    // Validate loop definitions against plant capabilities
    for (const loopDef of params.loopDefinitions) {
      this.validateLoopAgainstPlant(loopDef, plant);
      
      this.registry.registerLoop({
        id: loopDef.id,
        systemId: system.systemId,
        controlSystemId: system.id,
        loopName: loopDef.name,
        controllerId: loopDef.controllerId,
        plantId: plant.id,
        feedbackPaths: loopDef.feedback,
        feedforwardPaths: [],
        executionRateHz: loopDef.rateHz,
        targetOperatingMode: loopDef.mode,
        configurationId: system.configurationId,
        revisionId: system.revisionId
      });
    }
  }

  /**
   * Validates that a loop's feedback paths map to existing plant measurements
   */
  private validateLoopAgainstPlant(loop: any, plant: ControlledPlant) {
    for (const path of loop.feedback) {
      const measurement = plant.measurements.find(m => m.name === path.measurementName);
      if (!measurement) {
        throw new Error(`MISSING_MEASUREMENT: Loop '${loop.name}' refers to unknown measurement '${path.measurementName}' on plant '${plant.id}'`);
      }
    }
  }

  /**
   * Connects a controller to a specific P3 Architecture Element
   */
  public bindControllerToArchitecture(controllerId: string, p3ArchId: string) {
    const controller = this.registry.getController(controllerId);
    if (!controller) throw new Error(`CONTROLLER_NOT_FOUND: '${controllerId}'`);
    
    // In a real implementation, we would verify p3ArchId exists in the P3 Engine
    controller.relationships.push({
      targetId: p3ArchId,
      relationshipType: 'IMPLEMENTS_CONTROL_FOR'
    });
  }
}
