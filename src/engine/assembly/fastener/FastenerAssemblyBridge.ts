/**
 * SECP FASTENER ASSEMBLY BRIDGE (PATCH-226)
 * 
 * Bridges parametric fasteners, bolted joint stacks, and fastener patterns into
 * the SECP Assembly Engine:
 * - Creates AssemblyPartDefinitions and AssemblyComponents
 * - Creates Concentric and Coincident/Mate assembly constraints
 * - Generates Bolt Circle Pattern (PCD) and Linear array instances
 * - Aggregates Bill of Materials (BOM) rollups by standard, size, material, finish
 */

import {
  AssemblyComponent,
  AssemblyConstraint,
  AssemblyPartDefinition
} from '../ProductionAssemblyTypes';
import {
  BoltedJointStack,
  FastenerBOMItem,
  FastenerPattern,
  FastenerSpecification
} from './FastenerTypes';
import { FastenerGeometryEngine } from './FastenerGeometryEngine';

export class FastenerAssemblyBridge {
  /**
   * Converts a FastenerSpecification into an AssemblyPartDefinition
   */
  public static toAssemblyPartDefinition(fastener: FastenerSpecification): AssemblyPartDefinition {
    const brep = fastener.brepSolid || FastenerGeometryEngine.generateBRepSolid(
      fastener.category,
      fastener.headType,
      fastener.driveType,
      fastener.dimensions,
      fastener.thread,
      fastener.material
    );

    return {
      partId: fastener.id,
      name: `${fastener.standardCode} ${fastener.partNumber}`,
      revision: fastener.revision,
      mass_kg: (brep.mass_grams || 25) / 1000,
      materialId: fastener.material.id,
      centerOfMass: brep.centerOfGravity_mm,
      inertiaTensor: {
        Ixx: 1e-5, Ixy: 0, Ixz: 0,
        Iyy: 1e-5, Iyz: 0,
        Izz: 1e-5
      },
      geometry: {
        type: 'BREP_SOLID',
        featureTree: fastener.featureTree as any,
        vertices: Array.from(brep.vertices3D),
        indices: Array.from(brep.indices3D),
        normals: Array.from(brep.normals3D)
      }
    };
  }

  /**
   * Creates standard assembly mounting constraints for a fastener in a hole
   */
  public static createMountingConstraints(
    fastenerInstanceId: string,
    targetComponentId: string,
    holeCenterZ_mm: number = 0
  ): AssemblyConstraint[] {
    return [
      {
        constraintId: `CST-CONCENTRIC-${fastenerInstanceId}`,
        name: 'Fastener Shank to Hole Axis Alignment',
        assemblyId: 'MAIN-ASSEMBLY',
        type: 'CONCENTRIC',
        componentA: fastenerInstanceId,
        componentB: targetComponentId,
        geometryRefA: {
          componentId: fastenerInstanceId,
          entityType: 'AXIS',
          entityId: 'SHANK_AXIS',
          subIndex: 0
        },
        geometryRefB: {
          componentId: targetComponentId,
          entityType: 'AXIS',
          entityId: 'HOLE_AXIS',
          subIndex: 0
        },
        parameters: {
          aligned: true,
          offset: 0
        },
        status: 'SATISFIED',
        solverError: 0,
        revision: 1
      },
      {
        constraintId: `CST-MATE-SEAT-${fastenerInstanceId}`,
        name: 'Fastener Underhead Bearing Face Mate',
        assemblyId: 'MAIN-ASSEMBLY',
        type: 'MATE',
        componentA: fastenerInstanceId,
        componentB: targetComponentId,
        geometryRefA: {
          componentId: fastenerInstanceId,
          entityType: 'FACE',
          entityId: 'UNDERHEAD_SEATING_FACE',
          subIndex: 0
        },
        geometryRefB: {
          componentId: targetComponentId,
          entityType: 'FACE',
          entityId: 'PLATE_TOP_FACE',
          subIndex: 0
        },
        parameters: {
          offset: holeCenterZ_mm
        },
        status: 'SATISFIED',
        solverError: 0,
        revision: 1
      }
    ];
  }

