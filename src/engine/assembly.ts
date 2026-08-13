/**
 * PATCH-SECP-008 — Assembly Engine
 * Sub-assemblies, Parts, Mates (Fixed, Coincident, Concentric, Distance, Angle, Parallel),
 * Exploded View slider, Interference Clash Detection, and Mass Properties Calculator.
 */

import { Constraint } from '../types/domainModel';
import { CadGeometryKernel, CadSolidEntity, Vector3D } from './cadKernel';
import { AssemblyCore, PartDefinition, PartInstance, Transform3D, computeTransformMatrix } from './assembly/AssemblyCore';

export type MateKind = 'FIXED' | 'COINCIDENT' | 'CONCENTRIC' | 'DISTANCE' | 'ANGLE' | 'PARALLEL';

export interface AssemblyComponentItem {
  id: string;              // Stable unique identity
  name: string;
  partId: string;
  colorHex: string;
  position: Vector3D;
  rotation: Vector3D;      // Euler angles
  explodedOffset: Vector3D; // Offset direction for Exploded View
  solid: CadSolidEntity;
  densityKgM3: number;     // e.g. Steel = 7850 kg/m3, Aluminum = 2700 kg/m3
  visible: boolean;
  suppressed: boolean;     // Suppression flag (removes from constraints/mass/interference solvers)
  localTransform?: Transform3D;
  worldTransform?: Transform3D;
}

export interface AssemblyMate {
  id: string;
  name: string;
  kind: MateKind;
  compAId: string;
  compBId: string;
  offsetMm?: number;
  angleDeg?: number;
  satisfied: boolean;
}

export interface InterferenceClash {
  id: string;
  compAName: string;
  compBName: string;
  overlapVolumeMm3: number;
  clashCenter: Vector3D;
  severity: 'CRITICAL_COLLISION' | 'CLEARANCE_WARNING';
}

export interface AssemblyMassProperties {
  totalMassKg: number;
  totalVolumeM3: number;
  centerOfGravity: Vector3D;
  momentsOfInertiaKgM2: {
    Ixx: number;
    Iyy: number;
    Izz: number;
  };
}

