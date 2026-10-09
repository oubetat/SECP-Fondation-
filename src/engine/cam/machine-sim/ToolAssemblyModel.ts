/**
 * SECP Industrial OS - PATCH-264: Machine Simulation Engine
 * Tool Assembly Model: Multi-Body Representation of Cutter, Shank, Holder, and Spindle Interface
 */

import { ToolGeometryDefinition, ToolHolderDefinition } from '../tool-library/ToolTypes';
import { Vector3D } from './MachineSimulationTypes';

export interface ToolAssemblyCylinder {
  name: string;
  type: 'CUTTER' | 'SHANK' | 'HOLDER_COLLET' | 'HOLDER_BODY' | 'SPINDLE_FACE';
  bottomZ: number; // relative to tool tip at Z=0
  topZ: number;
  radius: number;
  isCutting: boolean;
}

export class ToolAssemblyModel {
  private tool: ToolGeometryDefinition;
  private holder?: ToolHolderDefinition;

  constructor(tool: ToolGeometryDefinition, holder?: ToolHolderDefinition) {
    this.tool = tool;
    this.holder = holder;
  }

  public getTool(): ToolGeometryDefinition {
    return this.tool;
  }

  public getHolder(): ToolHolderDefinition | undefined {
    return this.holder;
  }

  /**
   * Generates cylindrical collision slices along the tool axis (Z from tip upwards).
   */
  public getCollisionVolumes(): ToolAssemblyCylinder[] {
    const volumes: ToolAssemblyCylinder[] = [];
    const cutterRadius = this.tool.cuttingDiameter / 2.0;
    const shankRadius = (this.tool.shankDiameter || this.tool.cuttingDiameter) / 2.0;
    const fluteLength = this.tool.fluteLength || 25;
    const overallLength = this.tool.overallLength || 75;

    // 1. Cutting Flute Slice
    volumes.push({
      name: 'Flute Portion',
      type: 'CUTTER',
      bottomZ: 0,
      topZ: fluteLength,
      radius: cutterRadius,
      isCutting: true,
    });

    // 2. Non-cutting Shank Slice
    if (overallLength > fluteLength) {
      volumes.push({
        name: 'Tool Shank',
        type: 'SHANK',
        bottomZ: fluteLength,
        topZ: overallLength,
        radius: shankRadius,
        isCutting: false,
      });
    }

    // 3. Holder Geometry
    const holderGaugeLength = this.holder?.gaugeLength || 60;
    const holderRadius = (this.holder?.bodyDiameter || 50) / 2.0;
    const colletRadius = (this.holder?.colletDiameter || 32) / 2.0;

    // Collet section
    volumes.push({
      name: 'Holder Collet',
      type: 'HOLDER_COLLET',
      bottomZ: overallLength,
      topZ: overallLength + 25,
      radius: colletRadius,
      isCutting: false,
    });

    // Main Holder Body
    volumes.push({
      name: 'Holder Main Body',
      type: 'HOLDER_BODY',
      bottomZ: overallLength + 25,
      topZ: overallLength + holderGaugeLength,
      radius: holderRadius,
      isCutting: false,
    });

    // Spindle Face
    volumes.push({
      name: 'Spindle Nose Interface',
      type: 'SPINDLE_FACE',
      bottomZ: overallLength + holderGaugeLength,
      topZ: overallLength + holderGaugeLength + 40,
      radius: 65, // typical 130mm spindle nose diameter
      isCutting: false,
    });

    return volumes;
  }
}