  /**
   * Generates a Bolt Circle (PCD) Pattern of Fastener Instances
   */
  public static generateBoltCirclePattern(
    sourceFastener: FastenerSpecification,
    instanceCount: number,
    pitchCircleDiameter_mm: number,
    startAngle_deg: number = 0
  ): FastenerPattern {
    const patternId = `PAT-PCD-${Math.random().toString(36).substring(2, 9)}`;
    const radius = pitchCircleDiameter_mm / 2;
    const angularStep = 360 / instanceCount;
    const instances: FastenerPattern['instancePositions'] = [];

    for (let i = 0; i < instanceCount; i++) {
      const angleDeg = startAngle_deg + i * angularStep;
      const angleRad = (angleDeg * Math.PI) / 180;
      const x = parseFloat((radius * Math.cos(angleRad)).toFixed(3));
      const y = parseFloat((radius * Math.sin(angleRad)).toFixed(3));

      instances.push({
        instanceIndex: i,
        position: { x, y, z: 0 },
        rotationAngle_deg: angleDeg
      });
    }

    return {
      patternId,
      type: 'CIRCULAR_PCD',
      sourceFastenerId: sourceFastener.id,
      instanceCount,
      pitchCircleDiameter_PCD_mm: pitchCircleDiameter_mm,
      startAngle_deg,
      angularSpacing_deg: angularStep,
      instancePositions: instances
    };
  }

  /**
   * Builds an aggregated Bill of Materials (BOM) for fasteners in an assembly
   */
  public static buildFastenerBOM(
    fasteners: Array<{ fastener: FastenerSpecification; quantity: number }>
  ): FastenerBOMItem[] {
    const bomItems: FastenerBOMItem[] = [];
    const grouped = new Map<string, { fastener: FastenerSpecification; qty: number }>();

    for (const item of fasteners) {
      const key = `${item.fastener.standardCode}_${item.fastener.partNumber}_${item.fastener.material.name}_${item.fastener.surfaceTreatment.treatment}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.qty += item.quantity;
      } else {
        grouped.set(key, { fastener: item.fastener, qty: item.quantity });
      }
    }

    let itemNum = 1;
    for (const entry of Array.from(grouped.values())) {
      const f = entry.fastener;
      const unitMass = f.brepSolid?.mass_grams || 25;
      const totalMass = unitMass * entry.qty;

      const sizeStr = f.category === 'PLAIN_WASHER' || f.category === 'LOCK_WASHER'
        ? `M${f.dimensions.nominalDiameter_d_mm} Washer (Ø${f.dimensions.washerInsideDiameter_d1_mm || f.dimensions.nominalDiameter_d_mm}×Ø${f.dimensions.washerOutsideDiameter_d2_mm || 16})`
        : f.category === 'HEX_NUT' || f.category === 'LOCK_NUT'
        ? `M${f.dimensions.nominalDiameter_d_mm}×${f.thread.pitch_P_mm} Nut`
        : `M${f.dimensions.nominalDiameter_d_mm}×${f.dimensions.overallLength_L_mm}`;

      bomItems.push({
        itemNumber: itemNum++,
        partNumber: f.partNumber,
        standardCode: f.standardCode,
        description: `${f.standardCode} ${f.category.replace(/_/g, ' ')}`,
        category: f.category,
        nominalSize: sizeStr,
        materialName: f.material.name,
        surfaceFinish: f.surfaceTreatment.name,
        quantity: entry.qty,
        unitMass_grams: parseFloat(unitMass.toFixed(2)),
        totalMass_grams: parseFloat(totalMass.toFixed(2)),
        torqueSpecification_Nm: f.mechanical.tighteningTorque_Ma_Nm || 0,
        status: 'APPROVED'
      });
    }

    return bomItems;
  }
}