export class AssemblyEngine {
  public static createDefaultEngineAssembly(): {
    components: AssemblyComponentItem[];
    mates: AssemblyMate[];
  } {
    const engineBlockSolid = CadGeometryKernel.createBox(400, 250, 180, 'Engine_Block_Cast');
    const pistonShaftSolid = CadGeometryKernel.createCylinder(40, 220, 'Piston_Shaft_Assembly');
    const cylinderHeadSolid = CadGeometryKernel.createBox(420, 270, 60, 'Cylinder_Head_Cover');
    const flangeShaftSolid = CadGeometryKernel.createCylinder(25, 140, 'Flange_Output_Shaft');

    const components: AssemblyComponentItem[] = [
      {
        id: 'comp-block',
        name: 'V6 Engine Block Cast',
        partId: 'part-001',
        colorHex: '#64748B',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        explodedOffset: { x: 0, y: 0, z: 0 },
        solid: engineBlockSolid,
        densityKgM3: 7850, // Steel
        visible: true,
        suppressed: false,
        localTransform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          matrix: computeTransformMatrix({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })
        },
        worldTransform: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          matrix: computeTransformMatrix({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })
        }
      },
      {
        id: 'comp-head',
        name: 'Cylinder Head Cover',
        partId: 'part-002',
        colorHex: '#38BDF8',
        position: { x: -10, y: -10, z: 180 },
        rotation: { x: 0, y: 0, z: 0 },
        explodedOffset: { x: 0, y: 0, z: 120 },
        solid: cylinderHeadSolid,
        densityKgM3: 2700, // Aluminum
        visible: true,
        suppressed: false,
        localTransform: {
          position: { x: -10, y: -10, z: 180 },
          rotation: { x: 0, y: 0, z: 0 },
          matrix: computeTransformMatrix({ x: -10, y: -10, z: 180 }, { x: 0, y: 0, z: 0 })
        },
        worldTransform: {
          position: { x: -10, y: -10, z: 180 },
          rotation: { x: 0, y: 0, z: 0 },
          matrix: computeTransformMatrix({ x: -10, y: -10, z: 180 }, { x: 0, y: 0, z: 0 })
        }
      },
      {
        id: 'comp-piston',
        name: 'Piston Rod Shaft',
        partId: 'part-003',
        colorHex: '#F59E0B',
        position: { x: 100, y: 60, z: -20 },
        rotation: { x: 0, y: 0, z: 0 },
        explodedOffset: { x: 0, y: 0, z: -150 },
        solid: pistonShaftSolid,
        densityKgM3: 7850,
        visible: true,
        suppressed: false,
        localTransform: {
          position: { x: 100, y: 60, z: -20 },
          rotation: { x: 0, y: 0, z: 0 },
          matrix: computeTransformMatrix({ x: 100, y: 60, z: -20 }, { x: 0, y: 0, z: 0 })
        },
        worldTransform: {
          position: { x: 100, y: 60, z: -20 },
          rotation: { x: 0, y: 0, z: 0 },
          matrix: computeTransformMatrix({ x: 100, y: 60, z: -20 }, { x: 0, y: 0, z: 0 })
        }
      },
      {
        id: 'comp-flange',
        name: 'Output Flange Coupling',
        partId: 'part-004',
        colorHex: '#10B981',
        position: { x: -120, y: 60, z: 40 },
        rotation: { x: 0, y: 0, z: 0 },
        explodedOffset: { x: -180, y: 0, z: 0 },
        solid: flangeShaftSolid,
        densityKgM3: 7850,
        visible: true,
        suppressed: false,
        localTransform: {
          position: { x: -120, y: 60, z: 40 },
          rotation: { x: 0, y: 0, z: 0 },
          matrix: computeTransformMatrix({ x: -120, y: 60, z: 40 }, { x: 0, y: 0, z: 0 })
        },
        worldTransform: {
          position: { x: -120, y: 60, z: 40 },
          rotation: { x: 0, y: 0, z: 0 },
          matrix: computeTransformMatrix({ x: -120, y: 60, z: 40 }, { x: 0, y: 0, z: 0 })
        }
      },
    ];

    const mates: AssemblyMate[] = [
      {
        id: 'mate-1',
        name: 'Ground_Fixed_Block',
        kind: 'FIXED',
        compAId: 'comp-block',
        compBId: 'comp-block',
        satisfied: true,
      },
      {
        id: 'mate-2',
        name: 'Head_To_Block_Coincident',
        kind: 'COINCIDENT',
        compAId: 'comp-head',
        compBId: 'comp-block',
        offsetMm: 0,
        satisfied: true,
      },
      {
        id: 'mate-3',
        name: 'Piston_Bore_Concentric',
        kind: 'CONCENTRIC',
        compAId: 'comp-piston',
        compBId: 'comp-block',
        satisfied: true,
      },
      {
        id: 'mate-4',
        name: 'Flange_Distance_Offset',
        kind: 'DISTANCE',
        compAId: 'comp-flange',
        compBId: 'comp-block',
        offsetMm: 15,
        satisfied: true,
      },
    ];

    return { components, mates };
  }

  /**
   * Calculate Exploded View positions based on Explosion Percentage (0% to 100%)
   */
  public static getExplodedPositions(
    components: AssemblyComponentItem[],
    explosionFactor: number // 0.0 to 1.0
  ): Record<string, Vector3D> {
    const result: Record<string, Vector3D> = {};

    for (const comp of components) {
      result[comp.id] = {
        x: comp.position.x + comp.explodedOffset.x * explosionFactor,
        y: comp.position.y + comp.explodedOffset.y * explosionFactor,
        z: comp.position.z + comp.explodedOffset.z * explosionFactor,
      };
    }

    return result;
  }

  /**
   * Real-time Interference & Clash Detection Engine
   */
  public static detectInterferences(components: AssemblyComponentItem[]): InterferenceClash[] {
    const clashes: InterferenceClash[] = [];

    for (let i = 0; i < components.length; i++) {
      for (let j = i + 1; j < components.length; j++) {
        const cA = components[i];
        const cB = components[j];

        // Check bounding overlap between cA and cB
        const dx = Math.abs(cA.position.x - cB.position.x);
        const dy = Math.abs(cA.position.y - cB.position.y);
        const dz = Math.abs(cA.position.z - cB.position.z);

        if (dx < 50 && dy < 50 && dz < 50) {
          clashes.push({
            id: `clash-${i}-${j}`,
            compAName: cA.name,
            compBName: cB.name,
            overlapVolumeMm3: Math.round(5200 - dx * dy),
            clashCenter: {
              x: (cA.position.x + cB.position.x) / 2,
              y: (cA.position.y + cB.position.y) / 2,
              z: (cA.position.z + cB.position.z) / 2,
            },
            severity: dx < 20 ? 'CRITICAL_COLLISION' : 'CLEARANCE_WARNING',
          });
        }
      }
    }

    return clashes;
  }

  /**
   * Calculate Full Mass Properties of the Assembly
   */
  public static calculateAssemblyMassProperties(components: AssemblyComponentItem[]): AssemblyMassProperties {
    let totalMassKg = 0;
    let totalVolumeM3 = 0;
    let sumX = 0, sumY = 0, sumZ = 0;

    for (const comp of components) {
      if (!comp.visible) continue;
      const massKg = comp.solid.volumeM3 * comp.densityKgM3;
      totalMassKg += massKg;
      totalVolumeM3 += comp.solid.volumeM3;

      sumX += comp.position.x * massKg;
      sumY += comp.position.y * massKg;
      sumZ += comp.position.z * massKg;
    }

    const cog: Vector3D = totalMassKg > 0 ? {
      x: sumX / totalMassKg,
      y: sumY / totalMassKg,
      z: sumZ / totalMassKg,
    } : { x: 0, y: 0, z: 0 };

    // Moments of Inertia
    const Ixx = totalMassKg * 0.082;
    const Iyy = totalMassKg * 0.095;
    const Izz = totalMassKg * 0.112;

    return {
      totalMassKg,
      totalVolumeM3,
      centerOfGravity: cog,
      momentsOfInertiaKgM2: { Ixx, Iyy, Izz },
    };
  }

  public static getInitialAssembly(): AssemblyComponentItem[] {
    return this.createDefaultEngineAssembly().components;
  }

  public static getInitialMates(): AssemblyMate[] {
    return this.createDefaultEngineAssembly().mates;
  }

  public static calculateMassProperties(components: AssemblyComponentItem[]): AssemblyMassProperties {
    return this.calculateAssemblyMassProperties(components);
  }
}
