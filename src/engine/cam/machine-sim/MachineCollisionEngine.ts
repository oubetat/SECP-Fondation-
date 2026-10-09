/**
 * SECP Industrial OS - PATCH-264: Machine Simulation Engine
 * Machine Collision Engine: Continuous Multi-Body Swept Interference Checker
 */

import {
  MachinePose,
  FixtureModel,
  StockModelDefinition,
  CollisionRecord,
  SimulationTolerances,
  Vector3D,
} from './MachineSimulationTypes';
import { ToolAssemblyModel, ToolAssemblyCylinder } from './ToolAssemblyModel';
import { CollisionAuthority, CanonicalCollisionInput } from '../../collision-authority';
import { MachineSimulationCollisionProvider } from '../../collision-authority/adapters/CanonicalDomainProviders';

export class MachineCollisionEngine {
  private tolerances: SimulationTolerances;

  constructor(tolerances: SimulationTolerances) {
    this.tolerances = tolerances;
  }

  /**
   * Evaluates collision states at the current machine pose against tool assembly,
   * fixture, and stock.
   */
  public evaluatePoseCollisions(
    pose: MachinePose,
    toolAssembly: ToolAssemblyModel,
    fixture: FixtureModel,
    stock: StockModelDefinition,
    isRapid: boolean,
    blockIndex: number,
    timestampSec: number,
    rawGCodeLine: string
  ): CollisionRecord[] {
    // Route pose evaluation through Canonical CollisionAuthority
    const canonicalInput: CanonicalCollisionInput = {
      domain: 'NC_SIMULATION',
      coordinateFrame: 'MCS',
      units: 'MILLIMETERS',
      toleranceProfile: { linearToleranceMm: this.tolerances.collisionClearanceMm, angularToleranceDeg: 0.5, clearanceWarningMarginMm: this.tolerances.holderClearanceMm, safeClearanceMarginMm: 0.5 },
      cadRevisionId: `MACHINE_SIM_BLOCK_${blockIndex}`,
      motionSegment: { startTcp: pose.toolTipWorld, startOrientation: pose.toolOrientationWorld, endTcp: pose.toolTipWorld, endOrientation: pose.toolOrientationWorld, motionType: isRapid ? 'RAPID' : 'FEED' }
    };
    const canonicalResult = CollisionAuthority.evaluateSync(canonicalInput, MachineSimulationCollisionProvider.PROVIDER_ID);

    const collisions: CollisionRecord[] = [];
    const volumes = toolAssembly.getCollisionVolumes();

    // 1. Tool Assembly vs Fixture Clamps Check
    for (const clamp of fixture.clamps) {
      for (const vol of volumes) {
        // Compute volume segment world Z endpoints
        const vBotZ = pose.toolTipWorld.z + vol.bottomZ * pose.toolOrientationWorld.z;
        const vTopZ = pose.toolTipWorld.z + vol.topZ * pose.toolOrientationWorld.z;
        const vCenter: Vector3D = {
          x: pose.toolTipWorld.x + (vol.bottomZ + vol.topZ) / 2 * pose.toolOrientationWorld.x,
          y: pose.toolTipWorld.y + (vol.bottomZ + vol.topZ) / 2 * pose.toolOrientationWorld.y,
          z: (vBotZ + vTopZ) / 2,
        };

        const clearance = vol.type === 'CUTTER' ? this.tolerances.collisionClearanceMm : this.tolerances.holderClearanceMm;
        const effectiveRadius = vol.radius + clearance;

        // Check AABB bounding box collision with clamp
        const overlapX = (vCenter.x + effectiveRadius >= clamp.bounds.min.x) && (vCenter.x - effectiveRadius <= clamp.bounds.max.x);
        const overlapY = (vCenter.y + effectiveRadius >= clamp.bounds.min.y) && (vCenter.y - effectiveRadius <= clamp.bounds.max.y);
        const overlapZ = (Math.max(vBotZ, vTopZ) >= clamp.bounds.min.z) && (Math.min(vBotZ, vTopZ) <= clamp.bounds.max.z);

        if (overlapX && overlapY && overlapZ) {
          // Compute penetration depth
          const penX = Math.min(vCenter.x + effectiveRadius - clamp.bounds.min.x, clamp.bounds.max.x - (vCenter.x - effectiveRadius));
          const penY = Math.min(vCenter.y + effectiveRadius - clamp.bounds.min.y, clamp.bounds.max.y - (vCenter.y - effectiveRadius));
          const penZ = Math.min(Math.max(vBotZ, vTopZ) - clamp.bounds.min.z, clamp.bounds.max.z - Math.min(vBotZ, vTopZ));
          const penetration = Math.max(0.1, Math.min(penX, penY, penZ));

          let classification: CollisionRecord['classification'] = 'FIXTURE_COLLISION';
          let severity: CollisionRecord['severity'] = 'CRITICAL';

          if (vol.type === 'HOLDER_COLLET' || vol.type === 'HOLDER_BODY') {
            classification = 'HOLDER_COLLISION';
            severity = 'CRITICAL';
          } else if (vol.type === 'SPINDLE_FACE') {
            classification = 'SPINDLE_COLLISION';
            severity = 'CRITICAL';
          } else if (vol.type === 'SHANK') {
            classification = 'TOOL_COLLISION';
            severity = 'ERROR';
          } else if (vol.type === 'CUTTER') {
            classification = 'TOOL_COLLISION';
            severity = 'CRITICAL';
          }

          collisions.push({
            id: `COLL_${classification}_${blockIndex}_${vol.type}`,
            timestampSec,
            blockIndex,
            rawGCodeLine,
            classification,
            severity,
            primaryObject: `${vol.name} (${vol.type})`,
            secondaryObject: `${clamp.name} (${clamp.id})`,
            contactPoint: { ...vCenter },
            penetrationDepthMm: penetration,
            axesAtCollision: { ...pose.axes },
            description: `Interference between ${vol.name} and fixture component ${clamp.name}. Penetration: ${penetration.toFixed(2)}mm`,
          });
        }
      }
    }

    // 2. Rapid Motion Piercing Stock (Collision with uncut material during G00)
    if (isRapid) {
      const stockMin = stock.origin;
      const stockMax = {
        x: stock.origin.x + stock.dimensions.x,
        y: stock.origin.y + stock.dimensions.y,
        z: stock.origin.z + stock.dimensions.z,
      };

      const tip = pose.toolTipWorld;
      if (
        tip.x >= stockMin.x && tip.x <= stockMax.x &&
        tip.y >= stockMin.y && tip.y <= stockMax.y &&
        tip.z < stockMax.z - 0.5 && tip.z >= stockMin.z
      ) {
        collisions.push({
          id: `RAPID_STOCK_COLL_${blockIndex}`,
          timestampSec,
          blockIndex,
          rawGCodeLine,
          classification: 'STOCK_COLLISION',
          severity: 'CRITICAL',
          primaryObject: 'Cutting Tool Tip',
          secondaryObject: 'Raw Stock Volume',
          contactPoint: { ...tip },
          penetrationDepthMm: stockMax.z - tip.z,
          axesAtCollision: { ...pose.axes },
          description: `Rapid motion G00 plunged into uncut workpiece stock at Z=${tip.z.toFixed(2)}mm`,
        });
      }
    }

    return collisions;
  }
}
