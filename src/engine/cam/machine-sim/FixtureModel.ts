/**
 * SECP Industrial OS - PATCH-264: Machine Simulation Engine
 * Fixture Model: Parametric Representation of Vises, Step Clamps, Chucks & Tables
 */

import { FixtureModel, FixtureClampMesh, Vector3D } from './MachineSimulationTypes';

export class FixtureManager {
  public static createPrecisionVise(
    jawWidth: number = 150,
    jawOpening: number = 100,
    jawHeight: number = 40,
    offset: Vector3D = { x: 0, y: 0, z: 0 }
  ): FixtureModel {
    const fixedJaw: FixtureClampMesh = {
      id: 'FIXED_JAW',
      name: 'Precision Vise Fixed Jaw',
      type: 'VISE_JAW',
      bounds: {
        min: { x: offset.x - jawWidth / 2, y: offset.y + jawOpening / 2, z: offset.z - jawHeight },
        max: { x: offset.x + jawWidth / 2, y: offset.y + jawOpening / 2 + 25, z: offset.z + 10 },
      },
      center: { x: offset.x, y: offset.y + jawOpening / 2 + 12.5, z: offset.z - jawHeight / 2 + 5 },
      dimensions: { x: jawWidth, y: 25, z: jawHeight + 10 },
      color: '#475569',
    };

    const movableJaw: FixtureClampMesh = {
      id: 'MOVABLE_JAW',
      name: 'Precision Vise Movable Jaw',
      type: 'VISE_JAW',
      bounds: {
        min: { x: offset.x - jawWidth / 2, y: offset.y - jawOpening / 2 - 25, z: offset.z - jawHeight },
        max: { x: offset.x + jawWidth / 2, y: offset.y - jawOpening / 2, z: offset.z + 10 },
      },
      center: { x: offset.x, y: offset.y - jawOpening / 2 - 12.5, z: offset.z - jawHeight / 2 + 5 },
      dimensions: { x: jawWidth, y: 25, z: jawHeight + 10 },
      color: '#475569',
    };

    const viseBase: FixtureClampMesh = {
      id: 'VISE_BASE',
      name: 'Vise Hardened Base',
      type: 'VISE_JAW',
      bounds: {
        min: { x: offset.x - jawWidth / 2 - 20, y: offset.y - jawOpening / 2 - 50, z: offset.z - jawHeight - 50 },
        max: { x: offset.x + jawWidth / 2 + 20, y: offset.y + jawOpening / 2 + 50, z: offset.z - jawHeight },
      },
      center: { x: offset.x, y: offset.y, z: offset.z - jawHeight - 25 },
      dimensions: { x: jawWidth + 40, y: jawOpening + 100, z: 50 },
      color: '#334155',
    };

    return {
      id: 'VISE_STANDARD_6IN',
      name: 'Kurt Precision CNC Vise 6-Inch',
      clamps: [fixedJaw, movableJaw, viseBase],
      mountingOffset: offset,
    };
  }

  public static createStepClampFixture(
    stockWidth: number = 100,
    stockLength: number = 100,
    offset: Vector3D = { x: 0, y: 0, z: 0 }
  ): FixtureModel {
    const leftClamp: FixtureClampMesh = {
      id: 'STEP_CLAMP_LEFT',
      name: 'M12 Heavy-Duty Step Clamp Left',
      type: 'STEP_CLAMP',
      bounds: {
        min: { x: offset.x - stockWidth / 2 - 35, y: offset.y - 15, z: offset.z },
        max: { x: offset.x - stockWidth / 2 + 10, y: offset.y + 15, z: offset.z + 18 },
      },
      center: { x: offset.x - stockWidth / 2 - 12.5, y: offset.y, z: offset.z + 9 },
      dimensions: { x: 45, y: 30, z: 18 },
      color: '#64748b',
    };

    const rightClamp: FixtureClampMesh = {
      id: 'STEP_CLAMP_RIGHT',
      name: 'M12 Heavy-Duty Step Clamp Right',
      type: 'STEP_CLAMP',
      bounds: {
        min: { x: offset.x + stockWidth / 2 - 10, y: offset.y - 15, z: offset.z },
        max: { x: offset.x + stockWidth / 2 + 35, y: offset.y + 15, z: offset.z + 18 },
      },
      center: { x: offset.x + stockWidth / 2 + 12.5, y: offset.y, z: offset.z + 9 },
      dimensions: { x: 45, y: 30, z: 18 },
      color: '#64748b',
    };

    return {
      id: 'STEP_CLAMP_SET',
      name: 'T-Slot Step Clamp Fixture Set',
      clamps: [leftClamp, rightClamp],
      mountingOffset: offset,
    };
  }
}
